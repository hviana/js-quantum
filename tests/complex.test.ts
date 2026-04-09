import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertThrows,
} from "jsr:@std/assert";
import { Complex } from "../src/complex.ts";

const EPS = Complex.EPSILON;

Deno.test("Complex: constructor stores real and imaginary parts", () => {
  const z = new Complex(3, -4);
  assertEquals(z.re, 3);
  assertEquals(z.im, -4);
});

Deno.test("Complex: default imaginary part is zero", () => {
  const z = new Complex(5);
  assertEquals(z.im, 0);
});

Deno.test("Complex: ZERO constant", () => {
  assertEquals(Complex.ZERO.re, 0);
  assertEquals(Complex.ZERO.im, 0);
});

Deno.test("Complex: ONE constant", () => {
  assertEquals(Complex.ONE.re, 1);
  assertEquals(Complex.ONE.im, 0);
});

Deno.test("Complex: I constant", () => {
  assertEquals(Complex.I.re, 0);
  assertEquals(Complex.I.im, 1);
});

Deno.test("Complex: MINUS_I constant", () => {
  assertEquals(Complex.MINUS_I.re, 0);
  assertEquals(Complex.MINUS_I.im, -1);
});

Deno.test("Complex: MINUS_ONE constant", () => {
  assertEquals(Complex.MINUS_ONE.re, -1);
  assertEquals(Complex.MINUS_ONE.im, 0);
});

Deno.test("Complex: addition of positive numbers", () => {
  const a = new Complex(1, 2);
  const b = new Complex(3, 4);
  const r = a.add(b);
  assert(r.equals(new Complex(4, 6)));
});

Deno.test("Complex: addition with negatives", () => {
  const a = new Complex(1, 2);
  const b = new Complex(-3, -4);
  assert(a.add(b).equals(new Complex(-2, -2)));
});

Deno.test("Complex: addition with zero", () => {
  const a = new Complex(3, -7);
  assert(a.add(Complex.ZERO).equals(a));
});

Deno.test("Complex: subtraction", () => {
  const a = new Complex(5, 3);
  const b = new Complex(2, 1);
  assert(a.sub(b).equals(new Complex(3, 2)));
});

Deno.test("Complex: subtraction to zero", () => {
  const a = new Complex(7, -2);
  assert(a.sub(a).equals(Complex.ZERO));
});

Deno.test("Complex: multiplication of pure real", () => {
  const a = new Complex(3, 0);
  const b = new Complex(4, 0);
  assert(a.mul(b).equals(new Complex(12, 0)));
});

Deno.test("Complex: multiplication of pure imaginary: i*i = -1", () => {
  assert(Complex.I.mul(Complex.I).equals(Complex.MINUS_ONE));
});

Deno.test("Complex: multiplication general (a+bi)(c+di)", () => {
  const a = new Complex(2, 3);
  const b = new Complex(4, 5);
  // (2+3i)(4+5i) = 8 + 10i + 12i + 15i^2 = 8 + 22i - 15 = -7 + 22i
  assert(a.mul(b).equals(new Complex(-7, 22)));
});

Deno.test("Complex: multiplication by ONE is identity", () => {
  const a = new Complex(3, -2);
  assert(a.mul(Complex.ONE).equals(a));
});

Deno.test("Complex: multiplication by ZERO is zero", () => {
  const a = new Complex(3, -2);
  assert(a.mul(Complex.ZERO).equals(Complex.ZERO));
});

Deno.test("Complex: division of pure real", () => {
  const a = new Complex(10, 0);
  const b = new Complex(2, 0);
  assert(a.div(b).equals(new Complex(5, 0)));
});

Deno.test("Complex: division (a/a = 1)", () => {
  const a = new Complex(3, 4);
  assert(a.div(a).equals(Complex.ONE));
});

Deno.test("Complex: division by zero throws", () => {
  const a = new Complex(1, 1);
  assertThrows(() => a.div(Complex.ZERO), Error, "Complex division by zero");
});

Deno.test("Complex: scale by real scalar", () => {
  const a = new Complex(2, 3);
  assert(a.scale(2).equals(new Complex(4, 6)));
});

Deno.test("Complex: scale by zero", () => {
  const a = new Complex(2, 3);
  assert(a.scale(0).equals(Complex.ZERO));
});

Deno.test("Complex: conjugate of general number", () => {
  const a = new Complex(3, -4);
  assert(a.conjugate().equals(new Complex(3, 4)));
});

Deno.test("Complex: conjugate of real is itself", () => {
  const a = new Complex(7, 0);
  assert(a.conjugate().equals(a));
});

Deno.test("Complex: conjugate of imaginary", () => {
  assert(Complex.I.conjugate().equals(Complex.MINUS_I));
});

Deno.test("Complex: z * conjugate(z) is real and equals |z|^2", () => {
  const a = new Complex(3, 4);
  const r = a.mul(a.conjugate());
  assertAlmostEquals(r.im, 0, EPS);
  assertAlmostEquals(r.re, 25, EPS);
});

Deno.test("Complex: neg negates both parts", () => {
  const a = new Complex(3, -4);
  assert(a.neg().equals(new Complex(-3, 4)));
});

Deno.test("Complex: add of neg is zero", () => {
  const a = new Complex(3, -4);
  assert(a.add(a.neg()).equals(Complex.ZERO));
});

Deno.test("Complex: magnitude of known value 3-4i is 5", () => {
  const a = new Complex(3, -4);
  assertAlmostEquals(a.magnitude(), 5, EPS);
});

Deno.test("Complex: magnitude of zero is zero", () => {
  assertEquals(Complex.ZERO.magnitude(), 0);
});

Deno.test("Complex: magnitudeSquared matches magnitude^2", () => {
  const a = new Complex(3, 4);
  assertAlmostEquals(a.magnitude() ** 2, a.magnitudeSquared(), EPS);
});

Deno.test("Complex: phase on positive real axis is 0", () => {
  assertAlmostEquals(new Complex(5, 0).phase(), 0, EPS);
});

Deno.test("Complex: phase on positive imaginary axis is pi/2", () => {
  assertAlmostEquals(Complex.I.phase(), Math.PI / 2, EPS);
});

Deno.test("Complex: phase on negative real axis is pi", () => {
  assertAlmostEquals(Complex.MINUS_ONE.phase(), Math.PI, EPS);
});

Deno.test("Complex: phase on negative imaginary axis is -pi/2", () => {
  assertAlmostEquals(Complex.MINUS_I.phase(), -Math.PI / 2, EPS);
});

Deno.test("Complex: phase of zero is 0 by convention", () => {
  assertEquals(Complex.ZERO.phase(), 0);
});

Deno.test("Complex: phase in first quadrant", () => {
  assertAlmostEquals(new Complex(1, 1).phase(), Math.PI / 4, EPS);
});

Deno.test("Complex: phase in second quadrant", () => {
  assertAlmostEquals(new Complex(-1, 1).phase(), (3 * Math.PI) / 4, EPS);
});

Deno.test("Complex: phase in third quadrant", () => {
  assertAlmostEquals(new Complex(-1, -1).phase(), (-3 * Math.PI) / 4, EPS);
});

Deno.test("Complex: phase in fourth quadrant", () => {
  assertAlmostEquals(new Complex(1, -1).phase(), -Math.PI / 4, EPS);
});

Deno.test("Complex: exp(0) = 1", () => {
  assert(Complex.exp(0).equals(Complex.ONE));
});

Deno.test("Complex: exp(pi/2) = i", () => {
  assert(Complex.exp(Math.PI / 2).equals(Complex.I));
});

Deno.test("Complex: exp(pi) = -1", () => {
  assert(Complex.exp(Math.PI).equals(Complex.MINUS_ONE));
});

Deno.test("Complex: exp(3pi/2) = -i", () => {
  assert(Complex.exp((3 * Math.PI) / 2).equals(Complex.MINUS_I));
});

Deno.test("Complex: exp(2pi) = 1", () => {
  assert(Complex.exp(2 * Math.PI).equals(Complex.ONE));
});

Deno.test("Complex: fromPolar(1, 0) = 1", () => {
  assert(Complex.fromPolar(1, 0).equals(Complex.ONE));
});

Deno.test("Complex: fromPolar(2, pi/2) = 2i", () => {
  assert(Complex.fromPolar(2, Math.PI / 2).equals(new Complex(0, 2)));
});

Deno.test("Complex: fromPolar round-trip", () => {
  const z = new Complex(3, 4);
  const r = z.magnitude();
  const theta = z.phase();
  assert(Complex.fromPolar(r, theta).equals(z));
});

Deno.test("Complex: real factory wraps scalar", () => {
  assert(Complex.real(5).equals(new Complex(5, 0)));
});

Deno.test("Complex: imag factory wraps scalar", () => {
  assert(Complex.imag(3).equals(new Complex(0, 3)));
});

Deno.test("Complex: equals within epsilon", () => {
  const a = new Complex(1, 0);
  const b = new Complex(1 + 1e-12, 0);
  assert(a.equals(b));
});

Deno.test("Complex: equals rejects differences above epsilon", () => {
  const a = new Complex(1, 0);
  const b = new Complex(1.001, 0);
  assert(!a.equals(b));
});

Deno.test("Complex: equals with custom epsilon", () => {
  const a = new Complex(1, 0);
  const b = new Complex(1.01, 0);
  assert(a.equals(b, 0.1));
});

Deno.test("Complex: immutability — operations do not mutate", () => {
  const a = new Complex(1, 2);
  const b = new Complex(3, 4);
  a.add(b);
  a.mul(b);
  assertEquals(a.re, 1);
  assertEquals(a.im, 2);
});

Deno.test("Complex: toString real-only", () => {
  assertEquals(new Complex(3, 0).toString(), "3");
});

Deno.test("Complex: toString imaginary-only", () => {
  assertEquals(new Complex(0, 5).toString(), "5i");
});

Deno.test("Complex: toString general", () => {
  assertEquals(new Complex(3, 4).toString(), "3+4i");
});

Deno.test("Complex: toString negative imaginary", () => {
  assertEquals(new Complex(3, -4).toString(), "3-4i");
});
