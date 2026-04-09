/**
 * Example E — Linear algebra: loop currents in a resistor mesh.
 *
 * Algorithms covered (internally): HHL and QSVT-based matrix
 * function application for solving Ax = b.
 *
 * Practical use case: a three-mesh DC circuit with a 10 V source
 * drives current through a network of resistors. Kirchhoff's
 * voltage law around each independent loop gives a 3×3 linear
 * system whose solution is the loop currents I1, I2, I3. This is
 * a real engineering calculation — the same shape of problem
 * scales to thousands of meshes in power-grid analysis, for which
 * HHL-class solvers target exponential speedups when the system
 * is sparse and well-conditioned.
 *
 * The user supplies A (the resistance coefficient matrix built
 * from the loop equations) and b (the EMF vector); the API returns
 * the current vector.
 *
 * Note on simulation: on a classical simulator HHL is evaluated
 * as a direct matrix inversion; the exponential advantage is
 * structural and only meaningful on real quantum hardware with
 * sparse block-encoded inputs.
 */

import { quantum } from "../mod.ts";

// Three-mesh DC circuit:
//   Mesh 1: (R1 + R2) I1 − R2 I2          = V
//   Mesh 2: −R2 I1 + (R2 + R3 + R4) I2 − R4 I3 = 0
//   Mesh 3:          −R4 I2 + (R4 + R5) I3 = 0
// R1=2 Ω, R2=4 Ω, R3=6 Ω, R4=3 Ω, R5=5 Ω, V=10 V.
const A = [
  [6, -4, 0],
  [-4, 13, -3],
  [0, -3, 8],
];
const b = [10, 0, 0];

const result = await quantum("linear_system")
  .matrix(A)
  .vector(b)
  .run();

console.log(result.answer()); // → loop currents [I1, I2, I3] in amperes
