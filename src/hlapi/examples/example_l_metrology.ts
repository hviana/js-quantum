/**
 * Example L — Metrology class: phase / parameter estimation.
 *
 * Algorithms covered (internally): quantum phase estimation,
 * GHZ-state sensing, and Heisenberg-limited estimation.
 *
 * Problem solved: estimate an unknown optical phase φ from a
 * sensor response function. The user supplies the signal function;
 * the API returns the estimated parameter together with a
 * confidence interval.
 */

import { quantum } from "../mod.ts";

const unknownPhase = 0.3183; // ~ 1/π, pretend it is unknown

// Sensor signal: a monotone read-out linear in the phase.
const signal = (_x: number): number => unknownPhase;

const result = await quantum("phase_estimation")
  .function(signal)
  .run();

console.log(result.answer()); // → { phase: 0.3183, confidence: 0.95 }
