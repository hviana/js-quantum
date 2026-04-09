/**
 * Example B — Amplitude amplification: subset-sum reconciliation.
 *
 * Algorithm covered (internally): Grover's algorithm and its
 * generalisations — amplitude amplification and amplitude
 * estimation.
 *
 * Practical use case: given a list of invoice amounts and a target
 * total, find a subset of invoices that reconciles exactly to the
 * target. This is the canonical NP-style decision problem where
 * *verifying* a candidate is O(n) (add up the selected amounts)
 * but *searching* is exponential in the number of invoices — so
 * subset-sum lies squarely in the regime where amplitude
 * amplification offers a provable quadratic (Grover) speedup on
 * real quantum hardware.
 *
 * The user describes the search space as an enumerable set of
 * candidate masks and the predicate as a pure check function; the
 * API returns a mask that reconciles. Nothing about this code is
 * specific to "a list of records to scan" — the oracle is computed
 * from the candidate, not looked up in a pre-populated table.
 *
 * Note on simulation: on a classical simulator the predicate is
 * evaluated over the candidate space to mark the Grover oracle,
 * so the √N advantage is not realised here. The same user code
 * runs unchanged on a real quantum backend, where the predicate
 * becomes a reversible oracle circuit and the solver achieves the
 * quadratic speedup.
 */

import { quantum } from "../mod.ts";

// Invoices from a procurement run; accounting needs a subset that
// reconciles exactly to $42 to close a disputed line item.
const invoices = [7, 13, 11, 8, 3, 14, 5];
const target = 42;

// Search space: every subset of the invoices, encoded as a bitmask
// with bit i set when invoice i is selected. 2^7 = 128 candidates.
const candidates = Array.from({ length: 1 << invoices.length }, (_, m) => m);

const reconciles = (mask: unknown): boolean => {
  let sum = 0;
  for (let i = 0; i < invoices.length; i++) {
    if (((mask as number) >> i) & 1) sum += invoices[i];
  }
  return sum === target;
};

const result = await quantum("search")
  .search_in(candidates, reconciles)
  .run();

const mask = result.answer() as number;
const subset = invoices.filter((_, i) => ((mask >> i) & 1) === 1);
console.log(subset, "→", subset.reduce((a, b) => a + b, 0));
// → e.g. [13, 11, 8, 3, 7] → 42
