/**
 * `SimulatorBackend` — noiseless state-vector quantum simulator
 * (Section 9 of the specification).
 *
 * Gate application uses **subspace iteration**: per-gate matrices
 * are `2^k × 2^k` where `k` is the gate's operand arity, and are
 * applied to the `2^n`-dimensional state vector by iterating over
 * all `2^(n-k)` context (non-target) bit patterns and multiplying
 * the `2^k`-dimensional sub-vector through the gate matrix.
 *
 * Critically, the simulator never materializes the full
 * `2^n × 2^n` matrix of the circuit. Gate matrices are obtained
 * individually via `materializeGate` from `circuit.ts`, then
 * applied to the state vector directly.
 */

import { Complex } from "./complex.ts";
import type { Matrix } from "./matrix.ts";
import type { QuantumCircuit } from "./circuit.ts";
import { materializeGate } from "./circuit.ts";
import type {
  BackendConfiguration,
  ClassicalExpr,
  ExecutionResult,
  Instruction,
  StateSpec,
  Target,
} from "./types.ts";
import type { Backend, Executable } from "./backend.ts";
import { DEFAULT_SHOTS, makeBasicTarget } from "./backend.ts";

// =============================================================================
// SimulatorExecutable
// =============================================================================

/**
 * Compiled payload for `SimulatorBackend`. Since the simulator
 * supports every gate in the catalog and has no connectivity
 * constraints, compilation is a pass-through: just wrap the
 * circuit and record the shot count.
 */
export interface SimulatorExecutable extends Executable {
  readonly compiledCircuit: QuantumCircuit;
  readonly target: Target;
  readonly numShots: number;
}

// =============================================================================
// SimulatorBackend
// =============================================================================

/**
 * Noiseless state-vector simulator backend. Supports every gate in
 * Tiers 0–14, mid-circuit measurement, reset, and the full
 * classical control-flow surface of the Expansion API.
 *
 * `couplingMap` is `null` (all-to-all). The default `numQubits` is
 * a soft limit for resource guards; simulation memory grows as
 * `O(2^n)` so the practical ceiling is around 25–30 qubits.
 */
export class SimulatorBackend implements Backend {
  readonly name: string = "simulator";
  readonly numQubits: number;
  readonly basisGates: readonly string[];
  readonly couplingMap: null = null;
  readonly defaultShots: number;

  constructor(options: {
    numQubits?: number;
    defaultShots?: number;
  } = {}) {
    this.numQubits = options.numQubits ?? 30;
    this.defaultShots = options.defaultShots ?? DEFAULT_SHOTS;
    // The simulator supports every gate; we enumerate the basis
    // as a concrete list for Backend-contract introspection only.
    this.basisGates = ALL_SIMULATOR_GATES;
  }

  /** Return the backend configuration record. */
  get configuration(): BackendConfiguration {
    return {
      name: this.name,
      numQubits: this.numQubits,
      basisGates: this.basisGates,
      couplingMap: null,
    };
  }

  /**
   * Compile a circuit for this backend. Since the simulator
   * supports every gate and has no coupling constraints, this is
   * a trivial wrap.
   */
  transpileAndPackage(
    circuit: QuantumCircuit,
    shots: number = this.defaultShots,
  ): SimulatorExecutable {
    return {
      compiledCircuit: circuit,
      target: makeBasicTarget(this.numQubits, this.basisGates, null),
      numShots: shots,
    };
  }

  /**
   * Execute a `SimulatorExecutable`. Runs the circuit `shots`
   * times and aggregates the measurement outcomes into an
   * `ExecutionResult` histogram (bitstring → percentage 0–100).
   *
   * If the circuit contains no mid-circuit measurements, the
   * simulator runs the unitary evolution only once and then
   * samples `shots` outcomes from the Born-rule distribution.
   * Otherwise it runs the full simulation `shots` times
   * independently.
   */
  execute(
    executable: Executable,
    shots?: number,
  ): ExecutionResult {
    const simExe = executable as SimulatorExecutable;
    const numShots = shots ?? simExe.numShots;
    const circuit = simExe.compiledCircuit;
    const counts = new Map<string, number>();
    // Detect mid-circuit measurements (any measure followed by a
    // non-measurement instruction that depends on the result).
    const hasMidCircuitMeasure = detectMidCircuitMeasurement(circuit);
    if (!hasMidCircuitMeasure && countMeasurements(circuit) > 0) {
      // Single-shot sampling path.
      const { state, classicalMemory: _cm } = runUnitaryPortion(circuit);
      const terminalMeasurements = collectTerminalMeasurements(circuit);
      sampleTerminalMeasurements(
        state,
        circuit,
        terminalMeasurements,
        numShots,
        counts,
      );
    } else if (countMeasurements(circuit) === 0) {
      // No measurements at all: every shot produces "000...0".
      const bitstring = "0".repeat(Math.max(1, totalClbits(circuit) || 1));
      counts.set(bitstring, numShots);
    } else {
      // Mid-circuit measurement path: run full simulation per shot.
      for (let s = 0; s < numShots; s++) {
        const result = runFullSimulation(circuit);
        const bitstring = formatBitstring(result.classicalMemory, circuit);
        counts.set(bitstring, (counts.get(bitstring) ?? 0) + 1);
      }
    }
    // Convert counts to percentages.
    const out: Record<string, number> = {};
    for (const [bs, c] of counts) {
      out[bs] = (c / numShots) * 100;
    }
    return out;
  }

  /**
   * Compute the exact state vector of `circuit` after unitary
   * evolution. Rejects circuits containing non-unitary instructions
   * (measurement, reset, classical control flow dependent on
   * sampled data). Useful for tests and transpiler equivalence
   * checks.
   */
  getStateVector(circuit: QuantumCircuit): Complex[] {
    for (const instr of circuit.instructions) {
      if (
        instr.kind === "measure" ||
        instr.kind === "reset" ||
        instr.kind === "if" ||
        instr.kind === "for" ||
        instr.kind === "while" ||
        instr.kind === "switch"
      ) {
        throw new Error(
          `getStateVector: non-unitary instruction '${instr.kind}' not allowed`,
        );
      }
    }
    const { state } = runUnitaryPortion(circuit);
    return state;
  }
}

// =============================================================================
// State-vector simulation core
// =============================================================================

/**
 * Build the initial `|0...0⟩` state vector for an `n`-qubit system.
 */
function initialState(n: number): Complex[] {
  const dim = 1 << n;
  const state: Complex[] = new Array(dim);
  for (let i = 0; i < dim; i++) state[i] = Complex.ZERO;
  state[0] = Complex.ONE;
  return state;
}

/**
 * Apply a `k`-qubit gate matrix `U` to the state vector on target
 * arg positions `targets` (MSB-first local ordering relative to
 * `U`'s own indexing). The state vector has `n` qubits total;
 * `targets[i]` gives the *global* qubit position (also MSB-first
 * in the state vector index) to which `U`'s i-th argument maps.
 *
 * This is the Section 9 subspace-iteration inner loop. For each
 * "context" bit pattern on the non-target qubits, we apply the
 * `2^k × 2^k` matrix to the corresponding length-`2^k` subvector.
 */
function applyGateInPlace(
  state: Complex[],
  U: Matrix,
  targets: readonly number[],
  n: number,
): void {
  const k = targets.length;
  const dimU = 1 << k;
  if (U.rows !== dimU || U.cols !== dimU) {
    throw new Error(
      `applyGateInPlace: gate is ${U.rows}×${U.cols} but targets has ${k} positions`,
    );
  }
  if (k === 0) {
    // Zero-qubit gate: multiply entire state by U[0,0].
    const scalar = U.get(0, 0);
    for (let i = 0; i < state.length; i++) state[i] = state[i].mul(scalar);
    return;
  }
  // Target bit positions in the n-qubit state vector index.
  // Under Section 2, gate argument `p` (with MSB-first gate index bit `k-1-p`)
  // corresponds to state-vector bit `(n-1-targets[p])`.
  const targetBits = targets.map((t) => n - 1 - t);
  const isTarget = new Array(n).fill(false);
  for (const b of targetBits) isTarget[b] = true;
  const otherBits: number[] = [];
  for (let b = 0; b < n; b++) if (!isTarget[b]) otherBits.push(b);
  const numOthers = otherBits.length;
  const dimOther = 1 << numOthers;

  // Workspace for the local sub-vector in the gate's basis order.
  const localIn: Complex[] = new Array(dimU);
  const localOut: Complex[] = new Array(dimU);

  // For each context, extract → multiply → write back.
  for (let ctx = 0; ctx < dimOther; ctx++) {
    // Base index with context bits set, target bits zero.
    let baseIdx = 0;
    for (let i = 0; i < numOthers; i++) {
      const bit = (ctx >> (numOthers - 1 - i)) & 1;
      if (bit) baseIdx |= 1 << otherBits[i];
    }
    // Extract the local sub-vector, indexed in gate-local MSB-first order.
    for (let j = 0; j < dimU; j++) {
      let idx = baseIdx;
      for (let t = 0; t < k; t++) {
        const bit = (j >> (k - 1 - t)) & 1;
        if (bit) idx |= 1 << targetBits[t];
      }
      localIn[j] = state[idx];
    }
    // Matrix-vector multiply.
    for (let r = 0; r < dimU; r++) {
      let sumRe = 0;
      let sumIm = 0;
      for (let c = 0; c < dimU; c++) {
        const a = U.get(r, c);
        const b = localIn[c];
        sumRe += a.re * b.re - a.im * b.im;
        sumIm += a.re * b.im + a.im * b.re;
      }
      localOut[r] = new Complex(sumRe, sumIm);
    }
    // Write back.
    for (let j = 0; j < dimU; j++) {
      let idx = baseIdx;
      for (let t = 0; t < k; t++) {
        const bit = (j >> (k - 1 - t)) & 1;
        if (bit) idx |= 1 << targetBits[t];
      }
      state[idx] = localOut[j];
    }
  }
}

/**
 * Multiply every amplitude by a scalar in place. Used for zero-qubit
 * phase instructions and for renormalization after measurement.
 */
function scaleInPlace(state: Complex[], scalar: Complex): void {
  for (let i = 0; i < state.length; i++) state[i] = state[i].mul(scalar);
}

/**
 * Simulate a Born-rule measurement of a single qubit, collapsing
 * the state. Returns the classical outcome (0 or 1) and mutates
 * `state` in place.
 */
function measureQubit(
  state: Complex[],
  qubit: number,
  n: number,
): 0 | 1 {
  const bit = n - 1 - qubit; // state-vector bit position
  // Compute P(0) = sum |amp|^2 for indices where bit is 0.
  let p0 = 0;
  for (let i = 0; i < state.length; i++) {
    if (((i >> bit) & 1) === 0) {
      const a = state[i];
      p0 += a.re * a.re + a.im * a.im;
    }
  }
  const outcome: 0 | 1 = Math.random() < p0 ? 0 : 1;
  // Collapse: zero out inconsistent amplitudes, renormalize consistent ones.
  let norm = 0;
  for (let i = 0; i < state.length; i++) {
    const thisBit = (i >> bit) & 1;
    if (thisBit !== outcome) {
      state[i] = Complex.ZERO;
    } else {
      norm += state[i].re * state[i].re + state[i].im * state[i].im;
    }
  }
  if (norm > 0) {
    const inv = 1 / Math.sqrt(norm);
    for (let i = 0; i < state.length; i++) {
      if (((i >> bit) & 1) === outcome) state[i] = state[i].scale(inv);
    }
  }
  return outcome;
}

// =============================================================================
// Classical memory
// =============================================================================

/**
 * Classical memory: a flat bit array indexed by `Instruction.clbits`.
 * A second map keeps integer values for variables declared via
 * `declareClassicalVar` / assignment. Classical register lookups
 * compose bits into integer register values (little-endian).
 */
interface ClassicalState {
  bits: number[]; // length = totalClbits
  vars: Map<string, number>;
}

function newClassicalState(totalBits: number): ClassicalState {
  return {
    bits: new Array(totalBits).fill(0),
    vars: new Map(),
  };
}

/** Read the integer value represented by a classical register's bits. */
function readRegister(
  cs: ClassicalState,
  flatOffset: number,
  size: number,
): number {
  let v = 0;
  for (let i = 0; i < size; i++) {
    if (cs.bits[flatOffset + i] === 1) v |= 1 << i;
  }
  return v;
}

// =============================================================================
// Classical expression evaluator
// =============================================================================

/**
 * Evaluate a classical expression against the current classical
 * state. Supports literals, identifier lookups (registers +
 * variables), builtin constants, and the full operator surface.
 *
 * Throws for expressions containing `measure-expr` (they must be
 * folded during instruction execution, not classical evaluation).
 */
function evalClassical(
  expr: ClassicalExpr,
  cs: ClassicalState,
  circuit: QuantumCircuit,
): number {
  switch (expr.kind) {
    case "int-literal":
    case "float-literal":
      return expr.value;
    case "imaginary-literal":
      throw new Error("evalClassical: imaginary literal not supported");
    case "bool-literal":
      return expr.value ? 1 : 0;
    case "bitstring-literal": {
      // Interpret as unsigned integer (left = MSB).
      let v = 0;
      for (const ch of expr.value) {
        v = (v << 1) | (ch === "1" ? 1 : 0);
      }
      return v;
    }
    case "duration-literal":
      return expr.value;
    case "builtin-constant":
      switch (expr.name) {
        case "pi":
          return Math.PI;
        case "tau":
          return 2 * Math.PI;
        case "euler":
          return Math.E;
        case "im":
          throw new Error("evalClassical: 'im' constant not a real value");
      }
      break;
    case "identifier": {
      // Look up register or variable.
      if (cs.vars.has(expr.name)) return cs.vars.get(expr.name)!;
      const reg = circuit.getClassicalRegister(expr.name);
      if (reg) return readRegister(cs, reg.flatOffset, reg.size);
      throw new Error(`evalClassical: unknown identifier '${expr.name}'`);
    }
    case "physical-qubit":
      throw new Error(
        "evalClassical: physical qubit reference is not a classical value",
      );
    case "unary": {
      const v = evalClassical(expr.operand, cs, circuit);
      switch (expr.op) {
        case "-":
          return -v;
        case "+":
          return v;
        case "!":
          return v === 0 ? 1 : 0;
        case "~":
          return ~v;
      }
      break;
    }
    case "binary": {
      const l = evalClassical(expr.left, cs, circuit);
      const r = evalClassical(expr.right, cs, circuit);
      switch (expr.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return l / r;
        case "%":
          return l - Math.floor(l / r) * r;
        case "**":
          return Math.pow(l, r);
        case "&":
          return l & r;
        case "|":
          return l | r;
        case "^":
          return l ^ r;
        case "<<":
          return l << r;
        case ">>":
          return l >> r;
        case "&&":
          return (l !== 0 && r !== 0) ? 1 : 0;
        case "||":
          return (l !== 0 || r !== 0) ? 1 : 0;
        case "<":
          return l < r ? 1 : 0;
        case "<=":
          return l <= r ? 1 : 0;
        case ">":
          return l > r ? 1 : 0;
        case ">=":
          return l >= r ? 1 : 0;
        case "==":
          return l === r ? 1 : 0;
        case "!=":
          return l !== r ? 1 : 0;
      }
      break;
    }
    case "paren":
      return evalClassical(expr.inner, cs, circuit);
    case "cast":
      return evalClassical(expr.value, cs, circuit);
    case "sizeof":
      throw new Error(
        "evalClassical: sizeof not supported in runtime expressions",
      );
    case "real-part":
    case "imag-part":
      return evalClassical(expr.operand, cs, circuit);
    case "call": {
      const args = expr.args.map((a) => evalClassical(a, cs, circuit));
      return callBuiltinFunction(expr.callee, args);
    }
    case "index": {
      // Scalar bit indexing into a classical register or integer-valued
      // variable: `c[i]` selects bit `i` (LSB-on-right, matching how
      // `readRegister` assembles the value). Only a single selector is
      // supported here — multi-dimensional array indexing is not.
      if (expr.selectors.length !== 1) {
        throw new Error(
          "evalClassical: multi-dimensional index not supported",
        );
      }
      const base = evalClassical(expr.base, cs, circuit);
      const idx = evalClassical(expr.selectors[0], cs, circuit);
      return (base >> idx) & 1;
    }
    case "range":
    case "array-literal":
    case "set-literal":
    case "concat":
      throw new Error(`evalClassical: ${expr.kind} not a scalar expression`);
    case "measure-expr":
      throw new Error(
        "evalClassical: measure expression must be handled at instruction level",
      );
    case "duration-of":
      throw new Error("evalClassical: durationof not yet supported");
  }
  throw new Error(`evalClassical: unhandled expression kind`);
}

function callBuiltinFunction(name: string, args: number[]): number {
  switch (name) {
    case "sin":
      return Math.sin(args[0]);
    case "cos":
      return Math.cos(args[0]);
    case "tan":
      return Math.tan(args[0]);
    case "arcsin":
      return Math.asin(args[0]);
    case "arccos":
      return Math.acos(args[0]);
    case "arctan":
      return Math.atan(args[0]);
    case "sqrt":
      return Math.sqrt(args[0]);
    case "exp":
      return Math.exp(args[0]);
    case "log":
      return Math.log(args[0]);
    case "ceiling":
      return Math.ceil(args[0]);
    case "floor":
      return Math.floor(args[0]);
    case "mod":
      return args[0] - Math.floor(args[0] / args[1]) * args[1];
    case "pow":
      return Math.pow(args[0], args[1]);
    case "popcount": {
      let n = args[0] | 0;
      let c = 0;
      while (n) {
        c += n & 1;
        n >>>= 1;
      }
      return c;
    }
    case "rotl": {
      const v = args[0] | 0;
      const k = (args[1] | 0) & 31;
      return ((v << k) | (v >>> (32 - k))) | 0;
    }
    case "rotr": {
      const v = args[0] | 0;
      const k = (args[1] | 0) & 31;
      return ((v >>> k) | (v << (32 - k))) | 0;
    }
  }
  throw new Error(`evalClassical: unknown builtin '${name}'`);
}

// =============================================================================
// Simulation drivers
// =============================================================================

/** Count total classical bits referenced by a circuit. */
function totalClbits(circuit: QuantumCircuit): number {
  return circuit.numClbits;
}

/** Count measurement instructions, including nested scopes. */
function countMeasurements(circuit: QuantumCircuit): number {
  let count = 0;
  for (const instr of circuit.instructions) {
    if (instr.kind === "measure") count++;
    // Nested scopes.
    const body = instructionBody(instr);
    if (body) count += countMeasurements(body);
  }
  return count;
}

/**
 * Extract a nested body circuit from a control-flow or definition
 * instruction, or null if the instruction has no nested body.
 */
function instructionBody(instr: Instruction): QuantumCircuit | null {
  const p = instr.payload as {
    body?: QuantumCircuit;
    trueBody?: QuantumCircuit;
    falseBody?: QuantumCircuit;
  } | undefined;
  if (!p) return null;
  if (p.body) return p.body;
  if (p.trueBody) return p.trueBody;
  return null;
}

/**
 * Detect whether a circuit has mid-circuit measurements — i.e.,
 * any measurement followed by quantum operations on the same or
 * any qubit. For simplicity, we treat *any* measurement that is
 * not at the end of the instruction list as mid-circuit.
 */
function detectMidCircuitMeasurement(circuit: QuantumCircuit): boolean {
  const n = circuit.instructions.length;
  let lastQuantumIdx = -1;
  for (let i = 0; i < n; i++) {
    const instr = circuit.instructions[i];
    if (
      instr.kind === "gate" || instr.kind === "global-phase" ||
      instr.kind === "reset"
    ) {
      lastQuantumIdx = i;
    }
  }
  for (let i = 0; i < n; i++) {
    const instr = circuit.instructions[i];
    if (instr.kind === "measure" && i < lastQuantumIdx) return true;
    if (
      instr.kind === "if" || instr.kind === "for" || instr.kind === "while" ||
      instr.kind === "switch"
    ) {
      // Any classical control flow with quantum ops inside can trigger mid-circuit paths.
      return true;
    }
    if (instr.kind === "reset") return true;
  }
  return false;
}

/**
 * Collect the terminal measurements from a circuit whose
 * measurements all occur at the end. Returns the list of
 * `{ qubit, flatClbit }` pairs in the order they appear.
 */
function collectTerminalMeasurements(
  circuit: QuantumCircuit,
): { qubit: number; clbit: number | null }[] {
  const out: { qubit: number; clbit: number | null }[] = [];
  for (const instr of circuit.instructions) {
    if (instr.kind === "measure") {
      out.push({
        qubit: instr.qubits[0],
        clbit: instr.clbits.length > 0 ? instr.clbits[0] : null,
      });
    }
  }
  return out;
}

/**
 * Apply a `prepare-state` instruction directly on the state vector.
 *
 * Assumes the target qubits are currently in the |0...0⟩ state
 * (which is true at the start of a circuit or after a reset).
 * For amplitude-vector specs the amplitudes are written into the
 * subspace spanned by the target qubits. For basis/bitstring specs
 * the corresponding X flips are applied.
 */
function applyStatePrepInPlace(
  state: Complex[],
  spec: StateSpec,
  qubits: readonly number[],
  n: number,
): void {
  const k = qubits.length;
  const subDim = 1 << k;

  if (spec.kind === "amplitude-vector") {
    const amps = spec.amplitudes;
    // Iterate over every context (non-target) bit pattern and set
    // the target subspace to the requested amplitudes.
    const dim = state.length; // 2^n
    for (let ctx = 0; ctx < dim; ctx++) {
      // Check that all target qubits in this basis state are 0;
      // only then does this context contribute to the prep.
      let allZero = true;
      for (const q of qubits) {
        if ((ctx >> (n - 1 - q)) & 1) {
          allZero = false;
          break;
        }
      }
      if (!allZero) continue;

      // ctx has all target qubits = 0.  For each sub-index j,
      // compute the full index by setting target bits accordingly,
      // and write amps[j] × (current context amplitude).
      const ctxAmp = state[ctx];
      for (let j = 0; j < subDim; j++) {
        let idx = ctx;
        for (let b = 0; b < k; b++) {
          if ((j >> (k - 1 - b)) & 1) {
            idx |= 1 << (n - 1 - qubits[b]);
          }
        }
        const a = j < amps.length ? amps[j] : Complex.ZERO;
        // Multiply by the context amplitude so this works when the
        // non-target qubits are already in a superposition.
        state[idx] = new Complex(
          ctxAmp.re * a.re - ctxAmp.im * a.im,
          ctxAmp.re * a.im + ctxAmp.im * a.re,
        );
      }
    }
    return;
  }

  if (spec.kind === "basis-state") {
    // Flip qubits corresponding to the set bits of spec.value.
    for (let b = 0; b < k; b++) {
      if ((spec.value >> (k - 1 - b)) & 1) {
        applyXInPlace(state, qubits[b], n);
      }
    }
    return;
  }

  if (spec.kind === "bitstring-state") {
    // Flip qubits where the bitstring has '1'.
    for (let b = 0; b < k; b++) {
      if (spec.bits[b] === "1") {
        applyXInPlace(state, qubits[b], n);
      }
    }
    return;
  }
}

/** Apply a Pauli-X gate on a single qubit in-place. */
function applyXInPlace(state: Complex[], qubit: number, n: number): void {
  const dim = state.length;
  const bit = n - 1 - qubit;
  const mask = 1 << bit;
  for (let i = 0; i < dim; i++) {
    if (!(i & mask)) {
      const j = i | mask;
      const tmp = state[i];
      state[i] = state[j];
      state[j] = tmp;
    }
  }
}

/**
 * Run the unitary portion of a circuit (ignoring measurements and
 * resets) to produce a final state vector. Used by both
 * `getStateVector` and the fast single-shot sampling path.
 */
function runUnitaryPortion(
  circuit: QuantumCircuit,
): { state: Complex[]; classicalMemory: ClassicalState } {
  const n = Math.max(1, circuit.numQubits);
  const state = initialState(n);
  const cs = newClassicalState(circuit.numClbits);
  // Apply the scope-level globalPhase up front.
  if (!isZeroPhase(circuit.globalPhase)) {
    const theta = circuit.globalPhase.evaluate();
    scaleInPlace(state, Complex.exp(theta));
  }
  for (const instr of circuit.instructions) {
    if (instr.kind === "gate") {
      const U = materializeGate(instr);
      applyGateInPlace(state, U, instr.qubits, n);
    } else if (instr.kind === "global-phase") {
      const theta = instr.parameters?.[0]?.evaluate() ?? 0;
      scaleInPlace(state, Complex.exp(theta));
    } else if (instr.kind === "measure") {
      // Skip; handled by the caller (sampling path).
      continue;
    } else if (instr.kind === "prepare-state" || instr.kind === "initialize") {
      const spec = (instr.payload as { state: StateSpec }).state;
      const qubits = instr.qubits;
      applyStatePrepInPlace(state, spec, qubits, n);
    } else if (
      instr.kind === "barrier" ||
      instr.kind === "delay" ||
      instr.kind === "comment" ||
      instr.kind === "pragma" ||
      instr.kind === "annotation-statement" ||
      instr.kind === "classical-declaration" ||
      instr.kind === "const-declaration" ||
      instr.kind === "input-declaration" ||
      instr.kind === "output-declaration" ||
      instr.kind === "alias-declaration" ||
      instr.kind === "legacy-register-declaration"
    ) {
      continue;
    } else {
      throw new Error(
        `runUnitaryPortion: unsupported instruction kind '${instr.kind}' in unitary-only path`,
      );
    }
  }
  return { state, classicalMemory: cs };
}

/**
 * Sample `numShots` measurement outcomes from a finalized state
 * vector assuming all measurements appear at the end of the
 * circuit. Distributes samples into `counts` keyed by bitstring
 * (one character per classical bit in the circuit's registered
 * classical bit space).
 */
function sampleTerminalMeasurements(
  state: Complex[],
  circuit: QuantumCircuit,
  measurements: { qubit: number; clbit: number | null }[],
  numShots: number,
  counts: Map<string, number>,
): void {
  const n = Math.max(1, circuit.numQubits);
  // Compute cumulative probability over all 2^n basis states.
  const dim = state.length;
  const probs: number[] = new Array(dim);
  let total = 0;
  for (let i = 0; i < dim; i++) {
    const a = state[i];
    probs[i] = a.re * a.re + a.im * a.im;
    total += probs[i];
  }
  // Normalize (safety: should already be ≈1 for a valid state).
  if (total > 0) {
    for (let i = 0; i < dim; i++) probs[i] /= total;
  }
  // Cumulative distribution for inverse-transform sampling.
  const cdf: number[] = new Array(dim);
  let acc = 0;
  for (let i = 0; i < dim; i++) {
    acc += probs[i];
    cdf[i] = acc;
  }
  for (let s = 0; s < numShots; s++) {
    const r = Math.random();
    // Binary search the CDF.
    let lo = 0;
    let hi = dim - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (r <= cdf[mid]) hi = mid;
      else lo = mid + 1;
    }
    const basisIdx = lo;
    // Map basis index to classical bits via the measurement list.
    const bits: number[] = new Array(circuit.numClbits).fill(0);
    for (const m of measurements) {
      const qBit = n - 1 - m.qubit;
      const value = (basisIdx >> qBit) & 1;
      if (m.clbit !== null) bits[m.clbit] = value;
    }
    const bitstring = formatBitstringFromBits(bits, circuit);
    counts.set(bitstring, (counts.get(bitstring) ?? 0) + 1);
  }
}

/**
 * Full per-shot simulation: execute every instruction in order,
 * including measurements, resets, classical assignments, and
 * control flow. Returns the final state and classical memory.
 */
function runFullSimulation(
  circuit: QuantumCircuit,
): { state: Complex[]; classicalMemory: ClassicalState } {
  const n = Math.max(1, circuit.numQubits);
  const state = initialState(n);
  const cs = newClassicalState(circuit.numClbits);
  if (!isZeroPhase(circuit.globalPhase)) {
    scaleInPlace(state, Complex.exp(circuit.globalPhase.evaluate()));
  }
  executeInstructions(state, cs, circuit.instructions, circuit, n);
  return { state, classicalMemory: cs };
}

/** Execute a list of instructions in the current scope. */
function executeInstructions(
  state: Complex[],
  cs: ClassicalState,
  instructions: readonly Instruction[],
  circuit: QuantumCircuit,
  n: number,
): "continue" | "break" | "end" | null {
  for (const instr of instructions) {
    const signal = executeOneInstruction(state, cs, instr, circuit, n);
    if (signal) return signal;
  }
  return null;
}

function executeOneInstruction(
  state: Complex[],
  cs: ClassicalState,
  instr: Instruction,
  circuit: QuantumCircuit,
  n: number,
): "continue" | "break" | "end" | null {
  switch (instr.kind) {
    case "gate": {
      const U = materializeGate(instr);
      applyGateInPlace(state, U, instr.qubits, n);
      return null;
    }
    case "global-phase": {
      const theta = instr.parameters?.[0]?.evaluate() ?? 0;
      scaleInPlace(state, Complex.exp(theta));
      return null;
    }
    case "measure": {
      const q = instr.qubits[0];
      const outcome = measureQubit(state, q, n);
      if (instr.clbits.length > 0) {
        cs.bits[instr.clbits[0]] = outcome;
      }
      return null;
    }
    case "reset": {
      const q = instr.qubits[0];
      const outcome = measureQubit(state, q, n);
      if (outcome === 1) {
        // Flip with X.
        applyGateInPlace(state, pauliX(), [q], n);
      }
      return null;
    }
    case "barrier":
    case "delay":
    case "comment":
    case "pragma":
    case "annotation-statement":
    case "classical-declaration":
    case "const-declaration":
    case "input-declaration":
    case "output-declaration":
    case "alias-declaration":
    case "legacy-register-declaration":
    case "include":
    case "version":
    case "defcal-grammar":
    case "gate-definition":
    case "subroutine-definition":
    case "extern-declaration":
    case "cal-block":
    case "defcal-definition":
    case "port-declaration":
    case "frame-declaration":
    case "waveform-declaration":
    case "play":
    case "capture":
    case "frame-operation":
      return null;
    case "assignment": {
      const p = instr.payload as {
        target: ClassicalExpr;
        operator: string;
        value: ClassicalExpr;
      };
      const newVal = evalClassical(p.value, cs, circuit);
      if (p.target.kind === "identifier") {
        if (p.operator === "=") {
          cs.vars.set(p.target.name, newVal);
        } else {
          const old = cs.vars.get(p.target.name) ?? 0;
          cs.vars.set(p.target.name, applyCompoundOp(old, p.operator, newVal));
        }
      }
      return null;
    }
    case "expression-statement":
      return null;
    case "if": {
      const p = instr.payload as {
        condition: ClassicalExpr;
        trueBody: QuantumCircuit;
        falseBody?: QuantumCircuit;
      };
      const cond = evalClassical(p.condition, cs, circuit);
      if (cond !== 0) {
        return executeInstructions(
          state,
          cs,
          p.trueBody.instructions,
          circuit,
          n,
        );
      } else if (p.falseBody) {
        return executeInstructions(
          state,
          cs,
          p.falseBody.instructions,
          circuit,
          n,
        );
      }
      return null;
    }
    case "for": {
      const p = instr.payload as {
        loopVariableName: string;
        iterable: ClassicalExpr;
        body: QuantumCircuit;
      };
      const iterValues = resolveIterable(p.iterable, cs, circuit);
      for (const v of iterValues) {
        cs.vars.set(p.loopVariableName, v);
        const signal = executeInstructions(
          state,
          cs,
          p.body.instructions,
          circuit,
          n,
        );
        if (signal === "break") break;
        if (signal === "end") return "end";
      }
      return null;
    }
    case "while": {
      const p = instr.payload as {
        condition: ClassicalExpr;
        body: QuantumCircuit;
      };
      const MAX_ITER = 10000;
      for (let i = 0; i < MAX_ITER; i++) {
        const cond = evalClassical(p.condition, cs, circuit);
        if (cond === 0) break;
        const signal = executeInstructions(
          state,
          cs,
          p.body.instructions,
          circuit,
          n,
        );
        if (signal === "break") break;
        if (signal === "end") return "end";
      }
      return null;
    }
    case "switch": {
      const p = instr.payload as {
        subject: ClassicalExpr;
        cases: { values: ClassicalExpr[]; body: QuantumCircuit }[];
        defaultBody?: QuantumCircuit;
      };
      const subject = evalClassical(p.subject, cs, circuit);
      for (const c of p.cases) {
        for (const v of c.values) {
          if (evalClassical(v, cs, circuit) === subject) {
            return executeInstructions(
              state,
              cs,
              c.body.instructions,
              circuit,
              n,
            );
          }
        }
      }
      if (p.defaultBody) {
        return executeInstructions(
          state,
          cs,
          p.defaultBody.instructions,
          circuit,
          n,
        );
      }
      return null;
    }
    case "break":
      return "break";
    case "continue":
      return "continue";
    case "end":
      return "end";
    case "box": {
      const p = instr.payload as { body: QuantumCircuit };
      return executeInstructions(state, cs, p.body.instructions, circuit, n);
    }
    case "block": {
      const p = instr.payload as { body: QuantumCircuit };
      return executeInstructions(state, cs, p.body.instructions, circuit, n);
    }
    case "return":
      return "end";
    case "timed": {
      const p = instr.payload as { operation: Instruction };
      return executeOneInstruction(state, cs, p.operation, circuit, n);
    }
    case "prepare-state":
    case "initialize": {
      const spec = (instr.payload as { state: StateSpec }).state;
      applyStatePrepInPlace(state, spec, instr.qubits, n);
      return null;
    }
  }
  return null;
}

function applyCompoundOp(old: number, op: string, v: number): number {
  switch (op) {
    case "+=":
      return old + v;
    case "-=":
      return old - v;
    case "*=":
      return old * v;
    case "/=":
      return old / v;
    case "&=":
      return old & v;
    case "|=":
      return old | v;
    case "^=":
      return old ^ v;
    case "<<=":
      return old << v;
    case ">>=":
      return old >> v;
    case "%=":
      return old - Math.floor(old / v) * v;
    case "**=":
      return Math.pow(old, v);
    case "~=":
      return ~v;
  }
  throw new Error(`applyCompoundOp: unknown operator '${op}'`);
}

/** Resolve an iterable classical expression to a list of integer values. */
function resolveIterable(
  expr: ClassicalExpr,
  cs: ClassicalState,
  circuit: QuantumCircuit,
): number[] {
  if (expr.kind === "range") {
    const start = expr.start ? evalClassical(expr.start, cs, circuit) : 0;
    const end = expr.end ? evalClassical(expr.end, cs, circuit) : 0;
    const step = expr.step ? evalClassical(expr.step, cs, circuit) : 1;
    // OpenQASM range a:b is inclusive of `b`. a:c:b uses c as step.
    const out: number[] = [];
    if (step > 0) {
      for (let i = start; i <= end; i += step) out.push(i);
    } else if (step < 0) {
      for (let i = start; i >= end; i += step) out.push(i);
    } else {
      throw new Error("resolveIterable: zero step");
    }
    return out;
  }
  if (expr.kind === "set-literal" || expr.kind === "array-literal") {
    return expr.elements.map((e) => evalClassical(e, cs, circuit));
  }
  throw new Error(`resolveIterable: unsupported iterable kind '${expr.kind}'`);
}

// =============================================================================
// Bitstring formatting
// =============================================================================

/**
 * Format classical memory as a bitstring. Classical registers are
 * concatenated in declaration order; within each register, bit 0
 * is the rightmost character (LSB on the right). When there are
 * no registered classical bits, we return "0".
 */
function formatBitstring(
  cs: ClassicalState,
  circuit: QuantumCircuit,
): string {
  return formatBitstringFromBits(cs.bits, circuit);
}

function formatBitstringFromBits(
  bits: readonly number[],
  circuit: QuantumCircuit,
): string {
  if (circuit.classicalRegisters.length === 0) {
    if (bits.length === 0) return "0";
    // No registers but some bits exist (auto-created "c" register case).
    return bits.slice().reverse().map((b) => (b ? "1" : "0")).join("");
  }
  // Concatenate registers in declaration order, each written LSB-on-right.
  const parts: string[] = [];
  for (const reg of circuit.classicalRegisters) {
    const regBits: string[] = [];
    for (let i = reg.size - 1; i >= 0; i--) {
      regBits.push(bits[reg.flatOffset + i] ? "1" : "0");
    }
    parts.push(regBits.join(""));
  }
  return parts.join(" ");
}

// =============================================================================
// Helpers
// =============================================================================

function isZeroPhase(e: import("./parameter.ts").AngleExpr): boolean {
  if (e.kind === "int" && e.num === 0) return true;
  if (e.kind === "float" && e.num === 0) return true;
  return false;
}

/** Local Pauli X matrix used by `reset`. */
function pauliX(): Matrix {
  // Import locally to avoid a circular-import appearance at module load.
  return _pauliX ?? (_pauliX = buildPauliX());
}
let _pauliX: Matrix | null = null;
function buildPauliX(): Matrix {
  const { XGate } = _gatesNs();
  return XGate();
}
function _gatesNs(): { XGate: () => Matrix } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return gatesLazy;
}
// Lazy-imported to keep this module's top-level import list tidy.
import * as gatesLazy from "./gates.ts";

// =============================================================================
// Basis gate list (informational)
// =============================================================================

/**
 * Every gate name the simulator recognizes. Used by
 * `SimulatorBackend.basisGates` for backend-contract introspection;
 * the simulator does not actually restrict itself to these.
 */
export const ALL_SIMULATOR_GATES: readonly string[] = Object.freeze([
  // Tier 0
  "id",
  "h",
  "x",
  "y",
  "z",
  "p",
  "r",
  "rx",
  "ry",
  "rz",
  "s",
  "sdg",
  "sx",
  "sxdg",
  "t",
  "tdg",
  "u",
  "rv",
  "gphase",
  // Tier 1
  "cx",
  // Tier 2
  "cz",
  "cy",
  "cp",
  "crz",
  "cry",
  "crx",
  "cs",
  "csdg",
  "csx",
  "ch",
  "cu",
  "dcx",
  // Tier 3
  "swap",
  "rzz",
  "rxx",
  "ryy",
  "rzx",
  "ecr",
  "iswap",
  "xx_plus_yy",
  "xx_minus_yy",
  // Tier 4
  "ccx",
  "ccz",
  "cswap",
  "rccx",
  // Tier 5
  "c3x",
  "c3sx",
  "c4x",
  "rc3x",
  "mcx",
  "mcp",
  // Tier 6
  "ms",
  "pauli",
  "diagonal",
  "permutation",
  "mcmt",
  "pauli_product_rotation",
  // Tier 7
  "ucrz",
  "ucry",
  "ucrx",
  "uc_pauli_rot",
  "uc",
  "unitary",
  "linear_function",
  "isometry",
  // Tier 8
  "pauli_evolution",
  "hamiltonian",
  // Tier 9
  "qft",
  // Tier 10
  "and",
  "or",
  "bitwise_xor",
  "inner_product",
  // Tier 11
  "half_adder",
  "full_adder",
  "modular_adder",
  "multiplier",
  // Tier 12
  "linear_pauli_rotations",
  "polynomial_pauli_rotations",
  "piecewise_linear_pauli_rotations",
  "piecewise_polynomial_pauli_rotations",
  "piecewise_chebyshev",
  "linear_amplitude_function",
  "exact_reciprocal",
  // Tier 13
  "integer_comparator",
  "quadratic_form",
  "weighted_sum",
  "phase_oracle",
  "bit_flip_oracle",
  // Tier 14
  "graph_state",
]);
