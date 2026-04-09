import { assert, assertAlmostEquals } from "jsr:@std/assert";
import { Complex } from "../src/complex.ts";
import { blochFromStateVector, blochOfCircuit } from "../src/bloch.ts";
import { QuantumCircuit } from "../src/circuit.ts";

const EPS = 1e-10;

// Helper: build a single-qubit state vector [α, β].
function singleQubit(a: Complex, b: Complex): Complex[] {
  return [a, b];
}

// =============================================================================
// Standard single-qubit states
// =============================================================================

Deno.test("Bloch: |0> → (0, 0, 1), r=1, theta=0", () => {
  const c = blochFromStateVector(singleQubit(Complex.ONE, Complex.ZERO), 1, 0);
  assertAlmostEquals(c.x, 0, EPS);
  assertAlmostEquals(c.y, 0, EPS);
  assertAlmostEquals(c.z, 1, EPS);
  assertAlmostEquals(c.r, 1, EPS);
  assertAlmostEquals(c.theta, 0, EPS);
});

Deno.test("Bloch: |1> → (0, 0, -1), r=1, theta=pi", () => {
  const c = blochFromStateVector(singleQubit(Complex.ZERO, Complex.ONE), 1, 0);
  assertAlmostEquals(c.x, 0, EPS);
  assertAlmostEquals(c.y, 0, EPS);
  assertAlmostEquals(c.z, -1, EPS);
  assertAlmostEquals(c.r, 1, EPS);
  assertAlmostEquals(c.theta, Math.PI, EPS);
});

Deno.test("Bloch: |+> → (1, 0, 0)", () => {
  const s = 1 / Math.sqrt(2);
  const c = blochFromStateVector(
    singleQubit(new Complex(s), new Complex(s)),
    1,
    0,
  );
  assertAlmostEquals(c.x, 1, EPS);
  assertAlmostEquals(c.y, 0, EPS);
  assertAlmostEquals(c.z, 0, EPS);
  assertAlmostEquals(c.r, 1, EPS);
});

Deno.test("Bloch: |-> → (-1, 0, 0)", () => {
  const s = 1 / Math.sqrt(2);
  const c = blochFromStateVector(
    singleQubit(new Complex(s), new Complex(-s)),
    1,
    0,
  );
  assertAlmostEquals(c.x, -1, EPS);
  assertAlmostEquals(c.y, 0, EPS);
  assertAlmostEquals(c.z, 0, EPS);
});

Deno.test("Bloch: |+i> → (0, 1, 0)", () => {
  // |+i> = (|0> + i|1>) / sqrt(2)
  const s = 1 / Math.sqrt(2);
  const c = blochFromStateVector(
    singleQubit(new Complex(s), new Complex(0, s)),
    1,
    0,
  );
  assertAlmostEquals(c.x, 0, EPS);
  assertAlmostEquals(c.y, 1, EPS);
  assertAlmostEquals(c.z, 0, EPS);
});

Deno.test("Bloch: |-i> → (0, -1, 0)", () => {
  const s = 1 / Math.sqrt(2);
  const c = blochFromStateVector(
    singleQubit(new Complex(s), new Complex(0, -s)),
    1,
    0,
  );
  assertAlmostEquals(c.x, 0, EPS);
  assertAlmostEquals(c.y, -1, EPS);
  assertAlmostEquals(c.z, 0, EPS);
});

// =============================================================================
// Spherical consistency
// =============================================================================

Deno.test("Bloch: r = sqrt(x^2 + y^2 + z^2)", () => {
  const s = 1 / Math.sqrt(2);
  const c = blochFromStateVector(
    singleQubit(new Complex(s), new Complex(s)),
    1,
    0,
  );
  assertAlmostEquals(c.r, Math.sqrt(c.x * c.x + c.y * c.y + c.z * c.z), EPS);
});

Deno.test("Bloch: theta is in [0, pi]", () => {
  const s = 1 / Math.sqrt(2);
  for (
    const v of [
      [Complex.ONE, Complex.ZERO],
      [Complex.ZERO, Complex.ONE],
      [new Complex(s), new Complex(s)],
      [new Complex(s), new Complex(-s)],
      [new Complex(s), new Complex(0, s)],
    ] as [Complex, Complex][]
  ) {
    const c = blochFromStateVector(singleQubit(v[0], v[1]), 1, 0);
    assert(c.theta >= -EPS && c.theta <= Math.PI + EPS);
  }
});

Deno.test("Bloch: phi is in [0, 2pi)", () => {
  const s = 1 / Math.sqrt(2);
  const c = blochFromStateVector(
    singleQubit(new Complex(s), new Complex(0, s)),
    1,
    0,
  );
  assert(c.phi >= 0 && c.phi < 2 * Math.PI);
});

// =============================================================================
// Multi-qubit reduced states
// =============================================================================

Deno.test("Bloch: Bell state qubit 0 is maximally mixed (r=0)", () => {
  // (|00> + |11>) / sqrt(2)
  const s = 1 / Math.sqrt(2);
  const state = [new Complex(s), Complex.ZERO, Complex.ZERO, new Complex(s)];
  const c = blochFromStateVector(state, 2, 0);
  assertAlmostEquals(c.x, 0, EPS);
  assertAlmostEquals(c.y, 0, EPS);
  assertAlmostEquals(c.z, 0, EPS);
  assertAlmostEquals(c.r, 0, EPS);
});

Deno.test("Bloch: Bell state qubit 1 is also maximally mixed", () => {
  const s = 1 / Math.sqrt(2);
  const state = [new Complex(s), Complex.ZERO, Complex.ZERO, new Complex(s)];
  const c = blochFromStateVector(state, 2, 1);
  assertAlmostEquals(c.r, 0, EPS);
});

Deno.test("Bloch: |00> qubit 0 = (0, 0, 1)", () => {
  const state = [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO];
  const c = blochFromStateVector(state, 2, 0);
  assertAlmostEquals(c.z, 1, EPS);
});

Deno.test("Bloch: |10> qubit 0 = (0, 0, -1)", () => {
  // |10> in MSB-first 2-qubit ordering = index 2
  const state = [Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO];
  const c = blochFromStateVector(state, 2, 0);
  assertAlmostEquals(c.z, -1, EPS);
});

Deno.test("Bloch: |01> qubit 1 = (0, 0, -1)", () => {
  // |01> = index 1
  const state = [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO];
  const c = blochFromStateVector(state, 2, 1);
  assertAlmostEquals(c.z, -1, EPS);
});

Deno.test("Bloch: GHZ-3 each qubit is maximally mixed", () => {
  // (|000> + |111>) / sqrt(2) on 3 qubits
  const s = 1 / Math.sqrt(2);
  const state = new Array(8).fill(Complex.ZERO);
  state[0] = new Complex(s); // |000>
  state[7] = new Complex(s); // |111>
  for (let q = 0; q < 3; q++) {
    const c = blochFromStateVector(state, 3, q);
    assertAlmostEquals(c.r, 0, EPS);
  }
});

// =============================================================================
// blochOfCircuit
// =============================================================================

Deno.test("blochOfCircuit: |0> via empty circuit on 1 qubit", () => {
  const qc = new QuantumCircuit();
  qc.id(0);
  const c = blochOfCircuit(qc, 0);
  assertAlmostEquals(c.z, 1, EPS);
});

Deno.test("blochOfCircuit: H|0> = |+>", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  const c = blochOfCircuit(qc, 0);
  assertAlmostEquals(c.x, 1, EPS);
  assertAlmostEquals(c.r, 1, EPS);
});

Deno.test("blochOfCircuit: X|0> = |1>", () => {
  const qc = new QuantumCircuit();
  qc.x(0);
  const c = blochOfCircuit(qc, 0);
  assertAlmostEquals(c.z, -1, EPS);
});

Deno.test("blochOfCircuit: Bell state via H+CX gives r=0 on each qubit", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  const c0 = blochOfCircuit(qc, 0);
  const c1 = blochOfCircuit(qc, 1);
  assertAlmostEquals(c0.r, 0, EPS);
  assertAlmostEquals(c1.r, 0, EPS);
});

Deno.test("Bloch: rejects target out of range", () => {
  try {
    blochFromStateVector([Complex.ONE, Complex.ZERO], 1, 5);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("out of range"));
  }
});

Deno.test("Bloch: rejects state length mismatch", () => {
  try {
    blochFromStateVector([Complex.ONE, Complex.ZERO, Complex.ZERO], 1, 0);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("does not match"));
  }
});
