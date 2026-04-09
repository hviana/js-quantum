import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertThrows,
} from "jsr:@std/assert";
import {
  AngleExpr,
  asExactInteger,
  provablyEqual,
  provablyInteger,
  provablyTwoPiMultiple,
  provablyZero,
  wrapPhase,
} from "../src/parameter.ts";

const EPS = 1e-10;

// -------- literals and constants --------

Deno.test("AngleExpr: int literal resolved", () => {
  const e = AngleExpr.int(5);
  assert(e.isResolved());
  assertEquals(e.evaluate(), 5);
});

Deno.test("AngleExpr: rational literal reduces", () => {
  const e = AngleExpr.rational(6, 9);
  assertEquals(e.num, 2);
  assertEquals(e.den, 3);
});

Deno.test("AngleExpr: rational with integer denominator collapses to int", () => {
  const e = AngleExpr.rational(6, 2);
  assertEquals(e.kind, "int");
  assertEquals(e.num, 3);
});

Deno.test("AngleExpr: rational denominator zero throws", () => {
  assertThrows(() => AngleExpr.rational(1, 0), Error);
});

Deno.test("AngleExpr: pi constant evaluates to Math.PI", () => {
  assertAlmostEquals(AngleExpr.PI.evaluate(), Math.PI, EPS);
});

Deno.test("AngleExpr: tau evaluates to 2*pi", () => {
  assertAlmostEquals(AngleExpr.TAU.evaluate(), 2 * Math.PI, EPS);
});

Deno.test("AngleExpr: symbol is not resolved", () => {
  const e = AngleExpr.symbol("theta");
  assert(!e.isResolved());
});

Deno.test("AngleExpr: unresolved symbol evaluate throws", () => {
  assertThrows(() => AngleExpr.symbol("theta").evaluate(), Error);
});

// -------- binding --------

Deno.test("AngleExpr: bind single symbol with number", () => {
  const e = AngleExpr.symbol("theta");
  const bound = e.bind({ theta: 3.14 });
  assertAlmostEquals(bound.evaluate(), 3.14, EPS);
});

Deno.test("AngleExpr: partial binding leaves unbound symbolic", () => {
  const e = AngleExpr.add(AngleExpr.symbol("a"), AngleExpr.symbol("b"));
  const bound = e.bind({ a: 1 });
  assert(!bound.isResolved());
});

Deno.test("AngleExpr: arithmetic with symbol bind", () => {
  const theta = AngleExpr.symbol("theta");
  const e = theta.times(2);
  const bound = e.bind({ theta: Math.PI / 4 });
  assertAlmostEquals(bound.evaluate(), Math.PI / 2, EPS);
});

Deno.test("AngleExpr: division by 2 with bind", () => {
  const x = AngleExpr.symbol("x");
  const e = x.dividedBy(2);
  const bound = e.bind({ x: 10 });
  assertAlmostEquals(bound.evaluate(), 5, EPS);
});

Deno.test("AngleExpr: subtraction with bind", () => {
  const x = AngleExpr.symbol("x");
  const y = AngleExpr.symbol("y");
  const e = x.minus(y);
  assertAlmostEquals(e.bind({ x: 7, y: 3 }).evaluate(), 4, EPS);
});

Deno.test("AngleExpr: nested (x+1)*2", () => {
  const x = AngleExpr.symbol("x");
  const e = x.plus(1).times(2);
  assertAlmostEquals(e.bind({ x: 5 }).evaluate(), 12, EPS);
});

// -------- exact proof tests (affine form) --------

Deno.test("AngleExpr: provablyZero literal 0", () => {
  assert(provablyZero(AngleExpr.int(0)));
});

Deno.test("AngleExpr: provablyZero rejects 1", () => {
  assert(!provablyZero(AngleExpr.int(1)));
});

Deno.test("AngleExpr: provablyZero rejects symbol", () => {
  assert(!provablyZero(AngleExpr.symbol("x")));
});

Deno.test("AngleExpr: provablyZero of pi - pi", () => {
  assert(provablyZero(AngleExpr.PI.minus(AngleExpr.PI)));
});

Deno.test("AngleExpr: provablyZero of x - x", () => {
  const x = AngleExpr.symbol("x");
  assert(provablyZero(x.minus(x)));
});

Deno.test("AngleExpr: provablyTwoPiMultiple of 0", () => {
  assert(provablyTwoPiMultiple(AngleExpr.int(0)));
});

Deno.test("AngleExpr: provablyTwoPiMultiple of 2*pi", () => {
  assert(provablyTwoPiMultiple(AngleExpr.PI.times(2)));
});

Deno.test("AngleExpr: provablyTwoPiMultiple of -4*pi", () => {
  assert(provablyTwoPiMultiple(AngleExpr.PI.times(-4)));
});

Deno.test("AngleExpr: provablyTwoPiMultiple rejects pi", () => {
  assert(!provablyTwoPiMultiple(AngleExpr.PI));
});

Deno.test("AngleExpr: provablyTwoPiMultiple rejects symbol*pi", () => {
  assert(!provablyTwoPiMultiple(AngleExpr.symbol("k").times(AngleExpr.PI)));
});

Deno.test("AngleExpr: provablyInteger literal", () => {
  assert(provablyInteger(AngleExpr.int(42)));
});

Deno.test("AngleExpr: provablyInteger rejects 1/2", () => {
  assert(!provablyInteger(AngleExpr.rational(1, 2)));
});

Deno.test("AngleExpr: provablyInteger rejects pi", () => {
  assert(!provablyInteger(AngleExpr.PI));
});

Deno.test("AngleExpr: provablyInteger of 6/3 collapses to 2", () => {
  // rational(6,3) constructor collapses to int(2) automatically
  assert(provablyInteger(AngleExpr.rational(6, 3)));
});

Deno.test("AngleExpr: provablyInteger of 2 + 3 after normalization", () => {
  assert(provablyInteger(AngleExpr.int(2).plus(3)));
});

Deno.test("AngleExpr: asExactInteger returns integer or null", () => {
  assertEquals(asExactInteger(AngleExpr.int(7)), 7);
  assertEquals(asExactInteger(AngleExpr.rational(1, 2)), null);
});

Deno.test("AngleExpr: provablyEqual equal expressions", () => {
  assert(provablyEqual(AngleExpr.int(3).plus(2), AngleExpr.int(5)));
});

Deno.test("AngleExpr: provablyEqual rejects unequal", () => {
  assert(!provablyEqual(AngleExpr.int(3), AngleExpr.int(5)));
});

// -------- wrapPhase --------

Deno.test("wrapPhase: 0 stays 0", () => {
  assertEquals(wrapPhase(0), 0);
});

Deno.test("wrapPhase: pi stays pi (branch-cut snap to +pi)", () => {
  assertEquals(wrapPhase(Math.PI), Math.PI);
});

Deno.test("wrapPhase: -pi snaps to +pi", () => {
  assertEquals(wrapPhase(-Math.PI), Math.PI);
});

Deno.test("wrapPhase: 3pi/2 -> -pi/2", () => {
  assertAlmostEquals(wrapPhase((3 * Math.PI) / 2), -Math.PI / 2, EPS);
});

Deno.test("wrapPhase: -3pi/2 -> pi/2", () => {
  assertAlmostEquals(wrapPhase((-3 * Math.PI) / 2), Math.PI / 2, EPS);
});

Deno.test("wrapPhase: 2pi -> 0", () => {
  assertAlmostEquals(wrapPhase(2 * Math.PI), 0, EPS);
});

Deno.test("wrapPhase: pi - epsilon snaps to pi", () => {
  assertEquals(wrapPhase(Math.PI - 1e-13), Math.PI);
});

Deno.test("wrapPhase: -pi + epsilon snaps to pi", () => {
  assertEquals(wrapPhase(-Math.PI + 1e-13), Math.PI);
});

Deno.test("wrapPhase: large positive phase", () => {
  assertAlmostEquals(wrapPhase(10 * Math.PI + Math.PI / 3), Math.PI / 3, EPS);
});

Deno.test("wrapPhase: large negative phase", () => {
  assertAlmostEquals(wrapPhase(-10 * Math.PI + Math.PI / 3), Math.PI / 3, EPS);
});
