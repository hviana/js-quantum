/**
 * Example A — Hidden-subgroup class: finding prime factors.
 *
 * Algorithms covered (internally): Shor's algorithm, order finding,
 * Deutsch-Jozsa, Bernstein-Vazirani, Simon's algorithm.
 *
 * Problem solved: given an integer N that we know is a product of
 * two primes, recover its prime factors. The user hands in an
 * integer; the high-level API returns a list of factors.
 */

import { quantum } from "../mod.ts";

// RSA-like semiprime — recover its two prime factors.
const N = 15;

const result = await quantum("factoring")
  .data("target", N)
  .run();

console.log(result.answer()); // → [3, 5]
