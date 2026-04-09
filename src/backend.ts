/**
 * Backend interface (Section 8.3).
 *
 * A `Backend` abstracts execution: it takes a `QuantumCircuit`,
 * compiles it into a target-specific `Executable`, and then runs
 * that `Executable` to produce an `ExecutionResult` (a bitstring →
 * percentage histogram summing to 100).
 *
 * Three implementations are provided in the SDK:
 *
 *   - `SimulatorBackend` (`src/simulator.ts`): noiseless state-vector
 *     simulator, supports all gates, `couplingMap = null`.
 *   - `IBMBackend` (`src/ibm_backend.ts`): IBM Quantum REST API
 *     submission with Sampler V2 payload.
 *   - `QBraidBackend` (`src/qbraid_backend.ts`): qBraid cloud
 *     submission.
 *
 * Each backend defines its own `Executable` subtype; the base
 * `Executable` interface here is just a marker carrying the
 * compiled `QuantumCircuit` and the `Target` description for
 * optional caller inspection.
 */

import type { QuantumCircuit } from "./circuit.ts";
import type { ExecutionResult, Target } from "./types.ts";

/**
 * Marker interface for backend-specific executable payloads. Each
 * backend extends this with its own additional fields (IBM API
 * request body, qBraid payload, simulator shots, etc.).
 */
export interface Executable {
  /** The compiled circuit (post-transpilation) for optional inspection. */
  readonly compiledCircuit: QuantumCircuit;
  /** Target description used during compilation. */
  readonly target: Target;
  /** Shot count for this execution. */
  readonly numShots: number;
}

/**
 * The primary execution contract. All backends implement this
 * interface. `transpileAndPackage` is the compilation step and
 * `execute` is the runtime / remote-call step.
 */
export interface Backend {
  /** Device name. */
  readonly name: string;
  /** Number of qubits available. */
  readonly numQubits: number;
  /** Supported basis gate set. */
  readonly basisGates: readonly string[];
  /** Coupling map; null for all-to-all connectivity. */
  readonly couplingMap: ReadonlyArray<readonly [number, number]> | null;

  /**
   * Compile a circuit for this backend and wrap it in a
   * backend-specific `Executable`. Most of the transpilation work
   * lives in `src/transpiler.ts`; `SimulatorBackend` delegates to a
   * trivial pass-through compile because it supports every gate.
   *
   * @param circuit the circuit to compile.
   * @param shots   number of shots for the execution (default 1024).
   */
  transpileAndPackage(circuit: QuantumCircuit, shots?: number): Executable;

  /**
   * Execute a pre-compiled `Executable` and return a bitstring →
   * percentage histogram. Percentages are in `[0, 100]` and sum to
   * 100 across all returned keys.
   *
   * @param executable the compiled payload from `transpileAndPackage`.
   * @param shots override the shot count baked into `executable`.
   */
  execute(
    executable: Executable,
    shots?: number,
  ): ExecutionResult | Promise<ExecutionResult>;
}

/**
 * Default shot count used by every backend when the caller does
 * not supply an explicit value. Defined once here so backends agree
 * on the same default.
 */
export const DEFAULT_SHOTS = 1024;

/**
 * Build a minimal `Target` description for a backend with a given
 * basis gate set, qubit count, and coupling map. The returned
 * target has empty gate properties (no error/duration data). This
 * is the shape `SimulatorBackend` and test mocks use; real hardware
 * backends populate real error and duration data.
 */
export function makeBasicTarget(
  numQubits: number,
  basisGates: readonly string[],
  couplingMap: ReadonlyArray<readonly [number, number]> | null,
): Target {
  const instructions = new Map<
    string,
    Map<string, import("./types.ts").GateProperties>
  >();
  for (const g of basisGates) {
    instructions.set(g, new Map());
  }
  return {
    numQubits,
    instructions,
    couplingMap: couplingMap ?? undefined,
  };
}
