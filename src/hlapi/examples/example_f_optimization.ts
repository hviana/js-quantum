/**
 * Example F — Optimization class: combinatorial minimization.
 *
 * Algorithms covered (internally): QAOA, VQE, and adiabatic
 * quantum optimization.
 *
 * Problem solved: Max-Cut on a small graph. Given 5 nodes, assign
 * each to group A (bit 0) or group B (bit 1) so that the number
 * of edges crossing between the two groups is maximized. The user
 * supplies a cost function; the API returns the optimal
 * assignment and its cost.
 */

import { quantum } from "../mod.ts";

// Edges of a small 5-node graph.
const edges: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 0],
  [0, 2],
];

// Cost = −(edges crossing the cut); minimization ↔ maximum cut.
const cost = (bits: number[]): number => {
  let cut = 0;
  for (const [i, j] of edges) if (bits[i] !== bits[j]) cut++;
  return -cut;
};

const result = await quantum("optimization")
  .cost_function(cost, { metadata: { numBits: 5 } })
  .run();

console.log(result.answer()); // → { assignment: [...], cost: -5 }
