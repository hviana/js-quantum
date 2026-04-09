/**
 * `QuantumCircuit` — the central builder class.
 *
 * This is the primary user-facing type of the SDK. It stores an
 * ordered list of instructions, named classical registers, an
 * explicit scope-level `globalPhase`, and program-level metadata
 * (version, includes, defcalgrammar, transpilation provenance).
 *
 * Every gate from Tiers 0–14 (Section 3) has a chainable method that
 * appends a single gate instruction. Every non-gate feature from
 * Section 5 (the Expansion API) has a chainable method that appends
 * the corresponding IR node.
 *
 * Per Design Principle 7 of Section 5.1, the same class serves as
 * both the top-level program container and as the scope/body type
 * for nested contexts (gate bodies, subroutine bodies, control-flow
 * branches, boxed regions). Program-level metadata is semantically
 * meaningful only at the top level; nested scopes simply ignore it.
 */

import { Matrix } from "./matrix.ts";
import { AngleExpr } from "./parameter.ts";
import type {
  AssignOp,
  CalibrationGrammarSelection,
  ClassicalBitRef,
  ClassicalExpr,
  ClassicalRegister,
  ClassicalType,
  Condition,
  DurationExpr,
  GateModifier,
  IncludeDirective,
  Instruction,
  MeasurementSyntax,
  ProgramVersion,
  QuantumOperand,
  StateSpec,
  TranspilationMetadata,
} from "./types.ts";
import {
  AndGate,
  BitFlipOracleGate,
  BitwiseXorGate,
  C3SXGate,
  C3XGate,
  C4XGate,
  CCXGate,
  CCZGate,
  CHGate,
  compose,
  CPhaseGate,
  CRXGate,
  CRYGate,
  CRZGate,
  CSdgGate,
  CSGate,
  CSwapGate,
  CSXGate,
  CUGate,
  CXGate,
  CYGate,
  CZGate,
  DCXGate,
  DiagonalGate,
  ECRGate,
  type ESOPTerm,
  ExactReciprocalGate,
  FullAdderGate,
  GlobalPhaseGate,
  GraphStateGate,
  HalfAdderGate,
  HamiltonianGate,
  HGate,
  IGate,
  InnerProductGate,
  IntegerComparatorGate,
  Isometry,
  iSwapGate,
  liftGate,
  LinearAmplitudeFunctionGate,
  LinearFunction,
  LinearPauliRotationsGate,
  MCMTGate,
  MCPhaseGate,
  MCXGate,
  ModularAdderGate,
  MSGate,
  MultiplierGate,
  OrGate,
  PauliEvolutionGate,
  PauliGate,
  PauliProductRotationGate,
  type PauliTerm,
  PermutationGate,
  PhaseGate,
  PhaseOracleGate,
  PiecewiseChebyshevGate,
  PiecewiseLinearPauliRotationsGate,
  PiecewisePolynomialPauliRotationsGate,
  PolynomialPauliRotationsGate,
  QFTGate,
  QuadraticFormGate,
  RC3XGate,
  RCCXGate,
  RGate,
  RVGate,
  RXGate,
  RXXGate,
  RYGate,
  RYYGate,
  RZGate,
  RZXGate,
  RZZGate,
  SdgGate,
  SGate,
  SwapGate,
  SXdgGate,
  SXGate,
  TdgGate,
  TGate,
  UCGate,
  UCPauliRotGate,
  UCRXGate,
  UCRYGate,
  UCRZGate,
  UGate,
  UnitaryGate,
  WeightedSumGate,
  XGate,
  XXMinusYYGate,
  XXPlusYYGate,
  YGate,
  ZGate,
} from "./gates.ts";

// =============================================================================
// Angle helper: accept number | AngleExpr, resolve to number for matrix calls
// =============================================================================

/**
 * Parametric gate angles may be passed as numbers or as symbolic
 * `AngleExpr` values. For the purpose of storing an instruction in
 * the circuit, we retain the original `AngleExpr` in the
 * `parameters` array. For building a concrete matrix immediately
 * (e.g. during simulation/composition), we evaluate it.
 */
export type Angle = number | AngleExpr;

function toAngleExpr(a: Angle): AngleExpr {
  if (typeof a === "number") {
    return Number.isInteger(a) ? AngleExpr.int(a) : AngleExpr.float(a);
  }
  return a;
}

// =============================================================================
// QuantumCircuit
// =============================================================================

/**
 * Central circuit builder. All gate and Expansion API methods are
 * chainable (return `this`) except inspection methods.
 *
 * Qubit allocation is implicit: calling a gate method with a qubit
 * index `k` automatically extends the circuit to at least `k + 1`
 * qubits. Classical bits are grouped into named `ClassicalRegister`
 * records preserved in declaration order.
 */
export class QuantumCircuit {
  /** Scope-level global phase (Phase Convention 3). */
  globalPhase: AngleExpr;

  /** Program version header (top-level only). */
  version: ProgramVersion | null = null;

  /** Whether the version header is explicitly omitted. */
  versionOmitted: boolean = false;

  /** Include directives (top-level only), in source order. */
  includes: IncludeDirective[] = [];

  /** Calibration grammar selection (top-level only). */
  defcalGrammar: CalibrationGrammarSelection | null = null;

  /** Ordered instruction list. */
  instructions: Instruction[] = [];

  /** Ordered named classical registers. */
  classicalRegisters: ClassicalRegister[] = [];

  /** Post-compilation provenance; null until the transpiler populates it. */
  transpilationMetadata: TranspilationMetadata | null = null;

  /** Highest virtual qubit index used so far + 1. */
  private _numQubits: number = 0;

  /** Flat classical bit count (sum of register sizes). */
  private _numClbits: number = 0;

  /**
   * Construct a new `QuantumCircuit` with optional starting
   * `globalPhase` (default 0).
   */
  constructor(globalPhase: Angle = 0) {
    this.globalPhase = toAngleExpr(globalPhase);
  }

  /** Number of virtual qubits currently referenced. */
  get numQubits(): number {
    return this._numQubits;
  }

  /** Flat number of classical bits across all registers. */
  get numClbits(): number {
    return this._numClbits;
  }

  // ---------------------------------------------------------------------------
  // Program-level metadata (§5.2)
  // ---------------------------------------------------------------------------

  /** Set the OpenQASM version header. */
  setProgramVersion(major: number, minor?: number): this {
    this.version = minor === undefined ? { major } : { major, minor };
    this.versionOmitted = false;
    return this;
  }

  /** Explicitly omit the version header (distinct from "not set"). */
  omitProgramVersion(): this {
    this.version = null;
    this.versionOmitted = true;
    return this;
  }

  /** Append an `include "path";` directive. */
  include(path: string): this {
    this.includes.push({ path });
    return this;
  }

  /** Select a calibration grammar (e.g. "openpulse"). */
  setCalibrationGrammar(name: string): this {
    this.defcalGrammar = { name };
    return this;
  }

  // ---------------------------------------------------------------------------
  // Classical register declarations
  // ---------------------------------------------------------------------------

  /**
   * Declare a new named classical bit register. Registers are
   * preserved in declaration order and used for result bitstring
   * reconstruction in backends.
   */
  addClassicalRegister(name: string, size: number): this {
    if (!Number.isInteger(size) || size < 0) {
      throw new Error(
        `addClassicalRegister: size must be nonnegative integer, got ${size}`,
      );
    }
    if (this.classicalRegisters.some((r) => r.name === name)) {
      throw new Error(`addClassicalRegister: duplicate name '${name}'`);
    }
    this.classicalRegisters.push({ name, size, flatOffset: this._numClbits });
    this._numClbits += size;
    return this;
  }

  /** Look up a classical register by name. */
  getClassicalRegister(name: string): ClassicalRegister | null {
    return this.classicalRegisters.find((r) => r.name === name) ?? null;
  }

  /**
   * Resolve a `ClassicalBitRef` to its flat index, creating the
   * register lazily when `autoCreate` is true.
   */
  private resolveClbit(ref: ClassicalBitRef, autoCreate = true): number {
    let reg = this.getClassicalRegister(ref.registerName);
    if (!reg) {
      if (!autoCreate) {
        throw new Error(`unknown classical register '${ref.registerName}'`);
      }
      // Auto-create a register with size = bitIndex + 1.
      this.addClassicalRegister(ref.registerName, ref.bitIndex + 1);
      reg = this.getClassicalRegister(ref.registerName)!;
    }
    if (ref.bitIndex >= reg.size) {
      throw new Error(
        `classical bit index ${ref.bitIndex} out of range for register '${reg.name}' of size ${reg.size}`,
      );
    }
    return reg.flatOffset + ref.bitIndex;
  }

  // ---------------------------------------------------------------------------
  // Instruction append helpers
  // ---------------------------------------------------------------------------

  /** Extend the implicit qubit count to at least `maxArg + 1`. */
  private _useQubit(q: number): void {
    if (!Number.isInteger(q) || q < 0) {
      throw new Error(`qubit index must be a nonnegative integer, got ${q}`);
    }
    if (q + 1 > this._numQubits) this._numQubits = q + 1;
  }

  /** Extend the qubit count to cover every qubit in `qubits`. */
  private _useQubits(qubits: readonly number[]): void {
    // Validate distinctness.
    const seen = new Set<number>();
    for (const q of qubits) {
      this._useQubit(q);
      if (seen.has(q)) {
        throw new Error(`duplicate qubit ${q} in gate operand list`);
      }
      seen.add(q);
    }
  }

  /** Push an instruction onto the list and return `this`. */
  private _push(instr: Instruction): this {
    this.instructions.push(instr);
    return this;
  }

  /** Build and append a generic gate instruction. */
  private _appendGate(
    name: string,
    qubits: readonly number[],
    parameters: readonly AngleExpr[] = [],
    extra: Partial<Instruction> = {},
  ): this {
    this._useQubits(qubits);
    return this._push({
      kind: "gate",
      qubits: [...qubits],
      clbits: [],
      name,
      parameters,
      ...extra,
    });
  }

  // ===========================================================================
  // Tier 0 gate methods
  // ===========================================================================

  /** Zero-qubit global phase instruction `gphase(theta)`. */
  globalPhaseGate(theta: Angle): this {
    this._useQubits([]);
    return this._push({
      kind: "global-phase",
      qubits: [],
      clbits: [],
      name: "gphase",
      parameters: [toAngleExpr(theta)],
    });
  }

  /** Identity gate on a single qubit. */
  id(q: number): this {
    return this._appendGate("id", [q]);
  }

  /** Hadamard gate. */
  h(q: number): this {
    return this._appendGate("h", [q]);
  }

  /** Pauli-X. */
  x(q: number): this {
    return this._appendGate("x", [q]);
  }

  /** Pauli-Y. */
  y(q: number): this {
    return this._appendGate("y", [q]);
  }

  /** Pauli-Z. */
  z(q: number): this {
    return this._appendGate("z", [q]);
  }

  /** Phase gate `P(lambda)`. */
  p(lambda: Angle, q: number): this {
    return this._appendGate("p", [q], [toAngleExpr(lambda)]);
  }

  /** Axis-angle rotation `R(theta, phi)`. */
  r(theta: Angle, phi: Angle, q: number): this {
    return this._appendGate("r", [q], [toAngleExpr(theta), toAngleExpr(phi)]);
  }

  /** `RX(theta)`. */
  rx(theta: Angle, q: number): this {
    return this._appendGate("rx", [q], [toAngleExpr(theta)]);
  }

  /** `RY(theta)`. */
  ry(theta: Angle, q: number): this {
    return this._appendGate("ry", [q], [toAngleExpr(theta)]);
  }

  /** `RZ(theta)`. */
  rz(theta: Angle, q: number): this {
    return this._appendGate("rz", [q], [toAngleExpr(theta)]);
  }

  /** `S = P(pi/2)`. */
  s(q: number): this {
    return this._appendGate("s", [q]);
  }

  /** `Sdg = S†`. */
  sdg(q: number): this {
    return this._appendGate("sdg", [q]);
  }

  /** `SX = sqrt(X)`. */
  sx(q: number): this {
    return this._appendGate("sx", [q]);
  }

  /** `SXdg = SX†`. */
  sxdg(q: number): this {
    return this._appendGate("sxdg", [q]);
  }

  /** `T = P(pi/4)`. */
  t(q: number): this {
    return this._appendGate("t", [q]);
  }

  /** `Tdg = T†`. */
  tdg(q: number): this {
    return this._appendGate("tdg", [q]);
  }

  /** Canonical single-qubit gate `U_can(theta, phi, lambda)`. */
  u(theta: Angle, phi: Angle, lambda: Angle, q: number): this {
    return this._appendGate("u", [q], [
      toAngleExpr(theta),
      toAngleExpr(phi),
      toAngleExpr(lambda),
    ]);
  }

  /** Rotation-vector gate `RV(vx, vy, vz)`. */
  rv(vx: Angle, vy: Angle, vz: Angle, q: number): this {
    return this._appendGate("rv", [q], [
      toAngleExpr(vx),
      toAngleExpr(vy),
      toAngleExpr(vz),
    ]);
  }

  // ===========================================================================
  // Tier 1
  // ===========================================================================

  /** Controlled-NOT. */
  cx(control: number, target: number): this {
    return this._appendGate("cx", [control, target]);
  }

  // ===========================================================================
  // Tier 2
  // ===========================================================================

  cz(control: number, target: number): this {
    return this._appendGate("cz", [control, target]);
  }

  cy(control: number, target: number): this {
    return this._appendGate("cy", [control, target]);
  }

  cp(lambda: Angle, control: number, target: number): this {
    return this._appendGate("cp", [control, target], [toAngleExpr(lambda)]);
  }

  crz(theta: Angle, control: number, target: number): this {
    return this._appendGate("crz", [control, target], [toAngleExpr(theta)]);
  }

  cry(theta: Angle, control: number, target: number): this {
    return this._appendGate("cry", [control, target], [toAngleExpr(theta)]);
  }

  crx(theta: Angle, control: number, target: number): this {
    return this._appendGate("crx", [control, target], [toAngleExpr(theta)]);
  }

  cs(control: number, target: number): this {
    return this._appendGate("cs", [control, target]);
  }

  csdg(control: number, target: number): this {
    return this._appendGate("csdg", [control, target]);
  }

  csx(control: number, target: number): this {
    return this._appendGate("csx", [control, target]);
  }

  ch(control: number, target: number): this {
    return this._appendGate("ch", [control, target]);
  }

  cu(
    theta: Angle,
    phi: Angle,
    lambda: Angle,
    gamma: Angle,
    control: number,
    target: number,
  ): this {
    return this._appendGate("cu", [control, target], [
      toAngleExpr(theta),
      toAngleExpr(phi),
      toAngleExpr(lambda),
      toAngleExpr(gamma),
    ]);
  }

  dcx(q0: number, q1: number): this {
    return this._appendGate("dcx", [q0, q1]);
  }

  // ===========================================================================
  // Tier 3
  // ===========================================================================

  swap(q0: number, q1: number): this {
    return this._appendGate("swap", [q0, q1]);
  }

  rzz(theta: Angle, q0: number, q1: number): this {
    return this._appendGate("rzz", [q0, q1], [toAngleExpr(theta)]);
  }

  rxx(theta: Angle, q0: number, q1: number): this {
    return this._appendGate("rxx", [q0, q1], [toAngleExpr(theta)]);
  }

  ryy(theta: Angle, q0: number, q1: number): this {
    return this._appendGate("ryy", [q0, q1], [toAngleExpr(theta)]);
  }

  rzx(theta: Angle, q0: number, q1: number): this {
    return this._appendGate("rzx", [q0, q1], [toAngleExpr(theta)]);
  }

  ecr(q0: number, q1: number): this {
    return this._appendGate("ecr", [q0, q1]);
  }

  iswap(q0: number, q1: number): this {
    return this._appendGate("iswap", [q0, q1]);
  }

  xxPlusYY(theta: Angle, beta: Angle, q0: number, q1: number): this {
    return this._appendGate("xx_plus_yy", [q0, q1], [
      toAngleExpr(theta),
      toAngleExpr(beta),
    ]);
  }

  xxMinusYY(theta: Angle, beta: Angle, q0: number, q1: number): this {
    return this._appendGate("xx_minus_yy", [q0, q1], [
      toAngleExpr(theta),
      toAngleExpr(beta),
    ]);
  }

  // ===========================================================================
  // Tier 4
  // ===========================================================================

  ccx(c1: number, c2: number, t: number): this {
    return this._appendGate("ccx", [c1, c2, t]);
  }

  ccz(c1: number, c2: number, t: number): this {
    return this._appendGate("ccz", [c1, c2, t]);
  }

  cswap(c: number, t1: number, t2: number): this {
    return this._appendGate("cswap", [c, t1, t2]);
  }

  rccx(c1: number, c2: number, t: number): this {
    return this._appendGate("rccx", [c1, c2, t]);
  }

  // ===========================================================================
  // Tier 5
  // ===========================================================================

  c3x(c1: number, c2: number, c3: number, t: number): this {
    return this._appendGate("c3x", [c1, c2, c3, t]);
  }

  c3sx(c1: number, c2: number, c3: number, t: number): this {
    return this._appendGate("c3sx", [c1, c2, c3, t]);
  }

  c4x(c1: number, c2: number, c3: number, c4: number, t: number): this {
    return this._appendGate("c4x", [c1, c2, c3, c4, t]);
  }

  rc3x(c1: number, c2: number, c3: number, t: number): this {
    return this._appendGate("rc3x", [c1, c2, c3, t]);
  }

  mcx(controls: readonly number[], target: number): this {
    return this._appendGate("mcx", [...controls, target]);
  }

  mcp(lambda: Angle, controls: readonly number[], target: number): this {
    return this._appendGate("mcp", [...controls, target], [
      toAngleExpr(lambda),
    ]);
  }

  // ===========================================================================
  // Tier 6
  // ===========================================================================

  ms(theta: Angle, qubits: readonly number[]): this {
    return this._appendGate("ms", qubits, [toAngleExpr(theta)]);
  }

  pauli(pauliString: string, qubits: readonly number[]): this {
    if (pauliString.length !== qubits.length) {
      throw new Error(
        `pauli: string length ${pauliString.length} ≠ qubits length ${qubits.length}`,
      );
    }
    return this._appendGate("pauli", qubits, [], {
      payload: { pauliString },
    });
  }

  diagonal(phases: readonly number[], qubits: readonly number[]): this {
    if (phases.length !== 1 << qubits.length) {
      throw new Error(`diagonal: phases must have length 2^${qubits.length}`);
    }
    return this._appendGate("diagonal", qubits, [], {
      payload: { phases: [...phases] },
    });
  }

  permutation(sigma: readonly number[], qubits: readonly number[]): this {
    if (sigma.length !== 1 << qubits.length) {
      throw new Error(`permutation: sigma must have length 2^${qubits.length}`);
    }
    return this._appendGate("permutation", qubits, [], {
      payload: { sigma: [...sigma] },
    });
  }

  mcmt(
    gate: Matrix,
    controlQubits: readonly number[],
    targetQubits: readonly number[],
  ): this {
    return this._appendGate("mcmt", [...controlQubits, ...targetQubits], [], {
      payload: {
        gate,
        numControls: controlQubits.length,
        numTargets: targetQubits.length,
      },
    });
  }

  pauliProductRotation(
    theta: Angle,
    paulis: string,
    qubits: readonly number[],
  ): this {
    if (paulis.length !== qubits.length) {
      throw new Error(`pauliProductRotation: string length ≠ qubits length`);
    }
    return this._appendGate("pauli_product_rotation", qubits, [
      toAngleExpr(theta),
    ], {
      payload: { pauliString: paulis },
    });
  }

  // ===========================================================================
  // Tier 7
  // ===========================================================================

  ucrz(
    angles: readonly number[],
    controlQubits: readonly number[],
    target: number,
  ): this {
    if (angles.length !== 1 << controlQubits.length) {
      throw new Error(
        `ucrz: angles must have length 2^${controlQubits.length}`,
      );
    }
    return this._appendGate("ucrz", [...controlQubits, target], [], {
      payload: { angles: [...angles] },
    });
  }

  ucry(
    angles: readonly number[],
    controlQubits: readonly number[],
    target: number,
  ): this {
    if (angles.length !== 1 << controlQubits.length) {
      throw new Error(
        `ucry: angles must have length 2^${controlQubits.length}`,
      );
    }
    return this._appendGate("ucry", [...controlQubits, target], [], {
      payload: { angles: [...angles] },
    });
  }

  ucrx(
    angles: readonly number[],
    controlQubits: readonly number[],
    target: number,
  ): this {
    if (angles.length !== 1 << controlQubits.length) {
      throw new Error(
        `ucrx: angles must have length 2^${controlQubits.length}`,
      );
    }
    return this._appendGate("ucrx", [...controlQubits, target], [], {
      payload: { angles: [...angles] },
    });
  }

  ucPauliRot(
    angles: readonly number[],
    axis: "X" | "Y" | "Z",
    controlQubits: readonly number[],
    target: number,
  ): this {
    if (angles.length !== 1 << controlQubits.length) {
      throw new Error(
        `ucPauliRot: angles must have length 2^${controlQubits.length}`,
      );
    }
    return this._appendGate("uc_pauli_rot", [...controlQubits, target], [], {
      payload: { angles: [...angles], axis },
    });
  }

  uc(
    unitaries: readonly Matrix[],
    controlQubits: readonly number[],
    target: number,
  ): this {
    if (unitaries.length !== 1 << controlQubits.length) {
      throw new Error(
        `uc: unitaries must have length 2^${controlQubits.length}`,
      );
    }
    return this._appendGate("uc", [...controlQubits, target], [], {
      payload: { unitaries },
    });
  }

  unitary(matrix: Matrix, qubits: readonly number[]): this {
    if (
      matrix.rows !== 1 << qubits.length || matrix.cols !== 1 << qubits.length
    ) {
      throw new Error(`unitary: matrix dimension must be 2^${qubits.length}`);
    }
    return this._appendGate("unitary", qubits, [], {
      payload: { matrix },
    });
  }

  linearFunction(
    matrix: readonly (readonly number[])[],
    qubits: readonly number[],
  ): this {
    if (matrix.length !== qubits.length) {
      throw new Error(
        `linearFunction: matrix must be n×n where n = qubits length`,
      );
    }
    return this._appendGate("linear_function", qubits, [], {
      payload: { matrix },
    });
  }

  isometry(matrix: Matrix, qubits: readonly number[]): this {
    return this._appendGate("isometry", qubits, [], {
      payload: { matrix },
    });
  }

  // ===========================================================================
  // Tier 8
  // ===========================================================================

  pauliEvolution(
    terms: readonly PauliTerm[],
    time: Angle,
    qubits: readonly number[],
  ): this {
    return this._appendGate("pauli_evolution", qubits, [toAngleExpr(time)], {
      payload: { terms },
    });
  }

  hamiltonianGate(
    matrix: Matrix,
    time: Angle,
    qubits: readonly number[],
  ): this {
    return this._appendGate("hamiltonian", qubits, [toAngleExpr(time)], {
      payload: { matrix },
    });
  }

  // ===========================================================================
  // Tier 9
  // ===========================================================================

  qft(qubits: readonly number[]): this {
    return this._appendGate("qft", qubits);
  }

  // ===========================================================================
  // Tier 10
  // ===========================================================================

  andGate(inputs: readonly number[], output: number): this {
    return this._appendGate("and", [...inputs, output]);
  }

  orGate(inputs: readonly number[], output: number): this {
    return this._appendGate("or", [...inputs, output]);
  }

  bitwiseXor(a: readonly number[], b: readonly number[]): this {
    if (a.length !== b.length) {
      throw new Error(`bitwiseXor: register lengths must match`);
    }
    return this._appendGate("bitwise_xor", [...a, ...b], [], {
      payload: { n: a.length },
    });
  }

  innerProduct(
    a: readonly number[],
    b: readonly number[],
    output: number,
  ): this {
    if (a.length !== b.length) {
      throw new Error(`innerProduct: register lengths must match`);
    }
    return this._appendGate("inner_product", [...a, ...b, output], [], {
      payload: { n: a.length },
    });
  }

  // ===========================================================================
  // Tier 11
  // ===========================================================================

  halfAdder(a: number, b: number, sum: number, carry: number): this {
    return this._appendGate("half_adder", [a, b, sum, carry]);
  }

  fullAdder(
    a: number,
    b: number,
    cIn: number,
    sum: number,
    cOut: number,
  ): this {
    return this._appendGate("full_adder", [a, b, cIn, sum, cOut]);
  }

  modularAdder(a: readonly number[], b: readonly number[]): this {
    if (a.length !== b.length) {
      throw new Error(`modularAdder: register lengths must match`);
    }
    return this._appendGate("modular_adder", [...a, ...b], [], {
      payload: { n: a.length },
    });
  }

  multiplier(
    a: readonly number[],
    b: readonly number[],
    product: readonly number[],
  ): this {
    if (a.length !== b.length) {
      throw new Error(`multiplier: a and b lengths must match`);
    }
    if (product.length !== 2 * a.length) {
      throw new Error(`multiplier: product length must be 2 * n`);
    }
    return this._appendGate("multiplier", [...a, ...b, ...product], [], {
      payload: { n: a.length },
    });
  }

  // ===========================================================================
  // Tier 12
  // ===========================================================================

  linearPauliRotations(
    slope: Angle,
    offset: Angle,
    stateQubits: readonly number[],
    target: number,
    axis: "X" | "Y" | "Z" = "Y",
  ): this {
    return this._appendGate(
      "linear_pauli_rotations",
      [...stateQubits, target],
      [toAngleExpr(slope), toAngleExpr(offset)],
      { payload: { axis, numStateBits: stateQubits.length } },
    );
  }

  polynomialPauliRotations(
    coeffs: readonly number[],
    stateQubits: readonly number[],
    target: number,
    axis: "X" | "Y" | "Z" = "Y",
  ): this {
    return this._appendGate(
      "polynomial_pauli_rotations",
      [...stateQubits, target],
      [],
      {
        payload: {
          coeffs: [...coeffs],
          axis,
          numStateBits: stateQubits.length,
        },
      },
    );
  }

  piecewiseLinearPauliRotations(
    breakpoints: readonly number[],
    slopes: readonly number[],
    offsets: readonly number[],
    stateQubits: readonly number[],
    target: number,
    axis: "X" | "Y" | "Z" = "Y",
  ): this {
    return this._appendGate(
      "piecewise_linear_pauli_rotations",
      [...stateQubits, target],
      [],
      {
        payload: {
          breakpoints: [...breakpoints],
          slopes: [...slopes],
          offsets: [...offsets],
          axis,
          numStateBits: stateQubits.length,
        },
      },
    );
  }

  piecewisePolynomialPauliRotations(
    breakpoints: readonly number[],
    coeffsList: readonly (readonly number[])[],
    stateQubits: readonly number[],
    target: number,
    axis: "X" | "Y" | "Z" = "Y",
  ): this {
    return this._appendGate(
      "piecewise_polynomial_pauli_rotations",
      [...stateQubits, target],
      [],
      {
        payload: {
          breakpoints: [...breakpoints],
          coeffsList: coeffsList.map((c) => [...c]),
          axis,
          numStateBits: stateQubits.length,
        },
      },
    );
  }

  piecewiseChebyshev(
    fSamples: readonly (readonly number[])[],
    breakpoints: readonly number[],
    stateQubits: readonly number[],
    target: number,
    axis: "X" | "Y" | "Z" = "Y",
  ): this {
    return this._appendGate(
      "piecewise_chebyshev",
      [...stateQubits, target],
      [],
      {
        payload: {
          fSamples: fSamples.map((r) => [...r]),
          breakpoints: [...breakpoints],
          axis,
          numStateBits: stateQubits.length,
        },
      },
    );
  }

  linearAmplitudeFunction(
    slope: Angle,
    offset: Angle,
    domain: readonly [number, number],
    image: readonly [number, number],
    stateQubits: readonly number[],
    target: number,
  ): this {
    return this._appendGate(
      "linear_amplitude_function",
      [...stateQubits, target],
      [toAngleExpr(slope), toAngleExpr(offset)],
      {
        payload: {
          domain: [domain[0], domain[1]],
          image: [image[0], image[1]],
          numStateBits: stateQubits.length,
        },
      },
    );
  }

  exactReciprocal(
    scalingFactor: Angle,
    stateQubits: readonly number[],
    target: number,
  ): this {
    return this._appendGate(
      "exact_reciprocal",
      [...stateQubits, target],
      [toAngleExpr(scalingFactor)],
      { payload: { numStateBits: stateQubits.length } },
    );
  }

  // ===========================================================================
  // Tier 13
  // ===========================================================================

  integerComparator(
    value: number,
    stateQubits: readonly number[],
    result: number,
    work: readonly number[],
    geq: boolean = true,
  ): this {
    if (work.length !== stateQubits.length + 1) {
      throw new Error(
        `integerComparator: work register must have length numStateBits + 1`,
      );
    }
    return this._appendGate(
      "integer_comparator",
      [...stateQubits, result, ...work],
      [],
      { payload: { value, geq, numStateBits: stateQubits.length } },
    );
  }

  quadraticForm(
    A: readonly (readonly number[])[],
    b: readonly number[],
    c: number,
    stateQubits: readonly number[],
    resultQubits: readonly number[],
  ): this {
    return this._appendGate(
      "quadratic_form",
      [...stateQubits, ...resultQubits],
      [],
      {
        payload: {
          A: A.map((r) => [...r]),
          b: [...b],
          c,
          numStateBits: stateQubits.length,
          numResultBits: resultQubits.length,
        },
      },
    );
  }

  weightedSum(
    weights: readonly number[],
    stateQubits: readonly number[],
    sumQubits: readonly number[],
  ): this {
    return this._appendGate(
      "weighted_sum",
      [...stateQubits, ...sumQubits],
      [],
      {
        payload: {
          weights: [...weights],
          numStateBits: stateQubits.length,
          numSumBits: sumQubits.length,
        },
      },
    );
  }

  phaseOracle(esop: readonly ESOPTerm[], qubits: readonly number[]): this {
    return this._appendGate("phase_oracle", qubits, [], {
      payload: { esop: esop.map((t) => ({ ...t })) },
    });
  }

  bitFlipOracle(
    esop: readonly ESOPTerm[],
    qubits: readonly number[],
    output: number,
  ): this {
    return this._appendGate(
      "bit_flip_oracle",
      [...qubits, output],
      [],
      { payload: { esop: esop.map((t) => ({ ...t })) } },
    );
  }

  // ===========================================================================
  // Tier 14
  // ===========================================================================

  graphState(
    adjacencyMatrix: readonly (readonly number[])[],
    qubits: readonly number[],
  ): this {
    if (adjacencyMatrix.length !== qubits.length) {
      throw new Error(`graphState: matrix dimension must match qubit count`);
    }
    return this._appendGate("graph_state", qubits, [], {
      payload: { adjacencyMatrix: adjacencyMatrix.map((r) => [...r]) },
    });
  }

  // ===========================================================================
  // Non-unitary operations (§5.9)
  // ===========================================================================

  /**
   * Measure a qubit into a classical bit.
   * @param syntax round-trip hint: "assignment", "arrow", or "bare".
   */
  measure(
    qubit: number,
    clbit?: ClassicalBitRef,
    syntax: MeasurementSyntax = "assignment",
  ): this {
    this._useQubit(qubit);
    if (clbit === undefined) {
      // Bare measurement: no classical target.
      return this._push({
        kind: "measure",
        qubits: [qubit],
        clbits: [],
        measurementSyntax: "bare",
      });
    }
    const flat = this.resolveClbit(clbit);
    return this._push({
      kind: "measure",
      qubits: [qubit],
      clbits: [flat],
      clbitRefs: [clbit],
      measurementSyntax: syntax,
    });
  }

  /** Measure a full qubit register into a classical register. */
  measureRegister(
    qubits: readonly number[],
    clbitRefs: readonly ClassicalBitRef[],
    syntax: MeasurementSyntax = "assignment",
  ): this {
    if (qubits.length !== clbitRefs.length) {
      throw new Error(`measureRegister: qubits and clbits lengths must match`);
    }
    for (let i = 0; i < qubits.length; i++) {
      this.measure(qubits[i], clbitRefs[i], syntax);
    }
    return this;
  }

  /** Reset a qubit to |0⟩. */
  reset(qubit: number): this {
    this._useQubit(qubit);
    return this._push({
      kind: "reset",
      qubits: [qubit],
      clbits: [],
    });
  }

  /** Barrier instruction on a set of qubits (or all if empty). */
  barrier(...qubits: number[]): this {
    const targets = qubits.length > 0 ? qubits : [];
    if (targets.length > 0) this._useQubits(targets);
    return this._push({
      kind: "barrier",
      qubits: targets,
      clbits: [],
    });
  }

  /** Delay instruction with duration expression. */
  delay(duration: DurationExpr, qubits: readonly number[] = []): this {
    if (qubits.length > 0) this._useQubits(qubits);
    return this._push({
      kind: "delay",
      qubits: [...qubits],
      clbits: [],
      duration,
    });
  }

  /** Timed gate/operation wrapper (Section 5.20). */
  timed(
    operation: Instruction,
    duration: DurationExpr,
  ): this {
    return this._push({
      kind: "timed",
      qubits: [...operation.qubits],
      clbits: [...operation.clbits],
      duration,
      payload: { operation },
    });
  }

  // ===========================================================================
  // Gate modifiers (§5.7)
  // ===========================================================================

  /**
   * Append an inverse-modified gate call. `inner` is the semantic
   * gate name (e.g. "h"); the exact modifier stack is preserved on
   * the instruction.
   */
  inv(
    innerName: string,
    qubits: readonly number[],
    parameters: readonly Angle[] = [],
  ): this {
    return this._appendGate(innerName, qubits, parameters.map(toAngleExpr), {
      modifiers: [{ kind: "inv" }],
    });
  }

  /** Append a `pow(k) @` modified gate call. */
  pow(
    k: Angle,
    innerName: string,
    qubits: readonly number[],
    parameters: readonly Angle[] = [],
  ): this {
    return this._appendGate(innerName, qubits, parameters.map(toAngleExpr), {
      modifiers: [{ kind: "pow", exponent: toAngleExpr(k) }],
    });
  }

  /** Append a `ctrl(n) @` modified gate call. */
  ctrl(
    numControls: number,
    innerName: string,
    qubits: readonly number[],
    parameters: readonly Angle[] = [],
  ): this {
    return this._appendGate(innerName, qubits, parameters.map(toAngleExpr), {
      modifiers: [{ kind: "ctrl", count: numControls }],
    });
  }

  /** Append a `negctrl(n) @` modified gate call. */
  negctrl(
    numControls: number,
    innerName: string,
    qubits: readonly number[],
    parameters: readonly Angle[] = [],
  ): this {
    return this._appendGate(innerName, qubits, parameters.map(toAngleExpr), {
      modifiers: [{ kind: "negctrl", count: numControls }],
    });
  }

  /**
   * Generic gate-call instruction that preserves every detail a
   * round-trip parser/serializer may need: `localPhase`, an outer
   * modifier stack, the surface gate-family name, and an arbitrary
   * parameter list.
   */
  applyGate(options: {
    name: string;
    qubits: readonly number[];
    parameters?: readonly Angle[];
    modifiers?: readonly GateModifier[];
    localPhase?: Angle;
    surfaceName?: string;
  }): this {
    return this._appendGate(
      options.name,
      options.qubits,
      (options.parameters ?? []).map(toAngleExpr),
      {
        modifiers: options.modifiers,
        localPhase: options.localPhase !== undefined
          ? toAngleExpr(options.localPhase)
          : undefined,
        surfaceName: options.surfaceName,
      },
    );
  }

  // ===========================================================================
  // Gate and subroutine definitions (§5.8, §5.11)
  // ===========================================================================

  /** Define a custom gate with a phase-owning nested body. */
  defineGate(
    name: string,
    params: readonly string[],
    qubits: readonly string[],
    body: QuantumCircuit,
  ): this {
    return this._push({
      kind: "gate-definition",
      qubits: [],
      clbits: [],
      name,
      payload: { params, qubits, body },
    });
  }

  /** Define a subroutine. */
  defineSubroutine(
    name: string,
    params: readonly { name: string; type: ClassicalType }[],
    returnType: ClassicalType | null,
    body: QuantumCircuit,
  ): this {
    return this._push({
      kind: "subroutine-definition",
      qubits: [],
      clbits: [],
      name,
      payload: { params, returnType, body },
    });
  }

  /** Declare an extern function. */
  declareExtern(
    name: string,
    params: readonly ClassicalType[],
    returnType: ClassicalType | null,
  ): this {
    return this._push({
      kind: "extern-declaration",
      qubits: [],
      clbits: [],
      name,
      payload: { params, returnType },
    });
  }

  // ===========================================================================
  // Classical declarations (§5.6)
  // ===========================================================================

  /**
   * Declare a classical scalar/array variable. Stored as an IR node;
   * the actual storage is managed by the simulator / transpiler.
   */
  declareClassicalVar(
    name: string,
    type: ClassicalType,
    initializer?: ClassicalExpr,
  ): this {
    return this._push({
      kind: "classical-declaration",
      qubits: [],
      clbits: [],
      name,
      payload: { type, initializer },
    });
  }

  /** Declare a compile-time constant. */
  declareConst(
    name: string,
    type: ClassicalType,
    value: ClassicalExpr,
  ): this {
    return this._push({
      kind: "const-declaration",
      qubits: [],
      clbits: [],
      name,
      payload: { type, value },
    });
  }

  /** Declare a runtime input parameter. */
  declareInput(
    name: string,
    type: ClassicalType,
    defaultValue?: ClassicalExpr,
  ): this {
    return this._push({
      kind: "input-declaration",
      qubits: [],
      clbits: [],
      name,
      payload: { type, defaultValue },
    });
  }

  /** Declare a runtime output variable. */
  declareOutput(
    name: string,
    type: ClassicalType,
    initializer?: ClassicalExpr,
  ): this {
    return this._push({
      kind: "output-declaration",
      qubits: [],
      clbits: [],
      name,
      payload: { type, initializer },
    });
  }

  /** Alias declaration `let name = target;`. */
  alias(name: string, target: ClassicalExpr | QuantumOperand): this {
    return this._push({
      kind: "alias-declaration",
      qubits: [],
      clbits: [],
      name,
      payload: { target },
    });
  }

  /** Legacy `qreg name[size];`. */
  declareLegacyQReg(name: string, size: number): this {
    return this._push({
      kind: "legacy-register-declaration",
      qubits: [],
      clbits: [],
      name,
      payload: { kind: "qreg", size },
    });
  }

  /** Legacy `creg name[size];` (distinct from modern `bit[N]`). */
  declareLegacyCReg(name: string, size: number): this {
    return this._push({
      kind: "legacy-register-declaration",
      qubits: [],
      clbits: [],
      name,
      payload: { kind: "creg", size },
    });
  }

  // ===========================================================================
  // Classical statements (§5.10)
  // ===========================================================================

  /** Simple assignment `target = value;`. */
  classicalAssign(target: ClassicalExpr, value: ClassicalExpr): this {
    return this._push({
      kind: "assignment",
      qubits: [],
      clbits: [],
      payload: { target, operator: "=" as AssignOp, value },
    });
  }

  /** Compound assignment `target op= value;`. */
  classicalAssignOp(
    target: ClassicalExpr,
    operator: AssignOp,
    value: ClassicalExpr,
  ): this {
    return this._push({
      kind: "assignment",
      qubits: [],
      clbits: [],
      payload: { target, operator, value },
    });
  }

  /** Bare expression statement `expr;`. */
  exprStatement(expression: ClassicalExpr): this {
    return this._push({
      kind: "expression-statement",
      qubits: [],
      clbits: [],
      payload: { expression },
    });
  }

  /** `return value;`. */
  returnValue(value: ClassicalExpr): this {
    return this._push({
      kind: "return",
      qubits: [],
      clbits: [],
      payload: { value },
    });
  }

  /** `return;`. */
  returnVoid(): this {
    return this._push({
      kind: "return",
      qubits: [],
      clbits: [],
      payload: null,
    });
  }

  // ===========================================================================
  // Control flow (§5.10)
  // ===========================================================================

  /** `if (condition) { trueBody } else { falseBody }`. */
  ifTest(
    condition: ClassicalExpr | Condition,
    trueBody: QuantumCircuit,
    falseBody?: QuantumCircuit,
  ): this {
    // Extend qubit count to cover nested body qubits.
    this._useQubits(this._mergeNestedQubits(trueBody));
    if (falseBody) this._useQubits(this._mergeNestedQubits(falseBody));
    return this._push({
      kind: "if",
      qubits: [],
      clbits: [],
      payload: { condition, trueBody, falseBody },
    });
  }

  /** `for typeName name in iterable { body }`. */
  forLoop(
    loopVariableName: string,
    iterable: ClassicalExpr,
    body: QuantumCircuit,
  ): this {
    this._useQubits(this._mergeNestedQubits(body));
    return this._push({
      kind: "for",
      qubits: [],
      clbits: [],
      payload: { loopVariableName, iterable, body },
    });
  }

  /** `while (condition) { body }`. */
  whileLoop(condition: ClassicalExpr, body: QuantumCircuit): this {
    this._useQubits(this._mergeNestedQubits(body));
    return this._push({
      kind: "while",
      qubits: [],
      clbits: [],
      payload: { condition, body },
    });
  }

  /** `switch (subject) { case v { ... } default { ... } }`. */
  switch(
    subject: ClassicalExpr,
    cases: readonly {
      values: readonly ClassicalExpr[];
      body: QuantumCircuit;
    }[],
    defaultBody?: QuantumCircuit,
  ): this {
    for (const c of cases) {
      this._useQubits(this._mergeNestedQubits(c.body));
    }
    if (defaultBody) this._useQubits(this._mergeNestedQubits(defaultBody));
    return this._push({
      kind: "switch",
      qubits: [],
      clbits: [],
      payload: { subject, cases, defaultBody },
    });
  }

  breakLoop(): this {
    return this._push({ kind: "break", qubits: [], clbits: [] });
  }

  continueLoop(): this {
    return this._push({ kind: "continue", qubits: [], clbits: [] });
  }

  end(): this {
    return this._push({ kind: "end", qubits: [], clbits: [] });
  }

  /** Box a sub-circuit with optional duration designator. */
  box(body: QuantumCircuit, duration?: DurationExpr): this {
    this._useQubits(this._mergeNestedQubits(body));
    return this._push({
      kind: "box",
      qubits: [],
      clbits: [],
      duration,
      payload: { body },
    });
  }

  private _mergeNestedQubits(nested: QuantumCircuit): number[] {
    const arr: number[] = [];
    for (let i = 0; i < nested._numQubits; i++) arr.push(i);
    return arr;
  }

  // ===========================================================================
  // State preparation (§5.19)
  // ===========================================================================

  /** Apply a state-preparation unitary that maps |0..0⟩ → state. */
  prepareState(state: StateSpec, qubits: readonly number[]): this {
    return this._appendGate("prepare_state", qubits, [], {
      kind: "prepare-state",
      payload: { state },
    } as Partial<Instruction>);
  }

  /** Reset then apply state preparation. */
  initialize(state: StateSpec, qubits: readonly number[]): this {
    return this._appendGate("initialize", qubits, [], {
      kind: "initialize",
      payload: { state },
    } as Partial<Instruction>);
  }

  // ===========================================================================
  // Annotations, pragmas, and comments (§5.13)
  // ===========================================================================

  /** Append a pragma directive. */
  pragma(text: string): this {
    return this._push({
      kind: "pragma",
      qubits: [],
      clbits: [],
      payload: { text },
    });
  }

  /** Annotate the next instruction (stored as its own IR node). */
  annotate(keyword: string, payload?: string): this {
    return this._push({
      kind: "annotation-statement",
      qubits: [],
      clbits: [],
      payload: { keyword, payload },
    });
  }

  /** Line comment `// text`. */
  lineComment(content: string): this {
    return this._push({
      kind: "comment",
      qubits: [],
      clbits: [],
      payload: { style: "line", content },
    });
  }

  /** Block comment `/* text *\/`. */
  blockComment(content: string): this {
    return this._push({
      kind: "comment",
      qubits: [],
      clbits: [],
      payload: { style: "block", content },
    });
  }

  // ===========================================================================
  // Composition (§5.7, §8.3)
  // ===========================================================================

  /**
   * Append `other` onto this circuit, optionally remapping its
   * qubits. `qubitMap[k]` gives the target qubit for `other`'s
   * qubit `k`; if omitted, the identity mapping is used.
   *
   * Classical registers from `other` are currently required to
   * already exist (or be compatible) on `this`; a full merge with
   * register renaming is left to the transpiler.
   */
  compose(other: QuantumCircuit, qubitMap?: readonly number[]): this {
    const map = qubitMap ?? (() => {
      const m: number[] = new Array(other._numQubits);
      for (let i = 0; i < other._numQubits; i++) m[i] = i;
      return m;
    })();
    if (map.length < other._numQubits) {
      throw new Error(`compose: qubitMap must have length ≥ other.numQubits`);
    }
    for (const instr of other.instructions) {
      const remapped: Instruction = {
        ...instr,
        qubits: instr.qubits.map((q) => map[q]),
      };
      this._useQubits(remapped.qubits);
      this.instructions.push(remapped);
    }
    // Add other's globalPhase into this scope's globalPhase.
    if (!isZeroPhase(other.globalPhase)) {
      this.globalPhase = AngleExpr.add(this.globalPhase, other.globalPhase);
    }
    return this;
  }

  /**
   * Convert this circuit into a reusable gate definition. Stored as
   * a snapshot of the current instruction list together with its
   * phase-owning body.
   */
  toGate(label?: string): {
    label: string;
    numQubits: number;
    body: QuantumCircuit;
  } {
    return {
      label: label ?? "custom_gate",
      numQubits: this._numQubits,
      body: this.clone(),
    };
  }

  /**
   * Convert this circuit into a reusable instruction (may contain
   * measurements). Same shape as `toGate`.
   */
  toInstruction(label?: string): {
    label: string;
    numQubits: number;
    body: QuantumCircuit;
  } {
    return this.toGate(label);
  }

  /** Deep-copy this circuit. */
  clone(): QuantumCircuit {
    const out = new QuantumCircuit(this.globalPhase);
    out.version = this.version ? { ...this.version } : null;
    out.versionOmitted = this.versionOmitted;
    out.includes = this.includes.map((i) => ({ ...i }));
    out.defcalGrammar = this.defcalGrammar ? { ...this.defcalGrammar } : null;
    out.classicalRegisters = this.classicalRegisters.map((r) => ({ ...r }));
    out._numQubits = this._numQubits;
    out._numClbits = this._numClbits;
    out.transpilationMetadata = this.transpilationMetadata
      ? { ...this.transpilationMetadata }
      : null;
    out.instructions = this.instructions.map((i) => ({ ...i }));
    return out;
  }

  /**
   * Invert this circuit: reverse the instruction order and invert
   * each gate. Only defined for unitary-only circuits; non-unitary
   * instructions (measure, reset, classical control) cause an error.
   */
  inverse(): QuantumCircuit {
    // Reject non-unitary contents.
    for (const instr of this.instructions) {
      if (
        instr.kind === "measure" ||
        instr.kind === "reset" ||
        instr.kind === "if" ||
        instr.kind === "for" ||
        instr.kind === "while" ||
        instr.kind === "switch" ||
        instr.kind === "classical-declaration" ||
        instr.kind === "assignment"
      ) {
        throw new Error(
          `inverse: non-unitary instruction '${instr.kind}' cannot be inverted`,
        );
      }
    }
    const out = new QuantumCircuit(AngleExpr.neg(this.globalPhase));
    out._numQubits = this._numQubits;
    out._numClbits = this._numClbits;
    out.classicalRegisters = this.classicalRegisters.map((r) => ({ ...r }));
    for (let i = this.instructions.length - 1; i >= 0; i--) {
      const instr = this.instructions[i];
      // Invert: prepend an `inv` modifier to the modifier stack.
      const invertedMods: GateModifier[] = [
        { kind: "inv" },
        ...(instr.modifiers ?? []),
      ];
      out.instructions.push({
        ...instr,
        modifiers: invertedMods,
      });
    }
    return out;
  }

  // ===========================================================================
  // Parameter binding and inspection
  // ===========================================================================

  /**
   * Return a new circuit with every symbolic `AngleExpr` parameter
   * bound to its resolved value. Instructions whose parameters are
   * already resolved are copied unchanged.
   */
  run(bindings: Readonly<Record<string, number | AngleExpr>>): QuantumCircuit {
    const out = this.clone();
    out.globalPhase = this.globalPhase.bind(bindings);
    out.instructions = out.instructions.map((instr) => ({
      ...instr,
      parameters: instr.parameters?.map((p) => p.bind(bindings)),
      localPhase: instr.localPhase
        ? instr.localPhase.bind(bindings)
        : undefined,
    }));
    return out;
  }

  /**
   * Aggregate circuit statistics: instruction count, per-gate counts,
   * depth, two-qubit and multi-qubit gate counts, measurement count.
   */
  complexity(): {
    instructionCount: number;
    gateCounts: Record<string, number>;
    depth: number;
    twoQubitGateCount: number;
    multiQubitGateCount: number;
    measurementCount: number;
  } {
    const gateCounts: Record<string, number> = {};
    let twoQubit = 0;
    let multiQubit = 0;
    let measurements = 0;
    // Depth: longest path over per-qubit timelines.
    const qubitDepths: number[] = new Array(this._numQubits).fill(0);
    for (const instr of this.instructions) {
      if (instr.kind === "measure") measurements++;
      if (instr.kind === "gate" && instr.name) {
        gateCounts[instr.name] = (gateCounts[instr.name] ?? 0) + 1;
        if (instr.qubits.length === 2) twoQubit++;
        else if (instr.qubits.length >= 3) multiQubit++;
      }
      if (instr.qubits.length > 0) {
        const maxPrev = Math.max(
          0,
          ...instr.qubits.map((q) => qubitDepths[q] ?? 0),
        );
        const next = maxPrev + 1;
        for (const q of instr.qubits) qubitDepths[q] = next;
      }
    }
    const depth = qubitDepths.reduce((a, b) => Math.max(a, b), 0);
    return {
      instructionCount: this.instructions.length,
      gateCounts,
      depth,
      twoQubitGateCount: twoQubit,
      multiQubitGateCount: multiQubit,
      measurementCount: measurements,
    };
  }

  // ===========================================================================
  // Generic instruction append (escape hatch)
  // ===========================================================================

  /**
   * Append a pre-built instruction. Used by the transpiler and
   * parsers that construct `Instruction` records directly.
   */
  append(instr: Instruction): this {
    if (instr.qubits.length > 0) this._useQubits(instr.qubits);
    for (const b of instr.clbits) {
      if (b >= this._numClbits) {
        throw new Error(`append: classical bit ${b} out of range`);
      }
    }
    return this._push(instr);
  }

  // ===========================================================================
  // Matrix materialization (delegates to gates.ts)
  // ===========================================================================

  /**
   * Compute the unitary matrix of this circuit assuming it is fully
   * unitary (no measurements, resets, or classical control). Uses
   * the `gates.ts` constructors + `compose` helper to build the
   * full `2^numQubits × 2^numQubits` matrix.
   *
   * This method is used by tests and by the transpiler's equality
   * checks. It throws for circuits containing non-unitary
   * instructions or arity-dependent gates with unresolved symbols.
   */
  toMatrix(): Matrix {
    const n = this._numQubits;
    const steps: { gate: Matrix; targets: readonly number[] }[] = [];
    // Prepend global phase if nonzero.
    if (!isZeroPhase(this.globalPhase)) {
      steps.push({
        gate: GlobalPhaseGate(this.globalPhase.evaluate()),
        targets: [],
      });
    }
    for (const instr of this.instructions) {
      if (instr.kind === "gate" || instr.kind === "global-phase") {
        const m = materializeGate(instr);
        steps.push({ gate: m, targets: instr.qubits });
      } else if (
        instr.kind === "barrier" || instr.kind === "delay" ||
        instr.kind === "comment" || instr.kind === "pragma" ||
        instr.kind === "annotation-statement"
      ) {
        // No-op for matrix construction.
        continue;
      } else {
        throw new Error(
          `toMatrix: non-unitary instruction '${instr.kind}' cannot be materialized`,
        );
      }
    }
    return compose(n, steps);
  }
}

// =============================================================================
// Gate dispatch: convert a gate Instruction to its concrete matrix.
// =============================================================================

/**
 * Convert a gate instruction to its concrete `Matrix` representation
 * by dispatching on the gate name and calling the corresponding
 * `gates.ts` constructor. Parameters are resolved to concrete
 * numbers; unresolved symbolic angles cause an error.
 */
export function materializeGate(instr: Instruction): Matrix {
  const resolveParam = (i: number): number => {
    const p = instr.parameters?.[i];
    if (!p) {
      throw new Error(
        `materializeGate: missing parameter ${i} for '${instr.name}'`,
      );
    }
    return p.evaluate();
  };
  // localPhase, if any, multiplies the resulting matrix.
  const applyLocalPhase = (m: Matrix): Matrix => {
    if (instr.localPhase && !isZeroPhase(instr.localPhase)) {
      const phi = instr.localPhase.evaluate();
      return m.scale(
        {
          re: Math.cos(phi),
          im: Math.sin(phi),
        } as unknown as import("./complex.ts").Complex,
      );
    }
    return m;
  };
  // Apply outer gate modifiers to the base matrix: inverse, power,
  // and controls. Controls require promoting via `liftGate` + the
  // controlled-lifting rule of Phase Convention 4, but since the
  // inner matrix is already concrete we can use the direct block
  // assembly helper from gates.ts via `MCMTGate` equivalence.
  //
  // For the purpose of `toMatrix`, we only need to materialize
  // modifiers when they are present; for gates without modifiers
  // the base matrix is returned directly.
  const applyModifiers = (base: Matrix): Matrix => {
    const mods = instr.modifiers;
    if (!mods || mods.length === 0) return base;
    // Outermost-first array: apply right-to-left to base.
    let m = base;
    for (let i = mods.length - 1; i >= 0; i--) {
      const mod = mods[i];
      if (mod.kind === "inv") {
        m = m.dagger();
      } else if (mod.kind === "pow") {
        const k = mod.exponent.evaluate();
        if (!Number.isInteger(k)) {
          throw new Error(
            `materializeGate: non-integer pow not supported for matrix materialization`,
          );
        }
        if (k === 0) {
          m = Matrix.identity(m.rows);
        } else if (k > 0) {
          let r = m;
          for (let j = 1; j < k; j++) r = r.multiply(m);
          m = r;
        } else {
          const inv = m.dagger();
          let r = inv;
          for (let j = 1; j < -k; j++) r = r.multiply(inv);
          m = r;
        }
      } else if (mod.kind === "ctrl") {
        // Lift m to a `ctrl^{count}(m)` matrix via MCMTGate on the
        // target register (the existing `m` acts on the target qubits).
        const targetQubits = Math.log2(m.rows);
        if (!Number.isInteger(targetQubits)) {
          throw new Error(
            `materializeGate: non-power-of-two matrix in ctrl modifier`,
          );
        }
        // Build ctrl^{count} of an arbitrary target unitary by direct block assembly.
        m = liftControlledBlock(m, mod.count);
      } else if (mod.kind === "negctrl") {
        const targetQubits = Math.log2(m.rows);
        if (!Number.isInteger(targetQubits)) {
          throw new Error(
            `materializeGate: non-power-of-two matrix in negctrl modifier`,
          );
        }
        m = liftControlledBlock(m, mod.count);
        // Conjugate the new control qubits with X before and after.
        // The new controls are prepended as the top `count` arg positions.
        const totalArgs = Math.log2(m.rows);
        for (let c = 0; c < mod.count; c++) {
          m = liftGate(XGate(), [c], totalArgs).multiply(m).multiply(
            liftGate(XGate(), [c], totalArgs),
          );
        }
      }
    }
    return m;
  };

  const name = instr.name;
  let base: Matrix;
  // Tier 0
  if (name === "id") base = IGate();
  else if (name === "h") base = HGate();
  else if (name === "x") base = XGate();
  else if (name === "y") base = YGate();
  else if (name === "z") base = ZGate();
  else if (name === "p") base = PhaseGate(resolveParam(0));
  else if (name === "r") base = RGate(resolveParam(0), resolveParam(1));
  else if (name === "rx") base = RXGate(resolveParam(0));
  else if (name === "ry") base = RYGate(resolveParam(0));
  else if (name === "rz") base = RZGate(resolveParam(0));
  else if (name === "s") base = SGate();
  else if (name === "sdg") base = SdgGate();
  else if (name === "sx") base = SXGate();
  else if (name === "sxdg") base = SXdgGate();
  else if (name === "t") base = TGate();
  else if (name === "tdg") base = TdgGate();
  else if (name === "u") {
    base = UGate(resolveParam(0), resolveParam(1), resolveParam(2));
  } else if (name === "rv") {
    base = RVGate(resolveParam(0), resolveParam(1), resolveParam(2));
  } else if (name === "gphase") base = GlobalPhaseGate(resolveParam(0));
  // Tier 1
  else if (name === "cx") base = CXGate();
  // Tier 2
  else if (name === "cz") base = CZGate();
  else if (name === "cy") base = CYGate();
  else if (name === "cp") base = CPhaseGate(resolveParam(0));
  else if (name === "crz") base = CRZGate(resolveParam(0));
  else if (name === "cry") base = CRYGate(resolveParam(0));
  else if (name === "crx") base = CRXGate(resolveParam(0));
  else if (name === "cs") base = CSGate();
  else if (name === "csdg") base = CSdgGate();
  else if (name === "csx") base = CSXGate();
  else if (name === "ch") base = CHGate();
  else if (name === "cu") {
    base = CUGate(
      resolveParam(0),
      resolveParam(1),
      resolveParam(2),
      resolveParam(3),
    );
  } else if (name === "dcx") base = DCXGate();
  // Tier 3
  else if (name === "swap") base = SwapGate();
  else if (name === "rzz") base = RZZGate(resolveParam(0));
  else if (name === "rxx") base = RXXGate(resolveParam(0));
  else if (name === "ryy") base = RYYGate(resolveParam(0));
  else if (name === "rzx") base = RZXGate(resolveParam(0));
  else if (name === "ecr") base = ECRGate();
  else if (name === "iswap") base = iSwapGate();
  else if (name === "xx_plus_yy") {
    base = XXPlusYYGate(resolveParam(0), resolveParam(1));
  } else if (name === "xx_minus_yy") {
    base = XXMinusYYGate(resolveParam(0), resolveParam(1));
  } // Tier 4
  else if (name === "ccx") base = CCXGate();
  else if (name === "ccz") base = CCZGate();
  else if (name === "cswap") base = CSwapGate();
  else if (name === "rccx") base = RCCXGate();
  // Tier 5
  else if (name === "c3x") base = C3XGate();
  else if (name === "c3sx") base = C3SXGate();
  else if (name === "c4x") base = C4XGate();
  else if (name === "rc3x") base = RC3XGate();
  else if (name === "mcx") base = MCXGate(instr.qubits.length - 1);
  else if (name === "mcp") {
    base = MCPhaseGate(resolveParam(0), instr.qubits.length - 1);
  } // Tier 6
  else if (name === "ms") base = MSGate(resolveParam(0), instr.qubits.length);
  else if (name === "pauli") {
    const p = instr.payload as { pauliString: string };
    base = PauliGate(p.pauliString);
  } else if (name === "diagonal") {
    const p = instr.payload as { phases: number[] };
    base = DiagonalGate(p.phases);
  } else if (name === "permutation") {
    const p = instr.payload as { sigma: number[] };
    base = PermutationGate(p.sigma);
  } else if (name === "mcmt") {
    const p = instr.payload as {
      gate: Matrix;
      numControls: number;
      numTargets: number;
    };
    base = MCMTGate(p.gate, p.numControls, p.numTargets);
  } else if (name === "pauli_product_rotation") {
    const p = instr.payload as { pauliString: string };
    base = PauliProductRotationGate(resolveParam(0), p.pauliString);
  } // Tier 7
  else if (name === "ucrz") {
    const p = instr.payload as { angles: number[] };
    base = UCRZGate(p.angles);
  } else if (name === "ucry") {
    const p = instr.payload as { angles: number[] };
    base = UCRYGate(p.angles);
  } else if (name === "ucrx") {
    const p = instr.payload as { angles: number[] };
    base = UCRXGate(p.angles);
  } else if (name === "uc_pauli_rot") {
    const p = instr.payload as { angles: number[]; axis: "X" | "Y" | "Z" };
    base = UCPauliRotGate(p.angles, p.axis);
  } else if (name === "uc") {
    const p = instr.payload as { unitaries: Matrix[] };
    base = UCGate(p.unitaries);
  } else if (name === "unitary") {
    const p = instr.payload as { matrix: Matrix };
    base = UnitaryGate(p.matrix);
  } else if (name === "linear_function") {
    const p = instr.payload as { matrix: number[][] };
    base = LinearFunction(p.matrix);
  } else if (name === "isometry") {
    const p = instr.payload as { matrix: Matrix };
    base = Isometry(p.matrix);
  } // Tier 8
  else if (name === "pauli_evolution") {
    const p = instr.payload as { terms: PauliTerm[] };
    base = PauliEvolutionGate(p.terms, resolveParam(0));
  } else if (name === "hamiltonian") {
    const p = instr.payload as { matrix: Matrix };
    base = HamiltonianGate(p.matrix, resolveParam(0));
  } // Tier 9
  else if (name === "qft") base = QFTGate(instr.qubits.length);
  // Tier 10
  else if (name === "and") base = AndGate(instr.qubits.length - 1);
  else if (name === "or") base = OrGate(instr.qubits.length - 1);
  else if (name === "bitwise_xor") {
    const p = instr.payload as { n: number };
    base = BitwiseXorGate(p.n);
  } else if (name === "inner_product") {
    const p = instr.payload as { n: number };
    base = InnerProductGate(p.n);
  } // Tier 11
  else if (name === "half_adder") base = HalfAdderGate();
  else if (name === "full_adder") base = FullAdderGate();
  else if (name === "modular_adder") {
    const p = instr.payload as { n: number };
    base = ModularAdderGate(p.n);
  } else if (name === "multiplier") {
    const p = instr.payload as { n: number };
    base = MultiplierGate(p.n);
  } // Tier 12
  else if (name === "linear_pauli_rotations") {
    const p = instr.payload as { axis: "X" | "Y" | "Z"; numStateBits: number };
    base = LinearPauliRotationsGate(
      resolveParam(0),
      resolveParam(1),
      p.numStateBits,
      p.axis,
    );
  } else if (name === "polynomial_pauli_rotations") {
    const p = instr.payload as {
      coeffs: number[];
      axis: "X" | "Y" | "Z";
      numStateBits: number;
    };
    base = PolynomialPauliRotationsGate(p.coeffs, p.numStateBits, p.axis);
  } else if (name === "piecewise_linear_pauli_rotations") {
    const p = instr.payload as {
      breakpoints: number[];
      slopes: number[];
      offsets: number[];
      axis: "X" | "Y" | "Z";
      numStateBits: number;
    };
    base = PiecewiseLinearPauliRotationsGate(
      p.breakpoints,
      p.slopes,
      p.offsets,
      p.numStateBits,
      p.axis,
    );
  } else if (name === "piecewise_polynomial_pauli_rotations") {
    const p = instr.payload as {
      breakpoints: number[];
      coeffsList: number[][];
      axis: "X" | "Y" | "Z";
      numStateBits: number;
    };
    base = PiecewisePolynomialPauliRotationsGate(
      p.breakpoints,
      p.coeffsList,
      p.numStateBits,
      p.axis,
    );
  } else if (name === "piecewise_chebyshev") {
    const p = instr.payload as {
      fSamples: number[][];
      breakpoints: number[];
      axis: "X" | "Y" | "Z";
      numStateBits: number;
    };
    base = PiecewiseChebyshevGate(
      p.fSamples,
      p.breakpoints,
      p.numStateBits,
      p.axis,
    );
  } else if (name === "linear_amplitude_function") {
    const p = instr.payload as {
      domain: [number, number];
      image: [number, number];
      numStateBits: number;
    };
    base = LinearAmplitudeFunctionGate(
      resolveParam(0),
      resolveParam(1),
      p.domain,
      p.image,
      p.numStateBits,
    );
  } else if (name === "exact_reciprocal") {
    const p = instr.payload as { numStateBits: number };
    base = ExactReciprocalGate(p.numStateBits, resolveParam(0));
  } // Tier 13
  else if (name === "integer_comparator") {
    const p = instr.payload as {
      value: number;
      geq: boolean;
      numStateBits: number;
    };
    base = IntegerComparatorGate(p.value, p.numStateBits, p.geq);
  } else if (name === "quadratic_form") {
    const p = instr.payload as {
      A: number[][];
      b: number[];
      c: number;
      numStateBits: number;
      numResultBits: number;
    };
    base = QuadraticFormGate(p.A, p.b, p.c, p.numStateBits, p.numResultBits);
  } else if (name === "weighted_sum") {
    const p = instr.payload as {
      weights: number[];
      numStateBits: number;
      numSumBits: number;
    };
    base = WeightedSumGate(p.weights, p.numStateBits, p.numSumBits);
  } else if (name === "phase_oracle") {
    const p = instr.payload as { esop: ESOPTerm[] };
    base = PhaseOracleGate(p.esop, instr.qubits.length);
  } else if (name === "bit_flip_oracle") {
    const p = instr.payload as { esop: ESOPTerm[] };
    base = BitFlipOracleGate(p.esop, instr.qubits.length - 1);
  } // Tier 14
  else if (name === "graph_state") {
    const p = instr.payload as { adjacencyMatrix: number[][] };
    base = GraphStateGate(p.adjacencyMatrix);
  } else {
    throw new Error(`materializeGate: unknown gate '${name}'`);
  }
  return applyLocalPhase(applyModifiers(base));
}

// =============================================================================
// Helpers
// =============================================================================

/** Test whether an `AngleExpr` is provably zero. */
function isZeroPhase(e: AngleExpr): boolean {
  if (e.kind === "int" && e.num === 0) return true;
  if (e.kind === "float" && e.num === 0) return true;
  return false;
}

import { Complex as _Complex } from "./complex.ts";
import { Matrix as _Matrix } from "./matrix.ts";

/**
 * Build `ctrl^numControls(U)` for an arbitrary square unitary `U` by
 * direct block assembly: identity on every control basis state except
 * the fully enabled `|1...1⟩` subspace, where `U` acts on the target
 * register. Local shorthand used only by `materializeGate` for
 * modifier expansion.
 */
function liftControlledBlock(U: _Matrix, numControls: number): _Matrix {
  const targetDim = U.rows;
  const dim = (1 << numControls) * targetDim;
  // Start with identity.
  const data: _Complex[][] = [];
  for (let i = 0; i < dim; i++) {
    const row: _Complex[] = new Array(dim);
    for (let j = 0; j < dim; j++) {
      row[j] = i === j ? _Complex.ONE : _Complex.ZERO;
    }
    data.push(row);
  }
  const controlMask = ((1 << numControls) - 1) * targetDim;
  for (let jr = 0; jr < targetDim; jr++) {
    for (let jc = 0; jc < targetDim; jc++) {
      data[controlMask | jr][controlMask | jc] = U.get(jr, jc);
    }
  }
  return new _Matrix(data);
}
