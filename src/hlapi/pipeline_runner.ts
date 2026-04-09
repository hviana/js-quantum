/**
 * Pipeline runner — executes pipeline steps in order, respecting
 * composition modes (sequence, loop, repeat, map, parallel, branch,
 * recursive).
 *
 * Each pipeline step is executed via its registered step executor.
 * Step executors build real circuit fragments on `ctx.circuit` for
 * decomposable tasks (search, simulation, sampling, quantum walk,
 * error correction, phase estimation). The measure/sample step
 * executes the accumulated circuit on the backend. For complex
 * tasks (factoring, HHL, classification), step executors set state
 * flags and the proven legacy handler is called after all steps.
 */

import { QuantumCircuit } from "../circuit.ts";
import type { Backend } from "../backend.ts";
import type { StepExecutorContext, TaskType } from "./params.ts";
import type { Artifact, Pipeline } from "./registry.ts";
import { type BridgeRawResult, taskHandlerMap } from "./bridge.ts";
import { STEP_EXECUTORS } from "./step_executors.ts";

// =============================================================================
// Pipeline runner
// =============================================================================

export async function runPipeline(
  pipeline: Pipeline,
  task: TaskType,
  artifacts: Readonly<Record<string, Artifact>>,
  backend: Backend,
  shots: number,
): Promise<BridgeRawResult> {
  const ctx: StepExecutorContext = {
    backend,
    shots,
    artifacts,
    task,
    control: { ...pipeline.control },
    approximation: { ...pipeline.approximation },
    circuit: new QuantumCircuit(),
    state: { pipelineFamily: pipeline.family },
  };

  const compositionHandlers: Record<
    string,
    (p: Pipeline, c: StepExecutorContext) => Promise<BridgeRawResult>
  > = {
    loop: runLoopComposition,
    parallel: runParallelComposition,
    branch: runBranchComposition,
    recursive: runRecursiveComposition,
    map: runMapComposition,
  };
  const compositionRunner = compositionHandlers[pipeline.composition] ??
    runStepsComposition;
  const result = await compositionRunner(pipeline, ctx);

  return enforceErrorBudget(result, pipeline);
}

// =============================================================================
// Error budget enforcement
// =============================================================================

/**
 * Estimate and enforce the error budget on a pipeline result.
 *
 * Uses a simple depolarizing noise model: each gate contributes a
 * per-gate error probability, and the total error is estimated as
 * 1 - (1 - p_gate)^numGates ≈ numGates × p_gate for small p_gate.
 *
 * The default per-gate error rate is 1e-3 (typical for near-term
 * devices). If the estimated total error exceeds the budget, the
 * result note is annotated with a warning.
 */
function enforceErrorBudget(
  result: BridgeRawResult,
  pipeline: Pipeline,
): BridgeRawResult {
  const budget = pipeline.control.errorBudget as
    | { total?: number; perStep?: number; perGate?: number }
    | undefined;
  if (!budget) return result;

  const circuit = result.circuit;
  if (!circuit) return result;

  const gateInstrs = circuit.instructions.filter(
    (i) => i.kind !== "measure" && i.kind !== "barrier" && i.kind !== "reset",
  );
  const numGates = gateInstrs.length;
  const numSteps = pipeline.steps.length;

  // Per-gate error rate: user-specified or default 1e-3.
  const perGateError = budget.perGate ?? 1e-3;

  // Estimated total error: 1 - (1 - p)^n.
  const estimatedTotalError = 1 - Math.pow(1 - perGateError, numGates);

  // Per-step error: total error distributed across steps.
  const estimatedPerStepError = numSteps > 0
    ? estimatedTotalError / numSteps
    : estimatedTotalError;

  const warnings: string[] = [];

  if (budget.total != null && estimatedTotalError > budget.total) {
    warnings.push(
      `estimated total error ${
        estimatedTotalError.toFixed(4)
      } exceeds budget ${budget.total}`,
    );
  }

  if (budget.perStep != null && estimatedPerStepError > budget.perStep) {
    warnings.push(
      `estimated per-step error ${
        estimatedPerStepError.toFixed(4)
      } exceeds budget ${budget.perStep}`,
    );
  }

  if (budget.perGate != null && perGateError > budget.perGate) {
    warnings.push(
      `per-gate error ${perGateError} exceeds budget ${budget.perGate}`,
    );
  }

  if (warnings.length === 0) return result;

  return {
    ...result,
    note: `${result.note} [error budget warning: ${warnings.join("; ")}]`,
  };
}

// =============================================================================
// Composition: steps (sequence / repeat / map)
// =============================================================================

/**
 * Execute steps linearly. Each step executor can build circuit
 * fragments, set state, or return a fullResult. The measure/sample
 * step executes the accumulated circuit. If no step returned a
 * fullResult, delegate to the legacy handler.
 */
async function runStepsComposition(
  pipeline: Pipeline,
  ctx: StepExecutorContext,
): Promise<BridgeRawResult> {
  let currentCtx = ctx;

  for (const step of pipeline.steps) {
    const executor = STEP_EXECUTORS[step.action];
    if (!executor) continue;

    for (let r = 0; r < (step.repeat ?? 1); r++) {
      const result = await executor(step, currentCtx);

      if (result.fullResult) {
        return result.fullResult;
      }

      currentCtx = {
        ...currentCtx,
        circuit: currentCtx.circuit,
        state: { ...currentCtx.state, ...result.state },
      };
    }
  }

  return delegateToHandler(ctx.task, ctx.artifacts, {
    backend: ctx.backend,
    shots: ctx.shots,
  });
}

// =============================================================================
// Composition: loop (variational)
// =============================================================================

async function runLoopComposition(
  pipeline: Pipeline,
  ctx: StepExecutorContext,
): Promise<BridgeRawResult> {
  const maxIterations = (ctx.control.maxIterations as number | undefined) ??
    100;
  let currentCtx = ctx;

  for (let iter = 0; iter < maxIterations; iter++) {
    for (const step of pipeline.steps) {
      const executor = STEP_EXECUTORS[step.action];
      if (!executor) continue;

      for (let r = 0; r < (step.repeat ?? 1); r++) {
        const result = await executor(step, currentCtx);

        if (result.fullResult) {
          return result.fullResult;
        }

        currentCtx = {
          ...currentCtx,
          circuit: currentCtx.circuit,
          state: { ...currentCtx.state, ...result.state },
        };

        if (result.converged) {
          if (result.counts) {
            return {
              counts: result.counts,
              classicalAnswer: result.classicalAnswer ?? null,
              fallback: false,
              note: `Pipeline loop converged after iteration ${iter + 1}`,
              shots: ctx.shots,
              backendName: ctx.backend.name,
              circuit: result.circuit ?? null,
              supportStatus: "fully_executable",
            };
          }
          return delegateToHandler(ctx.task, ctx.artifacts, {
            backend: ctx.backend,
            shots: ctx.shots,
          });
        }
      }
    }
  }

  return delegateToHandler(ctx.task, ctx.artifacts, {
    backend: ctx.backend,
    shots: ctx.shots,
  });
}

// =============================================================================
// Composition: parallel
// =============================================================================

/**
 * Execute all steps concurrently, each on its own fresh circuit.
 * Results are merged: the first step that produces a fullResult wins;
 * otherwise states are merged left-to-right and the combined circuit
 * is the composition of all per-step circuits.
 */
async function runParallelComposition(
  pipeline: Pipeline,
  ctx: StepExecutorContext,
): Promise<BridgeRawResult> {
  const jobs = pipeline.steps.map(async (step) => {
    const executor = STEP_EXECUTORS[step.action];
    if (!executor) return null;

    const branchCtx: StepExecutorContext = {
      ...ctx,
      circuit: new QuantumCircuit(),
      state: { ...ctx.state },
    };

    let currentCtx = branchCtx;
    for (let r = 0; r < (step.repeat ?? 1); r++) {
      const result = await executor(step, currentCtx);
      if (result.fullResult) return result;
      currentCtx = {
        ...currentCtx,
        state: { ...currentCtx.state, ...result.state },
      };
    }
    return { state: currentCtx.state, circuit: currentCtx.circuit };
  });

  const results = await Promise.all(jobs);

  // Check for a fullResult from any branch.
  for (const r of results) {
    if (r && "fullResult" in r && r.fullResult) return r.fullResult;
  }

  // Merge: compose all branch circuits into the main circuit, merge state.
  let mergedState = { ...ctx.state };
  for (const r of results) {
    if (!r) continue;
    if ("state" in r) mergedState = { ...mergedState, ...r.state };
    if ("circuit" in r && r.circuit instanceof QuantumCircuit) {
      ctx.circuit.compose(r.circuit as QuantumCircuit);
    }
  }

  return delegateToHandler(ctx.task, ctx.artifacts, {
    backend: ctx.backend,
    shots: ctx.shots,
  });
}

// =============================================================================
// Composition: branch
// =============================================================================

/**
 * Evaluate each step's condition against the current state. Execute
 * only the first step whose condition matches (or that has no
 * condition). Falls through to the handler if no step fires.
 */
async function runBranchComposition(
  pipeline: Pipeline,
  ctx: StepExecutorContext,
): Promise<BridgeRawResult> {
  let currentCtx = ctx;

  for (const step of pipeline.steps) {
    // Evaluate condition (from step.condition or step.params.condition).
    const cond = step.condition ??
      (step.params?.condition as
        | { on: string; equals: number | string }
        | undefined);

    if (cond) {
      const val = currentCtx.state[cond.on];
      if (val !== cond.equals) continue; // skip non-matching branches
    }

    // Matching branch found — execute it.
    const executor = STEP_EXECUTORS[step.action];
    if (!executor) continue;

    for (let r = 0; r < (step.repeat ?? 1); r++) {
      const result = await executor(step, currentCtx);
      if (result.fullResult) return result.fullResult;
      currentCtx = {
        ...currentCtx,
        state: { ...currentCtx.state, ...result.state },
      };
    }

    // Execute any nested sub-steps.
    if (step.steps && step.steps.length > 0) {
      for (const sub of step.steps) {
        const subExec = STEP_EXECUTORS[sub.action];
        if (!subExec) continue;
        for (let r = 0; r < (sub.repeat ?? 1); r++) {
          const result = await subExec(sub, currentCtx);
          if (result.fullResult) return result.fullResult;
          currentCtx = {
            ...currentCtx,
            state: { ...currentCtx.state, ...result.state },
          };
        }
      }
    }

    // Only the first matching branch executes.
    break;
  }

  return delegateToHandler(ctx.task, ctx.artifacts, {
    backend: ctx.backend,
    shots: ctx.shots,
  });
}

// =============================================================================
// Composition: recursive
// =============================================================================

/**
 * Execute the pipeline steps repeatedly, feeding each iteration's
 * output state into the next, until convergence or maxIterations.
 * Unlike `loop` (which targets variational algorithms), `recursive`
 * rebuilds a fresh circuit each iteration and checks a
 * `recursionDepth` counter.
 */
async function runRecursiveComposition(
  pipeline: Pipeline,
  ctx: StepExecutorContext,
): Promise<BridgeRawResult> {
  const maxDepth = (ctx.control.maxDepth as number | undefined) ??
    (ctx.control.maxIterations as number | undefined) ?? 10;
  let currentCtx = ctx;

  for (let depth = 0; depth < maxDepth; depth++) {
    // Fresh circuit each recursion level.
    currentCtx = {
      ...currentCtx,
      circuit: new QuantumCircuit(),
      state: { ...currentCtx.state, recursionDepth: depth },
    };

    for (const step of pipeline.steps) {
      const executor = STEP_EXECUTORS[step.action];
      if (!executor) continue;

      for (let r = 0; r < (step.repeat ?? 1); r++) {
        const result = await executor(step, currentCtx);

        if (result.fullResult) return result.fullResult;

        currentCtx = {
          ...currentCtx,
          state: { ...currentCtx.state, ...result.state },
        };

        if (result.converged) {
          if (result.counts) {
            return {
              counts: result.counts,
              classicalAnswer: result.classicalAnswer ?? null,
              fallback: false,
              note: `Recursive composition converged at depth ${depth + 1}`,
              shots: ctx.shots,
              backendName: ctx.backend.name,
              circuit: result.circuit ?? null,
              supportStatus: "fully_executable",
            };
          }
          return delegateToHandler(ctx.task, ctx.artifacts, {
            backend: ctx.backend,
            shots: ctx.shots,
          });
        }
      }
    }
  }

  return delegateToHandler(ctx.task, ctx.artifacts, {
    backend: ctx.backend,
    shots: ctx.shots,
  });
}

// =============================================================================
// Composition: map
// =============================================================================

/**
 * Map the pipeline steps over each data item in the primary data
 * artifact. Each item gets its own circuit execution; results are
 * aggregated into an array of counts/answers.
 *
 * If no iterable data artifact is found, falls back to sequential.
 */
async function runMapComposition(
  pipeline: Pipeline,
  ctx: StepExecutorContext,
): Promise<BridgeRawResult> {
  // Find the iterable data artifact (training_data, items, or first array).
  const dataArtifact = ctx.artifacts.training_data ??
    ctx.artifacts.items ??
    Object.values(ctx.artifacts).find((a) => Array.isArray(a.data));

  if (!dataArtifact || !Array.isArray(dataArtifact.data)) {
    // No iterable data — fall back to sequential execution.
    return runStepsComposition(pipeline, ctx);
  }

  const items = dataArtifact.data as unknown[];
  const allCounts: Record<string, number>[] = [];
  const allAnswers: unknown[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    // Create a per-item context with a fresh circuit and the item in state.
    const itemCtx: StepExecutorContext = {
      ...ctx,
      circuit: new QuantumCircuit(),
      state: { ...ctx.state, mapIndex: idx, mapItem: items[idx] },
    };

    let currentCtx = itemCtx;
    let itemResult: BridgeRawResult | null = null;

    for (const step of pipeline.steps) {
      const executor = STEP_EXECUTORS[step.action];
      if (!executor) continue;

      for (let r = 0; r < (step.repeat ?? 1); r++) {
        const result = await executor(step, currentCtx);

        if (result.fullResult) {
          itemResult = result.fullResult;
          break;
        }

        currentCtx = {
          ...currentCtx,
          state: { ...currentCtx.state, ...result.state },
        };
      }
      if (itemResult) break;
    }

    if (itemResult) {
      if (itemResult.counts) allCounts.push(itemResult.counts);
      allAnswers.push(itemResult.classicalAnswer);
    }
  }

  // Aggregate: merge all count distributions.
  const mergedCounts: Record<string, number> = {};
  for (const c of allCounts) {
    for (const [k, v] of Object.entries(c)) {
      mergedCounts[k] = (mergedCounts[k] ?? 0) + v;
    }
  }

  return {
    counts: Object.keys(mergedCounts).length > 0 ? mergedCounts : null,
    classicalAnswer: allAnswers,
    fallback: false,
    note: `Map composition over ${items.length} items`,
    shots: ctx.shots,
    backendName: ctx.backend.name,
    circuit: null,
    supportStatus: allCounts.length > 0
      ? "fully_executable"
      : "classical_fallback",
  };
}

// =============================================================================
// Handler delegation
// =============================================================================

async function delegateToHandler(
  task: TaskType,
  artifacts: Readonly<Record<string, Artifact>>,
  ctx: { backend: Backend; shots: number },
): Promise<BridgeRawResult> {
  const handler = taskHandlerMap[task];
  if (handler) return handler(artifacts, ctx);
  return {
    counts: null,
    classicalAnswer: null,
    fallback: true,
    note: `task '${task}' has no executable bridge handler`,
    shots: ctx.shots,
    backendName: ctx.backend.name,
    circuit: null,
    supportStatus: "unsupported",
  };
}
