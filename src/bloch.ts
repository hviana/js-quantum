/**
 * @module bloch
 * Bloch sphere utilities for single-qubit state visualization.
 *
 * In quantum computing, any single-qubit state (pure or mixed) can be
 * represented as a point on or inside the Bloch sphere. Pure states lie
 * on the surface (radius = 1); mixed states (e.g., a qubit entangled
 * with others) lie inside (radius < 1).
 *
 * This module provides tools to:
 * - Extract the reduced density matrix of a single qubit from a multi-qubit state vector.
 * - Compute the Bloch vector (x, y, z) from that density matrix.
 * - Convert to spherical coordinates (θ, φ) for rendering.
 *
 * ## Mathematical Background
 *
 * For a single-qubit density matrix ρ (2×2 Hermitian, trace 1):
 *
 * ```
 * ρ = (I + r⃗ · σ⃗) / 2
 *
 * where σ⃗ = (σx, σy, σz) are the Pauli matrices and r⃗ = (x, y, z):
 *   x = Tr(ρ·σx)
 *   y = Tr(ρ·σy)
 *   z = Tr(ρ·σz)
 * ```
 *
 * The Bloch vector r⃗ satisfies |r⃗| ≤ 1, with equality for pure states.
 *
 * @example
 * ```ts
 * import { quantum, getStateVector } from "@hviana/js-quantum";
 * import { getBlochVector, getQubitState } from "@hviana/js-quantum";
 *
 * const code = quantum(2, 0, (qc) => {
 *   qc.h(0);
 *   qc.cx(0, 1);
 * });
 *
 * const sv = getStateVector(code);
 * const bloch0 = getBlochVector(sv, 0, 2);
 * // bloch0 ≈ { x: 0, y: 0, z: 0 } — maximally mixed (entangled)
 *
 * const qubit = getQubitState(sv, 0, 2);
 * // qubit.bloch, qubit.densityMatrix, qubit.purity, qubit.spherical
 * ```
 *
 * @author Henrique Emanoel Viana
 * @license MIT
 */

import { Complex } from "./complex.ts";

/**
 * A 2×2 density matrix for a single qubit.
 *
 * ```
 * ρ = [[ρ00, ρ01],
 *      [ρ10, ρ11]]
 * ```
 *
 * Properties:
 * - Hermitian: ρ† = ρ
 * - Positive semi-definite
 * - Trace 1: ρ00 + ρ11 = 1
 */
export interface DensityMatrix2x2 {
  /** Element (0,0): probability of |0⟩. */
  rho00: Complex;
  /** Element (0,1): coherence term. */
  rho01: Complex;
  /** Element (1,0): conjugate of ρ01. */
  rho10: Complex;
  /** Element (1,1): probability of |1⟩. */
  rho11: Complex;
}

/**
 * Bloch vector components in Cartesian coordinates.
 *
 * - **x**: component along the X-axis (σx expectation).
 * - **y**: component along the Y-axis (σy expectation).
 * - **z**: component along the Z-axis (σz expectation).
 *
 * |0⟩ → (0, 0, +1)  (north pole)
 * |1⟩ → (0, 0, -1)  (south pole)
 * |+⟩ → (+1, 0, 0)  (positive X)
 * |−⟩ → (-1, 0, 0)  (negative X)
 * |i⟩ → (0, +1, 0)  (positive Y)
 * |−i⟩ → (0, -1, 0) (negative Y)
 */
export interface BlochVector {
  /** Expectation value of σx: Tr(ρ·σx). */
  x: number;
  /** Expectation value of σy: Tr(ρ·σy). */
  y: number;
  /** Expectation value of σz: Tr(ρ·σz). */
  z: number;
}

/**
 * Spherical coordinates on the Bloch sphere.
 */
export interface BlochSpherical {
  /** Polar angle θ ∈ [0, π]. 0 = north pole (|0⟩), π = south pole (|1⟩). */
  theta: number;
  /** Azimuthal angle φ ∈ [0, 2π). Phase angle in the XY-plane. */
  phi: number;
  /** Radius r ∈ [0, 1]. 1 = pure state (surface), <1 = mixed state (interior). */
  r: number;
}

/**
 * Complete qubit state information for Bloch sphere visualization.
 */
export interface QubitState {
  /** The 2×2 reduced density matrix. */
  densityMatrix: DensityMatrix2x2;
  /** Bloch vector in Cartesian coordinates. */
  bloch: BlochVector;
  /** Bloch sphere in spherical coordinates. */
  spherical: BlochSpherical;
  /** Purity Tr(ρ²) ∈ [0.5, 1]. 1 = pure state, 0.5 = maximally mixed. */
  purity: number;
  /** Probability of measuring |0⟩. */
  prob0: number;
  /** Probability of measuring |1⟩. */
  prob1: number;
}

/**
 * Computes the reduced density matrix of a single qubit by tracing out
 * all other qubits from the full state vector.
 *
 * Given an n-qubit state vector |ψ⟩, the reduced density matrix for
 * qubit `q` is obtained by partial trace:
 *
 * ```
 * ρ_q = Tr_{all except q}(|ψ⟩⟨ψ|)
 * ```
 *
 * @param stateVector - The full state vector (array of 2^n complex amplitudes).
 * @param qubit - The qubit index to extract (0-based).
 * @param numQubits - Total number of qubits in the system.
 * @returns The 2×2 reduced density matrix.
 *
 * @throws {Error} If qubit index is out of range.
 */
export function reducedDensityMatrix(
  stateVector: Complex[],
  qubit: number,
  numQubits: number,
): DensityMatrix2x2 {
  const numStates = 1 << numQubits;
  if (stateVector.length !== numStates) {
    throw new Error(
      `State vector length ${stateVector.length} doesn't match ${numQubits} qubits (expected ${numStates})`,
    );
  }
  if (qubit < 0 || qubit >= numQubits) {
    throw new Error(`Qubit index ${qubit} out of range [0, ${numQubits - 1}]`);
  }

  const bitPos = numQubits - 1 - qubit;

  // ρ_ij = Σ_k ⟨k,i|ψ⟩⟨ψ|k,j⟩  where k runs over all other qubits
  // ρ00 = Σ |a_{...0...}|²  (sum over states where target bit = 0)
  // ρ11 = Σ |a_{...1...}|²  (sum over states where target bit = 1)
  // ρ01 = Σ a_{...0...} · conj(a_{...1...})  (paired states)
  let rho00 = Complex.ZERO;
  let rho01 = Complex.ZERO;
  let rho10 = Complex.ZERO;
  let rho11 = Complex.ZERO;

  for (let i = 0; i < numStates; i++) {
    if ((i >> bitPos) & 1) continue; // Only iterate where target bit = 0

    const i0 = i; // target bit = 0
    const i1 = i | (1 << bitPos); // target bit = 1

    const a0 = stateVector[i0]!;
    const a1 = stateVector[i1]!;

    // ρ_mn += a_m · conj(a_n) for this pair
    rho00 = rho00.add(a0.mul(a0.conjugate()));
    rho01 = rho01.add(a0.mul(a1.conjugate()));
    rho10 = rho10.add(a1.mul(a0.conjugate()));
    rho11 = rho11.add(a1.mul(a1.conjugate()));
  }

  return { rho00, rho01, rho10, rho11 };
}

/**
 * Computes the Bloch vector (x, y, z) from a 2×2 density matrix.
 *
 * Uses the Pauli decomposition:
 * ```
 * x = Tr(ρ·σx) = 2·Re(ρ01)
 * y = Tr(ρ·σy) = 2·Im(ρ01)  (note: corrected sign from σy = [[0,-i],[i,0]])
 * z = Tr(ρ·σz) = ρ00 - ρ11
 * ```
 *
 * @param dm - The 2×2 reduced density matrix.
 * @returns The Bloch vector.
 */
export function blochFromDensityMatrix(dm: DensityMatrix2x2): BlochVector {
  // x = Tr(ρ·σx) = ρ01 + ρ10 = 2·Re(ρ01) since ρ is Hermitian
  const x = dm.rho01.re + dm.rho10.re;

  // y = Tr(ρ·σy) = i(ρ10 - ρ01) = 2·Im(ρ10)
  // σy = [[0, -i], [i, 0]], so Tr(ρ·σy) = -i·ρ01 + i·ρ10
  //    = i·(ρ10 - ρ01) = i·(conj(ρ01) - ρ01) = i·(-2i·Im(ρ01)) = 2·Im(ρ01)
  // Actually: Tr(ρ·σy) = -i·ρ01 + i·ρ10 = 2·Im(ρ10) = -2·Im(ρ01)... let me be precise.
  // ρ·σy row 0 = [ρ00·0 + ρ01·i, ρ00·(-i) + ρ01·0] = [i·ρ01, -i·ρ00]
  // ρ·σy row 1 = [ρ10·0 + ρ11·i, ρ10·(-i) + ρ11·0] = [i·ρ11, -i·ρ10]
  // Tr = i·ρ01 + (-i·ρ10) = i(ρ01 - ρ10)
  // Since ρ10 = conj(ρ01), ρ01 - ρ10 = ρ01 - conj(ρ01) = 2i·Im(ρ01)
  // So Tr = i · 2i · Im(ρ01) = -2·Im(ρ01)
  // Wait, let me reconsider. Standard convention:
  // Tr(ρ·σy) where σy = [[0,-i],[i,0]]:
  // (ρ·σy)_00 = ρ00·0 + ρ01·i = i·ρ01
  // (ρ·σy)_11 = ρ10·(-i) + ρ11·0 = -i·ρ10
  // Tr = i·ρ01 - i·ρ10
  // ρ Hermitian → ρ10 = conj(ρ01). Let ρ01 = a+bi.
  // i·(a+bi) - i·(a-bi) = (ai + bi²) - (ai - bi²) = -b + (-b) ... no:
  // i·(a+bi) = ai + bi² = -b + ai
  // -i·(a-bi) = -ai + bi² = -b - ai
  // Tr = (-b + ai) + (-b - ai) = -2b = -2·Im(ρ01)
  // Hmm, but standard result is y = 2·Im(ρ01) for |+i⟩ state.
  // Let's verify: |+i⟩ = (|0⟩ + i|1⟩)/√2, ρ01 = (1)(−i)/2·...
  // Actually ρ = |ψ⟩⟨ψ|, ρ01 = ⟨0|ψ⟩⟨ψ|1⟩* ... no, ρ01 = (1/√2)(i/√2)* = (1/√2)(-i/√2) = -i/2
  // Im(ρ01) = -1/2
  // So y = -2·(-1/2) = 1. Correct! |+i⟩ should have y=1.
  // Tr(ρ·σy) = i·ρ01 - i·ρ10 = -2·Im(ρ01) for Hermitian ρ
  const y = -2 * dm.rho01.im;

  // z = Tr(ρ·σz) = ρ00 - ρ11
  const z = dm.rho00.re - dm.rho11.re;

  return {
    x: cleanFloat(x),
    y: cleanFloat(y),
    z: cleanFloat(z),
  };
}

/**
 * Computes the Bloch vector for a specific qubit directly from the state vector.
 *
 * This is a convenience function combining `reducedDensityMatrix` and
 * `blochFromDensityMatrix`.
 *
 * @param stateVector - The full state vector (2^n complex amplitudes).
 * @param qubit - Target qubit index (0-based).
 * @param numQubits - Total number of qubits.
 * @returns The Bloch vector (x, y, z).
 *
 * @example
 * ```ts
 * import { quantum, getStateVector, getBlochVector } from "@hviana/js-quantum";
 *
 * const code = quantum(1, 0, (qc) => { qc.h(0); });
 * const sv = getStateVector(code);
 * const bloch = getBlochVector(sv, 0, 1);
 * // bloch ≈ { x: 1, y: 0, z: 0 }  — |+⟩ state on the equator
 * ```
 */
export function getBlochVector(
  stateVector: Complex[],
  qubit: number,
  numQubits: number,
): BlochVector {
  const dm = reducedDensityMatrix(stateVector, qubit, numQubits);
  return blochFromDensityMatrix(dm);
}

/**
 * Converts a Bloch vector to spherical coordinates (θ, φ, r).
 *
 * ```
 * r = √(x² + y² + z²)
 * θ = arccos(z / r)      ∈ [0, π]
 * φ = atan2(y, x)         ∈ [0, 2π)
 * ```
 *
 * For a pure state |ψ⟩ = cos(θ/2)|0⟩ + e^(iφ)·sin(θ/2)|1⟩:
 * - θ controls the latitude (0 = |0⟩, π = |1⟩)
 * - φ controls the longitude (phase)
 *
 * @param bloch - The Bloch vector.
 * @returns Spherical coordinates.
 */
export function blochToSpherical(bloch: BlochVector): BlochSpherical {
  const { x, y, z } = bloch;
  const r = Math.sqrt(x * x + y * y + z * z);

  if (r < 1e-12) {
    // Maximally mixed state — center of sphere
    return { theta: Math.PI / 2, phi: 0, r: 0 };
  }

  const theta = Math.acos(Math.max(-1, Math.min(1, z / r)));
  let phi = Math.atan2(y, x);
  if (phi < 0) phi += 2 * Math.PI;

  return {
    theta: cleanFloat(theta),
    phi: cleanFloat(phi),
    r: cleanFloat(r),
  };
}

/**
 * Returns complete qubit state information for Bloch sphere rendering.
 *
 * Combines the density matrix, Bloch vector, spherical coordinates,
 * purity, and measurement probabilities into a single object.
 *
 * @param stateVector - The full state vector (2^n complex amplitudes).
 * @param qubit - Target qubit index (0-based).
 * @param numQubits - Total number of qubits.
 * @returns Complete {@link QubitState} for visualization.
 *
 * @example
 * ```ts
 * import { quantum, getStateVector, getQubitState } from "@hviana/js-quantum";
 *
 * // Single qubit in |+⟩ state
 * const code = quantum(1, 0, (qc) => { qc.h(0); });
 * const sv = getStateVector(code);
 * const q = getQubitState(sv, 0, 1);
 *
 * console.log(q.bloch);      // { x: 1, y: 0, z: 0 }
 * console.log(q.spherical);  // { theta: π/2, phi: 0, r: 1 }
 * console.log(q.purity);     // 1 (pure state)
 * console.log(q.prob0);      // 0.5
 * console.log(q.prob1);      // 0.5
 *
 * // Entangled qubit (Bell state)
 * const bell = quantum(2, 0, (qc) => { qc.h(0); qc.cx(0, 1); });
 * const sv2 = getStateVector(bell);
 * const q0 = getQubitState(sv2, 0, 2);
 *
 * console.log(q0.bloch);     // { x: 0, y: 0, z: 0 }
 * console.log(q0.purity);    // 0.5 (maximally mixed — entangled!)
 * console.log(q0.spherical.r); // 0 (center of Bloch sphere)
 * ```
 */
export function getQubitState(
  stateVector: Complex[],
  qubit: number,
  numQubits: number,
): QubitState {
  const dm = reducedDensityMatrix(stateVector, qubit, numQubits);
  const bloch = blochFromDensityMatrix(dm);
  const spherical = blochToSpherical(bloch);

  // Purity = Tr(ρ²) = |ρ00|² + |ρ01|² + |ρ10|² + |ρ11|²
  const purity = dm.rho00.magnitudeSquared() +
    dm.rho01.magnitudeSquared() +
    dm.rho10.magnitudeSquared() +
    dm.rho11.magnitudeSquared();

  return {
    densityMatrix: dm,
    bloch,
    spherical,
    purity: cleanFloat(purity),
    prob0: cleanFloat(dm.rho00.re),
    prob1: cleanFloat(dm.rho11.re),
  };
}

/** Cleans floating-point noise. */
function cleanFloat(x: number, eps = 1e-12): number {
  const rounded = Math.round(x);
  if (Math.abs(x - rounded) < eps) return rounded;
  return x;
}
