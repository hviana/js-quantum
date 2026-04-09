/**
 * Symbolic parameter / expression system for circuit angles and other
 * real-valued classical quantities.
 *
 * This module implements the exact-expression profile required by
 * Section 2 (minimum exact-expression conformance): exact retention of
 * immutable symbols, integer literals, `pi`, and affine combinations
 * with exact rational coefficients; exact proofs of literal zero,
 * normalized-expression equality, `2*pi*n` membership, and
 * integer-valuedness.
 *
 * Expressions are stored as an immutable tree. A normalization pass
 * collects affine combinations of `pi` and symbols with exact rational
 * coefficients, enabling the equality and classification proofs
 * required throughout Phase Convention and Section 3.
 */

/** Kinds of expression nodes. */
export type AngleKind =
  | "int"
  | "rational"
  | "float"
  | "pi"
  | "tau"
  | "euler"
  | "symbol"
  | "neg"
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "pow"
  | "call";

/**
 * Immutable angle / parameter expression. Supports exact symbolic
 * storage (never reduces modulo 2*pi unless the rewrite is proved
 * exact) and, when fully bound, exact numeric evaluation.
 */
export class AngleExpr {
  readonly kind: AngleKind;
  readonly num?: number;
  readonly den?: number;
  readonly name?: string;
  readonly args?: readonly AngleExpr[];
  readonly callee?: string;

  /** @internal — prefer the static factory methods. */
  constructor(init: {
    kind: AngleKind;
    num?: number;
    den?: number;
    name?: string;
    args?: readonly AngleExpr[];
    callee?: string;
  }) {
    this.kind = init.kind;
    this.num = init.num;
    this.den = init.den;
    this.name = init.name;
    this.args = init.args;
    this.callee = init.callee;
  }

  /** Exact integer literal. */
  static int(n: number): AngleExpr {
    if (!Number.isInteger(n)) {
      throw new Error(`AngleExpr.int requires integer, got ${n}`);
    }
    return new AngleExpr({ kind: "int", num: n, den: 1 });
  }

  /** Exact rational literal `num/den`. */
  static rational(num: number, den: number): AngleExpr {
    if (!Number.isInteger(num) || !Number.isInteger(den)) {
      throw new Error(
        "AngleExpr.rational requires integer numerator and denominator",
      );
    }
    if (den === 0) {
      throw new Error("AngleExpr.rational denominator must be nonzero");
    }
    const g = gcd(Math.abs(num), Math.abs(den));
    let n = num / g;
    let d = den / g;
    if (d < 0) {
      n = -n;
      d = -d;
    }
    if (d === 1) return new AngleExpr({ kind: "int", num: n, den: 1 });
    return new AngleExpr({ kind: "rational", num: n, den: d });
  }

  /** Inexact float literal (used only when no exact source is available). */
  static float(x: number): AngleExpr {
    if (Number.isInteger(x)) return AngleExpr.int(x);
    return new AngleExpr({ kind: "float", num: x });
  }

  /** The built-in constant `pi`. */
  static readonly PI: AngleExpr = new AngleExpr({ kind: "pi" });
  /** The built-in constant `tau = 2*pi`. */
  static readonly TAU: AngleExpr = new AngleExpr({ kind: "tau" });
  /** The built-in constant `e` (Euler's number). */
  static readonly EULER: AngleExpr = new AngleExpr({ kind: "euler" });
  /** Zero. */
  static readonly ZERO: AngleExpr = AngleExpr.int(0);
  /** One. */
  static readonly ONE: AngleExpr = AngleExpr.int(1);

  /** Free symbol by name. */
  static symbol(name: string): AngleExpr {
    return new AngleExpr({ kind: "symbol", name });
  }

  /** Unary negation `-x`. */
  static neg(x: AngleExpr): AngleExpr {
    return new AngleExpr({ kind: "neg", args: [x] });
  }

  /** Addition `a + b`. */
  static add(a: AngleExpr, b: AngleExpr): AngleExpr {
    return new AngleExpr({ kind: "add", args: [a, b] });
  }

  /** Subtraction `a - b`. */
  static sub(a: AngleExpr, b: AngleExpr): AngleExpr {
    return new AngleExpr({ kind: "sub", args: [a, b] });
  }

  /** Multiplication `a * b`. */
  static mul(a: AngleExpr, b: AngleExpr): AngleExpr {
    return new AngleExpr({ kind: "mul", args: [a, b] });
  }

  /** Division `a / b`. */
  static div(a: AngleExpr, b: AngleExpr): AngleExpr {
    return new AngleExpr({ kind: "div", args: [a, b] });
  }

  /** Power `a ** b`. */
  static pow(a: AngleExpr, b: AngleExpr): AngleExpr {
    return new AngleExpr({ kind: "pow", args: [a, b] });
  }

  /** Function call (e.g. `sin`, `cos`, `arcsin`, `sqrt`). */
  static call(callee: string, args: readonly AngleExpr[]): AngleExpr {
    return new AngleExpr({ kind: "call", callee, args });
  }

  /**
   * Substitute bound symbols and return a new expression. Symbols not
   * present in `bindings` are preserved.
   */
  bind(bindings: Readonly<Record<string, number | AngleExpr>>): AngleExpr {
    const b: Record<string, AngleExpr> = {};
    for (const k of Object.keys(bindings)) {
      const v = bindings[k];
      b[k] = typeof v === "number" ? AngleExpr.float(v) : v;
    }
    return bindRec(this, b);
  }

  /** True if this expression has no free symbols and evaluates numerically. */
  isResolved(): boolean {
    switch (this.kind) {
      case "symbol":
        return false;
      case "int":
      case "rational":
      case "float":
      case "pi":
      case "tau":
      case "euler":
        return true;
      default:
        return (this.args ?? []).every((a) => a.isResolved());
    }
  }

  /**
   * Evaluate to a JavaScript number. Throws if unresolved symbols
   * remain. For symbolic checks (exact zero, integer, etc.) use the
   * dedicated static helpers instead of rounding this value.
   */
  evaluate(): number {
    switch (this.kind) {
      case "int":
      case "rational":
        return this.num! / (this.den ?? 1);
      case "float":
        return this.num!;
      case "pi":
        return Math.PI;
      case "tau":
        return 2 * Math.PI;
      case "euler":
        return Math.E;
      case "symbol":
        throw new Error(`Unresolved symbol: ${this.name}`);
      case "neg":
        return -this.args![0].evaluate();
      case "add":
        return this.args![0].evaluate() + this.args![1].evaluate();
      case "sub":
        return this.args![0].evaluate() - this.args![1].evaluate();
      case "mul":
        return this.args![0].evaluate() * this.args![1].evaluate();
      case "div":
        return this.args![0].evaluate() / this.args![1].evaluate();
      case "pow":
        return Math.pow(this.args![0].evaluate(), this.args![1].evaluate());
      case "call": {
        const vals = (this.args ?? []).map((a) => a.evaluate());
        return callBuiltin(this.callee!, vals);
      }
    }
  }

  // -------- operator sugar for ergonomic construction --------

  /** `this + other` */
  plus(other: AngleExpr | number): AngleExpr {
    return AngleExpr.add(this, coerce(other));
  }

  /** `this - other` */
  minus(other: AngleExpr | number): AngleExpr {
    return AngleExpr.sub(this, coerce(other));
  }

  /** `this * other` */
  times(other: AngleExpr | number): AngleExpr {
    return AngleExpr.mul(this, coerce(other));
  }

  /** `this / other` */
  dividedBy(other: AngleExpr | number): AngleExpr {
    return AngleExpr.div(this, coerce(other));
  }

  /** Unary negation. */
  negated(): AngleExpr {
    return AngleExpr.neg(this);
  }

  /** Human-readable string representation (debug only, not OpenQASM). */
  toString(): string {
    switch (this.kind) {
      case "int":
      case "rational":
        return this.den === 1 ? `${this.num}` : `${this.num}/${this.den}`;
      case "float":
        return `${this.num}`;
      case "pi":
        return "pi";
      case "tau":
        return "tau";
      case "euler":
        return "euler";
      case "symbol":
        return this.name!;
      case "neg":
        return `-(${this.args![0]})`;
      case "add":
        return `(${this.args![0]} + ${this.args![1]})`;
      case "sub":
        return `(${this.args![0]} - ${this.args![1]})`;
      case "mul":
        return `(${this.args![0]} * ${this.args![1]})`;
      case "div":
        return `(${this.args![0]} / ${this.args![1]})`;
      case "pow":
        return `(${this.args![0]} ** ${this.args![1]})`;
      case "call":
        return `${this.callee}(${
          (this.args ?? []).map((a) => a.toString()).join(", ")
        })`;
    }
  }
}

/** Accept a number or AngleExpr and return an AngleExpr. */
export function coerce(x: AngleExpr | number): AngleExpr {
  if (typeof x === "number") {
    return Number.isInteger(x) ? AngleExpr.int(x) : AngleExpr.float(x);
  }
  return x;
}

/** Euclidean GCD on non-negative integers. */
function gcd(a: number, b: number): number {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

/** Recursive substitution helper. */
function bindRec(
  e: AngleExpr,
  b: Readonly<Record<string, AngleExpr>>,
): AngleExpr {
  if (e.kind === "symbol" && e.name! in b) return b[e.name!];
  if (!e.args) return e;
  const newArgs = e.args.map((a) => bindRec(a, b));
  const same = newArgs.every((a, i) => a === e.args![i]);
  if (same) return e;
  return new AngleExpr({
    kind: e.kind,
    name: e.name,
    callee: e.callee,
    args: newArgs,
  });
}

/** Built-in function dispatch used by `AngleExpr.evaluate`. */
function callBuiltin(name: string, args: readonly number[]): number {
  switch (name) {
    case "sin":
      return Math.sin(args[0]);
    case "cos":
      return Math.cos(args[0]);
    case "tan":
      return Math.tan(args[0]);
    case "arcsin":
      return Math.asin(args[0]);
    case "arccos":
      return Math.acos(args[0]);
    case "arctan":
      return Math.atan(args[0]);
    case "sqrt":
      return Math.sqrt(args[0]);
    case "exp":
      return Math.exp(args[0]);
    case "log":
      return Math.log(args[0]);
    case "ceiling":
      return Math.ceil(args[0]);
    case "floor":
      return Math.floor(args[0]);
    case "mod":
      return args[0] - Math.floor(args[0] / args[1]) * args[1];
    case "pow":
      return Math.pow(args[0], args[1]);
    case "popcount": {
      let n = args[0] | 0;
      let c = 0;
      while (n) {
        c += n & 1;
        n >>>= 1;
      }
      return c;
    }
    default:
      throw new Error(`Unknown built-in function: ${name}`);
  }
}

/**
 * Wrap a numeric phase to the canonical principal branch `(-pi, pi]`
 * using the deterministic branch-cut snap from Section 2 (Phase
 * Convention 1). If `|w ± pi| <= epsilon`, returns `pi`.
 */
export function wrapPhase(alpha: number, epsilon: number = 1e-10): number {
  const twoPi = 2 * Math.PI;
  let w = alpha - twoPi * Math.floor((alpha + Math.PI) / twoPi);
  if (Math.abs(w - Math.PI) <= epsilon || Math.abs(w + Math.PI) <= epsilon) {
    return Math.PI;
  }
  return w;
}

/**
 * Normalized affine representation of an expression: a rational
 * coefficient for `pi` plus a map from symbol names to rational
 * coefficients. Used for exact zero / `2*pi*n` / integer tests.
 *
 * `num` / `den` give the constant rational offset. If normalization
 * fails (because the expression is outside the minimum exact-expression
 * conformance profile), the whole result is `null`.
 */
export interface AffineForm {
  /** Constant rational offset. */
  constNum: number;
  /** Constant rational denominator. */
  constDen: number;
  /** Rational coefficient of `pi`. */
  piNum: number;
  /** Rational denominator for the coefficient of `pi`. */
  piDen: number;
  /** Symbol coefficients keyed by name: each entry is a rational num/den. */
  symbols: Record<string, { num: number; den: number }>;
}

/**
 * Try to normalize `e` into an affine form over `{1, pi, symbols}`
 * with exact rational coefficients. Returns null if the expression
 * falls outside the minimum conformance profile.
 */
export function toAffine(e: AngleExpr): AffineForm | null {
  switch (e.kind) {
    case "int":
      return { constNum: e.num!, constDen: 1, piNum: 0, piDen: 1, symbols: {} };
    case "rational":
      return {
        constNum: e.num!,
        constDen: e.den!,
        piNum: 0,
        piDen: 1,
        symbols: {},
      };
    case "pi":
      return { constNum: 0, constDen: 1, piNum: 1, piDen: 1, symbols: {} };
    case "tau":
      return { constNum: 0, constDen: 1, piNum: 2, piDen: 1, symbols: {} };
    case "symbol":
      return {
        constNum: 0,
        constDen: 1,
        piNum: 0,
        piDen: 1,
        symbols: { [e.name!]: { num: 1, den: 1 } },
      };
    case "neg": {
      const a = toAffine(e.args![0]);
      if (!a) return null;
      return scaleAffine(a, -1, 1);
    }
    case "add": {
      const a = toAffine(e.args![0]);
      const b = toAffine(e.args![1]);
      if (!a || !b) return null;
      return addAffine(a, b);
    }
    case "sub": {
      const a = toAffine(e.args![0]);
      const b = toAffine(e.args![1]);
      if (!a || !b) return null;
      return addAffine(a, scaleAffine(b, -1, 1));
    }
    case "mul": {
      // At least one side must be a concrete rational constant.
      const a = toAffine(e.args![0]);
      const b = toAffine(e.args![1]);
      if (!a || !b) return null;
      const aConst = isAffineRationalOnly(a);
      const bConst = isAffineRationalOnly(b);
      if (aConst) return scaleAffine(b, a.constNum, a.constDen);
      if (bConst) return scaleAffine(a, b.constNum, b.constDen);
      return null;
    }
    case "div": {
      const a = toAffine(e.args![0]);
      const b = toAffine(e.args![1]);
      if (!a || !b) return null;
      if (!isAffineRationalOnly(b)) return null;
      if (b.constNum === 0) return null;
      return scaleAffine(a, b.constDen, b.constNum);
    }
    default:
      return null;
  }
}

function isAffineRationalOnly(a: AffineForm): boolean {
  return a.piNum === 0 && Object.keys(a.symbols).length === 0;
}

function scaleAffine(a: AffineForm, num: number, den: number): AffineForm {
  const out: AffineForm = {
    constNum: 0,
    constDen: 1,
    piNum: 0,
    piDen: 1,
    symbols: {},
  };
  const c = reduce(a.constNum * num, a.constDen * den);
  out.constNum = c.num;
  out.constDen = c.den;
  const p = reduce(a.piNum * num, a.piDen * den);
  out.piNum = p.num;
  out.piDen = p.den;
  for (const [k, v] of Object.entries(a.symbols)) {
    const r = reduce(v.num * num, v.den * den);
    if (r.num !== 0) out.symbols[k] = r;
  }
  return out;
}

function addAffine(a: AffineForm, b: AffineForm): AffineForm {
  const cc = addRat(a.constNum, a.constDen, b.constNum, b.constDen);
  const pp = addRat(a.piNum, a.piDen, b.piNum, b.piDen);
  const symbols: Record<string, { num: number; den: number }> = {};
  for (const [k, v] of Object.entries(a.symbols)) symbols[k] = { ...v };
  for (const [k, v] of Object.entries(b.symbols)) {
    if (k in symbols) {
      const r = addRat(symbols[k].num, symbols[k].den, v.num, v.den);
      if (r.num === 0) delete symbols[k];
      else symbols[k] = r;
    } else {
      symbols[k] = { ...v };
    }
  }
  return {
    constNum: cc.num,
    constDen: cc.den,
    piNum: pp.num,
    piDen: pp.den,
    symbols,
  };
}

function addRat(
  an: number,
  ad: number,
  bn: number,
  bd: number,
): { num: number; den: number } {
  return reduce(an * bd + bn * ad, ad * bd);
}

function reduce(num: number, den: number): { num: number; den: number } {
  if (den === 0) throw new Error("Rational with zero denominator");
  if (num === 0) return { num: 0, den: 1 };
  const g = gcd(Math.abs(num), Math.abs(den));
  let n = num / g;
  let d = den / g;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  return { num: n, den: d };
}

/**
 * Exact test for "is this expression provably zero?" under the minimum
 * exact-expression conformance profile. Returns `false` for expressions
 * that fall outside the profile.
 */
export function provablyZero(e: AngleExpr): boolean {
  const a = toAffine(e);
  if (!a) return false;
  if (a.constNum !== 0) return false;
  if (a.piNum !== 0) return false;
  return Object.keys(a.symbols).length === 0;
}

/**
 * Exact test for `e ≡ 2*pi*n` for some exact integer `n`. Used by the
 * Phase Convention 1 "scalar phase ≡ 1" proofs.
 */
export function provablyTwoPiMultiple(e: AngleExpr): boolean {
  const a = toAffine(e);
  if (!a) return false;
  if (a.constNum !== 0) return false;
  if (Object.keys(a.symbols).length !== 0) return false;
  // piNum/piDen must be an even integer.
  if (a.piDen !== 1) return false;
  return a.piNum % 2 === 0;
}

/**
 * Exact test for "is this expression an integer?". True when the
 * affine form has no `pi` term, no symbols, and the constant rational
 * has denominator 1.
 */
export function provablyInteger(e: AngleExpr): boolean {
  const a = toAffine(e);
  if (!a) return false;
  if (a.piNum !== 0) return false;
  if (Object.keys(a.symbols).length !== 0) return false;
  return a.constDen === 1;
}

/**
 * If `e` is provably an exact integer, return it. Otherwise null.
 */
export function asExactInteger(e: AngleExpr): number | null {
  if (!provablyInteger(e)) return null;
  const a = toAffine(e)!;
  return a.constNum;
}

/** Exact equality test via normalization. */
export function provablyEqual(a: AngleExpr, b: AngleExpr): boolean {
  return provablyZero(AngleExpr.sub(a, b));
}
