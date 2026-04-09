import { assert, assertEquals } from "jsr:@std/assert";
import {
  ALL_ASSIGN_OPS,
  BUILTIN_FUNCTION_NAMES,
  Dur,
  Expr,
  isAssignOp,
  isBuiltinFunction,
  Op,
  State,
} from "../src/expansion.ts";
import { Complex } from "../src/complex.ts";

// -------- Expr factories --------

Deno.test("Expr.int creates int literal", () => {
  const e = Expr.int(42);
  assertEquals(e.kind, "int-literal");
  if (e.kind === "int-literal") assertEquals(e.value, 42);
});

Deno.test("Expr.int with hex base preserves hint", () => {
  const e = Expr.int(255, "hex");
  if (e.kind === "int-literal") assertEquals(e.base, "hex");
});

Deno.test("Expr.float", () => {
  const e = Expr.float(3.14);
  assertEquals(e.kind, "float-literal");
  if (e.kind === "float-literal") assertEquals(e.value, 3.14);
});

Deno.test("Expr.imaginary", () => {
  const e = Expr.imaginary(2);
  assertEquals(e.kind, "imaginary-literal");
});

Deno.test("Expr.bool true", () => {
  const e = Expr.bool(true);
  if (e.kind === "bool-literal") assertEquals(e.value, true);
});

Deno.test("Expr.bitstring", () => {
  const e = Expr.bitstring("1010");
  if (e.kind === "bitstring-literal") assertEquals(e.value, "1010");
});

Deno.test("Expr.duration", () => {
  const e = Expr.duration(100, "ns");
  if (e.kind === "duration-literal") {
    assertEquals(e.value, 100);
    assertEquals(e.unit, "ns");
  }
});

Deno.test("Expr.constant pi", () => {
  const e = Expr.constant("pi");
  if (e.kind === "builtin-constant") assertEquals(e.name, "pi");
});

Deno.test("Expr.constant tau / euler / im", () => {
  for (const n of ["tau", "euler", "im"] as const) {
    const e = Expr.constant(n);
    if (e.kind === "builtin-constant") assertEquals(e.name, n);
  }
});

Deno.test("Expr.ref creates identifier", () => {
  const e = Expr.ref("theta");
  if (e.kind === "identifier") assertEquals(e.name, "theta");
});

Deno.test("Expr.physicalQubit", () => {
  const e = Expr.physicalQubit(3);
  if (e.kind === "physical-qubit") assertEquals(e.index, 3);
});

Deno.test("Expr.array", () => {
  const e = Expr.array([Expr.int(1), Expr.int(2), Expr.int(3)]);
  if (e.kind === "array-literal") assertEquals(e.elements.length, 3);
});

Deno.test("Expr.set", () => {
  const e = Expr.set([Expr.int(1), Expr.int(3)]);
  if (e.kind === "set-literal") assertEquals(e.elements.length, 2);
});

Deno.test("Expr.range with all components", () => {
  const e = Expr.range(Expr.int(0), Expr.int(2), Expr.int(10));
  if (e.kind === "range") {
    assert(e.start !== undefined);
    assert(e.step !== undefined);
    assert(e.end !== undefined);
  }
});

Deno.test("Expr.range with only start and end", () => {
  const e = Expr.range(Expr.int(0), undefined, Expr.int(10));
  if (e.kind === "range") {
    assert(e.start !== undefined);
    assertEquals(e.step, undefined);
    assert(e.end !== undefined);
  }
});

Deno.test("Expr.unary", () => {
  const e = Expr.unary("-", Expr.int(5));
  if (e.kind === "unary") assertEquals(e.op, "-");
});

Deno.test("Expr.binary", () => {
  const e = Expr.binary("+", Expr.int(1), Expr.int(2));
  if (e.kind === "binary") assertEquals(e.op, "+");
});

Deno.test("Expr.concat", () => {
  const e = Expr.concat([Expr.ref("a"), Expr.ref("b")]);
  if (e.kind === "concat") assertEquals(e.parts.length, 2);
});

Deno.test("Expr.cast", () => {
  const e = Expr.cast({ kind: "int", width: 32 }, Expr.float(3.7));
  if (e.kind === "cast") assertEquals(e.targetType.kind, "int");
});

Deno.test("Expr.sizeOf without dimension", () => {
  const e = Expr.sizeOf(Expr.ref("arr"));
  if (e.kind === "sizeof") assertEquals(e.dimension, undefined);
});

Deno.test("Expr.sizeOf with dimension", () => {
  const e = Expr.sizeOf(Expr.ref("arr"), Expr.int(0));
  if (e.kind === "sizeof") assert(e.dimension !== undefined);
});

Deno.test("Expr.realPart / imagPart", () => {
  const a = Expr.realPart(Expr.ref("z"));
  const b = Expr.imagPart(Expr.ref("z"));
  assertEquals(a.kind, "real-part");
  assertEquals(b.kind, "imag-part");
});

Deno.test("Expr.call", () => {
  const e = Expr.call("sin", [Expr.constant("pi")]);
  if (e.kind === "call") {
    assertEquals(e.callee, "sin");
    assertEquals(e.args.length, 1);
  }
});

Deno.test("Expr.index", () => {
  const e = Expr.index(Expr.ref("c"), [Expr.int(3)]);
  if (e.kind === "index") assertEquals(e.selectors.length, 1);
});

Deno.test("Expr.measure wraps a quantum operand", () => {
  const e = Expr.measure(Op.virtual(0));
  assertEquals(e.kind, "measure-expr");
});

Deno.test("Expr.paren wraps an expression", () => {
  const e = Expr.paren(Expr.int(42));
  if (e.kind === "paren") assertEquals(e.inner.kind, "int-literal");
});

// -------- Op factories --------

Deno.test("Op.virtual", () => {
  const o = Op.virtual(5);
  if (o.kind === "virtual") assertEquals(o.index, 5);
});

Deno.test("Op.physical", () => {
  const o = Op.physical(0);
  if (o.kind === "physical") assertEquals(o.index, 0);
});

Deno.test("Op.identifier", () => {
  const o = Op.identifier("q");
  if (o.kind === "identifier") assertEquals(o.name, "q");
});

Deno.test("Op.indexed", () => {
  const o = Op.indexed(Op.identifier("q"), [Expr.int(3)]);
  assertEquals(o.kind, "indexed");
});

Deno.test("Op.sliced", () => {
  const o = Op.sliced(
    Op.identifier("q"),
    Expr.range(Expr.int(0), undefined, Expr.int(3)),
  );
  assertEquals(o.kind, "sliced");
});

Deno.test("Op.concat", () => {
  const o = Op.concat([Op.identifier("a"), Op.identifier("b")]);
  if (o.kind === "concat") assertEquals(o.parts.length, 2);
});

Deno.test("Op.alias", () => {
  const o = Op.alias("pair");
  if (o.kind === "alias") assertEquals(o.name, "pair");
});

// -------- Dur factories --------

Deno.test("Dur.literal", () => {
  const d = Dur.literal(100, "ns");
  if (d.kind === "literal") {
    assertEquals(d.value, 100);
    assertEquals(d.unit, "ns");
  }
});

Deno.test("Dur.identifier", () => {
  const d = Dur.identifier("t1");
  if (d.kind === "identifier") assertEquals(d.name, "t1");
});

Deno.test("Dur.binary addition", () => {
  const d = Dur.binary("+", Dur.literal(100, "ns"), Dur.literal(50, "ns"));
  if (d.kind === "binary") assertEquals(d.op, "+");
});

Deno.test("Dur.neg", () => {
  const d = Dur.neg(Dur.literal(100, "ns"));
  assertEquals(d.kind, "neg");
});

// -------- State factories --------

Deno.test("State.amplitudes", () => {
  const s = State.amplitudes([Complex.ONE, Complex.ZERO]);
  if (s.kind === "amplitude-vector") assertEquals(s.amplitudes.length, 2);
});

Deno.test("State.basis", () => {
  const s = State.basis(5);
  if (s.kind === "basis-state") assertEquals(s.value, 5);
});

Deno.test("State.bitstring", () => {
  const s = State.bitstring("1010");
  if (s.kind === "bitstring-state") assertEquals(s.bits, "1010");
});

// -------- Assignment operator helpers --------

Deno.test("ALL_ASSIGN_OPS has 13 operators", () => {
  assertEquals(ALL_ASSIGN_OPS.length, 13);
});

Deno.test("ALL_ASSIGN_OPS includes simple and compound forms", () => {
  assert(ALL_ASSIGN_OPS.includes("="));
  assert(ALL_ASSIGN_OPS.includes("+="));
  assert(ALL_ASSIGN_OPS.includes("**="));
  assert(ALL_ASSIGN_OPS.includes(">>="));
});

Deno.test("isAssignOp recognizes valid ops", () => {
  assert(isAssignOp("="));
  assert(isAssignOp("+="));
  assert(isAssignOp("**="));
});

Deno.test("isAssignOp rejects invalid strings", () => {
  assert(!isAssignOp("??"));
  assert(!isAssignOp("+"));
});

// -------- Built-in function helpers --------

Deno.test("BUILTIN_FUNCTION_NAMES has 16 entries", () => {
  assertEquals(BUILTIN_FUNCTION_NAMES.length, 16);
});

Deno.test("BUILTIN_FUNCTION_NAMES includes expected entries", () => {
  for (const name of ["sin", "cos", "sqrt", "arccos", "popcount", "rotl"]) {
    assert(BUILTIN_FUNCTION_NAMES.includes(name));
  }
});

Deno.test("isBuiltinFunction true for sin", () =>
  assert(isBuiltinFunction("sin")));
Deno.test("isBuiltinFunction false for my_func", () =>
  assert(!isBuiltinFunction("my_func")));

// -------- Factory object immutability --------

Deno.test("Expr module is frozen", () => {
  assert(Object.isFrozen(Expr));
});

Deno.test("Op module is frozen", () => {
  assert(Object.isFrozen(Op));
});

Deno.test("Dur module is frozen", () => {
  assert(Object.isFrozen(Dur));
});

Deno.test("State module is frozen", () => {
  assert(Object.isFrozen(State));
});
