/**
 * `ResultHandle` — the classical answer returned by `.run()`.
 *
 * Every quantum-mechanical detail is hidden behind `.answer()`,
 * which returns a strongly-typed classical value. Advanced users
 * can reach the raw histogram via `.raw()` or chain `.analyze()`
 * to post-process the measurement data.
 */

import type { BridgeRawResult } from "./bridge.ts";
import type { InterpretedResult } from "./interpret.ts";
import type { SupportStatus, TaskType } from "./params.ts";

export type ClassicalResult = unknown;

/** View returned by `.inspect()` on a `ResultHandle`. */
export interface ResultDetailView {
  readonly aspect: string;
  readonly task: TaskType;
  readonly method: string;
  readonly shots: number;
  readonly backend: string;
  readonly fallback: boolean;
  readonly counts: Readonly<Record<string, number>> | null;
  /** How the answer was produced (item 3). */
  readonly supportStatus: SupportStatus;
}

export class ResultHandle {
  constructor(
    private readonly task: TaskType,
    private readonly raw_: BridgeRawResult,
    private readonly interpreted: InterpretedResult,
    private readonly analyses: readonly {
      kind: string;
      value: unknown;
    }[] = [],
  ) {}

  /** Return the interpreted classical answer for the problem. */
  answer(): ClassicalResult {
    return this.interpreted.answer;
  }

  /** Confidence in `[0, 1]` based on measurement statistics. */
  confidence(): number {
    return this.interpreted.confidence;
  }

  /** Raw quantum measurement data (histogram, or `null` for fallback paths). */
  raw(): BridgeRawResult {
    return this.raw_;
  }

  /** Human-readable introspection of the result (item 3: stronger provenance). */
  inspect(aspect: string = "summary"): ResultDetailView {
    return {
      aspect,
      task: this.task,
      method: this.interpreted.method,
      shots: this.raw_.shots,
      backend: this.raw_.backendName,
      fallback: this.raw_.fallback,
      counts: this.raw_.counts,
      supportStatus: this.raw_.supportStatus,
    };
  }

  /**
   * Apply a classical post-processing analysis. Returns a NEW
   * `ResultHandle` with the analysis appended, so analyses chain.
   */
  analyze(
    kind: string,
    options: Record<string, unknown> = {},
  ): ResultHandle {
    const value = runAnalysis(
      kind,
      this.raw_,
      this.interpreted,
      this.task,
      options,
    );
    return new ResultHandle(this.task, this.raw_, this.interpreted, [
      ...this.analyses,
      { kind, value },
    ]);
  }

  /** Access the full list of analyses applied so far. */
  analyses_(): readonly { kind: string; value: unknown }[] {
    return this.analyses;
  }
}

// =============================================================================
// Analysis implementations (items 28-30)
// =============================================================================

type AnalysisCtx = {
  raw: BridgeRawResult;
  interp: InterpretedResult;
  task: TaskType;
  options: Record<string, unknown>;
};

// ---- visualize format handlers ----
const visualizeFormats: Record<string, (ctx: AnalysisCtx) => unknown> = {
  histogram: ({ raw }) => raw.counts ?? {},
  sorted: ({ raw }) => {
    if (!raw.counts) return [];
    return Object.entries(raw.counts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([bs, pct]) => ({ bitstring: bs, percentage: pct }));
  },
  spectrum: ({ raw }) => {
    if (!raw.counts) return [];
    return Object.entries(raw.counts)
      .map(([bs, pct]) => ({
        state: bs,
        index: parseInt(bs, 2),
        probability: (pct as number) / 100,
      }))
      .sort((a, b) => b.probability - a.probability);
  },
  optimizer_trace: ({ raw, interp }) => ({
    answer: interp.answer,
    method: interp.method,
    confidence: interp.confidence,
    topOutcomes: raw.counts
      ? Object.entries(raw.counts)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 10)
        .map(([bs, pct]) => ({ bitstring: bs, percentage: pct }))
      : [],
  }),
  kernel_summary: ({ interp }) => ({
    labels: interp.answer,
    method: interp.method,
    confidence: interp.confidence,
  }),
  decoder_diagnostics: ({ raw, interp }) => ({
    decoded: interp.answer,
    method: interp.method,
    histogram: raw.counts,
  }),
};

// ---- export format handlers ----
const exportFormats: Record<string, (ctx: AnalysisCtx) => unknown> = {
  json: ({ raw, interp }) =>
    JSON.stringify({
      task: interp.task,
      answer: interp.answer,
      confidence: interp.confidence,
      method: interp.method,
      fallback: raw.fallback,
      supportStatus: raw.supportStatus,
      shots: raw.shots,
      backend: raw.backendName,
      counts: raw.counts,
    }),
  csv: ({ raw }) => {
    if (!raw.counts) return "bitstring,percentage\n";
    const rows = Object.entries(raw.counts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([bs, pct]) => `${bs},${pct}`);
    return "bitstring,percentage\n" + rows.join("\n");
  },
  interpreted: ({ interp }) => ({
    task: interp.task,
    answer: interp.answer,
    confidence: interp.confidence,
    method: interp.method,
  }),
  circuit: ({ raw }) => {
    if (!raw.circuit) return { note: "no circuit available" };
    const circ = raw.circuit;
    return {
      numQubits: circ.numQubits,
      numClbits: circ.numClbits,
      instructionCount: circ.instructions.length,
      complexity: circ.complexity(),
    };
  },
  raw: ({ raw }) => ({
    counts: raw.counts,
    classicalAnswer: raw.classicalAnswer,
    fallback: raw.fallback,
    note: raw.note,
    shots: raw.shots,
    backendName: raw.backendName,
    supportStatus: raw.supportStatus,
  }),
};

// ---- decode task handlers ----
const decodeTaskHandlers: Record<string, (ctx: AnalysisCtx) => unknown> = {
  estimate_phase: ({ raw, interp }) => {
    const result = interp.answer as
      | { phase: number; confidence: number }
      | null;
    if (!result) return null;
    return {
      ...result,
      binaryFraction: result.phase.toString(2),
      histogram: raw.counts,
    };
  },
};

// ---- main analysis handler map ----
const analysisHandlers: Record<string, (ctx: AnalysisCtx) => unknown> = {
  marginal: ({ raw, options }) => {
    if (!raw.counts) return {};
    const qubits = (options.qubits as number[] | undefined) ?? [];
    const marg: Record<string, number> = {};
    for (
      const [bs, pct] of Object.entries(raw.counts) as [string, number][]
    ) {
      const key = qubits.map((q) => bs[q] ?? "0").join("");
      marg[key] = (marg[key] ?? 0) + pct;
    }
    return marg;
  },

  estimate_error: ({ raw, interp, options }) => {
    const level = (options.confidence as number | undefined) ?? 0.95;
    const shots = raw.shots;
    const p = interp.confidence;
    const z = level >= 0.99 ? 2.576 : level >= 0.95 ? 1.96 : 1.645;
    const n = shots;
    const denom = 1 + z * z / n;
    const centre = (p + z * z / (2 * n)) / denom;
    const halfWidth = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) /
      denom;
    return {
      confidence: level,
      interval: [
        Math.max(0, centre - halfWidth),
        Math.min(1, centre + halfWidth),
      ],
      shots,
      method: "Wilson score interval",
    };
  },

  decode: (ctx) => {
    if (!ctx.raw.counts) return ctx.interp.answer;
    const handler = decodeTaskHandlers[ctx.task];
    return handler ? handler(ctx) : ctx.interp.answer;
  },

  aggregate: ({ raw }) => {
    if (!raw.counts) return { mean: 0, variance: 0 };
    let mean = 0, meanSq = 0, totalPct = 0;
    for (
      const [bs, pct] of Object.entries(raw.counts) as [string, number][]
    ) {
      const val = parseInt(bs, 2);
      const p = pct / 100;
      mean += val * p;
      meanSq += val * val * p;
      totalPct += p;
    }
    if (totalPct > 0) {
      mean /= totalPct;
      meanSq /= totalPct;
    }
    return {
      mean,
      variance: meanSq - mean * mean,
      stddev: Math.sqrt(Math.max(0, meanSq - mean * mean)),
      numOutcomes: Object.keys(raw.counts).length,
    };
  },

  fit: ({ raw, options }) => {
    if (!raw.counts) return { kind: "fit", note: "no data to fit" };
    const model = (options.model as string | undefined) ?? "gaussian";
    const entries = Object.entries(raw.counts) as [string, number][];
    const values = entries.map(([bs, pct]) => ({
      x: parseInt(bs, 2),
      p: pct / 100,
    }));
    if (model === "gaussian") {
      let mean = 0, totalP = 0;
      for (const { x, p } of values) {
        mean += x * p;
        totalP += p;
      }
      mean /= Math.max(totalP, 1e-10);
      let variance = 0;
      for (const { x, p } of values) {
        variance += (x - mean) * (x - mean) * p;
      }
      variance /= Math.max(totalP, 1e-10);
      return { model: "gaussian", mean, variance, stddev: Math.sqrt(variance) };
    }
    return { model, note: `model '${model}' not implemented` };
  },

  certify: ({ raw, interp, options }) => {
    const threshold = (options.threshold as number | undefined) ?? 0.9;
    const certified = interp.confidence >= threshold;
    return {
      certified,
      threshold,
      confidence: interp.confidence,
      method: interp.method,
      fallback: raw.fallback,
      supportStatus: raw.supportStatus,
    };
  },

  reconstruct: ({ raw }) => {
    if (!raw.counts) return { note: "no counts for reconstruction" };
    const dist: Record<string, number> = {};
    let total = 0;
    for (
      const [bs, pct] of Object.entries(raw.counts) as [string, number][]
    ) {
      total += pct;
    }
    for (
      const [bs, pct] of Object.entries(raw.counts) as [string, number][]
    ) {
      dist[bs] = total > 0 ? pct / total : 0;
    }
    return { distribution: dist, totalPercentage: total };
  },

  correlate: ({ raw, options }) => {
    if (!raw.counts) return {};
    const qubits = (options.qubits as number[] | undefined) ?? [];
    const bitLen = Math.max(
      ...Object.keys(raw.counts).map((bs) => bs.length),
      1,
    );
    const qs = qubits.length > 0
      ? qubits
      : Array.from({ length: bitLen }, (_, i) => i);
    const correlations: Record<string, number> = {};
    for (let i = 0; i < qs.length; i++) {
      for (let j = i + 1; j < qs.length; j++) {
        let expectZiZj = 0;
        let totalP = 0;
        for (
          const [bs, pct] of Object.entries(raw.counts) as [string, number][]
        ) {
          const zi = bs[qs[i]] === "1" ? -1 : 1;
          const zj = bs[qs[j]] === "1" ? -1 : 1;
          expectZiZj += zi * zj * pct / 100;
          totalP += pct / 100;
        }
        correlations[`Z${qs[i]}Z${qs[j]}`] = totalP > 0
          ? expectZiZj / totalP
          : 0;
      }
    }
    return correlations;
  },

  visualize: (ctx) => {
    const format = (ctx.options.format as string | undefined) ?? "histogram";
    const handler = visualizeFormats[format];
    return handler ? handler(ctx) : (ctx.raw.counts ?? {});
  },

  export: (ctx) => {
    const fmt = (ctx.options.format as string | undefined) ?? "json";
    const handler = exportFormats[fmt];
    return handler ? handler(ctx) : JSON.stringify(ctx.interp);
  },
};

function runAnalysis(
  kind: string,
  raw: BridgeRawResult,
  interp: InterpretedResult,
  task: TaskType,
  options: Record<string, unknown>,
): unknown {
  const ctx: AnalysisCtx = { raw, interp, task, options };
  const handler = analysisHandlers[kind];
  if (handler) return handler(ctx);
  return { kind, note: "custom analysis — provide implementation via options" };
}
