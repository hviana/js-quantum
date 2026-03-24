/**
 * @module simulator
 * Quantum circuit simulation engine.
 *
 * Simulates quantum circuits by maintaining a state vector of 2^n complex
 * amplitudes and applying gate operations directly to it. Measurement is
 * performed using the Born rule with pseudo-random sampling.
 *
 * The simulator supports:
 * - All single-qubit, two-qubit, and multi-qubit gates
 * - Controlled gates (arbitrary control qubit)
 * - Classical conditions (gate executes only if classical register matches)
 * - Measurement (collapses state, stores result in classical register)
 * - Reset (forces qubit to |0⟩)
 * - Parameterized circuits (parameters resolved at simulation time)
 *
 * @author Henrique Emanoel Viana
 * @license MIT
 */

import { Complex } from "./complex.ts";
import type {
  CircuitInstruction,
  QuantumCode,
  SimulationParams,
  SimulationResult,
} from "./types.ts";
import * as gates from "./gates.ts";

/**
 * Simulates a quantum circuit for a given number of shots.
 *
 * Each "shot" is a full execution of the circuit from the initial state |0...0⟩
 * through all gates and measurements. The final measured outcomes across all
 * shots are aggregated into probability percentages.
 *
 * @param code - The quantum circuit to simulate (created by `quantum()`).
 * @param params - Named parameters resolved at simulation time (e.g., rotation angles).
 * @param numShots - Number of simulation shots (repetitions). More shots → more precise statistics.
 * @returns A map from computational basis state labels (e.g., "00", "01") to their measured probability percentages (0–100).
 *
 * @example
 * ```ts
 * import { quantum, simulate } from "@hev/js-quantum";
 *
 * const bell = quantum(2, 2, (qc) => {
 *   qc.h(0);
 *   qc.cx(0, 1);
 *   qc.measure(0, 0);
 *   qc.measure(1, 1);
 * });
 *
 * const result = simulate(bell, {}, 1024);
 * // result ≈ { "00": 50, "11": 50 }
 * ```
 *
 * @throws {Error} If a required parameter is missing or if the circuit is invalid.
 */
export function simulate(
  code: QuantumCode,
  params: SimulationParams = {},
  numShots = 1024,
): SimulationResult {
  // Validate parameters
  for (const name of code.parameterNames) {
    if (!(name in params)) {
      throw new Error(`Missing simulation parameter: "${name}"`);
    }
  }

  if (numShots < 1 || !Number.isInteger(numShots)) {
    throw new Error("numShots must be a positive integer");
  }

  const n = code.numQubits;
  const numStates = 1 << n; // 2^n
  const counts: Record<string, number> = {};

  for (let shot = 0; shot < numShots; shot++) {
    // Initialize state vector to |0...0⟩
    const state: Complex[] = new Array(numStates);
    for (let i = 0; i < numStates; i++) {
      state[i] = Complex.ZERO;
    }
    state[0] = Complex.ONE;

    // Initialize classical register
    const classicalBits = new Array<number>(code.numClassicalBits).fill(0);

    // Execute each instruction in order
    for (const instr of code.instructions) {
      // Check classical condition
      if (instr.condition !== undefined) {
        const regValue = classicalBitsToInt(classicalBits);
        if (regValue !== instr.condition.value) {
          continue; // Skip this instruction
        }
      }

      // Resolve parameters
      const resolvedParams = resolveParams(instr, params);

      // Execute the instruction
      executeInstruction(instr, resolvedParams, state, classicalBits, n);
    }

    // Record the classical register outcome
    const outcome = classicalBits.join("");
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }

  // If no measurements were performed, sample from the final state probabilities
  const hasMeasure = code.instructions.some((i) => i.gate === "measure");
  if (!hasMeasure) {
    // Run one more simulation to get the state vector, then compute probabilities
    const state: Complex[] = new Array(numStates);
    for (let i = 0; i < numStates; i++) state[i] = Complex.ZERO;
    state[0] = Complex.ONE;
    const classicalBits = new Array<number>(code.numClassicalBits).fill(0);

    for (const instr of code.instructions) {
      if (instr.condition !== undefined) {
        const regValue = classicalBitsToInt(classicalBits);
        if (regValue !== instr.condition.value) continue;
      }
      const resolvedParams = resolveParams(instr, params);
      executeInstruction(instr, resolvedParams, state, classicalBits, n);
    }

    // Return theoretical probabilities
    const result: SimulationResult = {};
    for (let i = 0; i < numStates; i++) {
      const label = i.toString(2).padStart(n, "0");
      const prob = state[i]!.magnitudeSquared() * 100;
      if (prob > 1e-10) {
        result[label] = Math.round(prob * 1e6) / 1e6;
      }
    }
    return result;
  }

  // Convert counts to percentages
  const result: SimulationResult = {};
  const numBits = code.numClassicalBits || n;
  for (let i = 0; i < (1 << numBits); i++) {
    const label = i.toString(2).padStart(numBits, "0");
    if (counts[label]) {
      result[label] = Math.round(((counts[label]!) / numShots) * 100 * 1e4) /
        1e4;
    }
  }
  return result;
}

/**
 * Returns the state vector after executing the circuit (no measurement collapse).
 *
 * Useful for debugging and verification. Does not perform measurements —
 * measure instructions are skipped.
 *
 * @param code - The quantum circuit.
 * @param params - Named parameters for parameterized gates.
 * @returns Array of complex amplitudes (length 2^numQubits).
 */
export function getStateVector(
  code: QuantumCode,
  params: SimulationParams = {},
): Complex[] {
  for (const name of code.parameterNames) {
    if (!(name in params)) {
      throw new Error(`Missing simulation parameter: "${name}"`);
    }
  }

  const n = code.numQubits;
  const numStates = 1 << n;
  const state: Complex[] = new Array(numStates);
  for (let i = 0; i < numStates; i++) state[i] = Complex.ZERO;
  state[0] = Complex.ONE;

  const classicalBits = new Array<number>(code.numClassicalBits).fill(0);

  for (const instr of code.instructions) {
    if (instr.gate === "measure") continue; // Skip measurements
    if (instr.condition !== undefined) {
      const regValue = classicalBitsToInt(classicalBits);
      if (regValue !== instr.condition.value) continue;
    }
    const resolvedParams = resolveParams(instr, params);
    executeInstruction(instr, resolvedParams, state, classicalBits, n);
  }

  return state;
}

// ─── Internal Helpers ──────────────────────────────────────────────────

/** Resolves parameter references in an instruction. */
function resolveParams(
  instr: CircuitInstruction,
  params: SimulationParams,
): number[] {
  if (instr.paramRefs && instr.paramRefs.length > 0) {
    return instr.paramRefs.map((name) => {
      if (!(name in params)) {
        throw new Error(`Missing parameter: "${name}"`);
      }
      return params[name]!;
    });
  }
  return instr.params;
}

/** Converts classical bit array to integer (big-endian). */
function classicalBitsToInt(bits: number[]): number {
  let val = 0;
  for (let i = 0; i < bits.length; i++) {
    val = (val << 1) | (bits[i]! & 1);
  }
  return val;
}

/**
 * Executes a single instruction on the state vector.
 */
function executeInstruction(
  instr: CircuitInstruction,
  resolvedParams: number[],
  state: Complex[],
  classicalBits: number[],
  numQubits: number,
): void {
  const { gate, targets, ctrl } = instr;

  // ─── Non-unitary operations ───────────────────────────────────
  if (gate === "measure") {
    performMeasurement(
      state,
      targets[0]!,
      classicalBits,
      resolvedParams[0]!,
      numQubits,
    );
    return;
  }

  if (gate === "reset") {
    performReset(state, targets[0]!, numQubits);
    return;
  }

  // ─── Unitary gates ────────────────────────────────────────────
  if (ctrl !== undefined) {
    // Controlled version of the gate
    applyControlledGate(gate, targets, resolvedParams, ctrl, state, numQubits);
  } else {
    applyGate(gate, targets, resolvedParams, state, numQubits);
  }
}

/**
 * Applies a single-qubit gate directly to the state vector.
 * Uses the efficient pair-wise iteration approach.
 */
function applySingleQubitGate(
  matrix: Complex[][],
  qubit: number,
  state: Complex[],
  numQubits: number,
): void {
  const numStates = 1 << numQubits;
  // qubit index in state vector: bit position = numQubits - 1 - qubit
  const bitPos = numQubits - 1 - qubit;
  const step = 1 << bitPos;

  for (let i = 0; i < numStates; i++) {
    // Process only indices where the target bit is 0
    if ((i >> bitPos) & 1) continue;

    const i0 = i; // index with target bit = 0
    const i1 = i | step; // index with target bit = 1

    const a0 = state[i0]!;
    const a1 = state[i1]!;

    // Apply 2x2 matrix: [m00, m01; m10, m11] * [a0; a1]
    state[i0] = matrix[0]![0]!.mul(a0).add(matrix[0]![1]!.mul(a1));
    state[i1] = matrix[1]![0]!.mul(a0).add(matrix[1]![1]!.mul(a1));
  }
}

/**
 * Applies a two-qubit gate directly to the state vector.
 */
function applyTwoQubitGate(
  matrix: Complex[][],
  qubit1: number,
  qubit2: number,
  state: Complex[],
  numQubits: number,
): void {
  const numStates = 1 << numQubits;
  const bit1 = numQubits - 1 - qubit1;
  const bit2 = numQubits - 1 - qubit2;

  const visited = new Uint8Array(numStates);

  for (let base = 0; base < numStates; base++) {
    if (visited[base]) continue;

    // Clear both target bits to get the base index
    const cleared = base & ~(1 << bit1) & ~(1 << bit2);
    if (visited[cleared]) continue;

    // Four indices corresponding to the 2-qubit subspace
    const i00 = cleared;
    const i01 = cleared | (1 << bit2);
    const i10 = cleared | (1 << bit1);
    const i11 = cleared | (1 << bit1) | (1 << bit2);

    visited[i00] = 1;
    visited[i01] = 1;
    visited[i10] = 1;
    visited[i11] = 1;

    const amps = [state[i00]!, state[i01]!, state[i10]!, state[i11]!];
    const newAmps: Complex[] = [
      Complex.ZERO,
      Complex.ZERO,
      Complex.ZERO,
      Complex.ZERO,
    ];

    for (let r = 0; r < 4; r++) {
      let sum = Complex.ZERO;
      for (let c = 0; c < 4; c++) {
        sum = sum.add(matrix[r]![c]!.mul(amps[c]!));
      }
      newAmps[r] = sum;
    }

    state[i00] = newAmps[0]!;
    state[i01] = newAmps[1]!;
    state[i10] = newAmps[2]!;
    state[i11] = newAmps[3]!;
  }
}

/**
 * Applies a multi-qubit gate using the full matrix representation.
 */
function applyMultiQubitGate(
  matrix: Complex[][],
  qubits: number[],
  state: Complex[],
  numQubits: number,
): void {
  const numStates = 1 << numQubits;
  const nGateQubits = qubits.length;
  const gateSize = 1 << nGateQubits;

  // Bit positions for each gate qubit
  const bitPositions = qubits.map((q) => numQubits - 1 - q);

  const visited = new Uint8Array(numStates);

  for (let base = 0; base < numStates; base++) {
    if (visited[base]) continue;

    // Clear all gate qubit bits
    let cleared = base;
    for (const bp of bitPositions) {
      cleared &= ~(1 << bp);
    }
    if (visited[cleared]) continue;

    // Enumerate all 2^nGateQubits indices in this subspace
    const indices: number[] = [];
    for (let g = 0; g < gateSize; g++) {
      let idx = cleared;
      for (let k = 0; k < nGateQubits; k++) {
        if ((g >> (nGateQubits - 1 - k)) & 1) {
          idx |= 1 << bitPositions[k]!;
        }
      }
      indices.push(idx);
      visited[idx] = 1;
    }

    // Gather amplitudes
    const amps = indices.map((idx) => state[idx]!);

    // Apply matrix
    const newAmps: Complex[] = [];
    for (let r = 0; r < gateSize; r++) {
      let sum = Complex.ZERO;
      for (let c = 0; c < gateSize; c++) {
        sum = sum.add(matrix[r]![c]!.mul(amps[c]!));
      }
      newAmps.push(sum);
    }

    // Write back
    for (let g = 0; g < gateSize; g++) {
      state[indices[g]!] = newAmps[g]!;
    }
  }
}

/**
 * Routes a gate to the appropriate application function.
 */
function applyGate(
  gateName: string,
  targets: number[],
  params: number[],
  state: Complex[],
  numQubits: number,
): void {
  // Single-qubit gates
  const singleGates = new Set([
    "h",
    "x",
    "y",
    "z",
    "s",
    "sdg",
    "t",
    "tdg",
    "sx",
    "sxdg",
    "id",
    "p",
    "rz",
    "rx",
    "u",
  ]);

  if (singleGates.has(gateName)) {
    const mat = gates.getGateMatrix(gateName, params);
    const matData = mat.data as Complex[][];
    applySingleQubitGate(matData, targets[0]!, state, numQubits);
    return;
  }

  // Two-qubit gates
  if (gateName === "cx") {
    applyCNOT(targets[0]!, targets[1]!, state, numQubits);
    return;
  }

  if (gateName === "swap") {
    applySWAP(targets[0]!, targets[1]!, state, numQubits);
    return;
  }

  if (gateName === "rxx" || gateName === "rzz") {
    const mat = gates.getGateMatrix(gateName, params);
    const matData = mat.data as Complex[][];
    applyTwoQubitGate(matData, targets[0]!, targets[1]!, state, numQubits);
    return;
  }

  // Three-qubit gates
  if (gateName === "ccx") {
    applyToffoli(targets[0]!, targets[1]!, targets[2]!, state, numQubits);
    return;
  }

  if (gateName === "rccx" || gateName === "rc3x") {
    const mat = gates.getGateMatrix(gateName, params);
    const matData = mat.data as Complex[][];
    applyMultiQubitGate(matData, targets, state, numQubits);
    return;
  }

  throw new Error(`Unknown gate: ${gateName}`);
}

/**
 * Applies a controlled version of any gate.
 * The gate is applied to target qubits only when the control qubit is |1⟩.
 */
function applyControlledGate(
  gateName: string,
  targets: number[],
  params: number[],
  ctrlQubit: number,
  state: Complex[],
  numQubits: number,
): void {
  const numStates = 1 << numQubits;
  const ctrlBitPos = numQubits - 1 - ctrlQubit;

  // Save and zero out amplitudes where control is |0⟩
  const savedState: Complex[] = [...state];

  // Zero out amplitudes where control is 0, apply gate, restore
  // Strategy: mask out control=0 states, apply gate, then reconstruct

  // Step 1: Save state
  const stateBackup = [...state];

  // Step 2: Zero out states where control is 1
  for (let i = 0; i < numStates; i++) {
    if ((i >> ctrlBitPos) & 1) {
      state[i] = Complex.ZERO;
    }
  }
  const ctrl0State = [...state];

  // Step 3: Restore and zero out states where control is 0
  for (let i = 0; i < numStates; i++) {
    state[i] = stateBackup[i]!;
  }
  for (let i = 0; i < numStates; i++) {
    if (!((i >> ctrlBitPos) & 1)) {
      state[i] = Complex.ZERO;
    }
  }

  // Step 4: Apply gate to the control=1 subspace
  applyGate(gateName, targets, params, state, numQubits);

  // Step 5: Add back the control=0 part
  for (let i = 0; i < numStates; i++) {
    state[i] = state[i]!.add(ctrl0State[i]!);
  }
}

/**
 * Efficient CNOT implementation (direct state vector manipulation).
 */
function applyCNOT(
  control: number,
  target: number,
  state: Complex[],
  numQubits: number,
): void {
  const numStates = 1 << numQubits;
  const ctrlBit = numQubits - 1 - control;
  const tgtBit = numQubits - 1 - target;

  for (let i = 0; i < numStates; i++) {
    // Only process states where control is 1 and target is 0
    if (((i >> ctrlBit) & 1) && !((i >> tgtBit) & 1)) {
      const j = i | (1 << tgtBit);
      const tmp = state[i]!;
      state[i] = state[j]!;
      state[j] = tmp;
    }
  }
}

/**
 * Efficient SWAP implementation.
 */
function applySWAP(
  qubit1: number,
  qubit2: number,
  state: Complex[],
  numQubits: number,
): void {
  const numStates = 1 << numQubits;
  const bit1 = numQubits - 1 - qubit1;
  const bit2 = numQubits - 1 - qubit2;

  for (let i = 0; i < numStates; i++) {
    const b1 = (i >> bit1) & 1;
    const b2 = (i >> bit2) & 1;
    // Only swap when bits differ: |...1...0...⟩ ↔ |...0...1...⟩
    if (b1 !== b2 && b1 === 1) {
      const j = (i & ~(1 << bit1)) | (1 << bit2);
      const tmp = state[i]!;
      state[i] = state[j]!;
      state[j] = tmp;
    }
  }
}

/**
 * Efficient Toffoli implementation.
 */
function applyToffoli(
  ctrl1: number,
  ctrl2: number,
  target: number,
  state: Complex[],
  numQubits: number,
): void {
  const numStates = 1 << numQubits;
  const c1Bit = numQubits - 1 - ctrl1;
  const c2Bit = numQubits - 1 - ctrl2;
  const tBit = numQubits - 1 - target;

  for (let i = 0; i < numStates; i++) {
    // Only when both controls are 1 and target is 0
    if (((i >> c1Bit) & 1) && ((i >> c2Bit) & 1) && !((i >> tBit) & 1)) {
      const j = i | (1 << tBit);
      const tmp = state[i]!;
      state[i] = state[j]!;
      state[j] = tmp;
    }
  }
}

/**
 * Performs a measurement on a qubit (Born rule sampling).
 * Collapses the state and stores the result in the classical register.
 */
function performMeasurement(
  state: Complex[],
  qubit: number,
  classicalBits: number[],
  classicalBitIndex: number,
  numQubits: number,
): void {
  const numStates = 1 << numQubits;
  const bitPos = numQubits - 1 - qubit;

  // Compute probability of measuring |1⟩
  let prob1 = 0;
  for (let i = 0; i < numStates; i++) {
    if ((i >> bitPos) & 1) {
      prob1 += state[i]!.magnitudeSquared();
    }
  }

  // Sample outcome
  const rand = Math.random();
  const outcome = rand < prob1 ? 1 : 0;

  // Store result
  if (classicalBitIndex < classicalBits.length) {
    classicalBits[classicalBitIndex] = outcome;
  }

  // Collapse state: zero out states inconsistent with outcome, renormalize
  const normFactor = outcome === 1 ? prob1 : (1 - prob1);
  if (normFactor < 1e-15) return; // Already in a definite state

  const norm = 1 / Math.sqrt(normFactor);
  for (let i = 0; i < numStates; i++) {
    const bit = (i >> bitPos) & 1;
    if (bit === outcome) {
      state[i] = state[i]!.scale(norm);
    } else {
      state[i] = Complex.ZERO;
    }
  }
}

/**
 * Resets a qubit to |0⟩ by projecting and renormalizing.
 */
function performReset(
  state: Complex[],
  qubit: number,
  numQubits: number,
): void {
  const numStates = 1 << numQubits;
  const bitPos = numQubits - 1 - qubit;
  const step = 1 << bitPos;

  // For each pair (i0, i1) where they differ only in the target bit:
  // Set |0⟩ amplitude to √(|a0|² + |a1|²), set |1⟩ amplitude to 0.
  // This preserves entanglement structure while forcing qubit to |0⟩.
  for (let i = 0; i < numStates; i++) {
    if ((i >> bitPos) & 1) continue; // Process each pair once

    const i0 = i;
    const i1 = i | step;

    const a0 = state[i0]!;
    const a1 = state[i1]!;

    // Combine amplitudes into the |0⟩ branch
    const totalProb = a0.magnitudeSquared() + a1.magnitudeSquared();
    if (totalProb < 1e-30) {
      state[i0] = Complex.ZERO;
    } else {
      // Preserve the relative phase of a0, scale to total probability
      const phase = a0.isZero()
        ? Complex.ONE
        : new Complex(a0.re / a0.magnitude(), a0.im / a0.magnitude());
      state[i0] = phase.scale(Math.sqrt(totalProb));
    }
    state[i1] = Complex.ZERO;
  }
}
