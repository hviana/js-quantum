/**
 * Bloch sphere introspection (Section 8.3, Section 11.3.10).
 *
 * Given a multi-qubit state vector and a target qubit index,
 * compute the Bloch vector `(x, y, z)` and the corresponding
 * spherical coordinates `(theta, phi, r)` for that qubit's
 * reduced state.
 *
 * Algorithm: trace out every other qubit to obtain the 2×2
 * reduced density matrix `rho_k`, then read off
 *
 *     x = 2 * Re(rho_k[0, 1])
 *     y = 2 * Im(rho_k[1, 0])
 *     z = rho_k[0, 0] - rho_k[1, 1]
 *     r = sqrt(x^2 + y^2 + z^2)
 *     theta = arccos(z / r)
 *     phi   = atan2(y, x)
 *
 * For a pure single-qubit state |ψ⟩ = α|0⟩ + β|1⟩, this reduces
 * to `r = 1` and the standard Bloch sphere parameterization. For
 * a maximally mixed reduced state (e.g. one qubit of a Bell pair)
 * the Bloch vector length is 0.
 */

import type { Complex } from "./complex.ts";
import type { BlochCoordinates } from "./types.ts";
import type { QuantumCircuit } from "./circuit.ts";
import { SimulatorBackend } from "./simulator.ts";

/**
 * Compute the Bloch coordinates of qubit `target` in a state
 * vector representing an `n`-qubit pure state.
 *
 * The state vector indexing follows Section 2 conventions: the
 * length is `2^n`; bit `(n-1-target)` of the index corresponds to
 * the value of `target` qubit.
 *
 * @param state state vector of length `2^n`.
 * @param numQubits the number of qubits `n`.
 * @param target the qubit whose Bloch vector to compute.
 */
export function blochFromStateVector(
  state: readonly Complex[],
  numQubits: number,
  target: number,
): BlochCoordinates {
  if (target < 0 || target >= numQubits) {
    throw new Error(
      `blochFromStateVector: target ${target} out of range [0, ${numQubits})`,
    );
  }
  const dim = 1 << numQubits;
  if (state.length !== dim) {
    throw new Error(
      `blochFromStateVector: state length ${state.length} does not match 2^${numQubits} = ${dim}`,
    );
  }
  const targetBit = numQubits - 1 - target;
  // Build the 2×2 reduced density matrix for the target qubit by
  // tracing out all other qubits.
  //
  // rho[i, j] = sum over context c of <i,c|psi><psi|j,c>
  //          = sum_c psi[idx(i,c)] * conj(psi[idx(j,c)])
  let r00re = 0, r00im = 0;
  let r01re = 0, r01im = 0;
  let r10re = 0, r10im = 0;
  let r11re = 0, r11im = 0;
  // Iterate over all "context" indices that have the target bit cleared.
  // For each context state ctx (with target bit = 0), the index for
  // |target=0> at ctx is `ctx`, and for |target=1> at ctx is `ctx | (1<<targetBit)`.
  const targetMask = 1 << targetBit;
  for (let ctx = 0; ctx < dim; ctx++) {
    if ((ctx & targetMask) !== 0) continue; // skip already-set targets
    const idx0 = ctx;
    const idx1 = ctx | targetMask;
    const a = state[idx0]; // psi[i=0, ctx]
    const b = state[idx1]; // psi[i=1, ctx]
    // rho[0, 0] += a * conj(a) = |a|^2
    r00re += a.re * a.re + a.im * a.im;
    // rho[0, 1] += a * conj(b)
    r01re += a.re * b.re + a.im * b.im;
    r01im += a.im * b.re - a.re * b.im;
    // rho[1, 0] += b * conj(a)
    r10re += b.re * a.re + b.im * a.im;
    r10im += b.im * a.re - b.re * a.im;
    // rho[1, 1] += b * conj(b) = |b|^2
    r11re += b.re * b.re + b.im * b.im;
  }
  // Extract Bloch vector: x = 2 Re(rho[0,1]), y = -2 Im(rho[0,1]).
  // Convention: x = trace(rho * X), y = trace(rho * Y), z = trace(rho * Z).
  //   X = [[0,1],[1,0]] ⇒ trace(rho X) = rho[0,1] + rho[1,0] = 2 Re(rho[0,1])
  //   Y = [[0,-i],[i,0]] ⇒ trace(rho Y) = -i*rho[0,1] + i*rho[1,0]
  //                       = i*(rho[1,0] - rho[0,1]). Real part = -2*Im(rho[0,1]).
  //   Z = [[1,0],[0,-1]] ⇒ trace(rho Z) = rho[0,0] - rho[1,1].
  const x = 2 * r01re;
  const y = -2 * r01im;
  const z = r00re - r11re;
  const _r10unused = r10re + r10im; // present in derivation; symmetric to r01
  void _r10unused;
  const r = Math.sqrt(x * x + y * y + z * z);
  // Spherical: theta = arccos(z/r), phi = atan2(y, x). Maximally mixed → r=0.
  let theta: number;
  let phi: number;
  if (r < 1e-12) {
    theta = 0;
    phi = 0;
  } else {
    theta = Math.acos(Math.max(-1, Math.min(1, z / r)));
    phi = Math.atan2(y, x);
    if (phi < 0) phi += 2 * Math.PI;
  }
  return { x, y, z, theta, phi, r };
}

/**
 * Convenience: extract Bloch coordinates for a single qubit of a
 * `QuantumCircuit` by simulating the unitary portion through
 * `SimulatorBackend.getStateVector` and then calling
 * `blochFromStateVector`.
 *
 * Rejects circuits containing non-unitary instructions for the
 * same reason `getStateVector` does.
 */
export function blochOfCircuit(
  circuit: QuantumCircuit,
  target: number,
): BlochCoordinates {
  const sim = new SimulatorBackend();
  const state = sim.getStateVector(circuit);
  return blochFromStateVector(state, Math.max(1, circuit.numQubits), target);
}
