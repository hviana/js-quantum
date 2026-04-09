/**
 * Example C — Quantum walk: locating a fault in a network topology.
 *
 * Algorithms covered (internally): Szegedy quantum walks and
 * continuous-time quantum walks for spatial search on a graph.
 *
 * Practical use case: a small mesh network of routers has started
 * dropping packets on exactly one device. Probing every router in
 * sequence is O(N); a quantum walk on the topology locates the
 * faulty node in O(√N) on real hardware, exploiting the graph
 * structure rather than any per-node label. The caller supplies
 * the adjacency matrix of the topology and a predicate that, given
 * a node index, checks whether that router is the one dropping
 * packets (e.g., by looking at its health counters). The API
 * returns the faulty node.
 *
 * The oracle here is a function — not a list lookup — so the
 * problem is a genuine spatial-search instance: the graph
 * structure is what makes the walk converge on the marked node.
 *
 * Note on simulation: on a classical simulator the health check is
 * evaluated on every candidate node to mark the walk operator; the
 * √N advantage is structural and only realised on real hardware.
 */

import { quantum } from "../mod.ts";

// 3 × 3 mesh network of routers (9 nodes); each router is connected
// to its cardinal neighbours.
const n = 3;
const nodes = Array.from({ length: n * n }, (_, i) => i);
const adjacency: number[][] = nodes.map(() => nodes.map(() => 0));
for (let r = 0; r < n; r++) {
  for (let c = 0; c < n; c++) {
    const i = r * n + c;
    if (r + 1 < n) {
      const j = (r + 1) * n + c;
      adjacency[i][j] = adjacency[j][i] = 1;
    }
    if (c + 1 < n) {
      const j = r * n + (c + 1);
      adjacency[i][j] = adjacency[j][i] = 1;
    }
  }
}

// One router has a degraded health counter; the predicate is a
// pure check function the caller would normally get from SNMP.
const healthCounter = (node: number): number => (node === 5 ? 0 : 100);
const isFaulty = (node: unknown): boolean => healthCounter(node as number) < 50;

const result = await quantum("search")
  .graph(adjacency)
  .search_in(nodes, isFaulty)
  .run();

console.log("faulty router:", result.answer()); // → 5
