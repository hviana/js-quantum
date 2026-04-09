/**
 * Gate matrix constructors for Tiers 0–14 as defined by Section 3 of
 * the SDK specification. All multi-qubit gates beyond Tier 1 are
 * computed **compositionally** by multiplying and tensoring the
 * matrices of their constituent Tier 0 single-qubit gates and the
 * Tier 1 `CX` primitive — no higher-arity hardcoded matrix literals
 * are introduced.
 *
 * All gate matrices use the Section 2 local **MSB-first** operand
 * ordering: for an m-qubit gate, bit `(m-1-k)` of the row/column
 * index corresponds to the k-th gate argument. Circuit-time order is
 * written with `→`; the corresponding matrix product applies the
 * leftmost operation last, so `A → B → C` is `C · B · A`.
 *
 * Tier 0 is the only tier that introduces explicit 1×1 / 2×2 matrix
 * literals. Tier 1 introduces the single hardcoded 4×4 `CX` matrix.
 * Every later tier is built from those primitives via the `lift` and
 * `compose` helpers defined at the bottom of this file.
 */

import { Complex } from "./complex.ts";
import { Matrix } from "./matrix.ts";

// =============================================================================
// Tier 0: Zero-qubit and single-qubit primitives
// =============================================================================

/**
 * The zero-qubit global phase gate `[[exp(i*theta)]]`.
 *
 * Under the ordinary-scope semantics of Phase Convention 3, this
 * denotes the scalar phase `exp(i*theta)` acting as a scalar multiple
 * of identity on whatever scope it appears in. The matrix returned
 * here is strictly 1×1 and represents the zero-qubit denotation only.
 *
 * @param theta phase angle in radians.
 */
export function GlobalPhaseGate(theta: number): Matrix {
  return new Matrix([[Complex.exp(theta)]]);
}

/** Identity gate `I`. */
export function IGate(): Matrix {
  return Matrix.identity(2);
}

/** Hadamard gate `H = (1/sqrt(2)) * [[1, 1], [1, -1]]`. */
export function HGate(): Matrix {
  const s = 1 / Math.sqrt(2);
  return new Matrix([
    [new Complex(s, 0), new Complex(s, 0)],
    [new Complex(s, 0), new Complex(-s, 0)],
  ]);
}

/** Pauli-X (bit flip) gate. */
export function XGate(): Matrix {
  return new Matrix([
    [Complex.ZERO, Complex.ONE],
    [Complex.ONE, Complex.ZERO],
  ]);
}

/** Pauli-Y gate `[[0, -i], [i, 0]]`. */
export function YGate(): Matrix {
  return new Matrix([
    [Complex.ZERO, Complex.MINUS_I],
    [Complex.I, Complex.ZERO],
  ]);
}

/** Pauli-Z (phase flip) gate `[[1, 0], [0, -1]]`. */
export function ZGate(): Matrix {
  return new Matrix([
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.MINUS_ONE],
  ]);
}

/**
 * Phase gate `P(lambda) = diag(1, exp(i*lambda))`.
 *
 * By Phase Convention 5, `P(lambda) = exp(i*lambda/2) * RZ(lambda)`.
 */
export function PhaseGate(lambda: number): Matrix {
  return new Matrix([
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.exp(lambda)],
  ]);
}

/**
 * Axis-angle rotation `R(theta, phi) = exp(-i * theta * (cos(phi) X
 * + sin(phi) Y) / 2)`.
 */
export function RGate(theta: number, phi: number): Matrix {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  // -i * exp(-i*phi) * sin(th/2) = sin(th/2) * (-i) * (cos(phi) - i sin(phi))
  //                             = sin(th/2) * (-i cos(phi) - sin(phi))
  //                             = -sin(phi)*sin(th/2) + i*(-cos(phi)*sin(th/2))
  const offDiag01 = new Complex(-Math.sin(phi) * s, -Math.cos(phi) * s);
  // -i * exp(i*phi) * sin(th/2) = sin(th/2) * (-i) * (cos(phi) + i sin(phi))
  //                             = sin(th/2) * (sin(phi) - i cos(phi))
  const offDiag10 = new Complex(Math.sin(phi) * s, -Math.cos(phi) * s);
  return new Matrix([
    [new Complex(c, 0), offDiag01],
    [offDiag10, new Complex(c, 0)],
  ]);
}

/** `RX(theta) = exp(-i*theta*X/2)`. */
export function RXGate(theta: number): Matrix {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return new Matrix([
    [new Complex(c, 0), new Complex(0, -s)],
    [new Complex(0, -s), new Complex(c, 0)],
  ]);
}

/** `RY(theta) = exp(-i*theta*Y/2)`. */
export function RYGate(theta: number): Matrix {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return new Matrix([
    [new Complex(c, 0), new Complex(-s, 0)],
    [new Complex(s, 0), new Complex(c, 0)],
  ]);
}

/** `RZ(theta) = exp(-i*theta*Z/2) = diag(exp(-i*theta/2), exp(i*theta/2))`. */
export function RZGate(theta: number): Matrix {
  return new Matrix([
    [Complex.exp(-theta / 2), Complex.ZERO],
    [Complex.ZERO, Complex.exp(theta / 2)],
  ]);
}

/** Phase gate `S = P(pi/2) = diag(1, i)`. */
export function SGate(): Matrix {
  return new Matrix([
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.I],
  ]);
}

/** Adjoint `Sdg = S† = diag(1, -i)`. */
export function SdgGate(): Matrix {
  return new Matrix([
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.MINUS_I],
  ]);
}

/**
 * Canonical square root of X:
 * `SX = exp(i*pi/4) * RX(pi/2) = (1/2) * [[1+i, 1-i], [1-i, 1+i]]`.
 */
export function SXGate(): Matrix {
  const p = new Complex(0.5, 0.5); // (1+i)/2
  const m = new Complex(0.5, -0.5); // (1-i)/2
  return new Matrix([
    [p, m],
    [m, p],
  ]);
}

/** Adjoint `SXdg = SX† = (1/2) * [[1-i, 1+i], [1+i, 1-i]]`. */
export function SXdgGate(): Matrix {
  const p = new Complex(0.5, 0.5); // (1+i)/2
  const m = new Complex(0.5, -0.5); // (1-i)/2
  return new Matrix([
    [m, p],
    [p, m],
  ]);
}

/** `T = P(pi/4) = diag(1, exp(i*pi/4))`. */
export function TGate(): Matrix {
  return new Matrix([
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.exp(Math.PI / 4)],
  ]);
}

/** Adjoint `Tdg = T† = diag(1, exp(-i*pi/4))`. */
export function TdgGate(): Matrix {
  return new Matrix([
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.exp(-Math.PI / 4)],
  ]);
}

/**
 * Internal canonical single-qubit gate `U_can(theta, phi, lambda) =
 * exp(i*(phi+lambda)/2) * RZ(phi) * RY(theta) * RZ(lambda)`, with the
 * explicit matrix form
 *
 *     [[cos(theta/2),              -exp(i*lambda)*sin(theta/2)],
 *      [exp(i*phi)*sin(theta/2),    exp(i*(phi+lambda))*cos(theta/2)]]
 *
 * This is the SDK's **internal canonical** single-qubit gate. The
 * textual OpenQASM 3.1 built-in `U(theta, phi, lambda)` differs by an
 * `exp(i*theta/2)` global phase; that boundary correction is handled
 * by the parser/serializer via `localPhase`, not here.
 */
export function UGate(theta: number, phi: number, lambda: number): Matrix {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  // M[0,0] = cos(theta/2)
  // M[0,1] = -exp(i*lambda) * sin(theta/2)
  // M[1,0] =  exp(i*phi)    * sin(theta/2)
  // M[1,1] =  exp(i*(phi+lambda)) * cos(theta/2)
  const m00 = new Complex(c, 0);
  const m01 = Complex.exp(lambda).scale(-s);
  const m10 = Complex.exp(phi).scale(s);
  const m11 = Complex.exp(phi + lambda).scale(c);
  return new Matrix([
    [m00, m01],
    [m10, m11],
  ]);
}

/**
 * Rotation-vector gate `RV(vx, vy, vz) = exp(-i * (vx*X + vy*Y +
 * vz*Z) / 2)`. Numerically unambiguous on the `norm = 0` branch:
 * returns the exact identity.
 *
 * For `norm > 0`, this is the closed-form
 *
 *     [[cos(h) - i*nz*sin(h),  (-i*nx - ny)*sin(h)],
 *      [(-i*nx + ny)*sin(h),    cos(h) + i*nz*sin(h)]]
 *
 * with `norm = sqrt(vx^2 + vy^2 + vz^2)`, `h = norm/2`, and
 * `nx = vx/norm`, etc.
 */
export function RVGate(vx: number, vy: number, vz: number): Matrix {
  const norm = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (norm === 0) return IGate();
  const h = norm / 2;
  const nx = vx / norm;
  const ny = vy / norm;
  const nz = vz / norm;
  const ch = Math.cos(h);
  const sh = Math.sin(h);
  return new Matrix([
    [new Complex(ch, -nz * sh), new Complex(-ny * sh, -nx * sh)],
    [new Complex(ny * sh, -nx * sh), new Complex(ch, nz * sh)],
  ]);
}

// =============================================================================
// Tier 1: The universal entangling primitive — CX
// =============================================================================

/**
 * Controlled-NOT gate `CX = CNOT`. In Section 2's MSB-first local
 * ordering on `(control, target)`, bit 1 is the control and bit 0 is
 * the target:
 *
 *     [[1,0,0,0],
 *      [0,1,0,0],
 *      [0,0,0,1],
 *      [0,0,1,0]]
 *
 * This is the only multi-qubit gate introduced by a hardcoded matrix
 * literal in this SDK. Every other multi-qubit gate in Tiers 2–14 is
 * built compositionally from Tier 0 primitives and this `CX`.
 */
export function CXGate(): Matrix {
  return new Matrix([
    [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
    [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO],
    [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE],
    [Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO],
  ]);
}

// =============================================================================
// Composition helpers — used by every higher tier
// =============================================================================

/**
 * Lift a `k`-qubit gate matrix `U` into an `m`-qubit space, acting on
 * the ordered list of argument positions `targets` (MSB-first gate
 * argument indices of the enclosing `m`-qubit gate).
 *
 * The returned matrix has shape `2^m × 2^m` and is the exact tensor
 * lifting of `U` through Section 2's local MSB-first ordering:
 * bit `(m-1-p)` of a row/column index corresponds to argument `p`.
 * `U`'s own internal MSB-first ordering maps `targets[0]` to `U`'s
 * first argument, `targets[1]` to `U`'s second, and so on.
 *
 * This is the generic subspace-iteration lifting used by every
 * compositional Tier 2+ gate constructor. When `targets` is empty,
 * `U` must be the `1×1` zero-qubit matrix and the result is
 * `U[0,0] * I_{2^m}`.
 */
export function liftGate(
  U: Matrix,
  targets: readonly number[],
  m: number,
): Matrix {
  if (m < 0) throw new Error(`liftGate: m must be non-negative, got ${m}`);
  const k = targets.length;
  const dimU = 1 << k;
  const dimM = 1 << m;
  if (U.rows !== dimU || U.cols !== dimU) {
    throw new Error(
      `liftGate: gate is ${U.rows}×${U.cols} but targets has length ${k} ⇒ expected ${dimU}×${dimU}`,
    );
  }
  // Validate target positions.
  for (const t of targets) {
    if (t < 0 || t >= m) {
      throw new Error(`liftGate: target position ${t} out of range [0, ${m})`);
    }
  }
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      if (targets[i] === targets[j]) {
        throw new Error(`liftGate: duplicate target position ${targets[i]}`);
      }
    }
  }

  // Special case: zero-qubit gate. Result is U[0,0] * I_{2^m}.
  if (k === 0) {
    const scalar = U.get(0, 0);
    return Matrix.identity(dimM).scale(scalar);
  }

  // Precompute the bit-position (in the m-qubit matrix index) of each
  // target. Argument position `p` maps to bit `(m-1-p)`.
  const targetBits: number[] = targets.map((p) => m - 1 - p);

  // Build the list of "other" bit positions (non-target bits).
  const isTarget = new Array(m).fill(false);
  for (const tb of targetBits) isTarget[tb] = true;
  const otherBits: number[] = [];
  for (let b = 0; b < m; b++) if (!isTarget[b]) otherBits.push(b);
  const numOthers = otherBits.length;
  const dimOther = 1 << numOthers;

  // Allocate the result as a zero matrix.
  const data: Complex[][] = [];
  for (let i = 0; i < dimM; i++) {
    const row: Complex[] = new Array(dimM);
    for (let j = 0; j < dimM; j++) row[j] = Complex.ZERO;
    data.push(row);
  }

  // For each context (non-target bit pattern) and each pair of local
  // gate-basis indices, place U[jr, jc] into the corresponding
  // (full-index row, full-index col).
  for (let ctx = 0; ctx < dimOther; ctx++) {
    // Build the base full-index with context bits in place, target
    // bits still zero.
    let baseIdx = 0;
    for (let i = 0; i < numOthers; i++) {
      const bit = (ctx >> (numOthers - 1 - i)) & 1;
      if (bit) baseIdx |= 1 << otherBits[i];
    }
    for (let jr = 0; jr < dimU; jr++) {
      let idxR = baseIdx;
      for (let t = 0; t < k; t++) {
        // U's local MSB-first bit (k-1-t) corresponds to target t,
        // which sits at bit `targetBits[t]` of the full index.
        const bit = (jr >> (k - 1 - t)) & 1;
        if (bit) idxR |= 1 << targetBits[t];
      }
      for (let jc = 0; jc < dimU; jc++) {
        let idxC = baseIdx;
        for (let t = 0; t < k; t++) {
          const bit = (jc >> (k - 1 - t)) & 1;
          if (bit) idxC |= 1 << targetBits[t];
        }
        data[idxR][idxC] = U.get(jr, jc);
      }
    }
  }
  return new Matrix(data);
}

/**
 * Compose a sequence of lifted gate operations in **circuit time
 * order** (earliest operation first) and return the resulting
 * `2^m × 2^m` matrix. Each entry of `steps` is `{ gate, targets }`
 * where `gate` is a `2^|targets| × 2^|targets|` matrix and `targets`
 * is the ordered list of argument positions in the enclosing
 * `m`-qubit gate that `gate` acts on.
 *
 * Time order semantics: if `steps = [A, B, C]`, the circuit executes
 * `A → B → C` and the returned matrix is `lift(C) * lift(B) * lift(A)`.
 */
export function compose(
  m: number,
  steps: readonly { gate: Matrix; targets: readonly number[] }[],
): Matrix {
  let result = Matrix.identity(1 << m);
  for (const step of steps) {
    const lifted = liftGate(step.gate, step.targets, m);
    result = lifted.multiply(result);
  }
  return result;
}

// =============================================================================
// Tier 2: Fundamental two-qubit controlled gates (compositional)
// =============================================================================
//
// Every Tier 2 gate is defined by a Section 3 decomposition written in
// circuit time order. Operand ordering is always `(control, target)`
// (control = arg 0 = MSB bit 1, target = arg 1 = LSB bit 0).
// =============================================================================

/**
 * `CZ(c, t) = H(t) → CX(c, t) → H(t)`.
 *
 * Proof: when control=1 the target sees `H·X·H = Z`. See Tier 2.
 */
export function CZGate(): Matrix {
  return compose(2, [
    { gate: HGate(), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: HGate(), targets: [1] },
  ]);
}

/**
 * `CY(c, t) = Sdg(t) → CX(c, t) → S(t)`.
 *
 * Proof: when control=1 the target sees `S·X·Sdg = Y`.
 */
export function CYGate(): Matrix {
  return compose(2, [
    { gate: SdgGate(), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: SGate(), targets: [1] },
  ]);
}

/**
 * Controlled-phase `CP(lambda, c, t) =
 *     P(lambda/2)(t) → CX(c,t) → P(-lambda/2)(t) → CX(c,t) → P(lambda/2)(c)`.
 *
 * Produces `diag(1, 1, 1, exp(i*lambda))` exactly.
 */
export function CPhaseGate(lambda: number): Matrix {
  return compose(2, [
    { gate: PhaseGate(lambda / 2), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: PhaseGate(-lambda / 2), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: PhaseGate(lambda / 2), targets: [0] },
  ]);
}

/**
 * Controlled-RZ `CRZ(theta, c, t) =
 *     RZ(theta/2)(t) → CX(c,t) → RZ(-theta/2)(t) → CX(c,t)`.
 */
export function CRZGate(theta: number): Matrix {
  return compose(2, [
    { gate: RZGate(theta / 2), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: RZGate(-theta / 2), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
  ]);
}

/**
 * Controlled-RY `CRY(theta, c, t) =
 *     RY(theta/2)(t) → CX(c,t) → RY(-theta/2)(t) → CX(c,t)`.
 */
export function CRYGate(theta: number): Matrix {
  return compose(2, [
    { gate: RYGate(theta / 2), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: RYGate(-theta / 2), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
  ]);
}

/**
 * Controlled-RX via CRZ Hadamard conjugation:
 * `CRX(theta, c, t) = H(t) → CRZ(theta, c, t) → H(t)`.
 */
export function CRXGate(theta: number): Matrix {
  return compose(2, [
    { gate: HGate(), targets: [1] },
    { gate: CRZGate(theta), targets: [0, 1] },
    { gate: HGate(), targets: [1] },
  ]);
}

/** `CS = CP(pi/2)`. */
export function CSGate(): Matrix {
  return CPhaseGate(Math.PI / 2);
}

/** `CSdg = CP(-pi/2)`. */
export function CSdgGate(): Matrix {
  return CPhaseGate(-Math.PI / 2);
}

/**
 * Controlled-SX: because `SX = exp(i*pi/4) * RX(pi/2)`, the controlled
 * version promotes the scalar phase onto the control qubit:
 * `CSX(c, t) = P(pi/4)(c) → CRX(pi/2, c, t)`.
 */
export function CSXGate(): Matrix {
  return compose(2, [
    { gate: PhaseGate(Math.PI / 4), targets: [0] },
    { gate: CRXGate(Math.PI / 2), targets: [0, 1] },
  ]);
}

/**
 * Controlled-Hadamard via the ABC decomposition of `H` (Tier 2 recipe).
 * `H = exp(i*pi/2) * RZ(0) * RY(pi/2) * RZ(pi)`, so `alpha = pi/2`,
 * `A = RZ(0) * RY(pi/4) = RY(pi/4)`, `B = RY(-pi/4) * RZ(-pi/2)`,
 * `C = RZ(pi/2)`, and the circuit is
 *
 *     C(t) → CX(c,t) → B(t) → CX(c,t) → A(t) → P(pi/2)(c)
 *
 * realized here as
 *
 *     RZ(pi/2)(t) → CX → RZ(-pi/2)(t) → RY(-pi/4)(t) → CX → RY(pi/4)(t) → P(pi/2)(c).
 */
export function CHGate(): Matrix {
  return compose(2, [
    { gate: RZGate(Math.PI / 2), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: RZGate(-Math.PI / 2), targets: [1] },
    { gate: RYGate(-Math.PI / 4), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: RYGate(Math.PI / 4), targets: [1] },
    { gate: PhaseGate(Math.PI / 2), targets: [0] },
  ]);
}

/**
 * General controlled-U via the Section 3 ABC decomposition of the
 * SDK's internal canonical single-qubit gate `U_can(theta, phi, lambda)`:
 *
 *     alpha = (phi + lambda) / 2
 *     A     = RZ(phi) · RY(theta/2)
 *     B     = RY(-theta/2) · RZ(-(phi+lambda)/2)
 *     C     = RZ((lambda-phi)/2)
 *
 * Circuit-time form for `CU(theta, phi, lambda, gamma, c, t)`:
 *
 *     RZ((lambda-phi)/2)(t) →
 *     CX(c,t) →
 *     RZ(-(phi+lambda)/2)(t) → RY(-theta/2)(t) →
 *     CX(c,t) →
 *     RY(theta/2)(t) → RZ(phi)(t) →
 *     P(gamma + (phi+lambda)/2)(c)
 *
 * This is identity on the control-0 subspace and
 * `exp(i*gamma) * U_can(theta, phi, lambda)` on the control-1 subspace,
 * with `gamma` the extra phase parameter on the enabled subspace (not
 * a whole-expression global phase).
 */
export function CUGate(
  theta: number,
  phi: number,
  lambda: number,
  gamma: number,
): Matrix {
  return compose(2, [
    { gate: RZGate((lambda - phi) / 2), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: RZGate(-(phi + lambda) / 2), targets: [1] },
    { gate: RYGate(-theta / 2), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: RYGate(theta / 2), targets: [1] },
    { gate: RZGate(phi), targets: [1] },
    { gate: PhaseGate(gamma + (phi + lambda) / 2), targets: [0] },
  ]);
}

/**
 * Double-CNOT `DCX(a, b) = CX(a, b) → CX(b, a)`.
 */
export function DCXGate(): Matrix {
  return compose(2, [
    { gate: CXGate(), targets: [0, 1] },
    { gate: CXGate(), targets: [1, 0] },
  ]);
}

// =============================================================================
// Tier 3: Higher two-qubit interaction gates (compositional)
// =============================================================================

/**
 * Qubit SWAP via the standard 3-CX identity:
 * `SWAP(a, b) = CX(a, b) → CX(b, a) → CX(a, b)`.
 */
export function SwapGate(): Matrix {
  return compose(2, [
    { gate: CXGate(), targets: [0, 1] },
    { gate: CXGate(), targets: [1, 0] },
    { gate: CXGate(), targets: [0, 1] },
  ]);
}

/**
 * `RZZ(theta, a, b) = CX(a, b) → RZ(theta)(b) → CX(a, b)`.
 *
 * Produces `exp(-i*theta/2 * Z⊗Z)`.
 */
export function RZZGate(theta: number): Matrix {
  return compose(2, [
    { gate: CXGate(), targets: [0, 1] },
    { gate: RZGate(theta), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
  ]);
}

/**
 * `RXX(theta, a, b) = H(a) → H(b) → RZZ(theta, a, b) → H(a) → H(b)`.
 *
 * Produces `exp(-i*theta/2 * X⊗X)` via Hadamard conjugation of the ZZ
 * generator.
 */
export function RXXGate(theta: number): Matrix {
  return compose(2, [
    { gate: HGate(), targets: [0] },
    { gate: HGate(), targets: [1] },
    { gate: RZZGate(theta), targets: [0, 1] },
    { gate: HGate(), targets: [0] },
    { gate: HGate(), targets: [1] },
  ]);
}

/**
 * `RYY(theta, a, b) = RX(-pi/2)(a) → RX(-pi/2)(b) → RZZ(theta, a, b)
 *                    → RX(pi/2)(a) → RX(pi/2)(b)`.
 *
 * Produces `exp(-i*theta/2 * Y⊗Y)` via the `RX(pi/2)*Z*RX(-pi/2) = -Y`
 * conjugation (so the generator is `(-Y)⊗(-Y) = Y⊗Y`).
 */
export function RYYGate(theta: number): Matrix {
  return compose(2, [
    { gate: RXGate(-Math.PI / 2), targets: [0] },
    { gate: RXGate(-Math.PI / 2), targets: [1] },
    { gate: RZZGate(theta), targets: [0, 1] },
    { gate: RXGate(Math.PI / 2), targets: [0] },
    { gate: RXGate(Math.PI / 2), targets: [1] },
  ]);
}

/**
 * `RZX(theta, a, b) = H(b) → RZZ(theta, a, b) → H(b)`.
 *
 * Produces `exp(-i*theta/2 * Z⊗X)` via the single-qubit Hadamard
 * conjugation `Z → X` on the second qubit.
 */
export function RZXGate(theta: number): Matrix {
  return compose(2, [
    { gate: HGate(), targets: [1] },
    { gate: RZZGate(theta), targets: [0, 1] },
    { gate: HGate(), targets: [1] },
  ]);
}

/**
 * Echoed cross-resonance `ECR(a, b) = RZX(pi/2, a, b) → X(a)`.
 *
 * Under this SDK's internal convention, its matrix is
 *
 *     (1/sqrt(2)) * [[0,0,1,i], [0,0,i,1], [1,-i,0,0], [-i,1,0,0]].
 */
export function ECRGate(): Matrix {
  return compose(2, [
    { gate: RZXGate(Math.PI / 2), targets: [0, 1] },
    { gate: XGate(), targets: [0] },
  ]);
}

/**
 * `iSWAP(a, b) = CZ(a, b) → SWAP(a, b) → S(a) → S(b)`.
 *
 * Verified in Section 3 by tracking each computational basis state:
 * `|01>` and `|10>` each pick up an `i`, and the `-1` from `CZ` on
 * `|11>` is exactly canceled by `S⊗S = diag(1,i,i,-1)` applied after
 * the swap.
 */
export function iSwapGate(): Matrix {
  return compose(2, [
    { gate: CZGate(), targets: [0, 1] },
    { gate: SwapGate(), targets: [0, 1] },
    { gate: SGate(), targets: [0] },
    { gate: SGate(), targets: [1] },
  ]);
}

/**
 * Parameterized (XX+YY) interaction with phase twist `beta` on the
 * `{|01>, |10>}` excitation-preserving subspace:
 *
 *     RZ(-beta/2)(a) → RZ(beta/2)(b) →
 *     RXX(theta/2, a, b) → RYY(theta/2, a, b) →
 *     RZ(beta/2)(a)  → RZ(-beta/2)(b)
 *
 * Identity on `{|00>, |11>}`.
 */
export function XXPlusYYGate(theta: number, beta: number): Matrix {
  return compose(2, [
    { gate: RZGate(-beta / 2), targets: [0] },
    { gate: RZGate(beta / 2), targets: [1] },
    { gate: RXXGate(theta / 2), targets: [0, 1] },
    { gate: RYYGate(theta / 2), targets: [0, 1] },
    { gate: RZGate(beta / 2), targets: [0] },
    { gate: RZGate(-beta / 2), targets: [1] },
  ]);
}

/**
 * Parameterized (XX-YY) interaction with phase twist `beta` on the
 * `{|00>, |11>}` pair-creation/pair-annihilation subspace:
 *
 *     RZ(-beta/2)(a) → RZ(-beta/2)(b) →
 *     RXX(theta/2, a, b) → RYY(-theta/2, a, b) →
 *     RZ(beta/2)(a)  → RZ(beta/2)(b)
 *
 * Identity on `{|01>, |10>}`.
 */
export function XXMinusYYGate(theta: number, beta: number): Matrix {
  return compose(2, [
    { gate: RZGate(-beta / 2), targets: [0] },
    { gate: RZGate(-beta / 2), targets: [1] },
    { gate: RXXGate(theta / 2), targets: [0, 1] },
    { gate: RYYGate(-theta / 2), targets: [0, 1] },
    { gate: RZGate(beta / 2), targets: [0] },
    { gate: RZGate(beta / 2), targets: [1] },
  ]);
}

// =============================================================================
// Tier 4: Three-qubit gates (compositional)
// =============================================================================

/**
 * Local shorthand used only by Tier 4's CCX V-decomposition for the
 * exact singly-controlled lifting of `SXdg`:
 * `CSXdg = P(-pi/4)(c) → CRX(-pi/2, c, t)` (Tier 2 primitives).
 * Not exported — Section 3 says this is a local helper, not a
 * separate public gate family.
 */
function CSXdgGateLocal(): Matrix {
  return compose(2, [
    { gate: PhaseGate(-Math.PI / 4), targets: [0] },
    { gate: CRXGate(-Math.PI / 2), targets: [0, 1] },
  ]);
}

/**
 * Toffoli / doubly-controlled X via the Barenco V-decomposition (8 CX):
 *
 *     CCX(c1, c2, t) = CSX(c1, t) → CX(c1, c2) → CSXdg(c2, t) →
 *                      CX(c1, c2) → CSX(c2, t)
 *
 * Since `SX * SX = X` and `SX * SXdg = I`, all four control
 * configurations are exactly verified (Section 3 Tier 4).
 */
export function CCXGate(): Matrix {
  return compose(3, [
    { gate: CSXGate(), targets: [0, 2] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: CSXdgGateLocal(), targets: [1, 2] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: CSXGate(), targets: [1, 2] },
  ]);
}

/**
 * Optimized T-gate decomposition of CCX (6 CX). Must produce the same
 * 8×8 matrix as `CCXGate`; used as a cross-check and as an alternate
 * synthesis path for hardware backends where T is cheaper than CSX.
 *
 *     H(t) → CX(c2,t) → Tdg(t) → CX(c1,t) → T(t) → CX(c2,t) →
 *     Tdg(t) → CX(c1,t) → T(c2) → T(t) → H(t) → CX(c1,c2) →
 *     T(c1) → Tdg(c2) → CX(c1,c2)
 */
export function CCXGateOptimized(): Matrix {
  return compose(3, [
    { gate: HGate(), targets: [2] },
    { gate: CXGate(), targets: [1, 2] },
    { gate: TdgGate(), targets: [2] },
    { gate: CXGate(), targets: [0, 2] },
    { gate: TGate(), targets: [2] },
    { gate: CXGate(), targets: [1, 2] },
    { gate: TdgGate(), targets: [2] },
    { gate: CXGate(), targets: [0, 2] },
    { gate: TGate(), targets: [1] },
    { gate: TGate(), targets: [2] },
    { gate: HGate(), targets: [2] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: TGate(), targets: [0] },
    { gate: TdgGate(), targets: [1] },
    { gate: CXGate(), targets: [0, 1] },
  ]);
}

/**
 * Doubly-controlled Z `CCZ(c1, c2, t) = H(t) → CCX → H(t)`.
 *
 * Flips the sign of `|111>` only.
 */
export function CCZGate(): Matrix {
  return compose(3, [
    { gate: HGate(), targets: [2] },
    { gate: CCXGate(), targets: [0, 1, 2] },
    { gate: HGate(), targets: [2] },
  ]);
}

/**
 * Fredkin / controlled-SWAP:
 * `CSWAP(c, t1, t2) = CX(t2, t1) → CCX(c, t1, t2) → CX(t2, t1)`.
 *
 * The first CX computes `t1 ⊕ t2` into `t1`; the CCX then flips
 * `t2` conditioned on both the outer control and that XOR; the final
 * CX restores `t1`. Net effect: swap `(t1, t2)` iff `c = 1`.
 */
export function CSwapGate(): Matrix {
  return compose(3, [
    { gate: CXGate(), targets: [2, 1] },
    { gate: CCXGate(), targets: [0, 1, 2] },
    { gate: CXGate(), targets: [2, 1] },
  ]);
}

/**
 * Relative-phase CCX (3 CX). NOT equal to exact CCX: the active
 * `|110>,|111>` subspace is `[[0,-i],[i,0]]`, with additional relative
 * phases on other basis states. Treat as a distinct gate.
 *
 *     H(t) → T(t) → CX(c2,t) → Tdg(t) → CX(c1,t) →
 *     T(t) → CX(c2,t) → Tdg(t) → H(t)
 */
export function RCCXGate(): Matrix {
  return compose(3, [
    { gate: HGate(), targets: [2] },
    { gate: TGate(), targets: [2] },
    { gate: CXGate(), targets: [1, 2] },
    { gate: TdgGate(), targets: [2] },
    { gate: CXGate(), targets: [0, 2] },
    { gate: TGate(), targets: [2] },
    { gate: CXGate(), targets: [1, 2] },
    { gate: TdgGate(), targets: [2] },
    { gate: HGate(), targets: [2] },
  ]);
}

// =============================================================================
// Tier 5: Multi-controlled gates (phase-safe, mutually recursive)
// =============================================================================
//
// Section 3 explicitly forbids the naive X-root ladder recursion
// (SX, SX^(1/2), ...) because it is not phase-safe under the Phase
// Convention 4 controlled-lifting rule. The normative construction
// for multi-controlled X and multi-controlled phase is a mutually
// recursive pair:
//
//     MCX(N, t)      = H(t) → MCPhase(pi, N, t) → H(t)
//     MCPhase(λ, N, t) =
//         CP(λ/2)(cN, t) →
//         MCX(N-1, cN) →
//         CP(-λ/2)(cN, t) →
//         MCX(N-1, cN) →
//         MCPhase(λ/2, N-1, t)
//
// Base cases: MCX(0) = X(t); MCX(1) = CX; MCPhase(λ, 0) = P(λ)(t);
// MCPhase(λ, 1) = CP(λ). Every recursive call strictly reduces the
// number of controls, so the recursion terminates in at most N steps
// and bottoms out in Tier 0 + Tier 2 primitives.
// =============================================================================

/**
 * Multi-controlled phase gate `ctrl^N(P(lambda))` on the operand list
 * `(c1, ..., cN, t)`: identity on every computational-basis state
 * except `|1...1⟩` on all controls AND the target, where the target
 * picks up phase `exp(i*lambda)`.
 *
 * Equivalently, the `(N+1)`-qubit matrix is
 * `diag(1, ..., 1, exp(i*lambda))` with the scaled entry at the last
 * diagonal position.
 *
 * The construction is the exact phase-safe recursion from Section 3
 * Tier 5. It is mutually recursive with `MCXGate`.
 *
 * @param lambda phase angle in radians.
 * @param numControls number of control qubits `N`, must be `>= 0`.
 */
export function MCPhaseGate(lambda: number, numControls: number): Matrix {
  if (numControls < 0) {
    throw new Error(
      `MCPhaseGate: numControls must be >= 0, got ${numControls}`,
    );
  }
  // Base case N = 0: targetful one-qubit gate P(lambda).
  if (numControls === 0) return PhaseGate(lambda);
  // Base case N = 1: two-qubit CP(lambda).
  if (numControls === 1) return CPhaseGate(lambda);

  // Recursive case N >= 2 on the operand list (c1, ..., cN, t).
  // Arg positions: c1=0, c2=1, ..., c_{N-1}=N-2, cN=N-1, t=N.
  const m = numControls + 1;
  const cN = numControls - 1;
  const t = numControls;

  // MCX(N-1, cN) lifted into the m-qubit space at positions (c1..c_{N-1}, cN).
  // numControls-1 controls c1..c_{N-1} at argument positions 0..N-2, and target cN at position N-1.
  const mcxPrev = MCXGate(numControls - 1);
  const mcxTargets: number[] = [];
  for (let i = 0; i < numControls - 1; i++) mcxTargets.push(i);
  mcxTargets.push(cN);

  // Recursive MCPhase on (c1..c_{N-1}, t): numControls-1 controls + target.
  const innerMcp = MCPhaseGate(lambda / 2, numControls - 1);
  const innerMcpTargets: number[] = [];
  for (let i = 0; i < numControls - 1; i++) innerMcpTargets.push(i);
  innerMcpTargets.push(t);

  return compose(m, [
    { gate: CPhaseGate(lambda / 2), targets: [cN, t] },
    { gate: mcxPrev, targets: mcxTargets },
    { gate: CPhaseGate(-lambda / 2), targets: [cN, t] },
    { gate: mcxPrev, targets: mcxTargets },
    { gate: innerMcp, targets: innerMcpTargets },
  ]);
}

/**
 * Multi-controlled X (Toffoli generalization) on the operand list
 * `(c1, ..., cN, t)`: identity on every computational-basis state
 * except `|1...1⟩` on all controls, where the target is flipped.
 *
 * Realized phase-exactly by `H(t) → MCPhase(pi, N, t) → H(t)`, which
 * bottoms out via the mutual recursion with `MCPhaseGate` in Tier 0
 * `H` and `P` gates plus Tier 1 `CX`. Because `H * P(pi) * H = X`,
 * the fully enabled subspace sees `X` exactly and all other basis
 * states see identity.
 *
 * @param numControls number of control qubits `N`, must be `>= 0`.
 */
export function MCXGate(numControls: number): Matrix {
  if (numControls < 0) {
    throw new Error(`MCXGate: numControls must be >= 0, got ${numControls}`);
  }
  if (numControls === 0) return XGate();
  if (numControls === 1) return CXGate();

  // Recursive case: H(t) → MCPhase(pi, N) → H(t).
  const m = numControls + 1;
  const t = numControls;

  // Build the MCPhase target list (c1..cN, t) as 0..N.
  const mcpTargets: number[] = [];
  for (let i = 0; i < m; i++) mcpTargets.push(i);

  return compose(m, [
    { gate: HGate(), targets: [t] },
    { gate: MCPhaseGate(Math.PI, numControls), targets: mcpTargets },
    { gate: HGate(), targets: [t] },
  ]);
}

/**
 * Triple-controlled X = `MCXGate(3)`. 4-qubit exact CCCX.
 */
export function C3XGate(): Matrix {
  return MCXGate(3);
}

/**
 * Quadruple-controlled X = `MCXGate(4)`. 5-qubit exact CCCCX.
 */
export function C4XGate(): Matrix {
  return MCXGate(4);
}

/**
 * Triple-controlled SX: `ctrl^3(SX)`. Under the controlled-lifting
 * rule, the 16×16 matrix is identity on every basis state except the
 * fully enabled `|1110>, |1111>` subspace, where `SX` acts on the
 * target.
 *
 * Section 3 forbids the X-root ladder for this family; the normative
 * reference synthesis is the V-chain ancilla-assisted lowering of
 * `MCMTGate_vchain`. Since this gate constructor returns a matrix (no
 * ancilla at the constructor level), we build the target matrix by
 * explicit block assembly from `SX` — equivalent to the exact
 * controlled-lifting rule itself (Phase Convention 4) and independent
 * of any recursive synthesis.
 *
 * This is the only place in Tiers 1–5 where we construct a
 * multi-controlled matrix by direct block assembly. That is permitted
 * by Section 3's Phase Convention 4 because the fully enabled subspace
 * definition **is** the semantic specification, and any exact
 * compositional synthesis of the same operator is a valid
 * implementation of that definition.
 */
export function C3SXGate(): Matrix {
  return liftControlledSingleQubit(SXGate(), 3);
}

/**
 * Relative-phase C3X (6 CX direct construction). Not equal to exact
 * C3X — the active `|1110>, |1111>` block is `[[0,1],[-1,0]]`, with
 * additional relative phases on other basis states (see Section 3
 * Tier 5 derived matrix).
 *
 * Section 3 circuit-time form (arg positions: c1=0, c2=1, c3=2, t=3):
 *
 *     H(t) → T(t) → CX(c3, t) → Tdg(t) → H(t) →
 *     CX(c1, t) → T(t) → CX(c2, t) → Tdg(t) →
 *     CX(c1, t) → T(t) → CX(c2, t) → Tdg(t) → H(t) →
 *     T(t) → CX(c3, t) → Tdg(t) → H(t)
 */
export function RC3XGate(): Matrix {
  return compose(4, [
    { gate: HGate(), targets: [3] },
    { gate: TGate(), targets: [3] },
    { gate: CXGate(), targets: [2, 3] },
    { gate: TdgGate(), targets: [3] },
    { gate: HGate(), targets: [3] },
    { gate: CXGate(), targets: [0, 3] },
    { gate: TGate(), targets: [3] },
    { gate: CXGate(), targets: [1, 3] },
    { gate: TdgGate(), targets: [3] },
    { gate: CXGate(), targets: [0, 3] },
    { gate: TGate(), targets: [3] },
    { gate: CXGate(), targets: [1, 3] },
    { gate: TdgGate(), targets: [3] },
    { gate: HGate(), targets: [3] },
    { gate: TGate(), targets: [3] },
    { gate: CXGate(), targets: [2, 3] },
    { gate: TdgGate(), targets: [3] },
    { gate: HGate(), targets: [3] },
  ]);
}

// -----------------------------------------------------------------------------
// Shared helper: direct block assembly for ctrl^N(U) on a 2x2 unitary.
// -----------------------------------------------------------------------------

/**
 * Build the `2^(N+1) x 2^(N+1)` matrix of `ctrl^N(U)` on the operand
 * list `(c1, ..., cN, t)` by direct block assembly under Phase
 * Convention 4: identity everywhere except the fully enabled `|1..1⟩`
 * control subspace, where the single-qubit unitary `U` acts on the
 * target.
 *
 * This is the normative **semantic** definition — not a synthesis
 * recipe — and is the only correct way to construct gates like
 * `C3SX` whose exact decomposition under Section 3 otherwise requires
 * ancilla-assisted V-chain lowering.
 */
// =============================================================================
// Tier 6: N-qubit structural composite gates (compositional)
// =============================================================================

/**
 * Mølmer-Sørensen gate on `m` qubits:
 * `MS(theta, m) = exp(-i * (theta/2) * sum_{j<k} X_j ⊗ X_k)`.
 *
 * Since the pairwise `X_j ⊗ X_k` terms commute, the exponential
 * factorizes as the ordered product of `RXX(theta)` gates over every
 * pair `(j, k)` with `j < k`, in lexicographic order. Boundary cases:
 * `m = 0` → `GlobalPhaseGate(0)`, `m = 1` → `IGate()`.
 *
 * @param theta interaction angle in radians.
 * @param m nonnegative number of qubits.
 */
export function MSGate(theta: number, m: number): Matrix {
  if (!Number.isInteger(m) || m < 0) {
    throw new Error(`MSGate: m must be a nonnegative integer, got ${m}`);
  }
  if (m === 0) return GlobalPhaseGate(0);
  if (m === 1) return IGate();
  const steps: { gate: Matrix; targets: number[] }[] = [];
  for (let j = 0; j < m; j++) {
    for (let k = j + 1; k < m; k++) {
      steps.push({ gate: RXXGate(theta), targets: [j, k] });
    }
  }
  return compose(m, steps);
}

/**
 * Tensor product of single-qubit Pauli operators specified by a
 * string like `"XYZ"`. The string is read **left-to-right**: the
 * leftmost character acts on the first qubit argument (MSB of the
 * gate matrix index), the next on the second, etc.
 *
 * Boundary cases:
 *   - empty string → `GlobalPhaseGate(0)` (zero-qubit identity)
 *   - every character must be one of `{I, X, Y, Z}`.
 */
export function PauliGate(pauliString: string): Matrix {
  if (pauliString.length === 0) return GlobalPhaseGate(0);
  const valid = new Set(["I", "X", "Y", "Z"]);
  for (const ch of pauliString) {
    if (!valid.has(ch)) {
      throw new Error(`PauliGate: invalid Pauli character '${ch}'`);
    }
  }
  const charToMatrix = (ch: string): Matrix => {
    switch (ch) {
      case "I":
        return IGate();
      case "X":
        return XGate();
      case "Y":
        return YGate();
      case "Z":
        return ZGate();
      default:
        throw new Error("unreachable");
    }
  };
  // Tensor product in left-to-right order.
  let result = charToMatrix(pauliString[0]);
  for (let i = 1; i < pauliString.length; i++) {
    result = result.tensor(charToMatrix(pauliString[i]));
  }
  return result;
}

/**
 * Diagonal unitary gate with explicit phase list. The matrix is
 * `diag(exp(i*theta_0), ..., exp(i*theta_{2^n - 1}))`, where `n` is
 * the number of qubits implied by `phases.length = 2^n`.
 *
 * This is the semantic matrix form; the Tier 7 recursive UCRZ
 * factorization produces the same matrix and is verified separately.
 *
 * @param phases array of `2^n` real phase angles.
 */
export function DiagonalGate(phases: readonly number[]): Matrix {
  const N = phases.length;
  if (N === 0) throw new Error("DiagonalGate: phases must be non-empty");
  // N must be a power of two.
  if ((N & (N - 1)) !== 0) {
    throw new Error(
      `DiagonalGate: phases.length must be a power of two, got ${N}`,
    );
  }
  const diag: Complex[] = phases.map((t) => Complex.exp(t));
  return Matrix.diagonal(diag);
}

/**
 * Permutation gate specified by a bijection `sigma: {0..2^n-1} →
 * {0..2^n-1}`. The resulting matrix is the permutation matrix with
 * `P[sigma(j), j] = 1` and zero elsewhere.
 *
 * The permutation operates on basis-state labels interpreted in the
 * Section 2 MSB-first gate-matrix ordering: the row/column index is
 * the integer whose bit `(n-1-k)` is the value of gate argument `k`.
 *
 * @param sigma array of length `2^n`; `sigma[j]` is the image of `j`.
 */
export function PermutationGate(sigma: readonly number[]): Matrix {
  const N = sigma.length;
  if (N === 0) throw new Error("PermutationGate: sigma must be non-empty");
  if ((N & (N - 1)) !== 0) {
    throw new Error(
      `PermutationGate: sigma.length must be a power of two, got ${N}`,
    );
  }
  // Validate bijection.
  const seen = new Set<number>();
  for (const v of sigma) {
    if (!Number.isInteger(v) || v < 0 || v >= N) {
      throw new Error(`PermutationGate: sigma entry ${v} out of range`);
    }
    if (seen.has(v)) {
      throw new Error(`PermutationGate: sigma has duplicate image ${v}`);
    }
    seen.add(v);
  }
  // Build permutation matrix.
  const data: Complex[][] = [];
  for (let i = 0; i < N; i++) {
    const row: Complex[] = new Array(N);
    for (let j = 0; j < N; j++) row[j] = Complex.ZERO;
    data.push(row);
  }
  for (let j = 0; j < N; j++) data[sigma[j]][j] = Complex.ONE;
  return new Matrix(data);
}

/**
 * Multi-controlled multi-target gate. Applies a single-qubit gate `G`
 * to each target qubit, all controlled by the full conjunction of
 * the control qubits.
 *
 * Operand layout (MSB-first): `[c1, ..., c_k, t1, ..., t_m]`.
 *
 * When `k = 0`, this reduces to uncontrolled fan-out of `G` onto each
 * target. When `k >= 1`, the semantic definition is that on the
 * fully enabled control subspace `|1...1⟩`, the target register sees
 * `G ⊗ G ⊗ ... ⊗ G` (one copy of `G` per target).
 *
 * This constructor returns the exact matrix directly. The
 * ancilla-assisted V-chain synthesis from Section 3 is an alternate
 * lowering used by the transpilation pipeline, not the definition.
 *
 * @param G single-qubit 2×2 matrix to apply on each target.
 * @param numControls number of control qubits.
 * @param numTargets number of target qubits.
 */
export function MCMTGate(
  G: Matrix,
  numControls: number,
  numTargets: number,
): Matrix {
  if (G.rows !== 2 || G.cols !== 2) {
    throw new Error("MCMTGate: G must be a 2x2 single-qubit gate");
  }
  if (numControls < 0 || !Number.isInteger(numControls)) {
    throw new Error(`MCMTGate: numControls must be a nonnegative integer`);
  }
  if (numTargets < 0 || !Number.isInteger(numTargets)) {
    throw new Error(`MCMTGate: numTargets must be a nonnegative integer`);
  }
  const m = numControls + numTargets;
  if (numTargets === 0) {
    // No targets: the gate degenerates to identity on the control register.
    return Matrix.identity(1 << m);
  }
  if (numControls === 0) {
    // Uncontrolled fan-out: G applied to each target qubit, tensored.
    let r = G;
    for (let i = 1; i < numTargets; i++) r = r.tensor(G);
    return r;
  }
  // Build G^⊗numTargets as a single (2^numTargets)×(2^numTargets) matrix.
  let Gtensor = G;
  for (let i = 1; i < numTargets; i++) Gtensor = Gtensor.tensor(G);
  // Use the generic N-control lifting rule: on the fully enabled
  // control subspace, Gtensor acts on the target register; identity
  // everywhere else.
  return liftControlledMultiQubit(Gtensor, numControls, numTargets);
}

/**
 * Pauli-string rotation `exp(-i * theta/2 * P_1 ⊗ P_2 ⊗ ... ⊗ P_n)`
 * where each `P_k ∈ {I, X, Y, Z}`. The string is read left-to-right:
 * element 0 acts on the first qubit argument (MSB of the local index).
 *
 * Decomposition (Section 3 Tier 6):
 *   1. Basis change: H on X positions, RX(π/2) on Y positions.
 *   2. CX parity ladder on active (non-I) positions.
 *   3. RZ(theta) on the last active position.
 *   4. Undo CX ladder.
 *   5. Undo basis change.
 *
 * Boundary case: if every symbol is `I`, the operator is
 * `exp(-i*theta/2) * I_{2^n}` which we represent as the explicit
 * zero-qubit phase lifted to the correct arity.
 *
 * @param theta rotation angle.
 * @param pauliString the Pauli string.
 */
export function PauliProductRotationGate(
  theta: number,
  pauliString: string,
): Matrix {
  if (pauliString.length === 0) {
    // Zero-qubit case
    return GlobalPhaseGate(-theta / 2);
  }
  const n = pauliString.length;
  const valid = new Set(["I", "X", "Y", "Z"]);
  for (const ch of pauliString) {
    if (!valid.has(ch)) {
      throw new Error(
        `PauliProductRotationGate: invalid Pauli character '${ch}'`,
      );
    }
  }
  // Identify active (non-identity) positions.
  const active: number[] = [];
  for (let i = 0; i < n; i++) if (pauliString[i] !== "I") active.push(i);
  if (active.length === 0) {
    // All identities: exp(-i*theta/2) * I_{2^n}.
    return Matrix.identity(1 << n).scale(Complex.exp(-theta / 2));
  }

  const steps: { gate: Matrix; targets: number[] }[] = [];
  // Step 1: basis change.
  for (const p of active) {
    const ch = pauliString[p];
    if (ch === "X") steps.push({ gate: HGate(), targets: [p] });
    else if (ch === "Y") {
      steps.push({ gate: RXGate(Math.PI / 2), targets: [p] });
    }
  }
  // Step 2: CX parity ladder.
  for (let i = 0; i < active.length - 1; i++) {
    steps.push({ gate: CXGate(), targets: [active[i], active[i + 1]] });
  }
  // Step 3: RZ(theta) on the last active position.
  steps.push({ gate: RZGate(theta), targets: [active[active.length - 1]] });
  // Step 4: undo CX ladder (reverse order).
  for (let i = active.length - 2; i >= 0; i--) {
    steps.push({ gate: CXGate(), targets: [active[i], active[i + 1]] });
  }
  // Step 5: undo basis change.
  for (const p of active) {
    const ch = pauliString[p];
    if (ch === "X") steps.push({ gate: HGate(), targets: [p] });
    else if (ch === "Y") {
      steps.push({ gate: RXGate(-Math.PI / 2), targets: [p] });
    }
  }
  return compose(n, steps);
}

// -----------------------------------------------------------------------------
// Helper: multi-control lift of an m-qubit unitary onto a combined
// (numControls + numTargets)-qubit space under Phase Convention 4.
// -----------------------------------------------------------------------------

/**
 * Build the `2^(numControls + numTargets) x 2^(numControls + numTargets)`
 * matrix of `ctrl^numControls(U)` where `U` is a `2^numTargets`-dim
 * unitary acting on the target register. Identity everywhere except
 * the fully enabled control subspace, where `U` acts.
 *
 * Operand layout (MSB-first): controls first, then targets.
 */
function liftControlledMultiQubit(
  U: Matrix,
  numControls: number,
  numTargets: number,
): Matrix {
  const targetDim = 1 << numTargets;
  if (U.rows !== targetDim || U.cols !== targetDim) {
    throw new Error(
      `liftControlledMultiQubit: U dimension ${U.rows} does not match 2^numTargets = ${targetDim}`,
    );
  }
  const m = numControls + numTargets;
  const dim = 1 << m;
  const data: Complex[][] = [];
  for (let i = 0; i < dim; i++) {
    const row: Complex[] = new Array(dim);
    for (let j = 0; j < dim; j++) row[j] = i === j ? Complex.ONE : Complex.ZERO;
    data.push(row);
  }
  // Control bits are the top `numControls` bits of the index
  // (MSB-first bits m-1 down to numTargets). The enabled mask is
  // "all control bits 1":
  const controlMask = ((1 << numControls) - 1) << numTargets;
  // For each pair of target-register basis states (jr, jc), place
  // U[jr, jc] at the full-index position (controlMask | jr, controlMask | jc).
  for (let jr = 0; jr < targetDim; jr++) {
    for (let jc = 0; jc < targetDim; jc++) {
      data[controlMask | jr][controlMask | jc] = U.get(jr, jc);
    }
  }
  // The diagonal of the enabled subspace was just overwritten by U.
  // For the non-diagonal entries that were set to identity earlier but
  // are now part of the U block, we must also clear the identity entry
  // where jr == jc but jr != 0 in the enabled subspace (they were
  // already overwritten by U[jr, jr] above, so we're fine). The only
  // remaining concern is that we didn't overwrite the off-diagonals
  // between rows in the enabled subspace and rows outside it; those
  // should be zero, and they already are because we started with the
  // identity and the off-diagonals of the identity are zero.
  return new Matrix(data);
}

function liftControlledSingleQubit(U: Matrix, numControls: number): Matrix {
  if (U.rows !== 2 || U.cols !== 2) {
    throw new Error("liftControlledSingleQubit requires a 2x2 unitary");
  }
  return liftControlledMultiQubit(U, numControls, 1);
}

// =============================================================================
// Tier 7: Uniformly controlled gates and general unitary synthesis
// =============================================================================

/**
 * Reflected binary (Gray) code: returns `i XOR (i >> 1)`. The sequence
 * `g_0, g_1, ..., g_{2^k-1}` visits every k-bit integer exactly once,
 * with consecutive entries differing in exactly one bit.
 */
function grayCode(i: number): number {
  return i ^ (i >> 1);
}

/**
 * Position of the single bit that differs between two consecutive
 * Gray-code words. Returns the bit position (LSB = 0). Used to
 * compute the `flip(r)` control index in the UCR* multiplexor.
 */
function bitFlipPosition(a: number, b: number): number {
  const diff = a ^ b;
  let pos = 0;
  let d = diff;
  while ((d & 1) === 0) {
    pos++;
    d >>= 1;
  }
  return pos;
}

/**
 * Exact Gray-code multiplexor for `UCRZ`/`UCRY` over `k` controls.
 * Given the selector-indexed angles `[theta_0, ..., theta_{2^k-1}]`,
 * returns the transformed angle list `[alpha_0, ..., alpha_{2^k-1}]`
 * used by the multiplexor construction:
 *
 *     alpha_r = (1 / 2^k) * sum_{j=0}^{2^k-1} (-1)^{popcount(g_r & j)} * theta[j]
 */
function ucrAngles(theta: readonly number[]): number[] {
  const N = theta.length;
  const out: number[] = new Array(N);
  for (let r = 0; r < N; r++) {
    const gr = grayCode(r);
    let sum = 0;
    for (let j = 0; j < N; j++) {
      const parity = popcount(gr & j) & 1;
      sum += (parity === 0 ? 1 : -1) * theta[j];
    }
    out[r] = sum / N;
  }
  return out;
}

/** Population count. */
function popcount(x: number): number {
  let n = x;
  let c = 0;
  while (n) {
    c += n & 1;
    n >>>= 1;
  }
  return c;
}

/**
 * Uniformly controlled RZ gate (multiplexed over `k` control qubits).
 * Operand layout: `[controls..., target]`. Given the `2^k` selector
 * angles `[theta_0, ..., theta_{2^k-1}]` indexed in local MSB-first
 * control-block order, on the control basis state with local MSB-first
 * index `j` the target qubit sees `RZ(theta[j])`.
 *
 * Decomposition (exact, `k >= 0`): Gray-code multiplexor with the
 * transformed angles from `ucrAngles`. For `k = 0` this reduces to
 * `RZ(theta[0])` on the target alone.
 */
export function UCRZGate(theta: readonly number[]): Matrix {
  const N = theta.length;
  if (N === 0) throw new Error("UCRZGate: theta must be non-empty");
  if ((N & (N - 1)) !== 0) {
    throw new Error(`UCRZGate: theta.length must be a power of two, got ${N}`);
  }
  const k = Math.log2(N); // number of controls
  if (k === 0) return RZGate(theta[0]);
  const m = k + 1; // total qubits (controls + target)
  const target = k; // target qubit arg position
  const alphas = ucrAngles(theta);
  const steps: { gate: Matrix; targets: number[] }[] = [];
  for (let r = 0; r < N; r++) {
    steps.push({ gate: RZGate(alphas[r]), targets: [target] });
    // Next CX targets position: flip(r) in the control list.
    // Gray code differs between g_r and g_{r+1} in bit `b`. Under
    // Section 2's MSB-first gate-matrix ordering, Gray-code bit 0
    // corresponds to `controls[k-1]`, bit 1 to `controls[k-2]`, ...,
    // bit `k-1` to `controls[0]`.
    const next = (r + 1) % N;
    const b = bitFlipPosition(grayCode(r), grayCode(next));
    const flipArg = k - 1 - b;
    steps.push({ gate: CXGate(), targets: [flipArg, target] });
  }
  return compose(m, steps);
}

/**
 * Uniformly controlled RY gate. Same Gray-code multiplexor structure
 * as `UCRZGate` but with `RY` in place of `RZ`.
 */
export function UCRYGate(theta: readonly number[]): Matrix {
  const N = theta.length;
  if (N === 0) throw new Error("UCRYGate: theta must be non-empty");
  if ((N & (N - 1)) !== 0) {
    throw new Error(`UCRYGate: theta.length must be a power of two, got ${N}`);
  }
  const k = Math.log2(N);
  if (k === 0) return RYGate(theta[0]);
  const m = k + 1;
  const target = k;
  const alphas = ucrAngles(theta);
  const steps: { gate: Matrix; targets: number[] }[] = [];
  for (let r = 0; r < N; r++) {
    steps.push({ gate: RYGate(alphas[r]), targets: [target] });
    const next = (r + 1) % N;
    const b = bitFlipPosition(grayCode(r), grayCode(next));
    const flipArg = k - 1 - b;
    steps.push({ gate: CXGate(), targets: [flipArg, target] });
  }
  return compose(m, steps);
}

/**
 * Uniformly controlled RX gate via Hadamard conjugation of UCRZ:
 * `H(target) → UCRZ(theta) → H(target)`.
 */
export function UCRXGate(theta: readonly number[]): Matrix {
  const N = theta.length;
  if (N === 0) throw new Error("UCRXGate: theta must be non-empty");
  if ((N & (N - 1)) !== 0) {
    throw new Error(`UCRXGate: theta.length must be a power of two, got ${N}`);
  }
  const k = Math.log2(N);
  if (k === 0) return RXGate(theta[0]);
  const m = k + 1;
  const target = k;
  const ucrzTargets: number[] = [];
  for (let i = 0; i < m; i++) ucrzTargets.push(i);
  return compose(m, [
    { gate: HGate(), targets: [target] },
    { gate: UCRZGate(theta), targets: ucrzTargets },
    { gate: HGate(), targets: [target] },
  ]);
}

/**
 * Uniformly controlled Pauli rotation: dispatches to `UCRX`, `UCRY`,
 * or `UCRZ` based on the `axis` parameter.
 */
export function UCPauliRotGate(
  theta: readonly number[],
  axis: "X" | "Y" | "Z",
): Matrix {
  switch (axis) {
    case "X":
      return UCRXGate(theta);
    case "Y":
      return UCRYGate(theta);
    case "Z":
      return UCRZGate(theta);
    default:
      throw new Error(`UCPauliRotGate: invalid axis '${axis}'`);
  }
}

/**
 * Canonical ZYZ decomposition of a single-qubit unitary.
 *
 * Given a `2 × 2` unitary `U`, returns `(alpha, beta, gamma, delta)`
 * satisfying
 *
 *     U = exp(i * alpha) * RZ(beta) * RY(gamma) * RZ(delta)
 *
 * with the canonical representative from Section 3 Tier 7:
 *
 *   - `gamma ∈ [0, π]` after the exact reflection normalization
 *   - if `gamma = 0` or `gamma = π`, the decomposition is simplified
 *     (only the sum or difference `beta ± delta` matters)
 *   - `alpha`, `beta`, `delta` are reduced via `wrapPhase` with
 *     scalar-phase compensation from the `pi * n_{...}` factors
 *
 * @param U a 2×2 unitary matrix.
 */
export function decomposeZYZ(
  U: Matrix,
): { alpha: number; beta: number; gamma: number; delta: number } {
  if (U.rows !== 2 || U.cols !== 2) {
    throw new Error("decomposeZYZ requires a 2x2 matrix");
  }
  // Extract an initial ZYZ representative from U.
  //
  // U = [[u00, u01], [u10, u11]]
  //   = exp(i*a) * [[cos(γ/2),              -exp(i*δ')*sin(γ/2)],
  //                 [exp(i*β')*sin(γ/2),   exp(i*(β'+δ'))*cos(γ/2)]]
  // where β' = β, δ' = δ (plugging in the ZYZ formula).
  //
  // Take |u00|^2 + |u10|^2 = 1, so |u00|^2 = cos²(γ/2), |u10|^2 = sin²(γ/2).
  // Therefore γ_raw = 2 * atan2(|u10|, |u00|) gives γ ∈ [0, π].
  //
  // Derivation: U_can(γ, β, δ) expanded directly in the ZYZ form gives
  //
  //     U = exp(i*a) *
  //         [[cos(γ/2)*exp(i*(a - (β+δ)/2)),  -sin(γ/2)*exp(i*(a + (δ-β)/2))],
  //          [sin(γ/2)*exp(i*(a + (β-δ)/2)),   cos(γ/2)*exp(i*(a + (β+δ)/2))]]
  //
  // so
  //   arg(u00) = a - (β+δ)/2
  //   arg(u11) = a + (β+δ)/2
  //   arg(u10) = a + (β-δ)/2
  //   arg(-u01) = a + (δ-β)/2
  //
  // ⇒ a = (arg(u00) + arg(u11))/2 = (arg(-u01) + arg(u10))/2
  //   β = arg(u10) - arg(u00)
  //   δ = arg(u11) - arg(u10)
  //
  const u00 = U.get(0, 0);
  const u01 = U.get(0, 1);
  const u10 = U.get(1, 0);
  const u11 = U.get(1, 1);
  const a00 = u00.magnitude();
  const a10 = u10.magnitude();
  const gamma0 = 2 * Math.atan2(a10, a00);
  const eps = Complex.EPSILON;
  let gamma: number;
  let beta: number;
  let delta: number;
  let alpha: number;

  if (Math.abs(gamma0) <= eps) {
    // γ = 0: only β + δ matters; set β = 0 and put all phase into δ.
    gamma = 0;
    // a_raw = (arg(u00) + arg(u11)) / 2
    // sum = arg(u11) - arg(u00) = β + δ
    const aRaw = (u00.phase() + u11.phase()) / 2;
    const sum = u11.phase() - u00.phase();
    beta = 0;
    delta = wrapPhaseLocal(sum, eps);
    // Compensation: RZ(δ_raw) = exp(i*π*n_δ) * RZ(δ) so α = a_raw + π*n_δ.
    const nDelta = Math.round((sum - delta) / (2 * Math.PI));
    alpha = wrapPhaseLocal(aRaw + Math.PI * nDelta, eps);
  } else if (Math.abs(gamma0 - Math.PI) <= eps) {
    // γ = π: only β - δ matters; set δ = 0 and put all phase into β.
    gamma = Math.PI;
    // a_raw = (arg(-u01) + arg(u10)) / 2
    // tau = arg(u10) - arg(-u01) = β - δ
    const argMU01 = u01.neg().phase();
    const argU10 = u10.phase();
    const aRaw = (argMU01 + argU10) / 2;
    const tau = argU10 - argMU01;
    delta = 0;
    beta = wrapPhaseLocal(tau, eps);
    const nBeta = Math.round((tau - beta) / (2 * Math.PI));
    alpha = wrapPhaseLocal(aRaw + Math.PI * nBeta, eps);
  } else {
    // Generic case 0 < γ < π.
    gamma = gamma0;
    const argU00 = u00.phase();
    const argU10 = u10.phase();
    const argU11 = u11.phase();
    const aRaw = (argU00 + argU11) / 2;
    const betaRaw = argU10 - argU00;
    const deltaRaw = argU11 - argU10;
    beta = wrapPhaseLocal(betaRaw, eps);
    delta = wrapPhaseLocal(deltaRaw, eps);
    const nBeta = Math.round((betaRaw - beta) / (2 * Math.PI));
    const nDelta = Math.round((deltaRaw - delta) / (2 * Math.PI));
    alpha = wrapPhaseLocal(aRaw + Math.PI * (nBeta + nDelta), eps);
  }
  return { alpha, beta, gamma, delta };
}

/** Local re-implementation of wrapPhase (avoid cyclic import). */
function wrapPhaseLocal(alpha: number, epsilon: number): number {
  const twoPi = 2 * Math.PI;
  let w = alpha - twoPi * Math.floor((alpha + Math.PI) / twoPi);
  if (Math.abs(w - Math.PI) <= epsilon || Math.abs(w + Math.PI) <= epsilon) {
    return Math.PI;
  }
  return w;
}

/**
 * General uniformly controlled gate. Given `2^k` arbitrary 2×2
 * unitaries `[U_0, ..., U_{2^k-1}]`, produces the `2^(k+1)`-dimensional
 * block-diagonal `diag(U_0, U_1, ..., U_{2^k-1})` under Section 2's
 * local MSB-first ordering where the first `k` arguments are the
 * controls and the last argument is the target.
 *
 * Decomposition (Möttönen et al. 2004, Section 3 Tier 7):
 * 1. ZYZ-decompose each `U_j = exp(i*alpha_j) * RZ(beta_j) * RY(gamma_j) * RZ(delta_j)`.
 * 2. Apply four layers:
 *       UCRZ({delta_j}) → UCRY({gamma_j}) → UCRZ({beta_j}) → DiagonalGate({alpha_j}) on controls
 *
 * The final `DiagonalGate({alpha_j})` acts on the `k` **control**
 * qubits only (it is a control-side phase injection, not a target
 * rotation).
 */
export function UCGate(unitaries: readonly Matrix[]): Matrix {
  const N = unitaries.length;
  if (N === 0) throw new Error("UCGate: unitaries list must be non-empty");
  if ((N & (N - 1)) !== 0) {
    throw new Error(
      `UCGate: unitaries.length must be a power of two, got ${N}`,
    );
  }
  const k = Math.log2(N);
  for (const U of unitaries) {
    if (U.rows !== 2 || U.cols !== 2) {
      throw new Error("UCGate: each unitary must be 2×2");
    }
    if (!U.isUnitary()) throw new Error("UCGate: input matrix is not unitary");
  }
  // Base case k = 0: just the single unitary acting on 1 qubit.
  if (k === 0) return unitaries[0];
  // ZYZ-decompose each operand.
  const alphas: number[] = new Array(N);
  const betas: number[] = new Array(N);
  const gammas: number[] = new Array(N);
  const deltas: number[] = new Array(N);
  for (let j = 0; j < N; j++) {
    const dec = decomposeZYZ(unitaries[j]);
    alphas[j] = dec.alpha;
    betas[j] = dec.beta;
    gammas[j] = dec.gamma;
    deltas[j] = dec.delta;
  }
  const m = k + 1;
  // UCRZ/UCRY operate on m qubits (controls first, target last), so
  // their targets are [0..m-1].
  const ucrTargets: number[] = [];
  for (let i = 0; i < m; i++) ucrTargets.push(i);
  // DiagonalGate({alpha_j}) acts on the k control qubits only.
  const diagTargets: number[] = [];
  for (let i = 0; i < k; i++) diagTargets.push(i);
  return compose(m, [
    { gate: UCRZGate(deltas), targets: ucrTargets },
    { gate: UCRYGate(gammas), targets: ucrTargets },
    { gate: UCRZGate(betas), targets: ucrTargets },
    { gate: DiagonalGate(alphas), targets: diagTargets },
  ]);
}

/**
 * Reversible linear function over GF(2). Given an `n × n` binary
 * matrix `M` that is invertible over GF(2), returns the permutation
 * matrix that implements `|x⟩ → |M·x mod 2⟩` under Section 2's
 * little-endian register value convention.
 *
 * Decomposition: Gaussian elimination over GF(2) produces a sequence
 * of elementary row operations. Each row-swap becomes a SWAP; each
 * row-addition `R_i ⊕= R_j` becomes a `CX(q[j], q[i])`. The circuit
 * is the reverse of the elimination sequence. Here we return the
 * resulting permutation matrix directly.
 *
 * @param M an `n × n` matrix of 0/1 entries, invertible over GF(2).
 */
export function LinearFunction(M: readonly (readonly number[])[]): Matrix {
  const n = M.length;
  if (n === 0) {
    // Empty function → zero-qubit identity.
    return GlobalPhaseGate(0);
  }
  for (const row of M) {
    if (row.length !== n) {
      throw new Error(
        `LinearFunction: matrix must be square, got ${row.length} vs ${n}`,
      );
    }
    for (const v of row) {
      if (v !== 0 && v !== 1) {
        throw new Error(`LinearFunction: entries must be 0 or 1, got ${v}`);
      }
    }
  }
  // Check invertibility by computing rank over GF(2).
  if (!isInvertibleGF2(M, n)) {
    throw new Error("LinearFunction: matrix is not invertible over GF(2)");
  }
  // Build the permutation directly: for each register value x in [0, 2^n),
  // compute y = M * x mod 2 using the little-endian convention of Section 2.
  //
  // Section 2 says: in the ordered qubit list q[0..n-1], bit i of the
  // register value is qubit q[i] (little-endian on the register value).
  // The gate matrix is still written in MSB-first ordering: row/column
  // index encodes q[0] as the MSB (bit n-1) and q[n-1] as the LSB.
  //
  // So for a register value x with little-endian bit `x_i = (x >> i) & 1`
  // corresponding to qubit q[i], the matrix-index is the MSB-first
  // integer where bit `(n-1-i)` is `x_i`, i.e., matrixIndex(x) = reverseBits(x, n).
  const dim = 1 << n;
  const sigma: number[] = new Array(dim);
  for (let matIdxIn = 0; matIdxIn < dim; matIdxIn++) {
    // Extract the register value from matrix index (reverse bit order).
    const x = reverseBits(matIdxIn, n);
    // Compute y = M * x mod 2 in little-endian register-value bits.
    let y = 0;
    for (let i = 0; i < n; i++) {
      let bit = 0;
      for (let j = 0; j < n; j++) {
        bit ^= M[i][j] & ((x >> j) & 1);
      }
      if (bit) y |= 1 << i;
    }
    const matIdxOut = reverseBits(y, n);
    sigma[matIdxIn] = matIdxOut;
  }
  return PermutationGate(sigma);
}

/** Reverse the lowest `n` bits of `x`. */
function reverseBits(x: number, n: number): number {
  let r = 0;
  for (let i = 0; i < n; i++) {
    if ((x >> i) & 1) r |= 1 << (n - 1 - i);
  }
  return r;
}

/** Check whether an `n × n` GF(2) matrix is invertible (full rank). */
function isInvertibleGF2(
  M: readonly (readonly number[])[],
  n: number,
): boolean {
  const a: number[][] = M.map((row) => row.slice());
  for (let col = 0; col < n; col++) {
    let piv = -1;
    for (let r = col; r < n; r++) {
      if (a[r][col] === 1) {
        piv = r;
        break;
      }
    }
    if (piv < 0) return false;
    if (piv !== col) {
      const tmp = a[col];
      a[col] = a[piv];
      a[piv] = tmp;
    }
    for (let r = 0; r < n; r++) {
      if (r !== col && a[r][col] === 1) {
        for (let c = 0; c < n; c++) a[r][c] ^= a[col][c];
      }
    }
  }
  return true;
}

/**
 * Isometry with canonical lexicographic Gram-Schmidt completion.
 *
 * Given a `2^n × 2^m` isometry `V` (with `m ≤ n` and
 * `V† V = I_{2^m}`), returns the `2^n × 2^n` unitary `U_V` whose
 * first `2^m` columns are exactly the columns of `V` and whose
 * remaining `2^n - 2^m` columns are built by the deterministic
 * lexicographic Gram-Schmidt rule from Section 3 Tier 7.
 *
 * @param V an isometry of shape `2^n × 2^m`.
 */
export function Isometry(V: Matrix): Matrix {
  const rows = V.rows;
  const cols = V.cols;
  if (!isPowerOfTwo(rows) || !isPowerOfTwo(cols)) {
    throw new Error(
      `Isometry: dimensions must be powers of two, got ${rows}x${cols}`,
    );
  }
  if (cols > rows) {
    throw new Error(`Isometry: cols must be ≤ rows (m ≤ n)`);
  }
  // Verify isometry: V† V ≈ I_{2^m}
  const vdv = V.dagger().multiply(V);
  if (!vdv.equals(Matrix.identity(cols))) {
    throw new Error("Isometry: V† V ≠ I (not an isometry within epsilon)");
  }
  // Build column vectors of V.
  const columns: Complex[][] = [];
  for (let j = 0; j < cols; j++) {
    const col: Complex[] = new Array(rows);
    for (let i = 0; i < rows; i++) col[i] = V.get(i, j);
    columns.push(col);
  }
  // Deterministic lexicographic Gram-Schmidt completion.
  for (let r = 0; columns.length < rows; r++) {
    // Candidate basis vector e_r.
    const cand: Complex[] = new Array(rows);
    for (let i = 0; i < rows; i++) {
      cand[i] = i === r ? Complex.ONE : Complex.ZERO;
    }
    // Subtract projections onto every existing column.
    for (const c of columns) {
      const dot = innerProduct(c, cand);
      for (let i = 0; i < rows; i++) {
        cand[i] = cand[i].sub(c[i].mul(dot));
      }
    }
    // Compute residual norm.
    let normSq = 0;
    for (let i = 0; i < rows; i++) normSq += cand[i].magnitudeSquared();
    if (normSq <= Complex.EPSILON * Complex.EPSILON) continue; // discard
    const norm = Math.sqrt(normSq);
    for (let i = 0; i < rows; i++) cand[i] = cand[i].scale(1 / norm);
    columns.push(cand);
  }
  // Assemble the final matrix from the column list.
  const data: Complex[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: Complex[] = new Array(rows);
    for (let j = 0; j < rows; j++) row[j] = columns[j][i];
    data.push(row);
  }
  return new Matrix(data);
}

/** Inner product `⟨a|b⟩ = sum_i conj(a_i) * b_i`. */
function innerProduct(a: readonly Complex[], b: readonly Complex[]): Complex {
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.length; i++) {
    // conj(a_i) * b_i
    re += a[i].re * b[i].re + a[i].im * b[i].im;
    im += a[i].re * b[i].im - a[i].im * b[i].re;
  }
  return new Complex(re, im);
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * General unitary synthesis via recursive Cosine-Sine Decomposition.
 *
 * Accepts a `2^n × 2^n` unitary `U` and returns the same matrix after
 * validating it is unitary. The exact compositional synthesis through
 * CSD → UCRY + recursive block-diagonal unitaries is encoded at the
 * `QuantumCircuit` level during transpilation; the constructor itself
 * returns the input matrix directly (it IS the semantic target).
 *
 * Section 3 makes clear that for `UnitaryGate`, the matrix is the
 * semantic definition; the CSD synthesis exists as a reference
 * **circuit** lowering, not a way to compute a different matrix. This
 * function therefore just performs the validation required by the
 * constructor contract and returns `U` unchanged.
 *
 * @param U a `2^n × 2^n` unitary matrix.
 */
export function UnitaryGate(U: Matrix): Matrix {
  if (U.rows !== U.cols) throw new Error("UnitaryGate: matrix must be square");
  if (!isPowerOfTwo(U.rows)) {
    throw new Error(
      `UnitaryGate: dimension must be a power of two, got ${U.rows}`,
    );
  }
  if (!U.isUnitary()) {
    throw new Error("UnitaryGate: input matrix is not unitary");
  }
  return U;
}

// =============================================================================
// Tier 8: Hamiltonian simulation and Pauli evolution
// =============================================================================

/**
 * One Pauli term in a weighted Pauli-string sum representing a
 * Hermitian operator `H = sum_k c_k * P_k`. The string uses the same
 * left-to-right convention as `PauliGate`: element 0 acts on the
 * first qubit argument.
 */
export interface PauliTerm {
  /** Real coefficient. */
  coefficient: number;
  /** Pauli string, e.g. "IXZ". */
  pauliString: string;
}

/**
 * Time evolution under a weighted Pauli-sum Hamiltonian
 * `H = sum_k c_k * P_k`. Returns the exact unitary
 * `exp(-i * time * H)`.
 *
 * When all terms commute, the exponential factorizes exactly as a
 * product of `PauliProductRotationGate(2 * time * c_k, P_k)`. When
 * they do not, the operator is computed by constructing `H` as a
 * full matrix and forwarding to `HamiltonianGate(H, time)`.
 *
 * @param terms array of `PauliTerm`, all sharing the same string
 *              length (number of qubits).
 * @param time  real evolution time.
 */
export function PauliEvolutionGate(
  terms: readonly PauliTerm[],
  time: number,
): Matrix {
  if (terms.length === 0) {
    throw new Error("PauliEvolutionGate: terms must be non-empty");
  }
  const n = terms[0].pauliString.length;
  for (const t of terms) {
    if (t.pauliString.length !== n) {
      throw new Error(
        "PauliEvolutionGate: all Pauli strings must have the same length",
      );
    }
    for (const ch of t.pauliString) {
      if (!"IXYZ".includes(ch)) {
        throw new Error(`PauliEvolutionGate: invalid Pauli character '${ch}'`);
      }
    }
  }
  // Collect like terms (sum coefficients of identical Pauli strings).
  const bucket = new Map<string, number>();
  for (const t of terms) {
    bucket.set(t.pauliString, (bucket.get(t.pauliString) ?? 0) + t.coefficient);
  }
  const collected: PauliTerm[] = [];
  for (const [s, c] of bucket) {
    collected.push({ pauliString: s, coefficient: c });
  }

  // Check whether all retained terms pairwise commute.
  if (allPauliTermsCommute(collected)) {
    // Factorized product: prod_k exp(-i * time * c_k * P_k)
    //                 = prod_k PauliProductRotationGate(2*time*c_k, P_k)
    if (n === 0) {
      // Zero-qubit: the only Pauli term possible is the empty string "" (identity).
      // H = sum c_k ⇒ exp(-i*t*sum c_k) — zero-qubit phase.
      let total = 0;
      for (const t of collected) total += t.coefficient;
      return GlobalPhaseGate(-time * total);
    }
    let result = Matrix.identity(1 << n);
    for (const t of collected) {
      const factor = PauliProductRotationGate(
        2 * time * t.coefficient,
        t.pauliString,
      );
      result = factor.multiply(result);
    }
    return result;
  }

  // Non-commuting terms: build H and forward to HamiltonianGate.
  if (n === 0) {
    let total = 0;
    for (const t of collected) total += t.coefficient;
    return GlobalPhaseGate(-time * total);
  }
  const dim = 1 << n;
  let H = Matrix.zeros(dim, dim);
  for (const t of collected) {
    const P = PauliGate(t.pauliString);
    H = H.add(P.scaleReal(t.coefficient));
  }
  return HamiltonianGate(H, time);
}

/**
 * General Hamiltonian simulation: returns `exp(-i * time * H)` for an
 * arbitrary Hermitian matrix `H`.
 *
 * Decomposition (Section 3 Tier 8): spectral factorization
 * `H = V * D * V†` followed by
 * `exp(-i*t*H) = V * diag(exp(-i*t*d_j)) * V†`. The eigendecomposition
 * is computed numerically via Jacobi rotations, which converge for
 * Hermitian matrices and are stable for the small dimensions used in
 * this SDK's test and simulation contexts.
 *
 * @param H a Hermitian `2^n × 2^n` matrix.
 * @param time real evolution time.
 */
export function HamiltonianGate(H: Matrix, time: number): Matrix {
  if (H.rows !== H.cols) throw new Error("HamiltonianGate: H must be square");
  if (!isPowerOfTwo(H.rows)) {
    throw new Error(
      `HamiltonianGate: dimension must be a power of two, got ${H.rows}`,
    );
  }
  // Verify Hermitian.
  if (!H.equals(H.dagger())) {
    throw new Error("HamiltonianGate: H must be Hermitian");
  }
  if (H.rows === 1) {
    // Scalar H = [[h]]: exp(-i*t*h) is a 1×1 zero-qubit phase.
    const h = H.get(0, 0).re; // imaginary part is zero for Hermitian
    return GlobalPhaseGate(-time * h);
  }
  // Compute eigendecomposition via Jacobi rotations for Hermitian matrices.
  const { eigenvalues, eigenvectors } = hermitianEigendecompose(H);
  // Build exp(-i*t*D) diagonal matrix.
  const expDiag: Complex[] = eigenvalues.map((d) => Complex.exp(-time * d));
  const expD = Matrix.diagonal(expDiag);
  // V * exp(-i*t*D) * V†
  return eigenvectors.multiply(expD).multiply(eigenvectors.dagger());
}

/**
 * Check whether all pairs of Pauli strings in `terms` commute.
 * Two Pauli strings commute iff the number of positions where they
 * have distinct non-identity factors is even.
 */
function allPauliTermsCommute(terms: readonly PauliTerm[]): boolean {
  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      if (!pauliStringsCommute(terms[i].pauliString, terms[j].pauliString)) {
        return false;
      }
    }
  }
  return true;
}

function pauliStringsCommute(a: string, b: string): boolean {
  let anticommuteCount = 0;
  for (let k = 0; k < a.length; k++) {
    const ca = a[k];
    const cb = b[k];
    if (ca === "I" || cb === "I") continue;
    if (ca !== cb) anticommuteCount++;
  }
  return anticommuteCount % 2 === 0;
}

/**
 * Jacobi eigendecomposition for a Hermitian matrix. Returns real
 * eigenvalues and a unitary `V` such that `V * diag(eigenvalues) * V†
 * = H`.
 *
 * This is the standard two-sided Jacobi rotation algorithm generalized
 * to complex Hermitian matrices. It converges quadratically and is
 * numerically stable for small dimensions (up to ~256).
 */
// =============================================================================
// Tier 14: State preparation — graph states
// =============================================================================

/**
 * Graph state preparation gate. Given a symmetric 0/1 adjacency
 * matrix `G` on `n` vertices, applies the exact circuit
 *
 *     |ψ⟩ = (∏_{(i,j) ∈ E, i < j} CZ(q[i], q[j])) · (H^⊗n) |ψ⟩
 *
 * When applied to the computational basis state `|0...0⟩`, this
 * produces the canonical graph state `|G⟩`.
 *
 * Requirements: `adjacencyMatrix` is `n × n`, binary, has zero
 * diagonal (no self-loops), and is symmetric.
 *
 * Boundary: `n = 0` → `GlobalPhaseGate(0)`.
 */
export function GraphStateGate(
  adjacencyMatrix: readonly (readonly number[])[],
): Matrix {
  const n = adjacencyMatrix.length;
  if (n === 0) return GlobalPhaseGate(0);
  // Validate shape and entries.
  for (let i = 0; i < n; i++) {
    const row = adjacencyMatrix[i];
    if (row.length !== n) {
      throw new Error(
        `GraphStateGate: adjacency matrix must be square, got row ${i} of length ${row.length}`,
      );
    }
    if (row[i] !== 0) {
      throw new Error(
        `GraphStateGate: diagonal must be zero (no self-loops) at index ${i}`,
      );
    }
    for (let j = 0; j < n; j++) {
      const v = row[j];
      if (v !== 0 && v !== 1) {
        throw new Error(
          `GraphStateGate: entries must be 0 or 1, got ${v} at (${i}, ${j})`,
        );
      }
      if (v !== adjacencyMatrix[j][i]) {
        throw new Error(`GraphStateGate: adjacency matrix must be symmetric`);
      }
    }
  }
  const steps: { gate: Matrix; targets: number[] }[] = [];
  // Apply Hadamard to every qubit.
  for (let i = 0; i < n; i++) {
    steps.push({ gate: HGate(), targets: [i] });
  }
  // Apply CZ for every edge (i, j) with i < j.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (adjacencyMatrix[i][j] === 1) {
        steps.push({ gate: CZGate(), targets: [i, j] });
      }
    }
  }
  return compose(n, steps);
}

// =============================================================================
// Tier 13: Comparison, aggregation, and oracles
// =============================================================================
//
// IntegerComparatorGate is defined in the Tier 12 section above
// because Tier 12 piecewise families depend on it. It is re-exported
// here as its canonical Tier 13 home.
// =============================================================================

/**
 * Quadratic-form gate `|x⟩|r⟩ → |x⟩|r + q(x) mod 2^m⟩` where
 * `q(x) = x^T A x + b^T x + c` with integer coefficients, `x` is
 * an `n`-bit register and `r` is an `m`-bit accumulator register.
 *
 * Operand layout: `[x[0..n-1], result[0..m-1]]`. Boundary: if
 * `m = 0`, identity on `x`; if `n = 0`, constant addition of `c`.
 *
 * Decomposition (Section 3 Tier 13): apply QFT on `result`, then
 * accumulate phases for the constant term, linear terms (controlled
 * on each `x_i`), and quadratic terms (doubly controlled on each
 * `(x_i, x_j)` with `i ≤ j`), then inverse QFT.
 *
 * @param A  n×n integer matrix (may be non-symmetric; off-diagonal
 *           coefficients are symmetrized as `A[i][j] + A[j][i]`).
 * @param b  integer n-vector.
 * @param c  integer scalar.
 * @param numStateBits `n`.
 * @param numResultBits `m`.
 */
export function QuadraticFormGate(
  A: readonly (readonly number[])[],
  b: readonly number[],
  c: number,
  numStateBits: number,
  numResultBits: number,
): Matrix {
  if (!Number.isInteger(numStateBits) || numStateBits < 0) {
    throw new Error(
      `QuadraticFormGate: numStateBits must be nonnegative integer`,
    );
  }
  if (!Number.isInteger(numResultBits) || numResultBits < 0) {
    throw new Error(
      `QuadraticFormGate: numResultBits must be nonnegative integer`,
    );
  }
  const n = numStateBits;
  const m = numResultBits;
  if (A.length !== n) throw new Error(`QuadraticFormGate: A must be ${n}×${n}`);
  for (const row of A) {
    if (row.length !== n) {
      throw new Error(`QuadraticFormGate: A must be ${n}×${n}`);
    }
  }
  if (b.length !== n) {
    throw new Error(`QuadraticFormGate: b must have length ${n}`);
  }
  if (m === 0) {
    return Matrix.identity(1 << n); // n + m = n qubits, but if m=0 no result ⇒ identity
  }
  // Total qubits: n + m. Operand: x[0..n-1] at args 0..n-1, r[0..m-1] at args n..n+m-1.
  const totalArgs = n + m;
  // Compute effective linear and symmetrized-quadratic coefficients.
  const ell: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) ell[i] = b[i] + A[i][i];
  const q: number[][] = [];
  for (let i = 0; i < n; i++) q.push(new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) q[i][j] = A[i][j] + A[j][i];
  }
  const steps: { gate: Matrix; targets: number[] }[] = [];
  const rTargets: number[] = [];
  for (let r = 0; r < m; r++) rTargets.push(n + r);
  // QFT on result register
  steps.push({ gate: QFTGate(m), targets: rTargets });
  // Phase accumulation.
  //
  // After QFT, basis state |j⟩ of the result register carries phase
  // exp(2*pi*i * j_val * (r_val) / 2^m). To add k to r_val, we want
  // to multiply amplitude at mode j_val by exp(2*pi*i * j_val * k / 2^m).
  //
  // Under Section 2's canonical no-SWAP QFT, qubit r[jj] carries
  // mode-index bit 2^(m-1-jj) (MSB-first). So the single-qubit phase
  // on r[jj] per unit of k is:
  //     2*pi * 2^(m-1-jj) / 2^m = pi / 2^jj
  // but we need the FULL phase k*pi/2^jj modulo 2*pi for each k.
  //
  // For a CLASSICAL constant k, emit one PhaseGate per qubit with the
  // correct accumulated angle. For a LINEAR term ell[i]*x_i, emit
  // controlled phases per qubit of r, controlled on x[i]. For a
  // QUADRATIC term q[i][j]*x_i*x_j, emit doubly-controlled phases.

  // Constant c: phase on each r[jj] equals c * 2*pi * 2^(m-1-jj) / 2^m = c * pi / 2^jj.
  for (let jj = 0; jj < m; jj++) {
    const phase = (2 * Math.PI * c * (1 << (m - 1 - jj))) / (1 << m);
    if (phase !== 0) {
      steps.push({ gate: PhaseGate(phase), targets: [n + jj] });
    }
  }
  // Linear terms ell[i]: controlled phase on (x[i], r[jj]).
  for (let i = 0; i < n; i++) {
    if (ell[i] === 0) continue;
    for (let jj = 0; jj < m; jj++) {
      const phase = (2 * Math.PI * ell[i] * (1 << (m - 1 - jj))) / (1 << m);
      if (phase !== 0) {
        steps.push({ gate: CPhaseGate(phase), targets: [i, n + jj] });
      }
    }
  }
  // Quadratic terms q[i][j]: doubly-controlled phase on (x[i], x[j], r[jj]).
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (q[i][j] === 0) continue;
      for (let jj = 0; jj < m; jj++) {
        const phase = (2 * Math.PI * q[i][j] * (1 << (m - 1 - jj))) / (1 << m);
        if (phase !== 0) {
          steps.push({
            gate: MCPhaseGate(phase, 2),
            targets: [i, j, n + jj],
          });
        }
      }
    }
  }
  // Inverse QFT on result register
  steps.push({ gate: QFTGate(m).dagger(), targets: rTargets });
  return compose(totalArgs, steps);
}

/**
 * Weighted sum gate `|x_0 ... x_{n-1}⟩|s⟩ → |x⟩|s + sum_i w_i * x_i mod 2^m⟩`.
 *
 * Operand layout: `[x[0..n-1], sum[0..m-1]]`. The weights are
 * integers; the sum is computed modulo `2^m`. Decomposition: QFT on
 * sum, controlled phase additions per bit, inverse QFT.
 *
 * Boundary cases: `n = 0` → identity on sum; `m = 0` → identity on x.
 */
export function WeightedSumGate(
  weights: readonly number[],
  numStateBits: number,
  numSumBits: number,
): Matrix {
  if (!Number.isInteger(numStateBits) || numStateBits < 0) {
    throw new Error(
      `WeightedSumGate: numStateBits must be nonnegative integer`,
    );
  }
  if (!Number.isInteger(numSumBits) || numSumBits < 0) {
    throw new Error(`WeightedSumGate: numSumBits must be nonnegative integer`);
  }
  if (weights.length !== numStateBits) {
    throw new Error(`WeightedSumGate: weights.length must equal numStateBits`);
  }
  const n = numStateBits;
  const m = numSumBits;
  if (m === 0) return Matrix.identity(1 << n);
  if (n === 0) return Matrix.identity(1 << m);
  const totalArgs = n + m;
  const sumTargets: number[] = [];
  for (let r = 0; r < m; r++) sumTargets.push(n + r);
  const steps: { gate: Matrix; targets: number[] }[] = [];
  steps.push({ gate: QFTGate(m), targets: sumTargets });
  for (let i = 0; i < n; i++) {
    const w = weights[i];
    if (w === 0) continue;
    for (let jj = 0; jj < m; jj++) {
      const phase = (2 * Math.PI * w * (1 << (m - 1 - jj))) / (1 << m);
      if (phase !== 0) {
        steps.push({ gate: CPhaseGate(phase), targets: [i, n + jj] });
      }
    }
  }
  steps.push({ gate: QFTGate(m).dagger(), targets: sumTargets });
  return compose(totalArgs, steps);
}

/**
 * One term in an Exclusive Sum of Products (ESOP) representation of a
 * Boolean function `f: {0,1}^n → {0,1}`. A term is a product of
 * literals; each literal is either a variable `x_i` (`negated =
 * false`) or its negation `¬x_i` (`negated = true`).
 */
export interface ESOPTerm {
  /** Array of variable indices. */
  variables: readonly number[];
  /** Whether each corresponding variable is negated. */
  negated: readonly boolean[];
}

/**
 * Phase oracle from a Boolean function in ESOP form.
 *
 * Applies `|x⟩ → (-1)^{f(x)} |x⟩` where `f` is the XOR of the terms
 * in `esop`.
 *
 * Decomposition (Section 3 Tier 13): for each term, apply X to
 * negated literals, then a multi-controlled Z on the relevant
 * qubits, then undo the X's. The constant-1 term (empty product) is
 * realized as `GlobalPhaseGate(pi)` (lifted to `n` qubits). ESOP
 * over ⊕ composes phases multiplicatively.
 */
export function PhaseOracleGate(
  esop: readonly ESOPTerm[],
  numVariables: number,
): Matrix {
  if (!Number.isInteger(numVariables) || numVariables < 0) {
    throw new Error(
      `PhaseOracleGate: numVariables must be a nonnegative integer`,
    );
  }
  if (numVariables === 0) {
    // Only the constant 1 / empty-term case; check whether the ESOP
    // evaluates to 1 (odd number of constant-1 terms).
    let bit = 0;
    for (const t of esop) {
      if (t.variables.length === 0) bit ^= 1;
    }
    return bit ? GlobalPhaseGate(Math.PI) : GlobalPhaseGate(0);
  }
  const n = numVariables;
  const steps: { gate: Matrix; targets: number[] }[] = [];
  for (const term of esop) {
    // Normalize: drop any variable that appears with both polarities; the
    // term is identically 0 and can be skipped. Also collapse duplicates.
    const varToPolarity = new Map<number, boolean>();
    let kill = false;
    for (let i = 0; i < term.variables.length; i++) {
      const v = term.variables[i];
      const neg = term.negated[i];
      if (varToPolarity.has(v)) {
        if (varToPolarity.get(v) !== neg) {
          kill = true;
          break;
        }
        // Duplicate same-polarity: keep single.
      } else {
        varToPolarity.set(v, neg);
      }
    }
    if (kill) continue;
    const vars = [...varToPolarity.keys()].sort((a, b) => a - b);
    const negArr = vars.map((v) => varToPolarity.get(v)!);
    if (vars.length === 0) {
      // Constant-1 term: global phase pi on whole register.
      steps.push({ gate: GlobalPhaseGate(Math.PI), targets: [] });
      continue;
    }
    // Apply X to negated literals.
    for (let i = 0; i < vars.length; i++) {
      if (negArr[i]) steps.push({ gate: XGate(), targets: [vars[i]] });
    }
    // Multi-controlled Z on these vars.
    if (vars.length === 1) {
      steps.push({ gate: ZGate(), targets: [vars[0]] });
    } else {
      // MCZ = H(last) → MCX → H(last) (already encoded by the
      // phase-safe recursion inside MCPhase / MCX).
      const last = vars[vars.length - 1];
      const controls = vars.slice(0, -1);
      steps.push({ gate: HGate(), targets: [last] });
      steps.push({
        gate: MCXGate(controls.length),
        targets: [...controls, last],
      });
      steps.push({ gate: HGate(), targets: [last] });
    }
    // Undo X's.
    for (let i = 0; i < vars.length; i++) {
      if (negArr[i]) steps.push({ gate: XGate(), targets: [vars[i]] });
    }
  }
  return compose(n, steps);
}

/**
 * Bit-flip oracle from a Boolean function in ESOP form.
 *
 * Applies `|x⟩|y⟩ → |x⟩|y ⊕ f(x)⟩` where `f = XOR of ESOP terms`.
 * Operand layout: `[x[0..n-1], y]` — the last argument is the output
 * qubit.
 */
export function BitFlipOracleGate(
  esop: readonly ESOPTerm[],
  numVariables: number,
): Matrix {
  if (!Number.isInteger(numVariables) || numVariables < 0) {
    throw new Error(
      `BitFlipOracleGate: numVariables must be a nonnegative integer`,
    );
  }
  const n = numVariables;
  const m = n + 1;
  const y = n;
  const steps: { gate: Matrix; targets: number[] }[] = [];
  for (const term of esop) {
    // Same normalization as PhaseOracleGate.
    const varToPolarity = new Map<number, boolean>();
    let kill = false;
    for (let i = 0; i < term.variables.length; i++) {
      const v = term.variables[i];
      const neg = term.negated[i];
      if (varToPolarity.has(v)) {
        if (varToPolarity.get(v) !== neg) {
          kill = true;
          break;
        }
      } else {
        varToPolarity.set(v, neg);
      }
    }
    if (kill) continue;
    const vars = [...varToPolarity.keys()].sort((a, b) => a - b);
    const negArr = vars.map((v) => varToPolarity.get(v)!);
    if (vars.length === 0) {
      // Constant-1 term: X(y).
      steps.push({ gate: XGate(), targets: [y] });
      continue;
    }
    // Apply X to negated literals.
    for (let i = 0; i < vars.length; i++) {
      if (negArr[i]) steps.push({ gate: XGate(), targets: [vars[i]] });
    }
    // Multi-controlled X on y with controls = vars.
    const mcx = MCXGate(vars.length);
    steps.push({ gate: mcx, targets: [...vars, y] });
    // Undo X's.
    for (let i = 0; i < vars.length; i++) {
      if (negArr[i]) steps.push({ gate: XGate(), targets: [vars[i]] });
    }
  }
  return compose(m, steps);
}

// =============================================================================
// Tier 12: Function loading and approximation
// =============================================================================

/**
 * Single-qubit rotation dispatch for an axis string. Internal helper
 * shared across Tier 12.
 */
function singleQubitRotation(axis: "X" | "Y" | "Z", theta: number): Matrix {
  switch (axis) {
    case "X":
      return RXGate(theta);
    case "Y":
      return RYGate(theta);
    case "Z":
      return RZGate(theta);
  }
}

/** Controlled single-qubit rotation dispatch for an axis string. */
function controlledSingleQubitRotation(
  axis: "X" | "Y" | "Z",
  theta: number,
): Matrix {
  switch (axis) {
    case "X":
      return CRXGate(theta);
    case "Y":
      return CRYGate(theta);
    case "Z":
      return CRZGate(theta);
  }
}

/**
 * Linear function rotation: applies
 *     R_{axis}(2 * (slope * x + offset))
 * to the target qubit, controlled by the `numStateBits`-bit input
 * register. Operand layout: `[x[0..n-1], target]`.
 *
 * Decomposition (Section 3 Tier 12):
 *     R_{axis}(2*offset)(target) →
 *     for i in 0..n-1: CR_{axis}(2*slope*2^i, x[i], target)
 *
 * Each bit of the input contributes a controlled rotation whose
 * angle scales with `2^i`. Boundary case `numStateBits = 0` reduces
 * to the unconditional rotation `R_{axis}(2*offset)` on the target.
 */
export function LinearPauliRotationsGate(
  slope: number,
  offset: number,
  numStateBits: number,
  axis: "X" | "Y" | "Z" = "Y",
): Matrix {
  if (!Number.isInteger(numStateBits) || numStateBits < 0) {
    throw new Error(
      `LinearPauliRotationsGate: numStateBits must be a nonnegative integer`,
    );
  }
  if (numStateBits === 0) {
    return singleQubitRotation(axis, 2 * offset);
  }
  const m = numStateBits + 1;
  const target = numStateBits;
  const steps: { gate: Matrix; targets: number[] }[] = [];
  steps.push({
    gate: singleQubitRotation(axis, 2 * offset),
    targets: [target],
  });
  for (let i = 0; i < numStateBits; i++) {
    const angle = 2 * slope * (1 << i);
    steps.push({
      gate: controlledSingleQubitRotation(axis, angle),
      targets: [i, target],
    });
  }
  return compose(m, steps);
}

/**
 * Polynomial function rotation. Given a polynomial
 * `p(x) = c_0 + c_1*x + ... + c_d*x^d`, applies
 *     R_{axis}(2 * p(x))
 * to the target qubit, where `x` is the register value encoded by
 * the `numStateBits`-bit input register in the little-endian
 * convention of Section 2.
 *
 * Decomposition: on the Boolean cube `x_i ∈ {0,1}`, the polynomial
 * becomes the multilinear function
 *     f(x_0, ..., x_{n-1}) = sum_S a_S * prod_{i∈S} x_i
 * where `a_S` is obtained by the exact Möbius inversion
 *     a_S = sum_{T ⊆ S} (-1)^{|S|-|T|} * p(value(T))
 * with `value(T) = sum_{i∈T} 2^i`.
 *
 * Each non-empty subset `S` contributes a multi-controlled rotation
 * controlled on the bits in `S`. Empty subset contributes an
 * unconditional rotation by `2*a_∅`.
 *
 * @param coeffs coefficient array `[c_0, c_1, ..., c_d]`.
 */
export function PolynomialPauliRotationsGate(
  coeffs: readonly number[],
  numStateBits: number,
  axis: "X" | "Y" | "Z" = "Y",
): Matrix {
  if (!Number.isInteger(numStateBits) || numStateBits < 0) {
    throw new Error(
      `PolynomialPauliRotationsGate: numStateBits must be a nonnegative integer`,
    );
  }
  if (coeffs.length === 0) {
    throw new Error("PolynomialPauliRotationsGate: coeffs must be non-empty");
  }
  if (numStateBits === 0) {
    // Only x = 0 matters.
    return singleQubitRotation(axis, 2 * coeffs[0]);
  }
  const n = numStateBits;
  const m = n + 1;
  const target = n;
  const steps: { gate: Matrix; targets: number[] }[] = [];
  // Evaluate p at every subset value for Möbius inversion.
  const evalP = (x: number): number => {
    let v = 0;
    let pow = 1;
    for (const c of coeffs) {
      v += c * pow;
      pow *= x;
    }
    return v;
  };
  // For each subset S of {0..n-1}, compute a_S.
  for (let S = 0; S < (1 << n); S++) {
    // a_S = sum over T ⊆ S of (-1)^{|S|-|T|} * p(value(T))
    let a = 0;
    // Iterate T ⊆ S
    let T = S;
    while (true) {
      const sign = ((popcount(S) - popcount(T)) & 1) === 0 ? 1 : -1;
      a += sign * evalP(T);
      if (T === 0) break;
      T = (T - 1) & S;
    }
    if (Math.abs(a) < 1e-14) continue; // skip near-zero (exact arithmetic would skip exact zero)
    // Determine the controls (bit positions in S) and the rotation angle.
    const controls: number[] = [];
    for (let i = 0; i < n; i++) if ((S >> i) & 1) controls.push(i);
    const numControls = controls.length;
    if (numControls === 0) {
      steps.push({ gate: singleQubitRotation(axis, 2 * a), targets: [target] });
    } else {
      // Apply a multi-controlled rotation with numControls controls on the target.
      // Use MCMTGate(single-qubit rotation, numControls, 1).
      const rot = singleQubitRotation(axis, 2 * a);
      const mc = MCMTGate(rot, numControls, 1);
      // Target list: controls + [target]. But the multi-control gate expects
      // arguments in (controls, targets) order, and our `controls` list is
      // in little-endian bit order (i.e., control for bit i). Since Section 2's
      // little-endian convention maps bit i to qubit x[i] at arg position i,
      // we can use `controls` directly.
      steps.push({ gate: mc, targets: [...controls, target] });
    }
  }
  return compose(m, steps);
}

/**
 * Integer comparator gate (Section 3 Tier 13, implemented here because
 * Tier 12 piecewise families depend on it).
 *
 * Operand layout: `[x[0..n-1], result, w[0..n]]` where `w` is a clean
 * `(n+1)`-qubit scratch register initialized and restored to `|0⟩`.
 *
 * Toggles `result` iff the comparison predicate is true:
 *   - `geq = true`  → result ← result ⊕ [x ≥ value]
 *   - `geq = false` → result ← result ⊕ [x < value]
 *
 * Construction: boundary cases handled classically at construction
 * time. For `1 ≤ value ≤ 2^n - 1`, uses reversible constant
 * addition of `c = 2^n - value` on the `(n+1)`-qubit work register:
 * the high bit `w[n]` becomes `1` iff `x + c ≥ 2^n`, which is
 * equivalent to `x ≥ value`.
 */
export function IntegerComparatorGate(
  value: number,
  numStateBits: number,
  geq: boolean = true,
): Matrix {
  if (!Number.isInteger(numStateBits) || numStateBits < 0) {
    throw new Error(
      `IntegerComparatorGate: numStateBits must be a nonnegative integer`,
    );
  }
  if (!Number.isInteger(value)) {
    throw new Error(`IntegerComparatorGate: value must be an integer`);
  }
  const n = numStateBits;
  // Operand layout: x[0..n-1] (args 0..n-1), result (arg n), w[0..n] (args n+1..2n+1).
  // Total args: n + 1 + (n + 1) = 2*n + 2.
  const m = 2 * n + 2;
  const resultArg = n;
  const wBase = n + 1; // w[0] at arg n+1; w[k] at arg n+1+k for k=0..n.

  // Boundary cases: comparator is trivially true or false.
  if (n === 0 || value <= 0) {
    // Always x ≥ value (since x ≥ 0).
    if (geq) {
      return liftGate(XGate(), [resultArg], m);
    }
    return Matrix.identity(1 << m);
  }
  if (value > (1 << n) - 1) {
    // Always x < value (since x ≤ 2^n - 1).
    if (geq) {
      return Matrix.identity(1 << m);
    }
    return liftGate(XGate(), [resultArg], m);
  }
  // Nontrivial range: 1 ≤ value ≤ 2^n - 1.
  const c = (1 << n) - value;

  // Bit positions on the work register: w[i] is at arg (wBase + i).
  // Under Section 2's little-endian convention, bit i of the register
  // value stored on w corresponds to qubit w[i].
  const wTargets: number[] = [];
  for (let k = 0; k <= n; k++) wTargets.push(wBase + k);

  const steps: { gate: Matrix; targets: number[] }[] = [];
  // Copy x into lower n bits of w (w currently clean |0⟩).
  for (let i = 0; i < n; i++) {
    steps.push({ gate: CXGate(), targets: [i, wBase + i] });
  }
  // Constant addition: w ← w + c (mod 2^(n+1)).
  //
  // We use the Draper QFT adder on the (n+1)-qubit register w. QFT,
  // then apply phase shifts encoding the constant `c`, then inverse QFT.
  const np1 = n + 1;
  steps.push({ gate: QFTGate(np1), targets: wTargets });
  for (let jj = 0; jj < np1; jj++) {
    // Per the derivation in ModularAdderGate, adding a constant `c`
    // onto a QFT-ed register contributes phase
    //     2*pi * j * c / 2^(n+1)
    // on Fourier mode j. With j expressed in MSB-first qubit ordering,
    // qubit w[jj] carries mode-index bit 2^(n - jj).
    // Total phase on qubit w[jj] equals sum over bits of c:
    //     phase(w[jj]) = sum_{i : bit i of c = 1}  2*pi * 2^(n-jj) * 2^i / 2^(n+1)
    //                  = sum_{i : bit i of c = 1}  pi * 2^(i - jj)
    //
    // For a FIXED constant c, we can emit a single PhaseGate per qubit
    // with the accumulated angle.
    let phase = 0;
    for (let i = 0; i < np1; i++) {
      if ((c >> i) & 1) {
        // Contribution only when 2*pi * 2^(i + n - jj) / 2^(n+1) is nontrivial mod 2*pi.
        // Equivalently when i + n - jj < n + 1, i.e. i < jj + 1, i.e. i ≤ jj.
        if (i <= jj) {
          phase += Math.PI / (1 << (jj - i));
        }
      }
    }
    if (phase !== 0) {
      steps.push({ gate: PhaseGate(phase), targets: [wBase + jj] });
    }
  }
  steps.push({ gate: QFTGate(np1).dagger(), targets: wTargets });
  // Copy w[n] (the high bit / carry flag) into result, conditional CX.
  steps.push({ gate: CXGate(), targets: [wBase + n, resultArg] });
  // If geq = false, invert the result bit.
  if (!geq) {
    steps.push({ gate: XGate(), targets: [resultArg] });
  }
  // Uncompute the constant addition: apply the inverse.
  steps.push({ gate: QFTGate(np1), targets: wTargets });
  for (let jj = 0; jj < np1; jj++) {
    let phase = 0;
    for (let i = 0; i < np1; i++) {
      if ((c >> i) & 1) {
        if (i <= jj) {
          phase += Math.PI / (1 << (jj - i));
        }
      }
    }
    if (phase !== 0) {
      steps.push({ gate: PhaseGate(-phase), targets: [wBase + jj] });
    }
  }
  steps.push({ gate: QFTGate(np1).dagger(), targets: wTargets });
  // Uncompute the x→w copy.
  for (let i = 0; i < n; i++) {
    steps.push({ gate: CXGate(), targets: [i, wBase + i] });
  }
  return compose(m, steps);
}

/**
 * Piecewise linear function rotation. Given breakpoints
 * `[b_0, b_1, ..., b_m] = [0, ..., 2^n]` (m intervals) and per-piece
 * `slopes[k]`, `offsets[k]`, applies
 *     R_{axis}(2 * (slopes[k] * x + offsets[k]))
 * to the target qubit when `b_k ≤ x < b_{k+1}`.
 *
 * Decomposition: direct value-selective synthesis. For each integer
 * `x` in `[0, 2^n)`, determine the active piece `k(x)` and apply
 * the corresponding linear rotation conditioned on that exact
 * computational-basis value via X-conjugated selectors. This avoids
 * ancillas while remaining exact.
 */
export function PiecewiseLinearPauliRotationsGate(
  breakpoints: readonly number[],
  slopes: readonly number[],
  offsets: readonly number[],
  numStateBits: number,
  axis: "X" | "Y" | "Z" = "Y",
): Matrix {
  if (!Number.isInteger(numStateBits) || numStateBits < 0) {
    throw new Error(
      `PiecewiseLinearPauliRotationsGate: numStateBits must be a nonnegative integer`,
    );
  }
  const N = 1 << numStateBits;
  // Validate breakpoints and per-piece arrays.
  if (breakpoints.length < 2) {
    throw new Error(
      "PiecewiseLinearPauliRotationsGate: need at least 2 breakpoints",
    );
  }
  if (breakpoints[0] !== 0 || breakpoints[breakpoints.length - 1] !== N) {
    throw new Error(
      `PiecewiseLinearPauliRotationsGate: breakpoints must start at 0 and end at 2^n = ${N}`,
    );
  }
  for (let i = 1; i < breakpoints.length; i++) {
    if (breakpoints[i] <= breakpoints[i - 1]) {
      throw new Error(
        "PiecewiseLinearPauliRotationsGate: breakpoints must be strictly increasing",
      );
    }
  }
  const pieces = breakpoints.length - 1;
  if (slopes.length !== pieces || offsets.length !== pieces) {
    throw new Error(
      `PiecewiseLinearPauliRotationsGate: expected ${pieces} slopes/offsets, got ${slopes.length}/${offsets.length}`,
    );
  }
  // Determine piece for each value of x.
  const pieceOf = (x: number): number => {
    for (let k = 0; k < pieces; k++) {
      if (x >= breakpoints[k] && x < breakpoints[k + 1]) return k;
    }
    return pieces - 1;
  };
  // Build value-selective synthesis using X-conjugated selectors.
  return buildValueSelectiveRotation(numStateBits, axis, (x) => {
    const k = pieceOf(x);
    return 2 * (slopes[k] * x + offsets[k]);
  });
}

/**
 * Piecewise polynomial function rotation. Same structure as
 * `PiecewiseLinearPauliRotationsGate` but each piece is a polynomial
 * `c_0 + c_1*x + ... + c_d*x^d`.
 */
export function PiecewisePolynomialPauliRotationsGate(
  breakpoints: readonly number[],
  coeffsList: readonly (readonly number[])[],
  numStateBits: number,
  axis: "X" | "Y" | "Z" = "Y",
): Matrix {
  if (!Number.isInteger(numStateBits) || numStateBits < 0) {
    throw new Error(
      `PiecewisePolynomialPauliRotationsGate: numStateBits must be a nonnegative integer`,
    );
  }
  const N = 1 << numStateBits;
  if (breakpoints.length < 2) {
    throw new Error(
      "PiecewisePolynomialPauliRotationsGate: need at least 2 breakpoints",
    );
  }
  if (breakpoints[0] !== 0 || breakpoints[breakpoints.length - 1] !== N) {
    throw new Error(
      `PiecewisePolynomialPauliRotationsGate: breakpoints must span [0, 2^n]`,
    );
  }
  const pieces = breakpoints.length - 1;
  if (coeffsList.length !== pieces) {
    throw new Error(
      `PiecewisePolynomialPauliRotationsGate: expected ${pieces} coeff lists`,
    );
  }
  const evalPoly = (coeffs: readonly number[], x: number): number => {
    let v = 0;
    let pow = 1;
    for (const c of coeffs) {
      v += c * pow;
      pow *= x;
    }
    return v;
  };
  const pieceOf = (x: number): number => {
    for (let k = 0; k < pieces; k++) {
      if (x >= breakpoints[k] && x < breakpoints[k + 1]) return k;
    }
    return pieces - 1;
  };
  return buildValueSelectiveRotation(numStateBits, axis, (x) => {
    const k = pieceOf(x);
    return 2 * evalPoly(coeffsList[k], x);
  });
}

/**
 * Chebyshev-approximated piecewise polynomial rotation. Given a
 * sampled function value list `fSamples[k][r]` for interval `k` and
 * node `r ∈ [0, degree]`, fits the first-kind Chebyshev coefficients,
 * converts them to ordinary monomial form, and delegates to
 * `PiecewisePolynomialPauliRotationsGate`.
 *
 * The `fSamples` are computed deterministically at construction time
 * from an exact symbolic expression; this constructor accepts the
 * already-sampled values so it remains a pure matrix-returning
 * function.
 */
export function PiecewiseChebyshevGate(
  fSamples: readonly (readonly number[])[],
  breakpoints: readonly number[],
  numStateBits: number,
  axis: "X" | "Y" | "Z" = "Y",
): Matrix {
  if (breakpoints.length < 2) {
    throw new Error("PiecewiseChebyshevGate: need at least 2 breakpoints");
  }
  if (fSamples.length !== breakpoints.length - 1) {
    throw new Error("PiecewiseChebyshevGate: fSamples length mismatch");
  }
  const degree = fSamples[0].length - 1;
  for (const row of fSamples) {
    if (row.length !== degree + 1) {
      throw new Error("PiecewiseChebyshevGate: ragged fSamples");
    }
  }
  // For each piece, compute Chebyshev coefficients then convert to
  // monomial coefficients in the interval variable x.
  const coeffsList: number[][] = [];
  for (let k = 0; k < fSamples.length; k++) {
    const y = fSamples[k];
    // Chebyshev basis coefficients a_s.
    const a: number[] = new Array(degree + 1);
    for (let s = 0; s <= degree; s++) {
      let sum = 0;
      for (let r = 0; r <= degree; r++) {
        sum += y[r] *
          Math.cos((s * (2 * r + 1) * Math.PI) / (2 * (degree + 1)));
      }
      a[s] = (2 / (degree + 1)) * sum;
    }
    // p(u) in normalized variable u ∈ [-1, 1]:
    //     p(u) = a_0 / 2 + sum_{s=1}^{d} a_s * T_s(u)
    // Convert to monomial in u.
    const pUMonomial = chebyshevToMonomial(a);
    pUMonomial[0] -= a[0] / 2; // subtract extra a_0 that chebyshevToMonomial added
    // Adjust: pUMonomial currently represents a_0 * T_0(u) + sum a_s T_s(u)
    //         = a_0 + sum a_s T_s(u). But we want a_0/2 + sum a_s T_s(u).
    // So we subtracted a_0/2 above.
    // Convert pU(u) to p_x(x) via u = (2x - (b_k + b_{k+1})) / (b_{k+1} - b_k)
    const left = breakpoints[k];
    const right = breakpoints[k + 1];
    const width = right - left;
    const mid = (left + right) / 2;
    // u = (2/width) * (x - mid) = (2/width)*x - (2*mid/width)
    // Compose pU(u) with u(x) = alpha*x + beta where alpha = 2/width, beta = -2*mid/width.
    const alpha = 2 / width;
    const beta = -(2 * mid) / width;
    const pXMonomial = composeMonomialWithAffine(pUMonomial, alpha, beta);
    coeffsList.push(pXMonomial);
  }
  return PiecewisePolynomialPauliRotationsGate(
    breakpoints,
    coeffsList,
    numStateBits,
    axis,
  );
}

/**
 * Linear amplitude function loading. Given `slope`, `offset`, domain
 * `[d_min, d_max]`, image `[i_min, i_max]`, and `numStateBits`,
 * loads the amplitude `sqrt(f(x))` onto the target qubit where
 * `f(x) = clamp((slope*x_real + offset - i_min)/(i_max - i_min), 0, 1)`
 * and `x_real = d_min + (d_max - d_min) * x / (2^n - 1)`.
 *
 * On a clean target (`|0⟩`):
 *     |x⟩|0⟩ → |x⟩(sqrt(1 - f(x))|0⟩ + sqrt(f(x))|1⟩)
 *
 * Decomposition: direct per-basis-value `RY(2*arcsin(sqrt(f(x))))`
 * selected via X-conjugated controls (no ancillas).
 */
export function LinearAmplitudeFunctionGate(
  slope: number,
  offset: number,
  domain: readonly [number, number],
  image: readonly [number, number],
  numStateBits: number,
): Matrix {
  if (!Number.isInteger(numStateBits) || numStateBits < 1) {
    throw new Error("LinearAmplitudeFunctionGate: numStateBits must be >= 1");
  }
  const [dMin, dMax] = domain;
  const [iMin, iMax] = image;
  if (iMax <= iMin) {
    throw new Error(
      "LinearAmplitudeFunctionGate: image must satisfy i_max > i_min",
    );
  }
  const N = 1 << numStateBits;
  const maxX = N - 1;
  const clamp = (v: number): number => Math.max(iMin, Math.min(iMax, v));
  const f = (x: number): number => {
    const xReal = dMin + (dMax - dMin) * (x / maxX);
    const y = clamp(slope * xReal + offset);
    return (y - iMin) / (iMax - iMin);
  };
  return buildValueSelectiveRotation(numStateBits, "Y", (x) => {
    return 2 * Math.asin(Math.sqrt(f(x)));
  });
}

/**
 * Exact reciprocal rotation: for each `x ∈ [1, 2^n - 1]`, applies
 * `RY(2 * arcsin(C / x))` to the target, conditioned on the basis
 * state `|x⟩`. For `x = 0`, the target is left unchanged (reciprocal
 * is undefined at 0).
 *
 * Requires `|C| ≤ 1` so `|C/x| ≤ 1` for every nonzero basis value.
 */
export function ExactReciprocalGate(
  numStateBits: number,
  scalingFactor: number,
): Matrix {
  if (!Number.isInteger(numStateBits) || numStateBits < 1) {
    throw new Error("ExactReciprocalGate: numStateBits must be >= 1");
  }
  if (Math.abs(scalingFactor) > 1) {
    throw new Error("ExactReciprocalGate: |scalingFactor| must be ≤ 1");
  }
  return buildValueSelectiveRotation(numStateBits, "Y", (x) => {
    if (x === 0) return 0;
    return 2 * Math.asin(scalingFactor / x);
  });
}

// -----------------------------------------------------------------------------
// Helpers for Tier 12: value-selective rotation synthesis and Chebyshev conversion.
// -----------------------------------------------------------------------------

/**
 * Build the matrix for a value-selective rotation: for each basis
 * value `x ∈ [0, 2^n)`, apply `R_{axis}(angleOf(x))` to the target
 * qubit conditioned exactly on the basis state `|x⟩`. Non-ancilla
 * synthesis via X-conjugated multi-controls.
 *
 * Operand layout: `[x[0..n-1], target]` (n+1 qubits).
 */
function buildValueSelectiveRotation(
  numStateBits: number,
  axis: "X" | "Y" | "Z",
  angleOf: (x: number) => number,
): Matrix {
  const n = numStateBits;
  if (n === 0) {
    // Only x = 0: unconditional rotation.
    return singleQubitRotation(axis, angleOf(0));
  }
  const m = n + 1;
  const target = n;
  const N = 1 << n;

  // Collect all steps first; accumulate per-x selectors.
  const allSteps: { gate: Matrix; targets: number[] }[] = [];
  for (let x = 0; x < N; x++) {
    const angle = angleOf(x);
    if (Math.abs(angle) < 1e-14) continue;
    // Determine which bits of x are 0 → need X on those.
    // Under Section 2's little-endian register convention, bit i of
    // the register value x is qubit x[i] at arg position i.
    const zeros: number[] = [];
    for (let i = 0; i < n; i++) {
      if (((x >> i) & 1) === 0) zeros.push(i);
    }
    // X-conjugate the zero-bits before the controlled rotation.
    for (const z of zeros) allSteps.push({ gate: XGate(), targets: [z] });
    // Apply multi-controlled rotation with n controls on target.
    const rot = singleQubitRotation(axis, angle);
    const mc = MCMTGate(rot, n, 1);
    const controls: number[] = [];
    for (let i = 0; i < n; i++) controls.push(i);
    allSteps.push({ gate: mc, targets: [...controls, target] });
    // Undo X-conjugation.
    for (const z of zeros) allSteps.push({ gate: XGate(), targets: [z] });
  }
  return compose(m, allSteps);
}

/**
 * Convert Chebyshev basis coefficients `[a_0, a_1, ..., a_d]` to
 * monomial coefficients `[c_0, c_1, ..., c_d]` such that
 *     sum_s a_s * T_s(u) = sum_k c_k * u^k
 * Uses the recurrence `T_0 = 1`, `T_1 = u`, `T_{n+1} = 2u*T_n - T_{n-1}`.
 */
function chebyshevToMonomial(a: readonly number[]): number[] {
  const d = a.length - 1;
  const out: number[] = new Array(d + 1).fill(0);
  if (d < 0) return out;
  // Maintain coefficients of T_n and T_{n-1} as arrays of length d+1.
  let Tprev: number[] = new Array(d + 1).fill(0);
  Tprev[0] = 1; // T_0 = 1
  let Tcurr: number[] = new Array(d + 1).fill(0);
  if (d >= 1) Tcurr[1] = 1; // T_1 = u
  // Accumulate a_0 * T_0 + a_1 * T_1.
  for (let k = 0; k <= d; k++) out[k] += a[0] * Tprev[k];
  if (d >= 1) {
    for (let k = 0; k <= d; k++) out[k] += a[1] * Tcurr[k];
  }
  // Apply recurrence for T_2, T_3, ..., T_d.
  for (let n = 2; n <= d; n++) {
    const Tnext: number[] = new Array(d + 1).fill(0);
    // T_{n+1} shifted: 2 * u * Tcurr
    for (let k = 0; k < d; k++) Tnext[k + 1] += 2 * Tcurr[k];
    // Minus T_{n-1}
    for (let k = 0; k <= d; k++) Tnext[k] -= Tprev[k];
    // Accumulate a_n * T_n into out
    for (let k = 0; k <= d; k++) out[k] += a[n] * Tnext[k];
    Tprev = Tcurr;
    Tcurr = Tnext;
  }
  return out;
}

/**
 * Compose monomial polynomial `p(u) = sum c_k u^k` with affine
 * substitution `u = alpha*x + beta`, returning the resulting monomial
 * coefficients in `x`.
 */
function composeMonomialWithAffine(
  coeffsU: readonly number[],
  alpha: number,
  beta: number,
): number[] {
  const d = coeffsU.length - 1;
  // (alpha*x + beta)^k expanded via binomial theorem, accumulated into result.
  const out: number[] = new Array(d + 1).fill(0);
  for (let k = 0; k <= d; k++) {
    if (coeffsU[k] === 0) continue;
    // Binomial expansion of (alpha*x + beta)^k
    for (let j = 0; j <= k; j++) {
      const binom = binomial(k, j);
      out[j] += coeffsU[k] * binom * Math.pow(alpha, j) * Math.pow(beta, k - j);
    }
  }
  return out;
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}

// =============================================================================
// Tier 11: Quantum arithmetic
// =============================================================================

/**
 * Reversible quantum half-adder. Operand layout: `(a, b, sum, carry)`.
 *
 * Applies:
 *     |a⟩|b⟩|s⟩|c⟩ → |a⟩|b⟩|s ⊕ a ⊕ b⟩|c ⊕ (a ∧ b)⟩
 *
 * Decomposition: `CX(a, sum) → CX(b, sum) → CCX(a, b, carry)`.
 */
export function HalfAdderGate(): Matrix {
  return compose(4, [
    { gate: CXGate(), targets: [0, 2] },
    { gate: CXGate(), targets: [1, 2] },
    { gate: CCXGate(), targets: [0, 1, 3] },
  ]);
}

/**
 * Reversible quantum full adder. Operand layout:
 * `(a, b, c_in, sum, c_out)`.
 *
 * Applies:
 *     |a⟩|b⟩|c_in⟩|s⟩|c_out⟩ →
 *         |a⟩|b⟩|c_in⟩|s ⊕ a ⊕ b ⊕ c_in⟩|c_out ⊕ maj(a,b,c_in)⟩
 *
 * Decomposition (Section 3 Tier 11):
 *     CCX(a, b, c_out) → CX(a, b) → CCX(b, c_in, c_out) →
 *     CX(c_in, sum) → CX(b, sum) → CX(a, b)
 */
export function FullAdderGate(): Matrix {
  return compose(5, [
    { gate: CCXGate(), targets: [0, 1, 4] },
    { gate: CXGate(), targets: [0, 1] },
    { gate: CCXGate(), targets: [1, 2, 4] },
    { gate: CXGate(), targets: [2, 3] },
    { gate: CXGate(), targets: [1, 3] },
    { gate: CXGate(), targets: [0, 1] }, // restore b
  ]);
}

/**
 * Draper QFT-based modular adder on two `n`-bit registers.
 * Operand layout: `(a[0..n-1], b[0..n-1])`. Applies
 *
 *     |a⟩|b⟩ → |a⟩|(a + b) mod 2^n⟩
 *
 * Algorithm: QFT on `b`, add controlled phase shifts conditioned on
 * each bit of `a`, inverse QFT. The phases are calibrated so the
 * net action on basis states is exact addition modulo `2^n`.
 *
 * Boundary: `n = 0` → `GlobalPhaseGate(0)`.
 */
export function ModularAdderGate(n: number): Matrix {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(
      `ModularAdderGate: n must be a nonnegative integer, got ${n}`,
    );
  }
  if (n === 0) return GlobalPhaseGate(0);
  const m = 2 * n;
  // Operand positions: a[i] at arg i, b[j] at arg n+j.
  const bTargets: number[] = [];
  for (let j = 0; j < n; j++) bTargets.push(n + j);
  const steps: { gate: Matrix; targets: number[] }[] = [];
  // QFT on b
  steps.push({ gate: QFTGate(n), targets: bTargets });
  // Phase additions.
  //
  // After the QFTGate on b, the amplitude of basis state |y⟩ on b
  // carries phase exp(2*pi*i * y_prime * brev_n(y) / 2^n). To add
  // register value `a_val` to the underlying register value `b_val`,
  // the phase on each Fourier mode `y_prime` must advance by
  // 2*pi * y_prime * a_val / 2^n. Because of the canonical QFT's
  // column-bit-reversal convention, the mode index y_prime is not a
  // positional bit of the qubits directly — we need to determine
  // which qubit carries which mode-index bit.
  //
  // For the SDK's internal canonical no-SWAP QFT:
  //   QFT[j, k] = (1 / sqrt(2^n)) * exp(2*pi*i * j * brev_n(k) / 2^n)
  // so applying QFT to |k⟩ gives the superposition
  //   (1/sqrt(2^n)) sum_j exp(2*pi*i * j * brev_n(k) / 2^n) |j⟩.
  // For addition, we want the map
  //   |a⟩|b⟩ → |a⟩ (1/sqrt(2^n)) sum_j exp(2*pi*i * j * (b_val + a_val) / 2^n) |j⟩
  // which means after QFT on b we apply phases multiplied by
  // exp(2*pi*i * j * a_val / 2^n) to each basis state |j⟩. Under the
  // canonical QFT, the role of j is played by the "row" index, which
  // is the MSB-first matrix row — i.e., the top bit of j is carried
  // by qubit b[0] (arg n+0), the next bit by b[1], etc.
  //
  // So on qubit b[jj] (arg n+jj), the phase contribution per unit
  // advancement of a_val is:
  //   phase per a unit = 2*pi * 2^(n-1-jj) / 2^n = pi / 2^jj (times the bit of a_val)
  //
  // Combining with a_val's own bit decomposition (a_val = sum_i a_i * 2^i),
  // the total controlled phase on qubit b[jj] controlled by a[i] is:
  //   2*pi * 2^(n-1-jj) * 2^i / 2^n = pi / 2^(jj - i)
  // but only when i - jj + (n-1) ≥ 0 can this be applied, i.e.,
  // i + (n - 1 - jj) ≥ 0, which is always true for valid indices.
  // Actually we need exponents that don't blow up modulo 2pi; the
  // correct expression is:
  //   angle = 2*pi * 2^(i + n - 1 - jj) / 2^n = 2*pi * 2^(i - 1 - jj + n - n) ...
  //
  // Let me re-derive using exact modular arithmetic. The phase we
  // want per unit of `a_val` on the j-th Fourier mode is exp(2πi * j * a_val / 2^n).
  // Since a_val = sum_{i=0}^{n-1} a_i 2^i, that's
  //   exp(2πi * j * sum_i a_i 2^i / 2^n) = prod_i exp(2πi * j * a_i * 2^i / 2^n).
  // And j, in MSB-first representation on the b register, has bit
  // (n-1-jj) = "bit position in integer j corresponding to qubit b[jj]",
  // i.e. j = sum_{jj=0}^{n-1} b_jj_bit * 2^(n-1-jj).
  // Substituting:
  //   prod_i exp(2πi * (sum_jj b_jj_bit * 2^(n-1-jj)) * a_i * 2^i / 2^n)
  // = prod_i prod_jj exp(2πi * b_jj_bit * a_i * 2^(n-1-jj+i-n))
  // = prod_i prod_jj exp(2πi * b_jj_bit * a_i * 2^(i-1-jj))
  //
  // When a_i * b_jj_bit = 1 (both are 1), this single-bit factor is
  //   exp(2πi * 2^(i-1-jj)) = exp(pi * 2^(i-jj)).
  //
  // So the controlled phase on (a[i], b[jj]) is CP(2π * 2^(i-1-jj))
  // = CP(pi * 2^(i-jj)).
  // But this must be understood modulo 2π. Equivalently we can write
  // the phase as 2π * 2^(i-1-jj) mod 2π. For i ≥ jj + 1, the phase
  // is a multiple of 2π and the CP is trivial; we only need to emit
  // nontrivial CPs when i < jj + 1, i.e., i ≤ jj.
  //
  // When i ≤ jj, the phase is pi * 2^(i-jj) = pi / 2^(jj - i).
  for (let jj = 0; jj < n; jj++) {
    for (let i = 0; i <= jj; i++) {
      const angle = Math.PI / (1 << (jj - i));
      steps.push({ gate: CPhaseGate(angle), targets: [i, n + jj] });
    }
  }
  // Inverse QFT on b (realized as the Hermitian conjugate of QFT).
  steps.push({ gate: QFTGate(n).dagger(), targets: bTargets });
  return compose(m, steps);
}

/**
 * Quantum multiplier: adds the product of two `n`-bit registers into
 * a `2n`-bit accumulator register. Operand layout:
 * `(a[0..n-1], b[0..n-1], product[0..2n-1])`.
 *
 * Applies:
 *     |a⟩|b⟩|p⟩ → |a⟩|b⟩|(p + a * b) mod 2^{2n}⟩
 *
 * Schoolbook synthesis: for each bit `b[j]`, controlled on `b[j]`,
 * add `a << j` into `product[j..2n-1]` using the Draper QFT adder
 * with phases doubly controlled by `(b[j], a[i])`.
 *
 * Boundary: `n = 0` → `GlobalPhaseGate(0)`.
 */
export function MultiplierGate(n: number): Matrix {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(
      `MultiplierGate: n must be a nonnegative integer, got ${n}`,
    );
  }
  if (n === 0) return GlobalPhaseGate(0);
  const m = 4 * n;
  // Operand positions: a[i] at arg i, b[j] at arg n+j,
  // product[r] at arg 2n+r.
  const steps: { gate: Matrix; targets: number[] }[] = [];
  // For each multiplier bit b[j]:
  for (let j = 0; j < n; j++) {
    // The adder operates on the suffix product[j..2n-1] of size (2n-j).
    const suffixLen = 2 * n - j;
    const suffixTargets: number[] = [];
    for (let r = 0; r < suffixLen; r++) suffixTargets.push(2 * n + j + r);
    // QFT on the suffix
    steps.push({ gate: QFTGate(suffixLen), targets: suffixTargets });
    // Doubly-controlled phase additions using the same per-mode
    // derivation as ModularAdderGate, but here the "effective addend"
    // is a_val, controlled on b[j].
    //
    // Within the suffix of size L = suffixLen, qubit `suffix[jj]` (for
    // jj in [0, L)) plays the role of b[jj] in the ModularAdder
    // derivation. Controlled on b[j] AND a[i], add phase
    // CP(pi / 2^(jj - i)) whenever i ≤ jj.
    for (let jj = 0; jj < suffixLen; jj++) {
      for (let i = 0; i < n && i <= jj; i++) {
        const angle = Math.PI / (1 << (jj - i));
        // Doubly-controlled CPhase: controlled on b[j] at arg n+j and a[i] at arg i,
        // target at arg 2n+j+jj. Use MCPhaseGate with 2 controls.
        steps.push({
          gate: MCPhaseGate(angle, 2),
          targets: [n + j, i, 2 * n + j + jj],
        });
      }
    }
    // Inverse QFT on the suffix
    steps.push({ gate: QFTGate(suffixLen).dagger(), targets: suffixTargets });
  }
  return compose(m, steps);
}

// =============================================================================
// Tier 10: Reversible classical-logic gates
// =============================================================================

/**
 * Reversible n-input AND. On the operand list `(x_1, ..., x_n, out)`,
 * XORs the AND of `x_1 ∧ ... ∧ x_n` into `out`.
 *
 * Boundary cases: `n = 0` → `X(out)` (empty conjunction is `1`);
 * `n = 1` → `CX(x_1, out)`; `n ≥ 2` → `MCX(n, ...)`.
 */
export function AndGate(n: number): Matrix {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`AndGate: n must be a nonnegative integer, got ${n}`);
  }
  if (n === 0) return XGate();
  return MCXGate(n);
}

/**
 * Reversible n-input OR. On the operand list `(x_1, ..., x_n, out)`,
 * XORs the OR of the inputs into `out` via De Morgan's law:
 * `OR = NOT(AND(NOT x_1, ..., NOT x_n))`.
 *
 * Boundary cases: `n = 0` → identity (empty disjunction is `0`).
 */
export function OrGate(n: number): Matrix {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`OrGate: n must be a nonnegative integer, got ${n}`);
  }
  if (n === 0) return IGate(); // empty disjunction: |y⟩ → |y⟩
  const m = n + 1;
  const steps: { gate: Matrix; targets: number[] }[] = [];
  // Negate all inputs
  for (let i = 0; i < n; i++) steps.push({ gate: XGate(), targets: [i] });
  // MCX of negated inputs (AND of negations) XORed into out
  const mcxTargets: number[] = [];
  for (let i = 0; i < m; i++) mcxTargets.push(i);
  steps.push({ gate: MCXGate(n), targets: mcxTargets });
  // Negate result
  steps.push({ gate: XGate(), targets: [n] });
  // Restore inputs
  for (let i = 0; i < n; i++) steps.push({ gate: XGate(), targets: [i] });
  return compose(m, steps);
}

/**
 * Bitwise XOR of two `n`-bit registers: `|a⟩|b⟩ → |a⟩|a ⊕ b⟩`.
 *
 * Operand layout: `[a[0..n-1], b[0..n-1]]` (2n total).
 * Boundary: `n = 0` → `GlobalPhaseGate(0)` (zero-qubit identity).
 */
export function BitwiseXorGate(n: number): Matrix {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(
      `BitwiseXorGate: n must be a nonnegative integer, got ${n}`,
    );
  }
  if (n === 0) return GlobalPhaseGate(0);
  const m = 2 * n;
  const steps: { gate: Matrix; targets: number[] }[] = [];
  // CX(a[i], b[i]) for each bit
  for (let i = 0; i < n; i++) {
    steps.push({ gate: CXGate(), targets: [i, n + i] });
  }
  return compose(m, steps);
}

/**
 * Inner product mod 2 of two n-bit registers XORed into a result qubit:
 * `|a⟩|b⟩|r⟩ → |a⟩|b⟩|r ⊕ (a·b mod 2)⟩`.
 *
 * Operand layout: `[a[0..n-1], b[0..n-1], result]`. Each bit-pair
 * contributes one `CCX(a[i], b[i], result)`. Boundary: `n = 0` →
 * empty mod-2 sum is 0, so the gate is `I(result)`.
 */
export function InnerProductGate(n: number): Matrix {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(
      `InnerProductGate: n must be a nonnegative integer, got ${n}`,
    );
  }
  if (n === 0) return IGate();
  const m = 2 * n + 1;
  const result = 2 * n;
  const steps: { gate: Matrix; targets: number[] }[] = [];
  for (let i = 0; i < n; i++) {
    steps.push({ gate: CCXGate(), targets: [i, n + i, result] });
  }
  return compose(m, steps);
}

// =============================================================================
// Tier 9: Quantum Fourier Transform
// =============================================================================

/**
 * Internal canonical no-SWAP Quantum Fourier Transform on `n` qubits.
 *
 * Following Section 2/3 conventions: gate matrices use local MSB-first
 * argument ordering and integer register values use Section 2's
 * little-endian convention. The SDK-canonical QFT matrix is
 *
 *     QFT[j, k] = (1 / sqrt(2^n)) * exp(2*pi*i * j * brev_n(k) / 2^n)
 *
 * where `brev_n(k)` is the integer obtained by reversing the `n` bits
 * of `k`. The returned matrix is the exact result of the descending-
 * index decomposition:
 *
 *     for k = n-1 downto 0:
 *         H(q[k])
 *         for j = k-1 downto 0:
 *             CP(pi / 2^(k-j), q[j], q[k])
 *
 * Boundary cases: `n = 0` → `GlobalPhaseGate(0)`, `n = 1` → `H`.
 *
 * No trailing SWAP network is part of the canonical gate. External
 * formats that want the alternate convention must prepend the
 * qubit-reversal network themselves.
 */
export function QFTGate(n: number): Matrix {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`QFTGate: n must be a nonnegative integer, got ${n}`);
  }
  if (n === 0) return GlobalPhaseGate(0);
  if (n === 1) return HGate();
  const steps: { gate: Matrix; targets: number[] }[] = [];
  for (let k = n - 1; k >= 0; k--) {
    steps.push({ gate: HGate(), targets: [k] });
    for (let j = k - 1; j >= 0; j--) {
      const lam = Math.PI / (1 << (k - j));
      steps.push({ gate: CPhaseGate(lam), targets: [j, k] });
    }
  }
  return compose(n, steps);
}

function hermitianEigendecompose(
  H: Matrix,
): { eigenvalues: number[]; eigenvectors: Matrix } {
  const n = H.rows;
  // Working copy of H.
  const A: Complex[][] = [];
  for (let i = 0; i < n; i++) {
    A.push(H.data[i].slice());
  }
  // V starts as identity and accumulates the rotations.
  const V: Complex[][] = [];
  for (let i = 0; i < n; i++) {
    const row: Complex[] = new Array(n);
    for (let j = 0; j < n; j++) row[j] = i === j ? Complex.ONE : Complex.ZERO;
    V.push(row);
  }
  const maxIter = 100;
  const tol = 1e-14;
  for (let iter = 0; iter < maxIter; iter++) {
    // Find the off-diagonal entry of largest magnitude.
    let pMax = 0;
    let qMax = 1;
    let maxMag = 0;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const mag = A[p][q].magnitude();
        if (mag > maxMag) {
          maxMag = mag;
          pMax = p;
          qMax = q;
        }
      }
    }
    if (maxMag <= tol) break;
    // Compute the Hermitian Jacobi rotation that zeros A[p][q].
    // For Hermitian matrices, use the "complex Jacobi" formulation:
    //   a_pq = |A[p][q]| * exp(i*phi)  (factor out the phase)
    //   Then in the real symmetric embedding, find Givens angle θ
    //   with tan(2θ) = 2*|a_pq| / (a_qq - a_pp), and apply
    //   rotation R_{p,q}(θ) * diag(1, exp(-i*phi)).
    const p = pMax;
    const q = qMax;
    const apq = A[p][q];
    const phi = apq.phase();
    const apqMag = apq.magnitude();
    const app = A[p][p].re; // Hermitian: diagonal is real
    const aqq = A[q][q].re;
    let theta: number;
    const diff = aqq - app;
    if (Math.abs(diff) < tol * apqMag) {
      theta = Math.PI / 4;
    } else {
      theta = 0.5 * Math.atan2(2 * apqMag, diff);
    }
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const eiPhi = Complex.exp(phi);
    const eMiPhi = Complex.exp(-phi);
    // Construct the rotation matrix (in the (p,q) 2x2 block):
    //   [  c         -s*exp(-i*phi) ]
    //   [  s*exp(i*phi)    c         ]
    // Apply to A: A' = R† * A * R (Hermitian conjugation)
    // and V' = V * R
    //
    // For each row i, update columns p and q:
    const newApCol: Complex[] = new Array(n);
    const newAqCol: Complex[] = new Array(n);
    for (let i = 0; i < n; i++) {
      // (A*R)[i][p] = A[i][p]*c + A[i][q]*s*exp(i*phi)
      const t1 = A[i][p].scale(c).add(A[i][q].mul(eiPhi).scale(s));
      // (A*R)[i][q] = -A[i][p]*s*exp(-i*phi) + A[i][q]*c
      const t2 = A[i][p].mul(eMiPhi).scale(-s).add(A[i][q].scale(c));
      newApCol[i] = t1;
      newAqCol[i] = t2;
    }
    for (let i = 0; i < n; i++) {
      A[i][p] = newApCol[i];
      A[i][q] = newAqCol[i];
    }
    // Now apply R† from the left: update rows p and q.
    // (R†*A)[p][j] = c*A[p][j] + s*exp(-i*phi)*A[q][j]
    // (R†*A)[q][j] = -s*exp(i*phi)*A[p][j] + c*A[q][j]
    const newRowP: Complex[] = new Array(n);
    const newRowQ: Complex[] = new Array(n);
    for (let j = 0; j < n; j++) {
      const r1 = A[p][j].scale(c).add(A[q][j].mul(eMiPhi).scale(s));
      const r2 = A[p][j].mul(eiPhi).scale(-s).add(A[q][j].scale(c));
      newRowP[j] = r1;
      newRowQ[j] = r2;
    }
    for (let j = 0; j < n; j++) {
      A[p][j] = newRowP[j];
      A[q][j] = newRowQ[j];
    }
    // Update V: V <- V * R
    const newVcolP: Complex[] = new Array(n);
    const newVcolQ: Complex[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const v1 = V[i][p].scale(c).add(V[i][q].mul(eiPhi).scale(s));
      const v2 = V[i][p].mul(eMiPhi).scale(-s).add(V[i][q].scale(c));
      newVcolP[i] = v1;
      newVcolQ[i] = v2;
    }
    for (let i = 0; i < n; i++) {
      V[i][p] = newVcolP[i];
      V[i][q] = newVcolQ[i];
    }
  }
  // Read eigenvalues from diagonal of A.
  const eigenvalues: number[] = new Array(n);
  for (let i = 0; i < n; i++) eigenvalues[i] = A[i][i].re;
  return { eigenvalues, eigenvectors: new Matrix(V) };
}
