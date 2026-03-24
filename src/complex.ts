/**
 * @module complex
 * Complex number arithmetic for quantum computing.
 *
 * Provides a complete implementation of complex number operations required
 * for quantum state manipulation, gate matrices, and probability calculations.
 *
 * @example
 * ```ts
 * import { Complex } from "./complex.ts";
 *
 * const a = new Complex(1, 2);   // 1 + 2i
 * const b = new Complex(3, -1);  // 3 - i
 * const c = a.mul(b);            // (1+2i)(3-i) = 5 + 5i
 * ```
 *
 * @author Henrique Emanoel Viana
 * @license MIT
 */

/** Tolerance for floating-point comparison. */
const EPSILON = 1e-12;

/**
 * Represents a complex number `re + im·i`.
 *
 * This class is immutable — all arithmetic operations return new instances.
 * It provides all the algebraic operations necessary for quantum computing,
 * including addition, multiplication, conjugation, polar form conversion,
 * and magnitude computation.
 */
export class Complex {
  /** Real part of the complex number. */
  readonly re: number;
  /** Imaginary part of the complex number. */
  readonly im: number;

  /** The complex zero: 0 + 0i. */
  static readonly ZERO = new Complex(0, 0);
  /** The real unit: 1 + 0i. */
  static readonly ONE = new Complex(1, 0);
  /** The imaginary unit: 0 + 1i. */
  static readonly I = new Complex(0, 1);
  /** Negative imaginary unit: 0 - 1i. */
  static readonly MINUS_I = new Complex(0, -1);
  /** Negative real unit: -1 + 0i. */
  static readonly MINUS_ONE = new Complex(-1, 0);

  /**
   * Creates a new complex number.
   * @param re - Real part (default 0).
   * @param im - Imaginary part (default 0).
   */
  constructor(re = 0, im = 0) {
    this.re = re;
    this.im = im;
  }

  /**
   * Creates a complex number from polar form: r·e^(iθ).
   * @param r - Magnitude (radius).
   * @param theta - Phase angle in radians.
   * @returns The complex number r·cos(θ) + r·sin(θ)·i.
   */
  static fromPolar(r: number, theta: number): Complex {
    return new Complex(r * Math.cos(theta), r * Math.sin(theta));
  }

  /**
   * Creates a complex number from Euler's formula: e^(iθ).
   * @param theta - Phase angle in radians.
   * @returns The complex number cos(θ) + sin(θ)·i.
   */
  static exp(theta: number): Complex {
    return Complex.fromPolar(1, theta);
  }

  /**
   * Adds two complex numbers.
   * @param other - The addend.
   * @returns `this + other`.
   */
  add(other: Complex): Complex {
    return new Complex(this.re + other.re, this.im + other.im);
  }

  /**
   * Subtracts a complex number.
   * @param other - The subtrahend.
   * @returns `this - other`.
   */
  sub(other: Complex): Complex {
    return new Complex(this.re - other.re, this.im - other.im);
  }

  /**
   * Multiplies two complex numbers.
   * Uses the identity: (a+bi)(c+di) = (ac-bd) + (ad+bc)i.
   * @param other - The multiplier.
   * @returns `this × other`.
   */
  mul(other: Complex): Complex {
    return new Complex(
      this.re * other.re - this.im * other.im,
      this.re * other.im + this.im * other.re,
    );
  }

  /**
   * Multiplies by a real scalar.
   * @param scalar - The real multiplier.
   * @returns `scalar × this`.
   */
  scale(scalar: number): Complex {
    return new Complex(this.re * scalar, this.im * scalar);
  }

  /**
   * Divides by another complex number.
   * @param other - The divisor (must be non-zero).
   * @returns `this / other`.
   * @throws {Error} If `other` is zero.
   */
  div(other: Complex): Complex {
    const denom = other.re * other.re + other.im * other.im;
    if (denom < EPSILON) {
      throw new Error("Division by zero complex number");
    }
    return new Complex(
      (this.re * other.re + this.im * other.im) / denom,
      (this.im * other.re - this.re * other.im) / denom,
    );
  }

  /**
   * Returns the complex conjugate: a - bi.
   * @returns The conjugate of this complex number.
   */
  conjugate(): Complex {
    return new Complex(this.re, -this.im);
  }

  /**
   * Returns the negation: -(a + bi).
   * @returns The negated complex number.
   */
  negate(): Complex {
    return new Complex(-this.re, -this.im);
  }

  /**
   * Returns the squared magnitude: |z|² = a² + b².
   * This avoids the square root and is used extensively in
   * probability calculations (Born rule).
   * @returns The squared magnitude.
   */
  magnitudeSquared(): number {
    return this.re * this.re + this.im * this.im;
  }

  /**
   * Returns the magnitude (absolute value): |z| = √(a² + b²).
   * @returns The magnitude.
   */
  magnitude(): number {
    return Math.sqrt(this.magnitudeSquared());
  }

  /**
   * Returns the phase angle (argument) in radians.
   * @returns The phase angle θ ∈ (-π, π].
   */
  phase(): number {
    return Math.atan2(this.im, this.re);
  }

  /**
   * Checks approximate equality with another complex number.
   * @param other - The complex number to compare.
   * @param epsilon - Tolerance (default 1e-10).
   * @returns True if both parts are within tolerance.
   */
  equals(other: Complex, epsilon = 1e-10): boolean {
    return (
      Math.abs(this.re - other.re) < epsilon &&
      Math.abs(this.im - other.im) < epsilon
    );
  }

  /**
   * Returns true if this number is approximately zero.
   * @param epsilon - Tolerance (default 1e-10).
   */
  isZero(epsilon = 1e-10): boolean {
    return this.magnitudeSquared() < epsilon * epsilon;
  }

  /**
   * Formats the complex number as a human-readable string.
   * @returns A string like "1+2i", "3", "4i", etc.
   */
  toString(): string {
    const r = roundIfClose(this.re);
    const i = roundIfClose(this.im);
    if (i === 0) return `${r}`;
    if (r === 0) return i === 1 ? "i" : i === -1 ? "-i" : `${i}i`;
    const sign = i > 0 ? "+" : "";
    const imStr = Math.abs(i) === 1 ? (i > 0 ? "i" : "-i") : `${i}i`;
    return `${r}${sign}${imStr}`;
  }

  /**
   * Creates a Complex from a plain object (deserialization helper).
   * @param obj - Object with `re` and `im` properties.
   */
  static from(obj: { re: number; im: number }): Complex {
    return new Complex(obj.re, obj.im);
  }
}

/**
 * Rounds a number to zero if it's very close to zero,
 * to an integer if close to one, etc. Aids string formatting.
 */
function roundIfClose(x: number, epsilon = 1e-10): number {
  const rounded = Math.round(x);
  if (Math.abs(x - rounded) < epsilon) return rounded;
  return parseFloat(x.toPrecision(8));
}
