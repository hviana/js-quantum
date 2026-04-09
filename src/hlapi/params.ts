/**
 * Enums and shared types for the High-Level API (hlapi).
 *
 * These are the language-agnostic vocabulary from AGENTS.md adapted to
 * TypeScript as string literal unions. Every enum includes a `"custom"`
 * variant as an escape hatch.
 */

import type { Backend } from "../backend.ts";

// =============================================================================
// Problem / task vocabulary
// =============================================================================

export type ProblemClass =
  | "hidden_subgroup"
  | "optimization"
  | "simulation"
  | "linear_algebra"
  | "sampling"
  | "machine_learning"
  | "error_correction"
  | "metrology"
  | "custom";

export type TaskType =
  | "search"
  | "factoring"
  | "period_finding"
  | "optimize"
  | "time_evolution"
  | "ground_state"
  | "solve_linear"
  | "sample"
  | "classify"
  | "correct"
  | "estimate_phase"
  | "quantum_walk"
  | "custom";

/**
 * Plain-language problem strings accepted by `quantum(problem)`.
 * Each maps to a `(ProblemClass, TaskType)` pair.
 */
export type ProblemString =
  | "search"
  | "factoring"
  | "period_finding"
  | "optimization"
  | "simulation"
  | "linear_system"
  | "sampling"
  | "classification"
  | "error_correction"
  | "phase_estimation"
  | "ground_state"
  | "quantum_walk"
  | "custom";

/** Object form of the `problem` argument (advanced). */
export interface ProblemObject {
  problem_class?: ProblemClass;
  task?: TaskType;
  objective?: { target?: string; direction?: string };
  promise?: Record<string, unknown>;
  success?: { metric?: string; threshold?: number };
  /** Free-form extension. */
  [k: string]: unknown;
}

export type ProblemInput = ProblemString | ProblemObject;

// =============================================================================
// Data / input vocabulary
// =============================================================================

export type DataRole =
  | "items"
  | "target"
  | "function"
  | "cost"
  | "matrix"
  | "vector"
  | "graph"
  | "initial_state"
  | "training_data"
  | "system"
  | "custom";

export type InputKind =
  | "hamiltonian"
  | "oracle"
  | "state"
  | "ansatz"
  | "cost"
  | "kernel"
  | "walk_operator"
  | "stabilizer_group"
  | "decoder"
  | "graph_state"
  | "circuit"
  | "custom";

export type RepFormat =
  | "pauli_sum"
  | "matrix"
  | "circuit"
  | "truth_table"
  | "symbolic"
  | "opaque"
  | "oracle_circuit"
  | "angle_sequence"
  | "graph"
  | "stabilizer_list"
  | "custom";

export type TransformKind =
  | "adjoint"
  | "controlled"
  | "power"
  | "tensor"
  | "compose"
  | "reflection"
  | "block_encode"
  | "signal_transform"
  | "fermion_to_qubit"
  | "trotterize"
  | "lcu"
  | "inverse"
  | "custom";

export type StepAction =
  | "prepare"
  | "apply"
  | "evolve"
  | "measure"
  | "encode"
  | "correct"
  | "adapt"
  | "braid"
  | "sample"
  | "optimize"
  | "repeat"
  | "branch"
  | "custom";

export type AlgorithmFamily =
  | "fourier_analysis"
  | "amplitude_amplification"
  | "quantum_walk"
  | "hamiltonian_simulation"
  | "linear_solver"
  | "variational"
  | "sampling"
  | "kernel_method"
  | "error_correction"
  | "measurement_based"
  | "topological"
  | "phase_estimation"
  | "custom";

export type CompositionMode =
  | "sequence"
  | "parallel"
  | "repeat"
  | "loop"
  | "branch"
  | "recursive"
  | "pipeline"
  | "map"
  | "custom";

export type ComputationModel =
  | "gate"
  | "custom";

/**
 * How a given task/family is executed on the current backend.
 *
 * - `fully_executable` — a real quantum circuit is built and executed.
 * - `classical_fallback` — a classical algorithm stands in for the
 *    quantum one; the answer is correct but no quantum advantage.
 * - `symbolic_only` — the pipeline is recorded but not executed;
 *    the result is a placeholder.
 * - `unsupported` — no implementation exists for this task.
 */
export type SupportStatus =
  | "fully_executable"
  | "classical_fallback"
  | "symbolic_only"
  | "unsupported";

// =============================================================================
// Options
// =============================================================================

export interface QuantumOptions {
  qubits?: number;
  model?: ComputationModel;
  resources?: {
    maxDepth?: number;
    maxGates?: number;
    maxTCount?: number;
    memory?: number;
  };
  /** String for built-in backends ("simulator"), or an actual `Backend` instance. */
  backend?: "simulator" | Backend;
}

export interface DataOptions {
  name?: string;
  format?: RepFormat;
  encoding?: "amplitude" | "basis" | "angle" | "block" | "custom";
  metadata?: Record<string, unknown>;
}

export interface InputOptions {
  name?: string;
  format?: RepFormat;
  metadata?: Record<string, unknown>;
}

export interface TransformOptions {
  source?: string | readonly string[];
  as?: string;
  params?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PipelineStep {
  action: StepAction;
  input?: string;
  repeat?: number;
  condition?: { on: string; equals: number | string };
  params?: Record<string, unknown>;
}

export interface SolveOptions {
  composition?: CompositionMode;
  approximation?: {
    method?: string;
    tolerance?: number;
    maxTerms?: number;
    ordering?: string;
  };
  control?: {
    maxIterations?: number;
    maxDepth?: number;
    convergenceThreshold?: number;
    optimizer?: string;
    schedule?: string;
    feedforward?: boolean;
  };
  errorBudget?: { total?: number; perStep?: number; perGate?: number };
  /** Overrides: replace pipeline steps whose `action` matches. */
  override?: readonly PipelineStep[];
}

export interface RunOptions {
  shots?: number;
  backend?: "simulator" | Backend;
}

// =============================================================================
// Pipeline stage types
// =============================================================================

/**
 * Data flowing between pipeline stages registered via `.then()`.
 *
 * When the preceding stage is a quantum execution with a known
 * interpretation (e.g. `"search"`), `answer` contains the interpreted
 * classical result. When no interpretation applies, `answer` is the
 * raw bitstring histogram. When the preceding stage is a TypeScript
 * function, `answer` carries that function's return value.
 *
 * `counts` and `confidence` reflect the most recent quantum execution
 * in the pipeline (they are `null` / `0` if no quantum stage has run).
 */
export interface PipelineOutput {
  /** Interpreted answer, histogram, or the preceding stage's return value. */
  readonly answer: unknown;
  /** Bitstring histogram from the most recent quantum execution, if any. */
  readonly counts: Readonly<Record<string, number>> | null;
  /** Confidence score in [0, 1] from the most recent quantum execution. */
  readonly confidence: number;
  /** Task type of the most recent quantum execution (`"custom"` if none). */
  readonly task: TaskType;
  /** Whether the most recent quantum execution used a classical fallback. */
  readonly fallback: boolean;
}

/**
 * An async-compatible function used as a pipeline stage.
 *
 * Receives the output of the preceding stage (quantum or TypeScript)
 * and returns a value for the next stage. If the return value is a
 * `QuantumTask`, it is executed as a quantum stage and its result
 * flows into the next stage automatically.
 */
export type PipelineFn = (
  input: PipelineOutput,
) => unknown | Promise<unknown>;

// =============================================================================
// Pipeline execution types
// =============================================================================

/**
 * Context threaded through every step executor during pipeline execution.
 */
export interface StepExecutorContext {
  /** The backend selected for this run. */
  backend: Backend;
  /** Shot count for circuit execution. */
  shots: number;
  /** All registered artifacts, keyed by role. */
  artifacts: Readonly<Record<string, import("./registry.ts").Artifact>>;
  /** The task type being executed. */
  task: TaskType;
  /** Pipeline-level control params (maxIterations, optimizer, etc.). */
  control: Record<string, unknown>;
  /** Pipeline-level approximation params. */
  approximation: Record<string, unknown>;
  /** Circuit being built incrementally by step executors. */
  circuit: import("../circuit.ts").QuantumCircuit;
  /** Mutable state shared across steps within a pipeline run. */
  state: Record<string, unknown>;
}

/**
 * Result returned by a single step executor.
 */
export interface StepExecutorResult {
  /** Execution counts if this step triggered measurement. */
  counts?: import("../types.ts").ExecutionResult;
  /** Circuit built/used by this step. */
  circuit?: import("../circuit.ts").QuantumCircuit;
  /** Classical answer produced by this step. */
  classicalAnswer?: unknown;
  /** Updated shared state (merged into context for next step). */
  state: Record<string, unknown>;
  /** Whether to break out of a loop (variational convergence). */
  converged?: boolean;
  /** If true, this step produced a full BridgeRawResult directly. */
  fullResult?: import("./bridge.ts").BridgeRawResult;
}
