/**
 * Algorithm-family presets.
 *
 * Each preset returns a default pipeline skeleton for a named
 * algorithm family. Presets are advisory: the bridge materializes
 * the actual circuit, but the pipeline steps carry semantic meaning
 * that guides the bridge's choices.
 *
 * Step action semantics (item 17):
 *
 * - `prepare`  — initialize the quantum register to a problem-specific
 *                state (e.g. uniform superposition, |b⟩, feature-map
 *                encoding, graph state).
 * - `apply`    — apply a unitary operator: an oracle, a diffuser, a
 *                QFT, or any named subroutine. The `input` field names
 *                the artifact that provides the operator.
 * - `evolve`   — Hamiltonian-simulation step: exp(-iHt) via Trotter,
 *                LCU, or direct exponentiation.
 * - `measure`  — computational-basis measurement of (some or all)
 *                qubits into a classical register.
 * - `encode`   — error-correction encoding: map k logical qubits
 *                into n physical qubits using the chosen code.
 * - `correct`  — syndrome measurement + error correction.
 * - `optimize` — classical parameter update step (VQE/QAOA outer
 *                loop): read measurement statistics and adjust
 *                variational parameters.
 * - `sample`   — identical to `measure` but semantically emphasizes
 *                that the purpose is to draw samples from the output
 *                distribution, not to read out a deterministic answer.
 * - `adapt`    — measurement-based QC adaptive measurement step:
 *                measure a qubit and feed the outcome forward to
 *                choose subsequent measurement bases.
 * - `braid`    — topological QC braiding step: exchange anyonic
 *                excitations according to the braiding schedule.
 * - `repeat`   — loop control: repeat the enclosed steps `repeat`
 *                times (or until a convergence condition is met).
 * - `branch`   — conditional execution: run the step only if a
 *                classical register satisfies `condition`.
 */

import type { AlgorithmFamily, StepAction, TaskType } from "./params.ts";
import type { Pipeline, PipelineStepInternal } from "./registry.ts";

const taskToFamily: Record<string, AlgorithmFamily> = {
  search: "amplitude_amplification",
  factoring: "fourier_analysis",
  period_finding: "fourier_analysis",
  optimize: "variational",
  ground_state: "variational",
  solve_linear: "linear_solver",
  time_evolution: "hamiltonian_simulation",
  sample: "sampling",
  classify: "kernel_method",
  correct: "error_correction",
  estimate_phase: "phase_estimation",
  quantum_walk: "quantum_walk",
};

/** Map a problem task to its default algorithm family. */
export function inferFamily(task: TaskType): AlgorithmFamily {
  return taskToFamily[task] ?? "custom";
}

/** Step shorthand to reduce boilerplate. */
function step(
  action: StepAction,
  input?: string,
  params: Record<string, unknown> = {},
): PipelineStepInternal {
  return input !== undefined
    ? { action, input, repeat: 1, params }
    : { action, repeat: 1, params };
}

/** Preset pipeline skeletons keyed by algorithm family. */
const presetMap: Record<
  string,
  Omit<Pipeline, "family"> & { family?: AlgorithmFamily }
> = {
  amplitude_amplification: {
    composition: "sequence",
    control: {},
    approximation: {},
    steps: [
      step("prepare", "initial_state"),
      step("apply", "oracle"),
      step("apply", "diffuser"),
      step("measure"),
    ],
  },
  fourier_analysis: {
    composition: "sequence",
    control: {},
    approximation: {},
    steps: [
      step("prepare", "initial_state"),
      step("apply", "oracle"),
      step("apply", "qft"),
      step("measure"),
    ],
  },
  variational: {
    composition: "loop",
    control: { maxIterations: 100, optimizer: "cobyla" },
    approximation: {},
    steps: [
      step("prepare", "ansatz"),
      step("evolve", "cost"),
      step("measure"),
      step("optimize"),
    ],
  },
  linear_solver: {
    composition: "sequence",
    control: {},
    approximation: {},
    steps: [
      step("prepare", "vector"),
      step("apply", "matrix", { method: "hhl" }),
      step("measure"),
    ],
  },
  hamiltonian_simulation: {
    composition: "sequence",
    control: {},
    approximation: { method: "trotter", ordering: "default" },
    steps: [
      step("prepare", "initial_state"),
      step("evolve", "system"),
      step("measure"),
    ],
  },
  phase_estimation: {
    composition: "sequence",
    control: {},
    approximation: {},
    steps: [
      step("prepare", "initial_state"),
      step("apply", "unitary"),
      step("apply", "qft", { inverse: true }),
      step("measure"),
    ],
  },
  sampling: {
    composition: "sequence",
    control: {},
    approximation: {},
    steps: [
      step("prepare", "initial_state"),
      step("apply", "entangler"),
      step("sample"),
    ],
  },
  kernel_method: {
    composition: "map",
    control: {},
    approximation: {},
    steps: [
      step("prepare", "training_data"),
      step("apply", "kernel"),
      step("measure"),
    ],
  },
  quantum_walk: {
    composition: "repeat",
    control: {},
    approximation: {},
    steps: [
      step("prepare", "initial_state"),
      step("apply", "walk_operator"),
      step("measure"),
    ],
  },
  error_correction: {
    composition: "sequence",
    control: {},
    approximation: {},
    steps: [
      step("encode", "system"),
      step("correct", "decoder"),
      step("measure"),
    ],
  },
  measurement_based: {
    composition: "sequence",
    control: {},
    approximation: {},
    steps: [
      step("prepare", "graph_state"),
      step("adapt", "graph_state"),
      step("measure"),
    ],
  },
  topological: {
    composition: "sequence",
    control: {},
    approximation: {},
    steps: [step("braid", "system"), step("measure")],
  },
};

/** Load the preset pipeline skeleton for a given algorithm family. */
export function loadPreset(family: AlgorithmFamily): Pipeline {
  const preset = presetMap[family];
  if (preset) return { ...preset, family } as Pipeline;
  return {
    family: "custom",
    composition: "sequence",
    control: {},
    approximation: {},
    steps: [],
  };
}
