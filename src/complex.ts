/**
 * Immutable complex number `a + bi` over the field C.
 *
 * All arithmetic methods return new instances; Complex values are value
 * objects and must never be mutated in place. Equality comparisons use
 * the SDK-wide default epsilon `1e-10` unless otherwise specified.
 */
export class Complex {
  /** Default floating-point tolerance used across the SDK (Section 2). */
  static readonly EPSILON = 1e-10;

  /** The real part. */
  readonly re: number;
  /** The imaginary part. */
  readonly im: number;

  /**
   * Construct a Complex number `re + im*i`.
   * @param re real part
   * @param im imaginary part (default 0)
   */
  constructor(re: number, im: number = 0) {
    this.re = re;
    this.im = im;
  }

  /** The complex zero `0`. */
  static readonly ZERO: Complex = new Complex(0, 0);
  /** The complex one `1`. */
  static readonly ONE: Complex = new Complex(1, 0);
  /** The imaginary unit `i`. */
  static readonly I: Complex = new Complex(0, 1);
  /** The negative imaginary unit `-i`. */
  static readonly MINUS_I: Complex = new Complex(0, -1);
  /** The negative one `-1`. */
  static readonly MINUS_ONE: Complex = new Complex(-1, 0);

  /**
   * Build a complex number from polar form `r * exp(i * theta)`.
   * @param r magnitude
   * @param theta phase angle in radians
   */
  static fromPolar(r: number, theta: number): Complex {
    return new Complex(r * Math.cos(theta), r * Math.sin(theta));
  }

  /**
   * `exp(i * theta)` — the unit-circle complex scalar with phase `theta`.
   * @param theta phase angle in radians
   */
  static exp(theta: number): Complex {
    return new Complex(Math.cos(theta), Math.sin(theta));
  }

  /** Real scalar wrapped as a complex number. */
  static real(x: number): Complex {
    return new Complex(x, 0);
  }

  /** Pure imaginary scalar `x*i`. */
  static imag(x: number): Complex {
    return new Complex(0, x);
  }

  /** Complex addition `this + other`. */
  add(other: Complex): Complex {
    return new Complex(this.re + other.re, this.im + other.im);
  }

  /** Complex subtraction `this - other`. */
  sub(other: Complex): Complex {
    return new Complex(this.re - other.re, this.im - other.im);
  }

  /** Complex multiplication `this * other`. */
  mul(other: Complex): Complex {
    return new Complex(
      this.re * other.re - this.im * other.im,
      this.re * other.im + this.im * other.re,
    );
  }

  /** Complex division `this / other`. Throws if `other` is exactly zero. */
  div(other: Complex): Complex {
    const denom = other.re * other.re + other.im * other.im;
    if (denom === 0) throw new Error("Complex division by zero");
    return new Complex(
      (this.re * other.re + this.im * other.im) / denom,
      (this.im * other.re - this.re * other.im) / denom,
    );
  }

  /** Multiplication by a real scalar. */
  scale(s: number): Complex {
    return new Complex(this.re * s, this.im * s);
  }

  /** The complex conjugate `a - bi`. */
  conjugate(): Complex {
    return new Complex(this.re, -this.im);
  }

  /** Additive inverse `-a - bi`. */
  neg(): Complex {
    return new Complex(-this.re, -this.im);
  }

  /** Absolute value / modulus `|z| = sqrt(a^2 + b^2)`. */
  magnitude(): number {
    return Math.hypot(this.re, this.im);
  }

  /** Squared magnitude `a^2 + b^2`. */
  magnitudeSquared(): number {
    return this.re * this.re + this.im * this.im;
  }

  /**
   * Principal argument / phase `arg(z)` in `(-pi, pi]`.
   * Returns 0 for the complex zero.
   */
  phase(): number {
    if (this.re === 0 && this.im === 0) return 0;
    return Math.atan2(this.im, this.re);
  }

  /**
   * Approximate entrywise equality against `other` within `epsilon`
   * (default `Complex.EPSILON`). Uses complex-magnitude difference
   * `|this - other| <= epsilon`, matching Section 2's `Matrix.equals`
   * entrywise rule.
   */
  equals(other: Complex, epsilon: number = Complex.EPSILON): boolean {
    const dr = this.re - other.re;
    const di = this.im - other.im;
    return Math.hypot(dr, di) <= epsilon;
  }

  /** Human-readable string representation. */
  toString(): string {
    if (this.im === 0) return `${this.re}`;
    if (this.re === 0) return `${this.im}i`;
    const sign = this.im >= 0 ? "+" : "-";
    return `${this.re}${sign}${Math.abs(this.im)}i`;
  }
}
