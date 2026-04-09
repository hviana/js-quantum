/**
 * Expansion API — standalone factory module for building IR nodes
 * defined in `types.ts`.
 *
 * Per Design Principle 6 of Section 5.1, expression construction is
 * separated from statement appending: the factories here return pure
 * value objects (`ClassicalExpr`, `QuantumOperand`, `DurationExpr`,
 * `StateSpec`) without touching any circuit state. `QuantumCircuit`
 * builder methods consume these objects when appending instructions.
 */

import type {
  AssignOp,
  BinaryOperator,
  ClassicalExpr,
  ClassicalType,
  DurationExpr,
  QuantumCircuitBodyRef,
  QuantumOperand,
  StateSpec,
  UnaryOperator,
} from "./types.ts";
import type { Complex } from "./complex.ts";

// =============================================================================
// Classical expression factories (§5.5)
// =============================================================================

/**
 * Pure factory module for constructing `ClassicalExpr` nodes. All
 * methods are side-effect free; the returned objects are plain IR
 * nodes that `QuantumCircuit` builder methods consume when building
 * statement lists.
 */
export const Expr: Readonly<{
  int(
    value: number,
    base?: "decimal" | "binary" | "octal" | "hex",
  ): ClassicalExpr;
  float(value: number): ClassicalExpr;
  imaginary(value: number): ClassicalExpr;
  bool(value: boolean): ClassicalExpr;
  bitstring(value: string): ClassicalExpr;
  duration(
    value: number,
    unit: "ns" | "us" | "ms" | "s" | "dt",
  ): ClassicalExpr;
  constant(name: "pi" | "tau" | "euler" | "im"): ClassicalExpr;
  ref(name: string): ClassicalExpr;
  physicalQubit(index: number): ClassicalExpr;
  array(elements: readonly ClassicalExpr[]): ClassicalExpr;
  set(elements: readonly ClassicalExpr[]): ClassicalExpr;
  range(
    start?: ClassicalExpr,
    step?: ClassicalExpr,
    end?: ClassicalExpr,
  ): ClassicalExpr;
  unary(op: UnaryOperator, operand: ClassicalExpr): ClassicalExpr;
  binary(
    op: BinaryOperator,
    left: ClassicalExpr,
    right: ClassicalExpr,
  ): ClassicalExpr;
  concat(parts: readonly ClassicalExpr[]): ClassicalExpr;
  cast(targetType: ClassicalType, value: ClassicalExpr): ClassicalExpr;
  sizeOf(target: ClassicalExpr, dimension?: ClassicalExpr): ClassicalExpr;
  realPart(operand: ClassicalExpr): ClassicalExpr;
  imagPart(operand: ClassicalExpr): ClassicalExpr;
  call(callee: string, args: readonly ClassicalExpr[]): ClassicalExpr;
  index(
    base: ClassicalExpr,
    selectors: readonly ClassicalExpr[],
  ): ClassicalExpr;
  measure(source: QuantumOperand): ClassicalExpr;
  durationOf(body: QuantumCircuitBodyRef): ClassicalExpr;
  paren(inner: ClassicalExpr): ClassicalExpr;
}> = Object.freeze({
  /** Integer literal. `base` is a source-preservation hint. */
  int(
    value: number,
    base?: "decimal" | "binary" | "octal" | "hex",
  ): ClassicalExpr {
    return { kind: "int-literal", value, base };
  },
  /** Floating-point literal. */
  float(value: number): ClassicalExpr {
    return { kind: "float-literal", value };
  },
  /** Imaginary literal `x*i`. */
  imaginary(value: number): ClassicalExpr {
    return { kind: "imaginary-literal", value };
  },
  /** Boolean literal. */
  bool(value: boolean): ClassicalExpr {
    return { kind: "bool-literal", value };
  },
  /** Bitstring literal (e.g. `"1010"`). */
  bitstring(value: string): ClassicalExpr {
    return { kind: "bitstring-literal", value };
  },
  /** Duration literal with SI or dt unit. */
  duration(
    value: number,
    unit: "ns" | "us" | "ms" | "s" | "dt",
  ): ClassicalExpr {
    return { kind: "duration-literal", value, unit };
  },
  /** Built-in named constant — `pi`, `tau`, `euler`, or `im`. */
  constant(name: "pi" | "tau" | "euler" | "im"): ClassicalExpr {
    return { kind: "builtin-constant", name };
  },
  /** Identifier reference (variable name). */
  ref(name: string): ClassicalExpr {
    return { kind: "identifier", name };
  },
  /** Physical qubit reference `$index`. */
  physicalQubit(index: number): ClassicalExpr {
    return { kind: "physical-qubit", index };
  },
  /** Array literal. */
  array(elements: readonly ClassicalExpr[]): ClassicalExpr {
    return { kind: "array-literal", elements };
  },
  /** Set literal. */
  set(elements: readonly ClassicalExpr[]): ClassicalExpr {
    return { kind: "set-literal", elements };
  },
  /** Range expression `start:step:end` (all components optional). */
  range(
    start?: ClassicalExpr,
    step?: ClassicalExpr,
    end?: ClassicalExpr,
  ): ClassicalExpr {
    return { kind: "range", start, step, end };
  },
  /** Unary operator. */
  unary(op: UnaryOperator, operand: ClassicalExpr): ClassicalExpr {
    return { kind: "unary", op, operand };
  },
  /** Binary operator. */
  binary(
    op: BinaryOperator,
    left: ClassicalExpr,
    right: ClassicalExpr,
  ): ClassicalExpr {
    return { kind: "binary", op, left, right };
  },
  /** Concatenation `a ++ b ++ c`. */
  concat(parts: readonly ClassicalExpr[]): ClassicalExpr {
    return { kind: "concat", parts };
  },
  /** Type cast `(T)(value)`. */
  cast(targetType: ClassicalType, value: ClassicalExpr): ClassicalExpr {
    return { kind: "cast", targetType, value };
  },
  /** `sizeof(target)` or `sizeof(target, dim)`. */
  sizeOf(target: ClassicalExpr, dimension?: ClassicalExpr): ClassicalExpr {
    return { kind: "sizeof", target, dimension };
  },
  /** `real(expr)`. */
  realPart(operand: ClassicalExpr): ClassicalExpr {
    return { kind: "real-part", operand };
  },
  /** `imag(expr)`. */
  imagPart(operand: ClassicalExpr): ClassicalExpr {
    return { kind: "imag-part", operand };
  },
  /** Function / subroutine / extern call. */
  call(callee: string, args: readonly ClassicalExpr[]): ClassicalExpr {
    return { kind: "call", callee, args };
  },
  /** Indexed access `base[s1, s2, ...]`. */
  index(
    base: ClassicalExpr,
    selectors: readonly ClassicalExpr[],
  ): ClassicalExpr {
    return { kind: "index", base, selectors };
  },
  /**
   * `measure q` as an expression (right-hand side of an assignment,
   * or return value).
   */
  measure(source: QuantumOperand): ClassicalExpr {
    return { kind: "measure-expr", source };
  },
  /** `durationof({...})`. */
  durationOf(body: QuantumCircuitBodyRef): ClassicalExpr {
    return { kind: "duration-of", body };
  },
  /** Parenthesized grouping — preserves an explicit paren node. */
  paren(inner: ClassicalExpr): ClassicalExpr {
    return { kind: "paren", inner };
  },
});

// =============================================================================
// Quantum operand factories (§5.4)
// =============================================================================

/**
 * Pure factory module for constructing `QuantumOperand` nodes.
 */
export const Op: Readonly<{
  virtual(index: number): QuantumOperand;
  physical(index: number): QuantumOperand;
  identifier(name: string): QuantumOperand;
  indexed(
    base: QuantumOperand,
    indices: readonly ClassicalExpr[],
  ): QuantumOperand;
  sliced(base: QuantumOperand, slice: ClassicalExpr): QuantumOperand;
  concat(parts: readonly QuantumOperand[]): QuantumOperand;
  alias(name: string): QuantumOperand;
}> = Object.freeze({
  /** Virtual qubit reference by index. */
  virtual(index: number): QuantumOperand {
    return { kind: "virtual", index };
  },
  /** Physical qubit literal `$index`. */
  physical(index: number): QuantumOperand {
    return { kind: "physical", index };
  },
  /** Identifier reference (register or alias name). */
  identifier(name: string): QuantumOperand {
    return { kind: "identifier", name };
  },
  /** Indexed reference `base[i, j, ...]`. */
  indexed(
    base: QuantumOperand,
    indices: readonly ClassicalExpr[],
  ): QuantumOperand {
    return { kind: "indexed", base, indices };
  },
  /** Sliced reference `base[slice]`. */
  sliced(base: QuantumOperand, slice: ClassicalExpr): QuantumOperand {
    return { kind: "sliced", base, slice };
  },
  /** Concatenation `a ++ b ++ c`. */
  concat(parts: readonly QuantumOperand[]): QuantumOperand {
    return { kind: "concat", parts };
  },
  /** Alias reference. */
  alias(name: string): QuantumOperand {
    return { kind: "alias", name };
  },
});

// =============================================================================
// Duration expression factories (§5.14)
// =============================================================================

/**
 * Pure factory module for constructing `DurationExpr` nodes used by
 * timing constructs (`delay`, `box[d]`, `durationof`, etc.).
 */
export const Dur: Readonly<{
  literal(
    value: number,
    unit: "ns" | "us" | "ms" | "s" | "dt",
  ): DurationExpr;
  identifier(name: string): DurationExpr;
  durationOf(body: QuantumCircuitBodyRef): DurationExpr;
  binary(
    op: "+" | "-" | "*" | "/",
    left: DurationExpr,
    right: DurationExpr,
  ): DurationExpr;
  neg(operand: DurationExpr): DurationExpr;
}> = Object.freeze({
  /** Duration literal with SI or dt unit. */
  literal(
    value: number,
    unit: "ns" | "us" | "ms" | "s" | "dt",
  ): DurationExpr {
    return { kind: "literal", value, unit };
  },
  /** Identifier reference to a named duration. */
  identifier(name: string): DurationExpr {
    return { kind: "identifier", name };
  },
  /** `durationof({...})`. */
  durationOf(body: QuantumCircuitBodyRef): DurationExpr {
    return { kind: "duration-of", body };
  },
  /** Binary arithmetic on durations. */
  binary(
    op: "+" | "-" | "*" | "/",
    left: DurationExpr,
    right: DurationExpr,
  ): DurationExpr {
    return { kind: "binary", op, left, right };
  },
  /** Unary negation. */
  neg(operand: DurationExpr): DurationExpr {
    return { kind: "neg", operand };
  },
});

// =============================================================================
// State specification factories (§5.19)
// =============================================================================

/**
 * Pure factory module for constructing `StateSpec` values used by
 * `QuantumCircuit.prepareState` and `QuantumCircuit.initialize`.
 */
export const State: Readonly<{
  amplitudes(amplitudes: readonly Complex[]): StateSpec;
  basis(value: number): StateSpec;
  bitstring(bits: string): StateSpec;
}> = Object.freeze({
  /**
   * Amplitude vector state preparation. `amplitudes.length` must be
   * `2^n` for the target register, and `sum |a_i|^2 ≈ 1`. Normalization
   * is enforced by the circuit-level builder, not here.
   */
  amplitudes(amplitudes: readonly Complex[]): StateSpec {
    return { kind: "amplitude-vector", amplitudes };
  },
  /** Computational basis state `|value⟩` (little-endian register value). */
  basis(value: number): StateSpec {
    return { kind: "basis-state", value };
  },
  /**
   * Bitstring state `|b_0 b_1 ...⟩`. The string is read left-to-right
   * with qubit 0 first, matching Section 5.19.
   */
  bitstring(bits: string): StateSpec {
    return { kind: "bitstring-state", bits };
  },
});

// =============================================================================
// Assignment operator list (§5.10)
// =============================================================================

/**
 * The 13 supported assignment operators (1 simple + 12 compound),
 * exposed for validators and serializers that need to enumerate them.
 */
export const ALL_ASSIGN_OPS: readonly AssignOp[] = Object.freeze([
  "=",
  "+=",
  "-=",
  "*=",
  "/=",
  "&=",
  "|=",
  "~=",
  "^=",
  "<<=",
  ">>=",
  "%=",
  "**=",
]);

/** Test whether a string is one of the valid assignment operators. */
export function isAssignOp(s: string): s is AssignOp {
  return (ALL_ASSIGN_OPS as readonly string[]).includes(s);
}

/**
 * The 16 built-in function names recognized by OpenQASM 3.1's
 * `CallExpr`. Any other identifier in a `call` must refer to a
 * user-defined subroutine or extern.
 */
export const BUILTIN_FUNCTION_NAMES: readonly string[] = Object.freeze([
  "arccos",
  "arcsin",
  "arctan",
  "ceiling",
  "cos",
  "exp",
  "floor",
  "log",
  "mod",
  "popcount",
  "pow",
  "rotl",
  "rotr",
  "sin",
  "sqrt",
  "tan",
]);

/** Test whether a name is one of the OpenQASM 3.1 built-in functions. */
export function isBuiltinFunction(name: string): boolean {
  return BUILTIN_FUNCTION_NAMES.includes(name);
}
