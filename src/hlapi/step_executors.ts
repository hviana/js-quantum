/**
 * Step executors — one function per `StepAction`.
 *
 * Each executor receives the current pipeline step and the shared
 * execution context, performs the action (building real circuit
 * fragments on `ctx.circuit`), and returns an updated result.
 *
 * Tasks that decompose cleanly into circuit steps (search,
 * simulation, sampling, quantum walk, error correction, phase
 * estimation) have executors that build real gates. The measure
 * step executes the accumulated circuit and decodes the result.
 *
 * Complex tasks (factoring, period finding, HHL, classification)
 * set state flags; the pipeline runner then delegates to the
 * proven legacy handler for those.
 */

import { QuantumCircuit } from "../circuit.ts";
import { Matrix } from "../matrix.ts";
import { Complex } from "../complex.ts";
import type {
  StepAction,
  StepExecutorContext,
  StepExecutorResult,
} from "./params.ts";
import type { PipelineStepInternal } from "./registry.ts";
import type { PauliTerm } from "../gates.ts";
import {
  appendInverseQFT,
  bitsFor,
  buildQAOACircuitCore,
  buildVQEAnsatz,
  classicalEigenvalues,
  controlledUnitaryMatrix,
  esopForIndices,
  estimateExpectationValue,
  groverIterations,
  intToBits,
  matchingIndices,
  MAX_BRIDGE_QUBITS,
  minimizeCost,
  mostLikelyBitstring,
  runCircuit,
} from "./bridge.ts";

// =============================================================================
// Step executor type and registry
// =============================================================================

export type StepExecutor = (
  step: PipelineStepInternal,
  ctx: StepExecutorContext,
) => Promise<StepExecutorResult>;

export const STEP_EXECUTORS: Record<StepAction, StepExecutor> = {
  prepare: executePrepare,
  apply: executeApply,
  evolve: executeEvolve,
  measure: executeMeasure,
  encode: executeEncode,
  correct: executeCorrect,
  adapt: executeAdapt,
  braid: executeBraid,
  sample: executeSample,
  optimize: executeOptimize,
  repeat: executeRepeat,
  branch: executeBranch,
  custom: executeCustom,
};

// =============================================================================
// PREPARE
// =============================================================================

async function executePrepare(
  step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  const input = step.input;

  if (input === "initial_state") {
    return prepareInitialState(ctx);
  }
  if (input === "ansatz") {
    return prepareAnsatz(ctx);
  }
  if (input === "circuit") {
    return prepareCircuit(ctx);
  }
  // Encoding-aware data preparation: if the step targets a data artifact
  // whose metadata specifies an encoding, use the encodeData helper.
  if (input === "vector" || input === "matrix" || input === "training_data") {
    const artifact = ctx.artifacts[input];
    if (artifact && Array.isArray(artifact.data)) {
      const enc = artifact.metadata.encoding as string | undefined;
      const data = artifact.data as number[];
      const n = qubitsOverride(ctx) ?? bitsFor(data.length);
      if (n <= MAX_BRIDGE_QUBITS) {
        encodeData(ctx.circuit, data, n, enc);
        return { state: { ...ctx.state, circuitBuilt: true, n } };
      }
    }
  }
  return { state: ctx.state };
}

/** Read the user-specified qubit override from pipeline control. */
function qubitsOverride(ctx: StepExecutorContext): number | undefined {
  return ctx.control.qubits as number | undefined;
}

/**
 * Encode classical data into quantum state using the encoding strategy
 * specified in the artifact's `metadata.encoding`.
 *
 * - `"amplitude"` — amplitude encoding via `prepareState` (default).
 * - `"basis"` — encode each value as a computational basis bit.
 * - `"angle"` — encode each value as a rotation angle via Ry gates.
 * - `"block"` — block encoding: embed data in the upper-left block
 *   of a larger unitary (H on ancilla + controlled rotations).
 */
function encodeData(
  qc: QuantumCircuit,
  data: number[],
  n: number,
  encoding: string | undefined,
): void {
  switch (encoding) {
    case "basis": {
      // Each data element maps to a qubit: |0⟩ or |1⟩.
      for (let i = 0; i < Math.min(data.length, n); i++) {
        if (data[i]) qc.x(i);
      }
      break;
    }
    case "angle": {
      // Angle encoding: Ry(arcsin(x_i)) on qubit i, mapping x_i ∈ [-1,1]
      // to a superposition. Values are clamped to [-1, 1].
      for (let i = 0; i < Math.min(data.length, n); i++) {
        const clamped = Math.max(-1, Math.min(1, data[i]));
        const angle = 2 * Math.asin(clamped);
        qc.ry(angle, i);
      }
      break;
    }
    case "block": {
      // Block encoding: ancilla qubit 0 prepares a superposition,
      // then controlled rotations on data qubits embed the values.
      // Ancilla = qubit 0, data qubits = 1..n.
      qc.h(0);
      for (let i = 0; i < Math.min(data.length, n - 1); i++) {
        const clamped = Math.max(-1, Math.min(1, data[i]));
        const angle = 2 * Math.asin(Math.abs(clamped));
        if (Math.abs(angle) > 1e-12) {
          qc.cry(angle, 0, i + 1);
        }
      }
      break;
    }
    case "amplitude":
    default: {
      // Amplitude encoding: normalize data into a state vector.
      const dim = 1 << n;
      const amps: Complex[] = new Array(dim);
      let norm = 0;
      for (let i = 0; i < dim; i++) {
        const v = i < data.length ? data[i] : 0;
        amps[i] = new Complex(v, 0);
        norm += v * v;
      }
      if (norm > 1e-15) {
        const factor = 1 / Math.sqrt(norm);
        for (let i = 0; i < dim; i++) {
          amps[i] = new Complex(amps[i].re * factor, 0);
        }
      }
      const qubits = Array.from({ length: n }, (_, i) => i);
      qc.prepareState({ kind: "amplitude-vector", amplitudes: amps }, qubits);
      break;
    }
  }
}

function prepareInitialState(ctx: StepExecutorContext): StepExecutorResult {
  const a = ctx.artifacts;

  switch (ctx.task) {
    case "search": {
      const items = (a.items?.data ?? []) as unknown[];
      if (!Array.isArray(items) || items.length === 0) {
        return { state: ctx.state };
      }
      const target = a.target?.data;
      const n = qubitsOverride(ctx) ?? bitsFor(items.length);
      const marked = matchingIndices(items, target);
      const iters = groverIterations(1 << n, Math.max(1, marked.length));
      for (let q = 0; q < n; q++) ctx.circuit.h(q);
      return {
        state: {
          ...ctx.state,
          circuitBuilt: true,
          n,
          markedIndices: marked,
          groverIters: iters,
        },
      };
    }
    case "time_evolution": {
      const H = a.system?.data;
      if (!H) return { state: ctx.state };
      const isPauli = Array.isArray(H) &&
        (H as PauliTerm[])[0]?.pauliString !== undefined;
      let n: number;
      if (isPauli) {
        n = (H as PauliTerm[])[0].pauliString.length;
      } else {
        const mat = H as number[][];
        n = bitsFor(mat.length);
      }
      n = qubitsOverride(ctx) ?? n;
      if (n > MAX_BRIDGE_QUBITS) return { state: ctx.state };
      const initState = a.initial_state?.data as number[] | undefined;
      if (initState) {
        const enc = a.initial_state?.metadata.encoding as string | undefined;
        if (enc && enc !== "basis") {
          encodeData(ctx.circuit, initState, n, enc);
        } else {
          for (let i = 0; i < n; i++) {
            if (initState[i]) ctx.circuit.x(i);
          }
        }
      }
      const time = (a.system?.metadata.time as number | undefined) ?? 1.0;
      const steps = (a.system?.metadata.steps as number | undefined) ?? 1;
      return {
        state: {
          ...ctx.state,
          circuitBuilt: true,
          n,
          isPauli,
          simTime: time,
          simSteps: steps,
        },
      };
    }
    case "sample": {
      const n = qubitsOverride(ctx) ??
        (a.custom?.metadata.n as number | undefined) ?? 4;
      for (let q = 0; q < n; q++) ctx.circuit.h(q);
      return { state: { ...ctx.state, circuitBuilt: true, n } };
    }
    case "quantum_walk": {
      const adj = a.graph?.data as number[][] | undefined;
      if (!adj) return { state: ctx.state };
      const numNodes = adj.length;
      const n = qubitsOverride(ctx) ?? bitsFor(numNodes);
      if (n > MAX_BRIDGE_QUBITS) return { state: ctx.state };
      for (let q = 0; q < n; q++) ctx.circuit.h(q);
      const items = (a.items?.data ?? []) as unknown[];
      const target = a.target?.data;
      const marked = items.length > 0 ? matchingIndices(items, target) : [];
      const walkSteps = Math.max(1, Math.round(Math.sqrt(numNodes)));
      const gamma = Math.PI / (2 * Math.max(1, Math.sqrt(numNodes)));
      return {
        state: {
          ...ctx.state,
          circuitBuilt: true,
          n,
          numNodes,
          adjacency: adj,
          walkedMarked: marked,
          walkSteps,
          walkGamma: gamma,
        },
      };
    }
    case "estimate_phase": {
      const signal = a.function?.data as ((x: number) => number) | undefined;
      if (typeof signal !== "function") return { state: ctx.state };
      const phi = signal(1);
      const phase = 2 * Math.PI * phi;
      const uRows: Complex[][] = [
        [Complex.ONE, Complex.ZERO],
        [Complex.ZERO, Complex.exp(phase)],
      ];
      const U = new Matrix(uRows);
      const t = qubitsOverride(ctx) ?? 8;
      const ns = 1;
      if (t + ns > MAX_BRIDGE_QUBITS) return { state: ctx.state };
      // System qubit at index t, prepare eigenstate |1⟩
      ctx.circuit.x(t);
      // H on ancilla
      for (let i = 0; i < t; i++) ctx.circuit.h(i);
      return {
        state: {
          ...ctx.state,
          circuitBuilt: true,
          numAncilla: t,
          numSystem: ns,
          qpeUnitary: U,
          n: t,
        },
      };
    }
    default:
      return { state: ctx.state };
  }
}

function prepareAnsatz(ctx: StepExecutorContext): StepExecutorResult {
  const userAnsatz = ctx.artifacts.ansatz;
  if (userAnsatz?.data instanceof QuantumCircuit) {
    return {
      state: {
        ...ctx.state,
        ansatzType: "circuit",
        userAnsatzCircuit: userAnsatz.data,
      },
    };
  }
  if (typeof userAnsatz?.data === "function") {
    return {
      state: {
        ...ctx.state,
        ansatzType: "builder",
        ansatzBuilder: userAnsatz.data,
      },
    };
  }
  return { state: { ...ctx.state, ansatzType: "default" } };
}

/**
 * Load a user-provided `QuantumCircuit` for direct execution.
 * The circuit is stored in state; the measure step will clone it,
 * add measurements if missing, and execute it on the backend.
 */
function prepareCircuit(ctx: StepExecutorContext): StepExecutorResult {
  const userCircuit = ctx.artifacts.circuit?.data;
  if (!(userCircuit instanceof QuantumCircuit)) {
    return { state: ctx.state };
  }
  return {
    state: {
      ...ctx.state,
      circuitBuilt: true,
      userCircuit,
      n: userCircuit.numQubits,
    },
  };
}

// =============================================================================
// APPLY
// =============================================================================

async function executeApply(
  step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  if (!ctx.state.circuitBuilt) return { state: ctx.state };

  const input = step.input;

  const applyHandlers: Record<
    string,
    (
      s: PipelineStepInternal,
      c: StepExecutorContext,
    ) => StepExecutorResult | Promise<StepExecutorResult>
  > = {
    oracle: applyOracle,
    diffuser: applyDiffuser,
    qft: applyQFT,
    walk_operator: (_s, c) => applyWalkOperator(c),
    entangler: (_s, c) => applyEntangler(c),
    unitary: (_s, c) => applyUnitary(c),
  };

  const handler = input ? applyHandlers[input] : undefined;
  return handler ? handler(step, ctx) : { state: ctx.state };
}

function applyOracle(
  step: PipelineStepInternal,
  ctx: StepExecutorContext,
): StepExecutorResult {
  if (ctx.task === "search") {
    const n = ctx.state.n as number;
    const marked = ctx.state.markedIndices as number[];
    const qubits = Array.from({ length: n }, (_, i) => i);

    // Check for user-provided oracle circuit.
    const userOracle = ctx.artifacts.oracle;
    if (userOracle?.data instanceof QuantumCircuit) {
      ctx.circuit.compose(userOracle.data as QuantumCircuit);
      return { state: ctx.state };
    }

    const isPreset = ctx.state.pipelineFamily !== "custom";
    if (isPreset && step.repeat === 1 && !ctx.state.searchIterationsApplied) {
      // Default preset: apply interleaved oracle+diffuser for optimal iterations.
      const iters = ctx.state.groverIters as number;
      const esop = esopForIndices(marked, n);
      for (let k = 0; k < iters; k++) {
        if (esop.length > 0) ctx.circuit.phaseOracle(esop, qubits);
        applyDiffuserGates(ctx.circuit, n, qubits);
      }
      return { state: { ...ctx.state, searchIterationsApplied: true } };
    }

    // Custom pipeline: apply oracle once per call.
    const esop = esopForIndices(marked, n);
    if (esop.length > 0) ctx.circuit.phaseOracle(esop, qubits);
    return { state: ctx.state };
  }
  return { state: ctx.state };
}

function applyDiffuser(
  _step: PipelineStepInternal,
  ctx: StepExecutorContext,
): StepExecutorResult {
  if (ctx.task === "search") {
    if (ctx.state.searchIterationsApplied) {
      // Oracle step already applied interleaved iterations — no-op.
      return { state: ctx.state };
    }

    // Check for user-provided diffuser circuit.
    const userDiffuser = ctx.artifacts.diffuser;
    if (userDiffuser?.data instanceof QuantumCircuit) {
      ctx.circuit.compose(userDiffuser.data as QuantumCircuit);
      return { state: ctx.state };
    }

    const n = ctx.state.n as number;
    const qubits = Array.from({ length: n }, (_, i) => i);
    applyDiffuserGates(ctx.circuit, n, qubits);
    return { state: ctx.state };
  }
  return { state: ctx.state };
}

/** Grover diffuser: H, X, MCZ (via H-MCX-H), X, H. */
function applyDiffuserGates(
  qc: QuantumCircuit,
  n: number,
  qubits: number[],
): void {
  for (const q of qubits) qc.h(q);
  for (const q of qubits) qc.x(q);
  if (n === 1) {
    qc.z(0);
  } else {
    qc.h(n - 1);
    qc.mcx(qubits.slice(0, -1), n - 1);
    qc.h(n - 1);
  }
  for (const q of qubits) qc.x(q);
  for (const q of qubits) qc.h(q);
}

function applyQFT(
  step: PipelineStepInternal,
  ctx: StepExecutorContext,
): StepExecutorResult {
  if (ctx.task === "estimate_phase") {
    // Inverse QFT on ancilla for QPE.
    const t = ctx.state.numAncilla as number;
    const ancilla = Array.from({ length: t }, (_, i) => i);
    if (step.params?.inverse === true) {
      appendInverseQFT(ctx.circuit, ancilla);
    }
    return { state: ctx.state };
  }
  return { state: ctx.state };
}

function applyWalkOperator(ctx: StepExecutorContext): StepExecutorResult {
  if (ctx.task !== "quantum_walk" || !ctx.state.circuitBuilt) {
    return { state: ctx.state };
  }
  const n = ctx.state.n as number;
  const adj = ctx.state.adjacency as number[][];
  const numNodes = ctx.state.numNodes as number;
  const marked = ctx.state.walkedMarked as number[];
  const walkSteps = ctx.state.walkSteps as number;
  const gamma = ctx.state.walkGamma as number;
  const qubits = Array.from({ length: n }, (_, i) => i);
  const dim = 1 << n;

  // Pad adjacency to dim×dim Matrix.
  const adjRows: (readonly Complex[])[] = [];
  for (let r = 0; r < dim; r++) {
    const row: Complex[] = [];
    for (let c = 0; c < dim; c++) {
      if (r < numNodes && c < numNodes) {
        row.push(adj[r][c] ? new Complex(adj[r][c], 0) : Complex.ZERO);
      } else {
        row.push(Complex.ZERO);
      }
    }
    adjRows.push(row);
  }
  const A = new Matrix(adjRows);

  for (let s = 0; s < walkSteps; s++) {
    // Oracle: phase flip marked nodes.
    if (marked.length > 0) {
      const phases = new Array(dim).fill(0);
      for (const m of marked) phases[m] = Math.PI;
      ctx.circuit.diagonal(phases, qubits);
    }
    // Walk: exp(iγA).
    ctx.circuit.hamiltonianGate(A, -gamma, qubits);
  }
  return { state: ctx.state };
}

function applyEntangler(ctx: StepExecutorContext): StepExecutorResult {
  if (ctx.task !== "sample" || !ctx.state.circuitBuilt) {
    return { state: ctx.state };
  }
  const n = ctx.state.n as number;

  // IQP-style entanglement: CZ + T + CZ + H.
  for (let q = 0; q < n - 1; q++) ctx.circuit.cz(q, q + 1);
  for (let q = 0; q < n; q++) ctx.circuit.t(q);
  for (let q = 0; q < n - 1; q += 2) {
    if (q + 1 < n) ctx.circuit.cz(q, q + 1);
  }
  for (let q = 1; q < n - 1; q += 2) {
    if (q + 1 < n) ctx.circuit.cz(q, q + 1);
  }
  for (let q = 0; q < n; q++) ctx.circuit.h(q);
  return { state: ctx.state };
}

function applyUnitary(ctx: StepExecutorContext): StepExecutorResult {
  if (ctx.task !== "estimate_phase" || !ctx.state.circuitBuilt) {
    return { state: ctx.state };
  }
  const t = ctx.state.numAncilla as number;
  const ns = ctx.state.numSystem as number;
  const U = ctx.state.qpeUnitary as Matrix;
  const ancilla = Array.from({ length: t }, (_, i) => i);
  const system = Array.from({ length: ns }, (_, i) => t + i);

  // Controlled-U^(2^(t-1-k)) for ancilla qubit k.
  const powers: Matrix[] = [U];
  for (let i = 1; i < t; i++) {
    powers[i] = powers[i - 1].multiply(powers[i - 1]);
  }
  for (let k = 0; k < t; k++) {
    const cU = controlledUnitaryMatrix(powers[t - 1 - k]);
    ctx.circuit.unitary(cU, [ancilla[k], ...system]);
  }
  return { state: ctx.state };
}

// =============================================================================
// EVOLVE
// =============================================================================

async function executeEvolve(
  _step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  const input = _step.input;

  if (
    input === "system" && ctx.task === "time_evolution" &&
    ctx.state.circuitBuilt
  ) {
    const a = ctx.artifacts;
    const H = a.system?.data;
    const n = ctx.state.n as number;
    const time = ctx.state.simTime as number;
    const isPauli = ctx.state.isPauli as boolean;
    const qubits = Array.from({ length: n }, (_, i) => i);

    // Read approximation params from the pipeline context.
    const approxMethod = (ctx.approximation.method as string | undefined) ??
      "trotter";
    const tolerance = (ctx.approximation.tolerance as number | undefined) ??
      undefined;
    const maxTerms = (ctx.approximation.maxTerms as number | undefined) ??
      undefined;
    const ordering = (ctx.approximation.ordering as string | undefined) ??
      "sequential";

    // Determine Trotter step count: user-specified metadata, or derived
    // from tolerance (smaller tolerance → more steps), capped by maxTerms.
    let steps = ctx.state.simSteps as number;
    if (tolerance != null && tolerance > 0) {
      // For first-order Trotter, error scales as O(t²/steps).
      // Solve: t²/steps ≤ tolerance → steps ≥ t²/tolerance.
      const autoSteps = Math.ceil((time * time) / tolerance);
      steps = Math.max(steps, autoSteps);
    }
    if (maxTerms != null) {
      steps = Math.min(steps, maxTerms);
    }
    steps = Math.max(1, steps);

    const dt = time / steps;

    if (isPauli) {
      let terms = H as PauliTerm[];

      // Apply term ordering for Trotter decomposition.
      if (ordering === "magnitude") {
        // Order by descending |coefficient| — largest terms first.
        terms = [...terms].sort(
          (a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient),
        );
      } else if (ordering === "random") {
        // Random ordering (randomized Trotter).
        terms = [...terms].sort(() => Math.random() - 0.5);
      }
      // "sequential" (default) preserves the original term order.

      if (approxMethod === "trotter2") {
        // Second-order (symmetric) Trotter: e^{-iHt} ≈ Πₖ e^{-iHₖdt/2} · Πₖ' e^{-iHₖ'dt/2}
        for (let s = 0; s < steps; s++) {
          ctx.circuit.pauliEvolution(terms, dt / 2, qubits);
          ctx.circuit.pauliEvolution([...terms].reverse(), dt / 2, qubits);
        }
      } else {
        // First-order Trotter (default, also used for "trotter" and "exact").
        for (let s = 0; s < steps; s++) {
          ctx.circuit.pauliEvolution(terms, dt, qubits);
        }
      }
    } else {
      const mat = H as number[][];
      const dim = mat.length;
      const fullDim = 1 << n;
      const hRows: (readonly Complex[])[] = [];
      for (let r = 0; r < fullDim; r++) {
        const row: Complex[] = [];
        for (let c = 0; c < fullDim; c++) {
          if (r < dim && c < dim) {
            row.push(new Complex(mat[r][c], 0));
          } else {
            row.push(Complex.ZERO);
          }
        }
        hRows.push(row);
      }
      const Hmat = new Matrix(hRows);
      for (let s = 0; s < steps; s++) {
        ctx.circuit.hamiltonianGate(Hmat, dt, qubits);
      }
    }
    return { state: ctx.state };
  }

  // cost evolve — handled by optimize step.
  return { state: ctx.state };
}

// =============================================================================
// ENCODE (error correction)
// =============================================================================

async function executeEncode(
  _step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  if (ctx.task !== "correct") return { state: ctx.state };
  const data = (ctx.artifacts.system?.data ?? ctx.artifacts.custom?.data) as
    | number[]
    | undefined;
  if (!data || !Array.isArray(data)) return { state: ctx.state };

  const codeDistance = data.length >= 5 ? 5 : 3;
  const codeData = data.slice(0, codeDistance);
  const n = codeDistance;
  const nSyn = n - 1;

  // Prepare input state.
  for (let i = 0; i < n; i++) {
    if (codeData[i]) ctx.circuit.x(i);
  }

  // Syndrome computation.
  for (let i = 0; i < nSyn; i++) {
    ctx.circuit.cx(i, n + i);
    ctx.circuit.cx(i + 1, n + i);
  }

  return {
    state: {
      ...ctx.state,
      circuitBuilt: true,
      n,
      codeDistance,
    },
  };
}

// =============================================================================
// CORRECT (error correction)
// =============================================================================

async function executeCorrect(
  _step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  if (ctx.task !== "correct" || !ctx.state.circuitBuilt) {
    return { state: ctx.state };
  }
  const n = ctx.state.codeDistance as number;

  if (n === 3) {
    ctx.circuit.x(n + 1);
    ctx.circuit.ccx(n, n + 1, 0);
    ctx.circuit.x(n + 1);
    ctx.circuit.ccx(n, n + 1, 1);
    ctx.circuit.x(n);
    ctx.circuit.ccx(n, n + 1, 2);
    ctx.circuit.x(n);
  } else if (n === 5) {
    ctx.circuit.x(n + 1);
    ctx.circuit.x(n + 2);
    ctx.circuit.x(n + 3);
    ctx.circuit.mcx([n, n + 1, n + 2, n + 3], 0);
    ctx.circuit.x(n + 1);
    ctx.circuit.x(n + 2);
    ctx.circuit.x(n + 3);
    ctx.circuit.x(n + 2);
    ctx.circuit.x(n + 3);
    ctx.circuit.mcx([n, n + 1, n + 2, n + 3], 1);
    ctx.circuit.x(n + 2);
    ctx.circuit.x(n + 3);
    ctx.circuit.x(n);
    ctx.circuit.x(n + 3);
    ctx.circuit.mcx([n, n + 1, n + 2, n + 3], 2);
    ctx.circuit.x(n);
    ctx.circuit.x(n + 3);
    ctx.circuit.x(n);
    ctx.circuit.x(n + 1);
    ctx.circuit.mcx([n, n + 1, n + 2, n + 3], 3);
    ctx.circuit.x(n);
    ctx.circuit.x(n + 1);
    ctx.circuit.x(n);
    ctx.circuit.x(n + 1);
    ctx.circuit.x(n + 2);
    ctx.circuit.mcx([n, n + 1, n + 2, n + 3], 4);
    ctx.circuit.x(n);
    ctx.circuit.x(n + 1);
    ctx.circuit.x(n + 2);
  }

  return { state: ctx.state };
}

// =============================================================================
// MEASURE — execute circuit and decode result
// =============================================================================

async function executeMeasure(
  _step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  if (!ctx.state.circuitBuilt) {
    return { state: { ...ctx.state, measureRequested: true } };
  }

  // --- User-provided QuantumCircuit (via use_circuit / quantum(qc)) ----------
  if (ctx.state.userCircuit) {
    const qc = (ctx.state.userCircuit as QuantumCircuit).clone();
    const n = qc.numQubits;
    const hasMeasurements = qc.instructions.some(
      (i) => i.kind === "measure",
    );
    if (!hasMeasurements && n > 0) {
      qc.addClassicalRegister("c", n);
      for (let i = 0; i < n; i++) {
        qc.measure(i, { registerName: "c", bitIndex: n - 1 - i });
      }
    }
    const counts = await runCircuit(qc, ctx.backend, ctx.shots);
    return {
      counts,
      circuit: qc,
      classicalAnswer: counts,
      state: { ...ctx.state, executed: true },
      fullResult: {
        counts,
        classicalAnswer: counts,
        fallback: false,
        note: `Custom circuit executed on ${n} qubits`,
        shots: ctx.shots,
        backendName: ctx.backend.name,
        circuit: qc,
        supportStatus: "fully_executable",
      },
    };
  }

  // --- Pipeline-built circuit ------------------------------------------------
  const n = ctx.state.n as number;
  const measQubits = ctx.task === "estimate_phase"
    ? ctx.state.numAncilla as number
    : n;

  ctx.circuit.addClassicalRegister("c", measQubits);
  for (let i = 0; i < measQubits; i++) {
    ctx.circuit.measure(i, { registerName: "c", bitIndex: measQubits - 1 - i });
  }

  const counts = await runCircuit(ctx.circuit, ctx.backend, ctx.shots);
  const decoded = decodeResult(ctx.task, counts, ctx);

  return {
    counts,
    circuit: ctx.circuit,
    classicalAnswer: decoded.answer,
    state: { ...ctx.state, executed: true },
    fullResult: {
      counts,
      classicalAnswer: decoded.answer,
      fallback: false,
      note: decoded.note,
      shots: ctx.shots,
      backendName: ctx.backend.name,
      circuit: ctx.circuit,
      supportStatus: "fully_executable",
    },
  };
}

// =============================================================================
// SAMPLE — execute circuit and return distribution
// =============================================================================

async function executeSample(
  _step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  if (!ctx.state.circuitBuilt) {
    return { state: { ...ctx.state, sampleRequested: true } };
  }

  const n = ctx.state.n as number;
  ctx.circuit.addClassicalRegister("c", n);
  for (let q = 0; q < n; q++) {
    ctx.circuit.measure(q, { registerName: "c", bitIndex: n - 1 - q });
  }

  const counts = await runCircuit(ctx.circuit, ctx.backend, ctx.shots);
  return {
    counts,
    circuit: ctx.circuit,
    classicalAnswer: Object.keys(counts),
    state: { ...ctx.state, executed: true },
    fullResult: {
      counts,
      classicalAnswer: Object.keys(counts),
      fallback: false,
      note: `IQP-style sampling on ${n} qubits with CZ+T entanglement`,
      shots: ctx.shots,
      backendName: ctx.backend.name,
      circuit: ctx.circuit,
      supportStatus: "fully_executable",
    },
  };
}

// =============================================================================
// Task-specific result decoding
// =============================================================================

type DecodeHandler = (
  counts: Record<string, number>,
  ctx: StepExecutorContext,
  n: number,
) => { answer: unknown; note: string };

const decodeHandlers: Record<string, DecodeHandler> = {
  search: (counts, ctx, n) => {
    const items = (ctx.artifacts.items?.data ?? []) as unknown[];
    const bs = mostLikelyBitstring(counts);
    const idx = bs ? parseInt(bs, 2) : -1;
    const found = idx >= 0 && idx < items.length ? items[idx] : null;
    const iters = ctx.state.groverIters as number;
    return {
      answer: found,
      note: `Grover search with ${iters} iteration(s) on ${n} qubits`,
    };
  },
  time_evolution: (counts, ctx, n) => {
    const time = ctx.state.simTime as number;
    const steps = ctx.state.simSteps as number;
    const isPauli = ctx.state.isPauli as boolean;
    return {
      answer: counts,
      note: isPauli
        ? `Pauli evolution on ${n} qubits, t=${time}`
        : `Hamiltonian simulation on ${n} qubits, t=${time}, ${steps} step(s)`,
    };
  },
  quantum_walk: (counts, ctx, n) => {
    const numNodes = ctx.state.numNodes as number;
    const walkSteps = ctx.state.walkSteps as number;
    const bs = mostLikelyBitstring(counts);
    const position = parseInt(bs, 2);
    const found = position < numNodes ? position : null;
    return {
      answer: found,
      note:
        `Continuous-time quantum walk on ${numNodes}-node graph, ${walkSteps} steps, ${n} qubits`,
    };
  },
  estimate_phase: (counts, ctx) => {
    const t = ctx.state.numAncilla as number;
    const ns = ctx.state.numSystem as number;
    const bs = mostLikelyBitstring(counts);
    const measured = parseInt(bs, 2);
    const estimatedPhase = measured / (1 << t);
    const topPct = counts[bs] ?? 0;
    const confidence = Math.min(1, topPct / 100);
    return {
      answer: { phase: estimatedPhase, confidence },
      note: `QPE on ${t}+${ns} qubits, measured phase ≈ ${
        estimatedPhase.toFixed(6)
      }`,
    };
  },
  correct: (counts, ctx) => {
    const codeDistance = ctx.state.codeDistance as number;
    const bs = mostLikelyBitstring(counts);
    const val = parseInt(bs, 2);
    const corrected = intToBits(val, codeDistance);
    const ones = corrected.reduce((s: number, b: number) => s + b, 0);
    const logicalBit = ones > codeDistance / 2 ? 1 : 0;
    return {
      answer: { corrected, logicalBit, codeDistance, syndrome: "decoded" },
      note:
        `${codeDistance}-qubit repetition code with Toffoli-based correction`,
    };
  },
};

function decodeResult(
  task: string,
  counts: Record<string, number>,
  ctx: StepExecutorContext,
): { answer: unknown; note: string } {
  const n = ctx.state.n as number;
  const handler = decodeHandlers[task];
  return handler
    ? handler(counts, ctx, n)
    : { answer: counts, note: `Pipeline execution on ${n} qubits` };
}

// =============================================================================
// OPTIMIZE — classical parameter update (variational)
// =============================================================================

async function executeOptimize(
  _step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  const maxIterations = (ctx.control.maxIterations as number | undefined) ?? 50;
  const convergenceThreshold =
    (ctx.control.convergenceThreshold as number | undefined) ?? 1e-6;
  const optimizer = (ctx.control.optimizer as string | undefined) ?? "cobyla";

  if (ctx.task === "optimize") {
    return optimizeQAOA(ctx, maxIterations, convergenceThreshold, optimizer);
  }
  if (ctx.task === "ground_state") {
    return optimizeVQE(ctx, maxIterations, convergenceThreshold, optimizer);
  }
  return { state: ctx.state, converged: true };
}

async function optimizeQAOA(
  ctx: StepExecutorContext,
  maxIterations: number,
  _convergenceThreshold: number,
  optimizer: string = "cobyla",
): Promise<StepExecutorResult> {
  const a = ctx.artifacts;
  const cost = a.cost?.data as ((bits: number[]) => number) | undefined;
  const n = (a.cost?.metadata.numBits as number | undefined) ??
    (a.cost?.metadata.n as number | undefined) ?? 6;

  if (typeof cost !== "function") {
    throw new Error("optimize step: cost function not found in artifacts");
  }

  if (n > MAX_BRIDGE_QUBITS) {
    const res = minimizeCost(cost, n);
    return {
      state: ctx.state,
      converged: true,
      fullResult: {
        counts: null,
        classicalAnswer: res,
        fallback: true,
        note:
          `QAOA needs ${n} qubits, exceeds limit — classical exhaustive fallback`,
        shots: ctx.shots,
        backendName: ctx.backend.name,
        circuit: null,
        supportStatus: "classical_fallback",
      },
    };
  }

  const optShots = Math.max(64, Math.min(256, ctx.shots));
  let bestGamma = 0, bestBeta = 0, bestExpect = Infinity;

  if (optimizer === "random") {
    // Random search: sample random (gamma, beta) pairs.
    const numSamples = Math.min(maxIterations * maxIterations, 144);
    for (let i = 0; i < numSamples; i++) {
      const gamma = Math.random() * Math.PI;
      const beta = Math.random() * Math.PI / 2;
      const qc = buildQAOACircuitCore(cost, n, gamma, beta);
      const E = await estimateExpectationValue(
        qc,
        cost,
        n,
        ctx.backend,
        optShots,
      );
      if (E < bestExpect) {
        bestExpect = E;
        bestGamma = gamma;
        bestBeta = beta;
      }
    }
  } else if (optimizer === "gradient") {
    // Parameter-shift gradient descent.
    let gamma = Math.PI / 4, beta = Math.PI / 8;
    const lr = 0.1;
    const shift = Math.PI / 2;
    for (let iter = 0; iter < maxIterations; iter++) {
      // Gradient w.r.t. gamma
      const ePlus = await estimateExpectationValue(
        buildQAOACircuitCore(cost, n, gamma + shift, beta),
        cost,
        n,
        ctx.backend,
        optShots,
      );
      const eMinus = await estimateExpectationValue(
        buildQAOACircuitCore(cost, n, gamma - shift, beta),
        cost,
        n,
        ctx.backend,
        optShots,
      );
      const gradGamma = (ePlus - eMinus) / 2;
      // Gradient w.r.t. beta
      const eBPlus = await estimateExpectationValue(
        buildQAOACircuitCore(cost, n, gamma, beta + shift),
        cost,
        n,
        ctx.backend,
        optShots,
      );
      const eBMinus = await estimateExpectationValue(
        buildQAOACircuitCore(cost, n, gamma, beta - shift),
        cost,
        n,
        ctx.backend,
        optShots,
      );
      const gradBeta = (eBPlus - eBMinus) / 2;
      gamma -= lr * gradGamma;
      beta -= lr * gradBeta;
      const E = await estimateExpectationValue(
        buildQAOACircuitCore(cost, n, gamma, beta),
        cost,
        n,
        ctx.backend,
        optShots,
      );
      if (E < bestExpect) {
        bestExpect = E;
        bestGamma = gamma;
        bestBeta = beta;
      }
    }
  } else {
    // Default "cobyla": grid search.
    const gridSize = Math.min(12, maxIterations);
    for (let gi = 0; gi < gridSize; gi++) {
      const gamma = ((gi + 0.5) * Math.PI) / gridSize;
      for (let bi = 0; bi < gridSize; bi++) {
        const beta = ((bi + 0.5) * Math.PI) / (2 * gridSize);
        const qc = buildQAOACircuitCore(cost, n, gamma, beta);
        const E = await estimateExpectationValue(
          qc,
          cost,
          n,
          ctx.backend,
          optShots,
        );
        if (E < bestExpect) {
          bestExpect = E;
          bestGamma = gamma;
          bestBeta = beta;
        }
      }
    }
  }

  const finalCircuit = buildQAOACircuitCore(cost, n, bestGamma, bestBeta);
  finalCircuit.addClassicalRegister("c", n);
  for (let i = 0; i < n; i++) {
    finalCircuit.measure(i, { registerName: "c", bitIndex: n - 1 - i });
  }
  const counts = await runCircuit(finalCircuit, ctx.backend, ctx.shots);
  const bs = mostLikelyBitstring(counts);
  const x = parseInt(bs, 2);
  const bestBits = intToBits(x, n);

  return {
    counts,
    circuit: finalCircuit,
    classicalAnswer: { assignment: bestBits, cost: cost(bestBits) },
    state: { ...ctx.state, bestGamma, bestBeta, bestExpect },
    converged: true,
    fullResult: {
      counts,
      classicalAnswer: { assignment: bestBits, cost: cost(bestBits) },
      fallback: false,
      note: `QAOA p=1 on ${n} qubits, γ=${bestGamma.toFixed(3)}, β=${
        bestBeta.toFixed(3)
      }`,
      shots: ctx.shots,
      backendName: ctx.backend.name,
      circuit: finalCircuit,
      supportStatus: "fully_executable",
    },
  };
}

async function optimizeVQE(
  ctx: StepExecutorContext,
  maxIterations: number,
  _convergenceThreshold: number,
  optimizer: string = "cobyla",
): Promise<StepExecutorResult> {
  const a = ctx.artifacts;
  const H = a.system?.data as number[][] | undefined;
  if (!H) throw new Error("optimize step (VQE): system Hamiltonian not found");

  const dim = H.length;
  const n = bitsFor(dim);

  if (n > MAX_BRIDGE_QUBITS) {
    const eigvals = classicalEigenvalues(H);
    const groundEnergy = Math.min(...eigvals);
    return {
      state: ctx.state,
      converged: true,
      fullResult: {
        counts: null,
        classicalAnswer: { energy: groundEnergy, eigenvalues: eigvals },
        fallback: true,
        note:
          `VQE needs ${n} qubits, exceeds limit — classical diagonalization`,
        shots: ctx.shots,
        backendName: ctx.backend.name,
        circuit: null,
        supportStatus: "classical_fallback",
      },
    };
  }

  const fullDim = 1 << n;
  const hRows: (readonly Complex[])[] = [];
  for (let r = 0; r < fullDim; r++) {
    const row: Complex[] = [];
    for (let c = 0; c < fullDim; c++) {
      if (r < dim && c < dim) {
        row.push(new Complex(H[r][c], 0));
      } else {
        row.push(r === c ? new Complex(100, 0) : Complex.ZERO);
      }
    }
    hRows.push(row);
  }
  const Hmat = new Matrix(hRows);

  const ansatzType = ctx.state.ansatzType as string | undefined;
  let ansatzBuilder: (p: number[], nq: number, ly: number) => QuantumCircuit;
  if (ansatzType === "circuit") {
    const userCircuit = ctx.state.userAnsatzCircuit as QuantumCircuit;
    ansatzBuilder = () => userCircuit.clone();
  } else if (ansatzType === "builder") {
    ansatzBuilder = ctx.state.ansatzBuilder as (
      p: number[],
      nq: number,
      ly: number,
    ) => QuantumCircuit;
  } else {
    ansatzBuilder = buildVQEAnsatz;
  }

  const layers = Math.min(3, Math.max(1, n));
  const numParams = n * layers;
  let params = new Array(numParams).fill(0).map(() => Math.random() * Math.PI);
  let bestEnergy = Infinity;
  let bestParams = [...params];
  const maxIter = Math.min(maxIterations, 50);
  const optShots = Math.max(64, Math.min(256, ctx.shots));

  if (optimizer === "random") {
    // Random search over parameter space.
    for (let iter = 0; iter < maxIter; iter++) {
      const trial = new Array(numParams).fill(0).map(() =>
        Math.random() * 2 * Math.PI
      );
      const E = await estimateExpectationValue(
        ansatzBuilder(trial, n, layers),
        Hmat,
        n,
        ctx.backend,
        optShots,
      );
      if (E < bestEnergy) {
        bestEnergy = E;
        bestParams = [...trial];
        params = [...trial];
      }
    }
  } else if (optimizer === "gradient") {
    // Parameter-shift gradient descent.
    const lr = 0.1;
    const shift = Math.PI / 2;
    for (let iter = 0; iter < maxIter; iter++) {
      const grad = new Array(numParams).fill(0);
      for (let p = 0; p < numParams; p++) {
        const orig = params[p];
        params[p] = orig + shift;
        const ePlus = await estimateExpectationValue(
          ansatzBuilder(params, n, layers),
          Hmat,
          n,
          ctx.backend,
          optShots,
        );
        params[p] = orig - shift;
        const eMinus = await estimateExpectationValue(
          ansatzBuilder(params, n, layers),
          Hmat,
          n,
          ctx.backend,
          optShots,
        );
        params[p] = orig;
        grad[p] = (ePlus - eMinus) / 2;
      }
      for (let p = 0; p < numParams; p++) params[p] -= lr * grad[p];
      const E = await estimateExpectationValue(
        ansatzBuilder(params, n, layers),
        Hmat,
        n,
        ctx.backend,
        optShots,
      );
      if (E < bestEnergy) {
        bestEnergy = E;
        bestParams = [...params];
      }
    }
  } else {
    // Default "cobyla": coordinate-wise search.
    const delta = 0.3;
    for (let iter = 0; iter < maxIter; iter++) {
      let improved = false;
      for (let p = 0; p < numParams; p++) {
        const origVal = params[p];

        params[p] = origVal + delta;
        const ePlus = await estimateExpectationValue(
          ansatzBuilder(params, n, layers),
          Hmat,
          n,
          ctx.backend,
          optShots,
        );
        params[p] = origVal - delta;
        const eMinus = await estimateExpectationValue(
          ansatzBuilder(params, n, layers),
          Hmat,
          n,
          ctx.backend,
          optShots,
        );
        params[p] = origVal;
        const eOrig = await estimateExpectationValue(
          ansatzBuilder(params, n, layers),
          Hmat,
          n,
          ctx.backend,
          optShots,
        );

        if (ePlus < eOrig && ePlus < eMinus) {
          params[p] = origVal + delta;
          if (ePlus < bestEnergy) {
            bestEnergy = ePlus;
            bestParams = [...params];
            improved = true;
          }
        } else if (eMinus < eOrig) {
          params[p] = origVal - delta;
          if (eMinus < bestEnergy) {
            bestEnergy = eMinus;
            bestParams = [...params];
            improved = true;
          }
        } else if (eOrig < bestEnergy) {
          bestEnergy = eOrig;
          bestParams = [...params];
        }
      }
      if (!improved) break;
    }
  }

  const finalCircuit = ansatzBuilder(bestParams, n, layers);
  finalCircuit.addClassicalRegister("c", n);
  for (let i = 0; i < n; i++) {
    finalCircuit.measure(i, { registerName: "c", bitIndex: n - 1 - i });
  }
  const counts = await runCircuit(finalCircuit, ctx.backend, ctx.shots);

  return {
    counts,
    circuit: finalCircuit,
    classicalAnswer: { energy: bestEnergy, distribution: counts },
    state: { ...ctx.state, bestEnergy, bestParams },
    converged: true,
    fullResult: {
      counts,
      classicalAnswer: { energy: bestEnergy, distribution: counts },
      fallback: false,
      note: `VQE on ${n} qubits, ${layers} layers, ground energy ≈ ${
        bestEnergy.toFixed(4)
      }`,
      shots: ctx.shots,
      backendName: ctx.backend.name,
      circuit: finalCircuit,
      supportStatus: "fully_executable",
    },
  };
}

// =============================================================================
// ADAPT — measurement-based quantum computation
// =============================================================================

/**
 * Adaptive measurement step for measurement-based QC (MBQC).
 *
 * Operates on a graph state (cluster state). Each qubit is measured
 * in a basis determined by the step params and prior measurement
 * outcomes. The measurement angle for qubit k is:
 *   θ_k = base_angle + π · (feedforward corrections from prior outcomes)
 *
 * The graph state adjacency is read from `ctx.artifacts.graph_state`.
 * If a graph state is available, CZ entanglement is applied first
 * (if not already built), then adaptive single-qubit rotations +
 * measurements are performed.
 */
async function executeAdapt(
  step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  const adj = ctx.artifacts.graph_state?.data as number[][] | undefined;
  if (!adj || !Array.isArray(adj)) return { state: ctx.state };

  const n = adj.length;
  if (n > MAX_BRIDGE_QUBITS || n === 0) return { state: ctx.state };

  // Build graph state if not already done: |+⟩^n then CZ for each edge.
  if (!ctx.state.graphStateBuilt) {
    for (let q = 0; q < n; q++) ctx.circuit.h(q);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (adj[i][j]) ctx.circuit.cz(i, j);
      }
    }
  }

  // Measurement angles from params (default: all zero = X-basis).
  const angles = (step.params?.angles as number[] | undefined) ??
    new Array(n).fill(0);

  // Feedforward corrections from prior adapt rounds.
  const outcomes = (ctx.state.adaptOutcomes as number[] | undefined) ?? [];

  // Determine which qubits to measure this round.
  // By default measure all non-output qubits (leave last qubit as output).
  const outputQubits = (step.params?.outputQubits as number[] | undefined) ??
    [n - 1];
  const measureQubits: number[] = [];
  for (let q = 0; q < n; q++) {
    if (!outputQubits.includes(q)) measureQubits.push(q);
  }

  // Apply adaptive rotations: Rz(θ_k) where θ is adjusted by feedforward.
  // Feedforward is enabled by default; set control.feedforward = false to disable.
  const useFeedforward =
    (ctx.control.feedforward as boolean | undefined) !== false;

  for (const q of measureQubits) {
    let angle = angles[q] ?? 0;
    // Feedforward: flip angle sign based on parity of dependent outcomes.
    if (useFeedforward) {
      const deps = step.params?.dependencies as
        | Record<number, number[]>
        | undefined;
      if (deps && deps[q]) {
        const parity = deps[q].reduce(
          (s: number, d: number) => s ^ (outcomes[d] ?? 0),
          0,
        );
        if (parity) angle = -angle;
      }
    }
    if (angle !== 0) {
      ctx.circuit.rz(angle, q);
      ctx.circuit.h(q);
    }
  }

  // Measure the non-output qubits.
  if (ctx.circuit.classicalRegisters.length === 0) {
    ctx.circuit.addClassicalRegister("c", n);
  }
  for (const q of measureQubits) {
    ctx.circuit.measure(q, { registerName: "c", bitIndex: q });
  }

  // Execute to get outcomes for feedforward.
  const counts = await runCircuit(ctx.circuit, ctx.backend, ctx.shots);
  const bs = mostLikelyBitstring(counts);
  const newOutcomes = [...outcomes];
  for (const q of measureQubits) {
    newOutcomes[q] = bs[n - 1 - q] === "1" ? 1 : 0;
  }

  return {
    counts,
    circuit: ctx.circuit,
    classicalAnswer: { outcomes: newOutcomes, outputQubits },
    state: {
      ...ctx.state,
      graphStateBuilt: true,
      adaptOutcomes: newOutcomes,
      circuitBuilt: true,
      n,
      executed: true,
    },
    fullResult: {
      counts,
      classicalAnswer: { outcomes: newOutcomes, outputQubits },
      fallback: false,
      note:
        `MBQC adaptive measurement on ${n}-qubit graph state, measured ${measureQubits.length} qubits`,
      shots: ctx.shots,
      backendName: ctx.backend.name,
      circuit: ctx.circuit,
      supportStatus: "fully_executable",
    },
  };
}

// =============================================================================
// BRAID — topological quantum computation
// =============================================================================

/**
 * Braiding step for topological QC.
 *
 * Simulates anyonic braiding on a gate-model backend by implementing
 * braid-group generators as unitary gates. Each braid exchanges two
 * adjacent anyons, which in the Fibonacci/Ising anyon model
 * corresponds to a specific unitary on the fusion space.
 *
 * The braiding schedule is read from `step.params.schedule` as an
 * array of `[i, j]` pairs (anyon indices to exchange), or from the
 * artifact `system`.
 *
 * For the Ising anyon model (default):
 *   σ_k = exp(-iπ/8) · (I + i·X_k) / √2   (on the fusion-space qubit)
 *   This is equivalent to an Rz(π/4) · H · S gate sequence.
 */
async function executeBraid(
  step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  const schedule = (step.params?.schedule as [number, number][] | undefined) ??
    (ctx.control.schedule as [number, number][] | undefined) ??
    (ctx.artifacts.system?.data as [number, number][] | undefined);

  if (!schedule || !Array.isArray(schedule) || schedule.length === 0) {
    return { state: ctx.state };
  }

  // Determine number of qubits from the schedule.
  let maxAnyon = 0;
  for (const [a, b] of schedule) {
    maxAnyon = Math.max(maxAnyon, a, b);
  }
  const n = maxAnyon + 1;
  if (n > MAX_BRIDGE_QUBITS) return { state: ctx.state };

  // Initialize fusion-space qubits in |0⟩ if not already built.
  if (!ctx.state.circuitBuilt) {
    // Topological qubits start in computational basis.
    // No explicit initialization needed beyond default |0⟩.
  }

  const model = (step.params?.model as string | undefined) ?? "ising";

  for (const [a, b] of schedule) {
    // Map anyon pair to the fusion-space qubit (the lower index).
    const q = Math.min(a, b);
    if (q >= n) continue;

    if (model === "ising") {
      // Ising anyon braid: σ = e^{-iπ/8}(I + iX)/√2
      // Decomposition: S · H · T on the fusion qubit, with a CZ if
      // the braid crosses two fusion-space qubits.
      ctx.circuit.t(q);
      ctx.circuit.h(q);
      ctx.circuit.s(q);
      if (a !== b && Math.abs(a - b) === 1 && b < n) {
        ctx.circuit.cz(Math.min(a, b), Math.max(a, b));
      }
    } else {
      // Fibonacci anyon model: approximate with Rz · Ry · Rz.
      // The F-matrix rotation angle is arctan(1/φ) where φ = golden ratio.
      const phi = (1 + Math.sqrt(5)) / 2;
      const angle = Math.atan(1 / phi);
      ctx.circuit.rz(angle, q);
      ctx.circuit.ry(2 * angle, q);
      ctx.circuit.rz(angle, q);
      if (a !== b && Math.abs(a - b) === 1 && b < n) {
        ctx.circuit.cz(Math.min(a, b), Math.max(a, b));
      }
    }
  }

  return {
    state: {
      ...ctx.state,
      circuitBuilt: true,
      n,
      braidModel: model,
      braidCount: schedule.length,
    },
  };
}

// =============================================================================
// REPEAT — loop control step action
// =============================================================================

/**
 * Execute nested sub-steps `step.repeat` times (already handled by
 * the pipeline runner's per-step repeat loop), but also supports
 * `step.steps` for nested sub-step sequences that are repeated as
 * a block. Checks for convergence after each iteration.
 */
async function executeRepeat(
  step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  if (!step.steps || step.steps.length === 0) {
    // No nested steps — the pipeline runner's repeat loop handles this.
    return { state: ctx.state };
  }

  const iterations = step.repeat ?? 1;
  let currentCtx = ctx;

  for (let iter = 0; iter < iterations; iter++) {
    for (const sub of step.steps) {
      const executor = STEP_EXECUTORS[sub.action];
      if (!executor) continue;

      for (let r = 0; r < (sub.repeat ?? 1); r++) {
        const result = await executor(sub, currentCtx);

        if (result.fullResult) return result;
        if (result.converged) {
          return {
            ...result,
            state: {
              ...currentCtx.state,
              ...result.state,
              repeatConvergedAt: iter,
            },
          };
        }

        currentCtx = {
          ...currentCtx,
          state: { ...currentCtx.state, ...result.state },
        };
      }
    }
  }

  return { state: currentCtx.state };
}

// =============================================================================
// BRANCH — conditional step execution
// =============================================================================

/**
 * Conditional execution: evaluate the condition against the current
 * pipeline state. If the condition matches (or there is no
 * condition), execute the step's nested sub-steps. Otherwise skip.
 *
 * Conditions are checked from `step.condition` or
 * `step.params.condition`.
 */
async function executeBranch(
  step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  const cond = step.condition ??
    (step.params?.condition as
      | { on: string; equals: number | string }
      | undefined);

  if (cond) {
    const val = ctx.state[cond.on];
    if (val !== cond.equals) {
      return { state: { ...ctx.state, branchSkipped: true } };
    }
  }

  // Condition matched (or no condition) — execute nested sub-steps.
  if (!step.steps || step.steps.length === 0) {
    return { state: { ...ctx.state, branchSkipped: false } };
  }

  let currentCtx = ctx;
  for (const sub of step.steps) {
    const executor = STEP_EXECUTORS[sub.action];
    if (!executor) continue;

    for (let r = 0; r < (sub.repeat ?? 1); r++) {
      const result = await executor(sub, currentCtx);
      if (result.fullResult) return result;
      currentCtx = {
        ...currentCtx,
        state: { ...currentCtx.state, ...result.state },
      };
    }
  }

  return { state: { ...currentCtx.state, branchSkipped: false } };
}

// =============================================================================
// CUSTOM — user-provided executor function
// =============================================================================

/**
 * Execute a user-provided function passed via `step.params.executor`.
 * The function receives the current context and must return a
 * `StepExecutorResult`. If no executor function is provided, acts
 * as a no-op pass-through.
 *
 * Also supports `step.params.circuit`: a `QuantumCircuit` to compose
 * into the current circuit.
 */
async function executeCustom(
  step: PipelineStepInternal,
  ctx: StepExecutorContext,
): Promise<StepExecutorResult> {
  // User-provided executor function.
  const fn = step.params?.executor as
    | ((
      ctx: StepExecutorContext,
    ) => StepExecutorResult | Promise<StepExecutorResult>)
    | undefined;
  if (typeof fn === "function") {
    return await fn(ctx);
  }

  // User-provided circuit fragment.
  const userCircuit = step.params?.circuit;
  if (userCircuit instanceof QuantumCircuit) {
    ctx.circuit.compose(userCircuit);
    return {
      state: {
        ...ctx.state,
        circuitBuilt: true,
        n: Math.max(
          (ctx.state.n as number | undefined) ?? 0,
          userCircuit.numQubits,
        ),
      },
    };
  }

  // User-provided gate sequence: array of { gate, qubits, params }.
  const gates = step.params?.gates as
    | { gate: string; qubits: number[]; params?: Record<string, number> }[]
    | undefined;
  if (Array.isArray(gates)) {
    let maxQ = (ctx.state.n as number | undefined) ?? 0;
    for (const g of gates) {
      const qs = g.qubits;
      for (const q of qs) maxQ = Math.max(maxQ, q + 1);

      const gateName = g.gate as string;
      const fn = (ctx.circuit as unknown as Record<string, unknown>)[gateName];
      if (typeof fn === "function") {
        const paramValues = g.params ? Object.values(g.params) : [];
        (fn as Function).call(ctx.circuit, ...paramValues, ...qs);
      }
    }
    return {
      state: { ...ctx.state, circuitBuilt: true, n: maxQ },
    };
  }

  return { state: ctx.state };
}
