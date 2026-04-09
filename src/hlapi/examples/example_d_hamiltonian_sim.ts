/**
 * Example D — Hamiltonian-simulation class: time evolution.
 *
 * Algorithms covered (internally): Trotter-Suzuki product formulas,
 * LCU, QDRIFT, and interaction-picture simulation.
 *
 * Problem solved: evolve a small spin chain under a transverse-field
 * Ising Hamiltonian and read back the resulting probability
 * distribution over computational-basis states. The user supplies
 * the Hamiltonian matrix; the API returns the measurement
 * distribution.
 */

import { quantum } from "../mod.ts";

// 2-qubit transverse-field Ising Hamiltonian (toy example).
const H = [
  [1, 1, 1, 0],
  [1, -1, 0, 1],
  [1, 0, -1, 1],
  [0, 1, 1, 1],
];

const result = await quantum("simulation")
  .system(H)
  .run();

console.log(result.answer()); // → distribution of basis states
