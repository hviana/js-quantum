/**
 * @module gates
 * Quantum gate matrix definitions.
 *
 * All standard quantum gates are defined here as matrix constructors.
 * Each gate returns a {@link Matrix} representing its unitary operation.
 * Parameterized gates (e.g., RX, RZ, U) accept rotation angles.
 *
 * Gate matrices follow the conventions of IBM Qiskit.
 *
 * @author Henrique Emanoel Viana
 * @license MIT
 */

import { Complex } from "./complex.ts";
import { Matrix } from "./matrix.ts";

const SQRT2_INV = 1 / Math.sqrt(2);

// ─── Single-Qubit Gates ──────────────────────────────────────────────

/**
 * Hadamard gate.
 *
 * Creates an equal superposition from a basis state:
 * H|0⟩ = (|0⟩+|1⟩)/√2, H|1⟩ = (|0⟩-|1⟩)/√2.
 *
 * Matrix: (1/√2) [[1, 1], [1, -1]]
 */
export function hadamard(): Matrix {
  const s = SQRT2_INV;
  return new Matrix(2, 2, [
    [new Complex(s), new Complex(s)],
    [new Complex(s), new Complex(-s)],
  ]);
}

/**
 * Pauli-X gate (NOT / bit-flip).
 *
 * Flips |0⟩ ↔ |1⟩. Equivalent to a classical NOT.
 *
 * Matrix: [[0, 1], [1, 0]]
 */
export function pauliX(): Matrix {
  return new Matrix(2, 2, [
    [Complex.ZERO, Complex.ONE],
    [Complex.ONE, Complex.ZERO],
  ]);
}

/**
 * Pauli-Y gate.
 *
 * Applies both a bit-flip and a phase-flip.
 *
 * Matrix: [[0, -i], [i, 0]]
 */
export function pauliY(): Matrix {
  return new Matrix(2, 2, [
    [Complex.ZERO, Complex.MINUS_I],
    [Complex.I, Complex.ZERO],
  ]);
}

/**
 * Pauli-Z gate (phase-flip).
 *
 * Flips the phase of |1⟩: Z|1⟩ = -|1⟩.
 *
 * Matrix: [[1, 0], [0, -1]]
 */
export function pauliZ(): Matrix {
  return new Matrix(2, 2, [
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.MINUS_ONE],
  ]);
}

/**
 * Identity gate.
 *
 * Does nothing — a no-op on a qubit.
 *
 * Matrix: [[1, 0], [0, 1]]
 */
export function identity(): Matrix {
  return Matrix.identity(2);
}

// ─── Phase Gates ─────────────────────────────────────────────────────

/**
 * S gate (√Z / Phase-π/2).
 *
 * Applies a π/2 phase to |1⟩.
 *
 * Matrix: [[1, 0], [0, i]]
 */
export function sGate(): Matrix {
  return new Matrix(2, 2, [
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.I],
  ]);
}

/**
 * S† (S-dagger) gate.
 *
 * The inverse of the S gate; applies a -π/2 phase to |1⟩.
 *
 * Matrix: [[1, 0], [0, -i]]
 */
export function sdgGate(): Matrix {
  return new Matrix(2, 2, [
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.MINUS_I],
  ]);
}

/**
 * T gate (√S / Phase-π/4).
 *
 * Applies a π/4 phase to |1⟩.
 *
 * Matrix: [[1, 0], [0, e^(iπ/4)]]
 */
export function tGate(): Matrix {
  return new Matrix(2, 2, [
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.exp(Math.PI / 4)],
  ]);
}

/**
 * T† (T-dagger) gate.
 *
 * The inverse of the T gate; applies a -π/4 phase to |1⟩.
 *
 * Matrix: [[1, 0], [0, e^(-iπ/4)]]
 */
export function tdgGate(): Matrix {
  return new Matrix(2, 2, [
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.exp(-Math.PI / 4)],
  ]);
}

/**
 * Phase gate P(λ).
 *
 * Applies a phase rotation λ to |1⟩.
 *
 * Matrix: [[1, 0], [0, e^(iλ)]]
 *
 * @param lambda - The phase angle in radians.
 */
export function phaseGate(lambda: number): Matrix {
  return new Matrix(2, 2, [
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.exp(lambda)],
  ]);
}

// ─── Rotation Gates ──────────────────────────────────────────────────

/**
 * RZ gate — rotation around the Z-axis.
 *
 * Matrix: [[e^(-iλ/2), 0], [0, e^(iλ/2)]]
 *
 * @param lambda - Rotation angle in radians.
 */
export function rzGate(lambda: number): Matrix {
  return new Matrix(2, 2, [
    [Complex.exp(-lambda / 2), Complex.ZERO],
    [Complex.ZERO, Complex.exp(lambda / 2)],
  ]);
}

/**
 * RX gate — rotation around the X-axis.
 *
 * Matrix: [[cos(θ/2), -i·sin(θ/2)], [-i·sin(θ/2), cos(θ/2)]]
 *
 * @param theta - Rotation angle in radians.
 */
export function rxGate(theta: number): Matrix {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return new Matrix(2, 2, [
    [new Complex(c), new Complex(0, -s)],
    [new Complex(0, -s), new Complex(c)],
  ]);
}

// ─── √X Gates ────────────────────────────────────────────────────────

/**
 * SX gate (√X).
 *
 * The square root of the Pauli-X gate: SX² = X.
 *
 * Matrix: (1/2) [[1+i, 1-i], [1-i, 1+i]]
 */
export function sxGate(): Matrix {
  return new Matrix(2, 2, [
    [new Complex(0.5, 0.5), new Complex(0.5, -0.5)],
    [new Complex(0.5, -0.5), new Complex(0.5, 0.5)],
  ]);
}

/**
 * SX† (SX-dagger) gate.
 *
 * The inverse of the SX gate.
 *
 * Matrix: (1/2) [[1-i, 1+i], [1+i, 1-i]]
 */
export function sxdgGate(): Matrix {
  return new Matrix(2, 2, [
    [new Complex(0.5, -0.5), new Complex(0.5, 0.5)],
    [new Complex(0.5, 0.5), new Complex(0.5, -0.5)],
  ]);
}

// ─── General Unitary Gate ────────────────────────────────────────────

/**
 * U gate — the general single-qubit unitary.
 *
 * Any single-qubit gate can be expressed as U(θ, φ, λ).
 *
 * Matrix:
 * ```
 * [[ cos(θ/2),          -e^(iλ)·sin(θ/2)     ],
 *  [ e^(iφ)·sin(θ/2),    e^(i(φ+λ))·cos(θ/2) ]]
 * ```
 *
 * @param theta - Polar angle θ.
 * @param phi - Azimuthal angle φ.
 * @param lambda - Phase angle λ.
 */
export function uGate(theta: number, phi: number, lambda: number): Matrix {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return new Matrix(2, 2, [
    [
      new Complex(c),
      Complex.exp(lambda).scale(-s),
    ],
    [
      Complex.exp(phi).scale(s),
      Complex.exp(phi + lambda).scale(c),
    ],
  ]);
}

// ─── Two-Qubit Gates ─────────────────────────────────────────────────

/**
 * CNOT (CX) gate — controlled NOT.
 *
 * Flips the target qubit if the control qubit is |1⟩.
 * Acts on a 2-qubit system (control ⊗ target).
 *
 * Matrix (4×4):
 * ```
 * [[1, 0, 0, 0],
 *  [0, 1, 0, 0],
 *  [0, 0, 0, 1],
 *  [0, 0, 1, 0]]
 * ```
 */
export function cnotGate(): Matrix {
  const O = Complex.ZERO;
  const I = Complex.ONE;
  return new Matrix(4, 4, [
    [I, O, O, O],
    [O, I, O, O],
    [O, O, O, I],
    [O, O, I, O],
  ]);
}

/**
 * SWAP gate.
 *
 * Swaps the states of two qubits.
 *
 * Matrix (4×4):
 * ```
 * [[1, 0, 0, 0],
 *  [0, 0, 1, 0],
 *  [0, 1, 0, 0],
 *  [0, 0, 0, 1]]
 * ```
 */
export function swapGate(): Matrix {
  const O = Complex.ZERO;
  const I = Complex.ONE;
  return new Matrix(4, 4, [
    [I, O, O, O],
    [O, O, I, O],
    [O, I, O, O],
    [O, O, O, I],
  ]);
}

/**
 * RXX gate — XX interaction (Ising coupling).
 *
 * Implements exp(-i·θ/2 · X⊗X).
 *
 * @param theta - Rotation angle in radians.
 */
export function rxxGate(theta: number): Matrix {
  const c = new Complex(Math.cos(theta / 2));
  const is = new Complex(0, -Math.sin(theta / 2));
  const O = Complex.ZERO;
  return new Matrix(4, 4, [
    [c, O, O, is],
    [O, c, is, O],
    [O, is, c, O],
    [is, O, O, c],
  ]);
}

/**
 * RZZ gate — ZZ interaction (Ising coupling).
 *
 * Implements exp(-i·θ/2 · Z⊗Z).
 *
 * @param theta - Rotation angle in radians.
 */
export function rzzGate(theta: number): Matrix {
  const O = Complex.ZERO;
  const ePos = Complex.exp(theta / 2);
  const eNeg = Complex.exp(-theta / 2);
  return new Matrix(4, 4, [
    [eNeg, O, O, O],
    [O, ePos, O, O],
    [O, O, ePos, O],
    [O, O, O, eNeg],
  ]);
}

// ─── Three-Qubit Gates ───────────────────────────────────────────────

/**
 * Toffoli (CCX) gate — doubly-controlled NOT.
 *
 * Flips the target qubit only when both control qubits are |1⟩.
 *
 * Returns an 8×8 matrix acting on a 3-qubit system.
 */
export function toffoliGate(): Matrix {
  const n = 8;
  const data = Matrix.zeros(n, n);
  // Identity on all states except |110⟩ ↔ |111⟩
  for (let i = 0; i < n; i++) {
    data[i]![i] = Complex.ONE;
  }
  // Swap |110⟩ (6) and |111⟩ (7)
  data[6]![6] = Complex.ZERO;
  data[7]![7] = Complex.ZERO;
  data[6]![7] = Complex.ONE;
  data[7]![6] = Complex.ONE;
  return new Matrix(n, n, data);
}

/**
 * RCCX gate — simplified (relative-phase) Toffoli.
 *
 * Has the same truth table as the Toffoli but with a relative phase
 * on some computational basis states. Uses fewer elementary gates.
 *
 * Returns an 8×8 matrix acting on a 3-qubit system (q0, q1, q2).
 * q0, q1 are controls; q2 is the target.
 */
export function rccxGate(): Matrix {
  // Build by decomposition into elementary gates applied to 3-qubit state
  // rccx is: H(q2) T(q2) CX(q1,q2) Tdg(q2) CX(q0,q2) T(q2) CX(q1,q2) Tdg(q2) H(q2)
  const n = 8;
  let state = Matrix.identity(n);

  const applyOnTarget = (gate: Matrix): Matrix => {
    // Apply single-qubit gate to qubit 2 (target, least significant)
    return Matrix.identity(4).tensor(gate);
  };

  const cxControlTarget = (ctrl: number, tgt: number): Matrix => {
    // Build CX gate on 3-qubit space
    const mat = Matrix.zeros(n, n);
    for (let i = 0; i < n; i++) {
      const ctrlBit = (i >> (2 - ctrl)) & 1;
      if (ctrlBit === 1) {
        const flipped = i ^ (1 << (2 - tgt));
        mat[i]![flipped] = Complex.ONE;
      } else {
        mat[i]![i] = Complex.ONE;
      }
    }
    return new Matrix(n, n, mat);
  };

  const H = hadamard();
  const T = tGate();
  const Td = tdgGate();

  state = state.multiply(applyOnTarget(H));
  state = state.multiply(applyOnTarget(T));
  state = state.multiply(cxControlTarget(1, 2));
  state = state.multiply(applyOnTarget(Td));
  state = state.multiply(cxControlTarget(0, 2));
  state = state.multiply(applyOnTarget(T));
  state = state.multiply(cxControlTarget(1, 2));
  state = state.multiply(applyOnTarget(Td));
  state = state.multiply(applyOnTarget(H));

  return state;
}

// ─── Four-Qubit Gates ────────────────────────────────────────────────

/**
 * RC3X gate — relative-phase 3-controlled X.
 *
 * Implements a 3-controlled X gate up to a relative phase.
 * Acts on a 4-qubit system (q0, q1, q2 are controls; q3 is target).
 *
 * Returns a 16×16 matrix.
 */
export function rc3xGate(): Matrix {
  const n = 16;
  // Decomposition based on Qiskit's rc3x implementation.
  // Uses rccx sub-routines and single-qubit gates.
  // For correctness, we build the matrix by applying the gate sequence:
  // The rc3x decomposes into: rccx(q0,q1,q2) followed by controlled operations
  // on q2->q3 and adjustments.

  // Build by matrix composition on 4-qubit state space
  let state = Matrix.identity(n);

  const singleQubitOnTarget = (gate: Matrix, qubit: number): Matrix => {
    // Apply single-qubit gate to specific qubit in 4-qubit space
    // qubit ordering: q0(bit3), q1(bit2), q2(bit1), q3(bit0)
    const matrices: Matrix[] = [];
    for (let i = 0; i < 4; i++) {
      matrices.push(i === qubit ? gate : Matrix.identity(2));
    }
    let result = matrices[0]!;
    for (let i = 1; i < 4; i++) {
      result = result.tensor(matrices[i]!);
    }
    return result;
  };

  const cxOn4 = (ctrl: number, tgt: number): Matrix => {
    const mat = Matrix.zeros(n, n);
    for (let i = 0; i < n; i++) {
      const ctrlBit = (i >> (3 - ctrl)) & 1;
      if (ctrlBit === 1) {
        const flipped = i ^ (1 << (3 - tgt));
        mat[i]![flipped] = Complex.ONE;
      } else {
        mat[i]![i] = Complex.ONE;
      }
    }
    return new Matrix(n, n, mat);
  };

  const H = hadamard();
  const T = tGate();
  const Td = tdgGate();

  // Qiskit rc3x decomposition:
  state = state.multiply(singleQubitOnTarget(H, 3));
  state = state.multiply(singleQubitOnTarget(T, 3));
  state = state.multiply(cxOn4(2, 3));
  state = state.multiply(singleQubitOnTarget(Td, 3));
  state = state.multiply(singleQubitOnTarget(H, 3));
  // CX(q0, q1) controlled rccx-like middle section
  state = state.multiply(cxOn4(0, 3));
  state = state.multiply(singleQubitOnTarget(T, 3));
  state = state.multiply(cxOn4(1, 3));
  state = state.multiply(singleQubitOnTarget(Td, 3));
  state = state.multiply(cxOn4(0, 3));
  state = state.multiply(singleQubitOnTarget(T, 3));
  state = state.multiply(cxOn4(1, 3));
  state = state.multiply(singleQubitOnTarget(Td, 3));
  state = state.multiply(singleQubitOnTarget(H, 3));
  state = state.multiply(singleQubitOnTarget(T, 3));
  state = state.multiply(cxOn4(2, 3));
  state = state.multiply(singleQubitOnTarget(Td, 3));
  state = state.multiply(singleQubitOnTarget(H, 3));

  return state;
}

// ─── Gate Lookup ─────────────────────────────────────────────────────

/**
 * Returns the 2×2 matrix for a named single-qubit gate, with optional parameters.
 *
 * @param name - The gate name.
 * @param params - Numeric parameters (for parameterized gates).
 * @returns The gate matrix.
 */
export function getGateMatrix(
  name: string,
  params: number[] = [],
): Matrix {
  switch (name) {
    case "h":
      return hadamard();
    case "x":
      return pauliX();
    case "y":
      return pauliY();
    case "z":
      return pauliZ();
    case "s":
      return sGate();
    case "sdg":
      return sdgGate();
    case "t":
      return tGate();
    case "tdg":
      return tdgGate();
    case "sx":
      return sxGate();
    case "sxdg":
      return sxdgGate();
    case "id":
      return identity();
    case "p":
      return phaseGate(params[0] ?? 0);
    case "rz":
      return rzGate(params[0] ?? 0);
    case "rx":
      return rxGate(params[0] ?? 0);
    case "u":
      return uGate(params[0] ?? 0, params[1] ?? 0, params[2] ?? 0);
    case "cx":
      return cnotGate();
    case "swap":
      return swapGate();
    case "ccx":
      return toffoliGate();
    case "rccx":
      return rccxGate();
    case "rc3x":
      return rc3xGate();
    case "rxx":
      return rxxGate(params[0] ?? 0);
    case "rzz":
      return rzzGate(params[0] ?? 0);
    default:
      throw new Error(`Unknown gate: ${name}`);
  }
}
