/**
 * Example G — Sampling class: drawing from a hard distribution.
 *
 * Algorithms covered (internally): IQP sampling.
 *
 * Problem solved: generate a batch of bitstring samples from a
 * quantum distribution that is classically hard to reproduce.
 * The user picks the number of qubits; the API returns a list of
 * samples.
 */

import { quantum } from "../mod.ts";

const result = await quantum("sampling")
  .data("custom", null, { metadata: { n: 4 } })
  .run();

console.log(result.answer()); // → ["0000", "0101", ...]
