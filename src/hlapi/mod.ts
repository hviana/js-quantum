/**
 * High-Level API (hlapi) — public entry point.
 *
 * A single entry-point function (`quantum`) returns a chainable
 * `QuantumTask` builder. Users supply **classical data** (numbers,
 * lists, matrices, callables) via `.data()` or its shorthands,
 * optionally pick a strategy via `.solve()`, and call `.run()` to
 * receive a `ResultHandle` whose `.answer()` is the classical
 * result (a found item, a solution vector, an optimal assignment,
 * a list of factors, ...).
 *
 * Quantum-mechanical details — qubits, gates, oracles, Hamiltonians,
 * bitstrings — are internal and never surface in the public API
 * unless the user explicitly asks for them via `.circuit()` or
 * `.raw()`.
 *
 * ## Support status
 *
 * Each task family has a **support status** that describes how the
 * answer was produced on the current backend:
 *
 * | Status              | Meaning                                       |
 * |---------------------|-----------------------------------------------|
 * | `fully_executable`  | A real quantum circuit was built and executed. |
 * | `classical_fallback`| A classical algorithm stood in; no quantum     |
 * |                     | advantage, but the answer is correct.          |
 * | `symbolic_only`     | The pipeline was recorded but not executed.    |
 * | `unsupported`       | No implementation exists for this task.        |
 *
 * Use `result.inspect().supportStatus` or `result.raw().supportStatus`
 * to check how a specific result was produced.
 *
 * > **Experimental.** Interfaces, enum values, and behavioral
 * > contracts are subject to breaking changes in any release.
 */

import { QuantumCircuit } from "../circuit.ts";
import type { ProblemInput, QuantumOptions } from "./params.ts";
import { QuantumTask } from "./task.ts";

/**
 * Entry point for the high-level API.
 *
 * @param problem plain-language problem string (e.g. `"search"`,
 *   `"factoring"`, `"optimization"`, `"linear_system"`,
 *   `"simulation"`, `"ground_state"`, `"quantum_walk"`) or an
 *   explicit `ProblemObject` for advanced users. Also accepts a
 *   `QuantumCircuit` instance directly — the circuit is executed
 *   as-is on the configured backend.
 * @param options optional execution-environment configuration
 *   (backend, model, resource constraints, metadata).
 * @returns a fresh `QuantumTask` builder.
 *
 * @example
 * ```ts
 * const result = await quantum("search")
 *   .search_in([10, 42, 7, 99], 42)
 *   .run();
 * console.log(result.answer()); // → 42
 * ```
 *
 * @example
 * ```ts
 * const qc = new QuantumCircuit();
 * qc.h(0); qc.cx(0, 1);
 * const result = await quantum(qc).run(1024);
 * ```
 */
export function quantum(
  problem: ProblemInput | QuantumCircuit,
  options?: QuantumOptions,
): QuantumTask {
  if (problem instanceof QuantumCircuit) {
    return new QuantumTask("custom", options).use_circuit(problem);
  }
  return new QuantumTask(problem, options);
}

export { QuantumTask } from "./task.ts";
export { ResultHandle } from "./result.ts";

export type {
  AlgorithmFamily,
  CompositionMode,
  ComputationModel,
  DataOptions,
  DataRole,
  InputKind,
  InputOptions,
  PipelineFn,
  PipelineOutput,
  PipelineStep,
  ProblemClass,
  ProblemInput,
  ProblemObject,
  ProblemString,
  QuantumOptions,
  RepFormat,
  RunOptions,
  SolveOptions,
  StepAction,
  SupportStatus,
  TaskType,
  TransformKind,
  TransformOptions,
} from "./params.ts";
