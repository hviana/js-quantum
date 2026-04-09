import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import { Complex } from "../src/complex.ts";
import { Matrix } from "../src/matrix.ts";

// -------- helpers --------
const c = (re: number, im: number = 0) => new Complex(re, im);

const PAULI_X = Matrix.real([[0, 1], [1, 0]]);
const PAULI_Y = new Matrix([
  [Complex.ZERO, Complex.MINUS_I],
  [Complex.I, Complex.ZERO],
]);
const PAULI_Z = Matrix.real([[1, 0], [0, -1]]);
const HADAMARD = Matrix.real([[1, 1], [1, -1]]).scale(c(1 / Math.sqrt(2), 0));

// -------- construction --------

Deno.test("Matrix: identity(2)", () => {
  const I = Matrix.identity(2);
  assertEquals(I.rows, 2);
  assertEquals(I.cols, 2);
  assert(I.get(0, 0).equals(Complex.ONE));
  assert(I.get(1, 1).equals(Complex.ONE));
  assert(I.get(0, 1).equals(Complex.ZERO));
  assert(I.get(1, 0).equals(Complex.ZERO));
});

Deno.test("Matrix: identity(4) correct size and diagonal", () => {
  const I = Matrix.identity(4);
  assertEquals(I.rows, 4);
  assertEquals(I.cols, 4);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      assert(I.get(i, j).equals(i === j ? Complex.ONE : Complex.ZERO));
    }
  }
});

Deno.test("Matrix: zeros has all zero entries", () => {
  const Z = Matrix.zeros(2, 3);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 3; j++) assert(Z.get(i, j).equals(Complex.ZERO));
  }
});

Deno.test("Matrix: real factory wraps number matrix", () => {
  const M = Matrix.real([[1, 2], [3, 4]]);
  assert(M.get(0, 0).equals(c(1)));
  assert(M.get(1, 1).equals(c(4)));
});

Deno.test("Matrix: diagonal factory", () => {
  const D = Matrix.diagonal([c(1), c(2), c(3)]);
  assertEquals(D.rows, 3);
  assertEquals(D.cols, 3);
  assert(D.get(0, 0).equals(c(1)));
  assert(D.get(1, 1).equals(c(2)));
  assert(D.get(2, 2).equals(c(3)));
  assert(D.get(0, 1).equals(Complex.ZERO));
});

Deno.test("Matrix: constructor rejects jagged rows", () => {
  assertThrows(
    () => new Matrix([[c(1), c(2)], [c(3)]]),
    Error,
    "Matrix row 1 has length 1",
  );
});

// -------- multiply --------

Deno.test("Matrix: I*A = A", () => {
  const A = Matrix.real([[1, 2], [3, 4]]);
  assert(Matrix.identity(2).multiply(A).equals(A));
});

Deno.test("Matrix: A*I = A", () => {
  const A = Matrix.real([[1, 2], [3, 4]]);
  assert(A.multiply(Matrix.identity(2)).equals(A));
});

Deno.test("Matrix: multiply associativity (A*B)*C = A*(B*C)", () => {
  const A = Matrix.real([[1, 2], [0, 1]]);
  const B = Matrix.real([[2, 0], [1, 3]]);
  const C = Matrix.real([[0, 1], [1, 0]]);
  assert(A.multiply(B).multiply(C).equals(A.multiply(B.multiply(C))));
});

Deno.test("Matrix: multiply non-square shapes", () => {
  const A = Matrix.real([[1, 2, 3]]); // 1x3
  const B = Matrix.real([[4], [5], [6]]); // 3x1
  const R = A.multiply(B);
  assertEquals(R.rows, 1);
  assertEquals(R.cols, 1);
  assert(R.get(0, 0).equals(c(32)));
});

Deno.test("Matrix: multiply incompatible dimensions throws", () => {
  const A = Matrix.real([[1, 2]]);
  const B = Matrix.real([[1, 2]]);
  assertThrows(() => A.multiply(B), Error);
});

Deno.test("Matrix: Pauli X*X = I", () => {
  assert(PAULI_X.multiply(PAULI_X).equals(Matrix.identity(2)));
});

Deno.test("Matrix: Pauli Y*Y = I", () => {
  assert(PAULI_Y.multiply(PAULI_Y).equals(Matrix.identity(2)));
});

Deno.test("Matrix: Pauli Z*Z = I", () => {
  assert(PAULI_Z.multiply(PAULI_Z).equals(Matrix.identity(2)));
});

Deno.test("Matrix: Pauli XY = iZ", () => {
  const xy = PAULI_X.multiply(PAULI_Y);
  const iZ = PAULI_Z.scale(Complex.I);
  assert(xy.equals(iZ));
});

Deno.test("Matrix: Pauli YZ = iX", () => {
  const yz = PAULI_Y.multiply(PAULI_Z);
  const iX = PAULI_X.scale(Complex.I);
  assert(yz.equals(iX));
});

Deno.test("Matrix: Pauli ZX = iY", () => {
  const zx = PAULI_Z.multiply(PAULI_X);
  const iY = PAULI_Y.scale(Complex.I);
  assert(zx.equals(iY));
});

// -------- add/sub --------

Deno.test("Matrix: addition commutative", () => {
  const A = Matrix.real([[1, 2], [3, 4]]);
  const B = Matrix.real([[5, 6], [7, 8]]);
  assert(A.add(B).equals(B.add(A)));
});

Deno.test("Matrix: subtraction yields zero for self", () => {
  const A = Matrix.real([[1, 2], [3, 4]]);
  assert(A.sub(A).equals(Matrix.zeros(2, 2)));
});

Deno.test("Matrix: add rejects shape mismatch", () => {
  assertThrows(() => Matrix.real([[1]]).add(Matrix.real([[1, 2]])), Error);
});

Deno.test("Matrix: sub rejects shape mismatch", () => {
  assertThrows(() => Matrix.real([[1]]).sub(Matrix.real([[1, 2]])), Error);
});

// -------- scale --------

Deno.test("Matrix: scale by ONE preserves matrix", () => {
  const A = Matrix.real([[1, 2], [3, 4]]);
  assert(A.scale(Complex.ONE).equals(A));
});

Deno.test("Matrix: scale by ZERO yields zero matrix", () => {
  const A = Matrix.real([[1, 2], [3, 4]]);
  assert(A.scale(Complex.ZERO).equals(Matrix.zeros(2, 2)));
});

Deno.test("Matrix: scale by i rotates entries", () => {
  const A = Matrix.real([[1, 0], [0, 1]]);
  const iA = A.scale(Complex.I);
  assert(iA.get(0, 0).equals(Complex.I));
  assert(iA.get(1, 1).equals(Complex.I));
});

Deno.test("Matrix: scaleReal", () => {
  const A = Matrix.real([[1, 2], [3, 4]]);
  assert(A.scaleReal(2).equals(Matrix.real([[2, 4], [6, 8]])));
});

// -------- dagger --------

Deno.test("Matrix: dagger dagger = original", () => {
  const A = new Matrix([
    [c(1, 2), c(3, -1)],
    [c(0, 5), c(-2, 0)],
  ]);
  assert(A.dagger().dagger().equals(A));
});

Deno.test("Matrix: dagger of identity is identity", () => {
  assert(Matrix.identity(3).dagger().equals(Matrix.identity(3)));
});

Deno.test("Matrix: dagger of Pauli X is X (hermitian)", () => {
  assert(PAULI_X.dagger().equals(PAULI_X));
});

Deno.test("Matrix: dagger of Pauli Y is Y (hermitian)", () => {
  assert(PAULI_Y.dagger().equals(PAULI_Y));
});

// -------- tensor --------

Deno.test("Matrix: I2 ⊗ I2 = I4", () => {
  assert(
    Matrix.identity(2).tensor(Matrix.identity(2)).equals(Matrix.identity(4)),
  );
});

Deno.test("Matrix: tensor dimensions are product", () => {
  const A = Matrix.real([[1, 2], [3, 4]]); // 2x2
  const B = Matrix.real([[1, 0, 0], [0, 1, 0]]); // 2x3
  const R = A.tensor(B);
  assertEquals(R.rows, 4);
  assertEquals(R.cols, 6);
});

Deno.test("Matrix: tensor block structure", () => {
  const A = Matrix.real([[1, 2], [3, 4]]);
  const B = Matrix.real([[0, 1], [1, 0]]);
  const R = A.tensor(B);
  // Top-left block is 1*B, top-right is 2*B
  assert(R.get(0, 0).equals(c(0))); // 1*B[0,0]
  assert(R.get(0, 1).equals(c(1))); // 1*B[0,1]
  assert(R.get(0, 2).equals(c(0))); // 2*B[0,0]
  assert(R.get(0, 3).equals(c(2))); // 2*B[0,1]
  assert(R.get(3, 3).equals(c(0))); // 4*B[1,1]
  assert(R.get(3, 2).equals(c(4))); // 4*B[1,0]
});

Deno.test("Matrix: X ⊗ X is its own inverse", () => {
  const XX = PAULI_X.tensor(PAULI_X);
  assert(XX.multiply(XX).equals(Matrix.identity(4)));
});

// -------- apply --------

Deno.test("Matrix: X applied to |0> yields |1>", () => {
  const v0 = [Complex.ONE, Complex.ZERO];
  const out = PAULI_X.apply(v0);
  assert(out[0].equals(Complex.ZERO));
  assert(out[1].equals(Complex.ONE));
});

Deno.test("Matrix: H applied to |0> yields (|0>+|1>)/sqrt(2)", () => {
  const v0 = [Complex.ONE, Complex.ZERO];
  const out = HADAMARD.apply(v0);
  const s = 1 / Math.sqrt(2);
  assert(out[0].equals(c(s)));
  assert(out[1].equals(c(s)));
});

Deno.test("Matrix: Z applied to |1> yields -|1>", () => {
  const v1 = [Complex.ZERO, Complex.ONE];
  const out = PAULI_Z.apply(v1);
  assert(out[0].equals(Complex.ZERO));
  assert(out[1].equals(Complex.MINUS_ONE));
});

Deno.test("Matrix: apply rejects wrong vector length", () => {
  assertThrows(() => PAULI_X.apply([Complex.ONE]), Error);
});

// -------- trace --------

Deno.test("Matrix: trace of identity is n", () => {
  assert(Matrix.identity(4).trace().equals(c(4)));
});

Deno.test("Matrix: trace of Pauli X is 0", () => {
  assert(PAULI_X.trace().equals(Complex.ZERO));
});

Deno.test("Matrix: trace of Pauli Y is 0", () => {
  assert(PAULI_Y.trace().equals(Complex.ZERO));
});

Deno.test("Matrix: trace of Pauli Z is 0", () => {
  assert(PAULI_Z.trace().equals(Complex.ZERO));
});

Deno.test("Matrix: trace rejects non-square", () => {
  assertThrows(() => Matrix.real([[1, 2]]).trace(), Error);
});

// -------- determinant --------

Deno.test("Matrix: det of identity = 1", () => {
  assert(Matrix.identity(3).determinant().equals(Complex.ONE));
});

Deno.test("Matrix: det of X = -1", () => {
  assert(PAULI_X.determinant().equals(Complex.MINUS_ONE));
});

Deno.test("Matrix: det of Y = -1", () => {
  assert(PAULI_Y.determinant().equals(Complex.MINUS_ONE));
});

Deno.test("Matrix: det of Z = -1", () => {
  assert(PAULI_Z.determinant().equals(Complex.MINUS_ONE));
});

Deno.test("Matrix: det of singular matrix = 0", () => {
  const M = Matrix.real([[1, 2], [2, 4]]);
  assert(M.determinant().equals(Complex.ZERO));
});

// -------- isUnitary --------

Deno.test("Matrix: identity is unitary", () => {
  assert(Matrix.identity(3).isUnitary());
});

Deno.test("Matrix: Pauli X is unitary", () => {
  assert(PAULI_X.isUnitary());
});

Deno.test("Matrix: Pauli Y is unitary", () => {
  assert(PAULI_Y.isUnitary());
});

Deno.test("Matrix: Pauli Z is unitary", () => {
  assert(PAULI_Z.isUnitary());
});

Deno.test("Matrix: Hadamard is unitary", () => {
  assert(HADAMARD.isUnitary());
});

Deno.test("Matrix: non-unitary matrix rejected", () => {
  const M = Matrix.real([[1, 2], [3, 4]]);
  assert(!M.isUnitary());
});

Deno.test("Matrix: non-square is not unitary", () => {
  assert(!Matrix.real([[1, 0, 0], [0, 1, 0]]).isUnitary());
});

// -------- equals --------

Deno.test("Matrix: equals symmetry", () => {
  const A = Matrix.real([[1, 2], [3, 4]]);
  const B = Matrix.real([[1, 2], [3, 4]]);
  assert(A.equals(B) && B.equals(A));
});

Deno.test("Matrix: equals rejects shape mismatch", () => {
  assert(!Matrix.real([[1]]).equals(Matrix.real([[1, 0]])));
});

Deno.test("Matrix: equals rejects entry mismatch", () => {
  const A = Matrix.real([[1]]);
  const B = Matrix.real([[2]]);
  assert(!A.equals(B));
});

Deno.test("Matrix: equals does NOT quotient by global phase", () => {
  const A = Matrix.identity(2);
  const B = A.scale(Complex.MINUS_ONE);
  assert(!A.equals(B));
});
