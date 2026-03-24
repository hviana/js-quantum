/**
 * # jsQuantum
 *
 * A pure TypeScript quantum computing simulation library.
 *
 * Provides a complete quantum circuit builder, gate library, simulator,
 * and JSON serialization — all without external dependencies.
 *
 * ## Quick Start
 *
 * ```ts
 * import { quantum, simulate } from "@hviana/js-quantum";
 *
 * const bell = quantum(2, 2, (qc) => {
 *   qc.h(0);
 *   qc.cx(0, 1);
 *   qc.measure(0, 0);
 *   qc.measure(1, 1);
 * });
 *
 * const result = simulate(bell, {}, 1024);
 * console.log(result); // ≈ { "00": 50, "11": 50 }
 * ```
 *
 * @module jsQuantum
 * @author Henrique Emanoel Viana
 * @license MIT
 */

// ─── Core Types ──────────────────────────────────────────────────────
export type {
  CircuitInstruction,
  ClassicalCondition,
  GateName,
  GateOptions,
  QuantumCode,
  SerializedCircuit,
  SerializedInstruction,
  SimulationParams,
  SimulationResult,
  StateVector,
} from "./src/types.ts";

// ─── Complex Number Arithmetic ───────────────────────────────────────
export { Complex } from "./src/complex.ts";

// ─── Matrix Algebra ──────────────────────────────────────────────────
export { Matrix } from "./src/matrix.ts";

// ─── Quantum Gates ───────────────────────────────────────────────────
export {
  cnotGate,
  getGateMatrix,
  hadamard,
  identity,
  pauliX,
  pauliY,
  pauliZ,
  phaseGate,
  rc3xGate,
  rccxGate,
  rxGate,
  rxxGate,
  rzGate,
  rzzGate,
  sdgGate,
  sGate,
  swapGate,
  sxdgGate,
  sxGate,
  tdgGate,
  tGate,
  toffoliGate,
  uGate,
} from "./src/gates.ts";

// ─── Circuit Builder ─────────────────────────────────────────────────
export { CircuitBuilder, quantum } from "./src/circuit.ts";

// ─── Simulator ───────────────────────────────────────────────────────
export { getStateVector, simulate } from "./src/simulator.ts";

// ─── Serialization ───────────────────────────────────────────────────
export { deserialize, fromJSON, serialize, toJSON } from "./src/serializer.ts";

// ─── Bloch Sphere ────────────────────────────────────────────────────
export type {
  BlochSpherical,
  BlochVector,
  DensityMatrix2x2,
  QubitState,
} from "./src/bloch.ts";

export {
  blochFromDensityMatrix,
  blochToSpherical,
  getBlochVector,
  getQubitState,
  reducedDensityMatrix,
} from "./src/bloch.ts";
