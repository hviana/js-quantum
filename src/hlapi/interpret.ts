/**
 * Output interpretation layer.
 *
 * Converts the `BridgeRawResult` produced by the bridge into the
 * classical answer type promised by `.answer()` for each problem
 * kind. Wraps the result with a task-specific confidence score.
 */

import type { BridgeRawResult } from "./bridge.ts";
import type { TaskType } from "./params.ts";

export interface InterpretedResult {
  readonly answer: unknown;
  readonly confidence: number;
  readonly task: TaskType;
  readonly method: string;
}

// =============================================================================
// Task-specific confidence estimation (item 27)
// =============================================================================

/**
 * Top probability from a histogram — used as a confidence proxy
 * for search/factoring/phase-estimation tasks where the correct
 * answer should dominate the histogram.
 */
function topProbability(raw: BridgeRawResult): number {
  if (!raw.counts) return 0;
  let top = 0;
  for (const pct of Object.values(raw.counts) as number[]) {
    if (pct > top) top = pct;
  }
  return Math.min(1, top / 100);
}

/**
 * Entropy-based confidence for sampling tasks.
 * Low entropy → more concentrated → higher confidence in the
 * distribution itself being non-trivial.
 */
function entropyConfidence(raw: BridgeRawResult): number {
  if (!raw.counts) return 0.5;
  let entropy = 0;
  for (const pct of Object.values(raw.counts) as number[]) {
    const p = pct / 100;
    if (p > 1e-10) entropy -= p * Math.log2(p);
  }
  const numOutcomes = Object.keys(raw.counts).length;
  const maxEntropy = Math.log2(Math.max(2, numOutcomes));
  // Normalized entropy in [0,1]; we want confidence to be higher
  // when entropy is moderate (neither trivial nor uniform).
  const normalized = maxEntropy > 0 ? entropy / maxEntropy : 1;
  return Math.max(0.1, 1 - Math.abs(normalized - 0.5));
}

/**
 * Optimization confidence: based on how concentrated the
 * distribution is around the best bitstring. In QAOA, the optimal
 * bitstring should have noticeably higher probability.
 */
function optimizationConfidence(raw: BridgeRawResult): number {
  if (!raw.counts) return 0.95; // classical fallback
  const probs = Object.values(raw.counts) as number[];
  if (probs.length === 0) return 0;
  const sorted = [...probs].sort((a, b) => b - a);
  const top = sorted[0] / 100;
  const second = (sorted[1] ?? 0) / 100;
  // Confidence is higher when the gap between top and second is large.
  const gap = top - second;
  return Math.min(1, top + gap);
}

/**
 * Classification confidence: proportion of kernel evaluations
 * that agreed on the winning label.
 */
function classificationConfidence(raw: BridgeRawResult): number {
  // For kernel classification, the bridge produces labels directly.
  // Confidence comes from the kernel values, which we approximate
  // as moderate since we don't have per-prediction kernel scores.
  if (raw.fallback) return 0.85;
  return 0.90;
}

/**
 * Error-correction confidence: based on the syndrome measurement.
 * If the corrected state dominates the histogram, confidence is high.
 */
function errorCorrectionConfidence(raw: BridgeRawResult): number {
  if (!raw.counts) return 0.5;
  return topProbability(raw);
}

// =============================================================================
// Task-specific decoders (item 26)
// =============================================================================

/**
 * Decode the bridge result into a task-appropriate classical answer
 * with algorithm-aware confidence scoring.
 */
type Interpreter = (
  raw: BridgeRawResult,
) => { answer: unknown; confidence: number };

const interpreterMap: Record<string, Interpreter> = {
  search: (raw) => ({
    answer: raw.classicalAnswer,
    confidence: topProbability(raw),
  }),
  factoring: (raw) => {
    const factors = raw.classicalAnswer as number[];
    const product = factors?.reduce((a, b) => a * b, 1) ?? 0;
    return {
      answer: factors,
      confidence: product > 1 ? 1.0 : topProbability(raw),
    };
  },
  period_finding: (raw) => {
    const r = raw.classicalAnswer as number;
    return {
      answer: r,
      confidence: r > 0 ? (raw.fallback ? 0.95 : topProbability(raw)) : 0,
    };
  },
  solve_linear: (raw) => ({
    answer: raw.classicalAnswer as number[],
    confidence: raw.fallback ? 0.99 : topProbability(raw),
  }),
  optimize: (raw) => ({
    answer: raw.classicalAnswer as
      | { assignment: number[]; cost: number }
      | null,
    confidence: optimizationConfidence(raw),
  }),
  ground_state: (raw) => ({
    answer: raw.classicalAnswer as
      | { energy: number; distribution?: unknown }
      | null,
    confidence: raw.fallback ? 0.95 : optimizationConfidence(raw),
  }),
  time_evolution: (raw) => ({
    answer: raw.classicalAnswer,
    confidence: raw.fallback ? 0.5 : entropyConfidence(raw),
  }),
  sample: (raw) => ({
    answer: raw.classicalAnswer,
    confidence: entropyConfidence(raw),
  }),
  classify: (raw) => ({
    answer: raw.classicalAnswer,
    confidence: classificationConfidence(raw),
  }),
  estimate_phase: (raw) => {
    const result = raw.classicalAnswer as
      | { phase: number; confidence: number }
      | null;
    return {
      answer: result,
      confidence: result?.confidence ?? topProbability(raw),
    };
  },
  correct: (raw) => ({
    answer: raw.classicalAnswer,
    confidence: errorCorrectionConfidence(raw),
  }),
  quantum_walk: (raw) => ({
    answer: raw.classicalAnswer,
    confidence: topProbability(raw),
  }),
};

export function interpret(
  task: TaskType,
  raw: BridgeRawResult,
): InterpretedResult {
  const handler = interpreterMap[task];
  const { answer, confidence } = handler ? handler(raw) : {
    answer: raw.classicalAnswer,
    confidence: raw.counts ? topProbability(raw) : 0.5,
  };
  return { answer, confidence, task, method: raw.note };
}
