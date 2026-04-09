import { Complex } from "./complex.ts";

/**
 * Immutable dense matrix over the complex field `C`.
 *
 * All methods return new instances; instances and their internal
 * row arrays must never be mutated. Equality is entrywise approximate
 * comparison with `Complex.EPSILON` (Section 2).
 *
 * Matrices are stored row-major: `data[row][col]`. Multi-qubit gate
 * matrices use the Section 2 MSB-first local operand ordering. See
 * `Matrix.permuteQubits` for bridging to the simulator's little-endian
 * state-vector indexing.
 */
export class Matrix {
  /** Number of rows. */
  readonly rows: number;
  /** Number of columns. */
  readonly cols: number;
  /** Row-major data. Callers must not mutate. */
  readonly data: readonly (readonly Complex[])[];

  /**
   * Construct a matrix from a row-major 2D `Complex` array. The input
   * is not cloned; callers must not mutate it afterwards.
   */
  constructor(data: readonly (readonly Complex[])[]) {
    this.rows = data.length;
    this.cols = data.length === 0 ? 0 : data[0].length;
    for (let i = 1; i < this.rows; i++) {
      if (data[i].length !== this.cols) {
        throw new Error(
          `Matrix row ${i} has length ${data[i].length}, expected ${this.cols}`,
        );
      }
    }
    this.data = data;
  }

  /**
   * Build a matrix from a row-major 2D number array, where each number
   * is interpreted as a real-valued complex number.
   */
  static real(data: readonly (readonly number[])[]): Matrix {
    return new Matrix(data.map((row) => row.map((x) => new Complex(x, 0))));
  }

  /** The `n × n` identity matrix. */
  static identity(n: number): Matrix {
    const data: Complex[][] = [];
    for (let i = 0; i < n; i++) {
      const row: Complex[] = new Array(n);
      for (let j = 0; j < n; j++) row[j] = i === j ? Complex.ONE : Complex.ZERO;
      data.push(row);
    }
    return new Matrix(data);
  }

  /** The `rows × cols` zero matrix. */
  static zeros(rows: number, cols: number): Matrix {
    const data: Complex[][] = [];
    for (let i = 0; i < rows; i++) {
      const row: Complex[] = new Array(cols);
      for (let j = 0; j < cols; j++) row[j] = Complex.ZERO;
      data.push(row);
    }
    return new Matrix(data);
  }

  /** Build a diagonal matrix from the given complex diagonal entries. */
  static diagonal(diag: readonly Complex[]): Matrix {
    const n = diag.length;
    const data: Complex[][] = [];
    for (let i = 0; i < n; i++) {
      const row: Complex[] = new Array(n);
      for (let j = 0; j < n; j++) row[j] = i === j ? diag[i] : Complex.ZERO;
      data.push(row);
    }
    return new Matrix(data);
  }

  /** Entry at `[row, col]`. */
  get(row: number, col: number): Complex {
    return this.data[row][col];
  }

  /** Matrix multiplication `this * other`. */
  multiply(other: Matrix): Matrix {
    if (this.cols !== other.rows) {
      throw new Error(
        `Matrix dimensions incompatible for multiplication: ${this.rows}×${this.cols} * ${other.rows}×${other.cols}`,
      );
    }
    const out: Complex[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row: Complex[] = new Array(other.cols);
      for (let j = 0; j < other.cols; j++) {
        let sumRe = 0;
        let sumIm = 0;
        for (let k = 0; k < this.cols; k++) {
          const a = this.data[i][k];
          const b = other.data[k][j];
          sumRe += a.re * b.re - a.im * b.im;
          sumIm += a.re * b.im + a.im * b.re;
        }
        row[j] = new Complex(sumRe, sumIm);
      }
      out.push(row);
    }
    return new Matrix(out);
  }

  /** Entrywise addition `this + other`. */
  add(other: Matrix): Matrix {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      throw new Error("Matrix shapes must match for addition");
    }
    const out: Complex[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row: Complex[] = new Array(this.cols);
      for (let j = 0; j < this.cols; j++) {
        row[j] = this.data[i][j].add(other.data[i][j]);
      }
      out.push(row);
    }
    return new Matrix(out);
  }

  /** Entrywise subtraction `this - other`. */
  sub(other: Matrix): Matrix {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      throw new Error("Matrix shapes must match for subtraction");
    }
    const out: Complex[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row: Complex[] = new Array(this.cols);
      for (let j = 0; j < this.cols; j++) {
        row[j] = this.data[i][j].sub(other.data[i][j]);
      }
      out.push(row);
    }
    return new Matrix(out);
  }

  /** Scalar multiplication by a complex number. */
  scale(s: Complex): Matrix {
    const out: Complex[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row: Complex[] = new Array(this.cols);
      for (let j = 0; j < this.cols; j++) row[j] = this.data[i][j].mul(s);
      out.push(row);
    }
    return new Matrix(out);
  }

  /** Scalar multiplication by a real number. */
  scaleReal(s: number): Matrix {
    const out: Complex[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row: Complex[] = new Array(this.cols);
      for (let j = 0; j < this.cols; j++) row[j] = this.data[i][j].scale(s);
      out.push(row);
    }
    return new Matrix(out);
  }

  /** Conjugate transpose `M†`. */
  dagger(): Matrix {
    const out: Complex[][] = [];
    for (let i = 0; i < this.cols; i++) {
      const row: Complex[] = new Array(this.rows);
      for (let j = 0; j < this.rows; j++) row[j] = this.data[j][i].conjugate();
      out.push(row);
    }
    return new Matrix(out);
  }

  /** Kronecker / tensor product `this ⊗ other`. */
  tensor(other: Matrix): Matrix {
    const r = this.rows * other.rows;
    const c = this.cols * other.cols;
    const out: Complex[][] = [];
    for (let i = 0; i < r; i++) {
      const row: Complex[] = new Array(c);
      const i1 = Math.floor(i / other.rows);
      const i2 = i % other.rows;
      for (let j = 0; j < c; j++) {
        const j1 = Math.floor(j / other.cols);
        const j2 = j % other.cols;
        row[j] = this.data[i1][j1].mul(other.data[i2][j2]);
      }
      out.push(row);
    }
    return new Matrix(out);
  }

  /**
   * Apply the matrix to a column vector `vec`, returning a new vector.
   * `vec.length` must equal `this.cols`.
   */
  apply(vec: readonly Complex[]): Complex[] {
    if (vec.length !== this.cols) {
      throw new Error(
        `Vector length ${vec.length} does not match matrix cols ${this.cols}`,
      );
    }
    const out: Complex[] = new Array(this.rows);
    for (let i = 0; i < this.rows; i++) {
      let sumRe = 0;
      let sumIm = 0;
      for (let j = 0; j < this.cols; j++) {
        const a = this.data[i][j];
        const b = vec[j];
        sumRe += a.re * b.re - a.im * b.im;
        sumIm += a.re * b.im + a.im * b.re;
      }
      out[i] = new Complex(sumRe, sumIm);
    }
    return out;
  }

  /** Trace `sum_i M[i,i]`. Requires a square matrix. */
  trace(): Complex {
    if (this.rows !== this.cols) {
      throw new Error("Trace requires square matrix");
    }
    let re = 0;
    let im = 0;
    for (let i = 0; i < this.rows; i++) {
      re += this.data[i][i].re;
      im += this.data[i][i].im;
    }
    return new Complex(re, im);
  }

  /**
   * Determinant of a square matrix via LU decomposition with partial
   * pivoting. O(n^3). Uses complex arithmetic throughout.
   */
  determinant(): Complex {
    if (this.rows !== this.cols) {
      throw new Error("Determinant requires square matrix");
    }
    const n = this.rows;
    // Copy to a mutable working buffer of Complex values (plain objects).
    const a: { re: number; im: number }[][] = [];
    for (let i = 0; i < n; i++) {
      const row: { re: number; im: number }[] = new Array(n);
      for (let j = 0; j < n; j++) {
        row[j] = { re: this.data[i][j].re, im: this.data[i][j].im };
      }
      a.push(row);
    }
    let detRe = 1;
    let detIm = 0;
    for (let k = 0; k < n; k++) {
      // Partial pivot on magnitude.
      let piv = k;
      let pivMag = Math.hypot(a[k][k].re, a[k][k].im);
      for (let i = k + 1; i < n; i++) {
        const m = Math.hypot(a[i][k].re, a[i][k].im);
        if (m > pivMag) {
          pivMag = m;
          piv = i;
        }
      }
      if (pivMag === 0) return Complex.ZERO;
      if (piv !== k) {
        const tmp = a[k];
        a[k] = a[piv];
        a[piv] = tmp;
        detRe = -detRe;
        detIm = -detIm;
      }
      const pk = a[k][k];
      // det *= pk
      const nr = detRe * pk.re - detIm * pk.im;
      const ni = detRe * pk.im + detIm * pk.re;
      detRe = nr;
      detIm = ni;
      // Eliminate below.
      for (let i = k + 1; i < n; i++) {
        // factor = a[i][k] / pk
        const denom = pk.re * pk.re + pk.im * pk.im;
        const aik = a[i][k];
        const fr = (aik.re * pk.re + aik.im * pk.im) / denom;
        const fi = (aik.im * pk.re - aik.re * pk.im) / denom;
        for (let j = k; j < n; j++) {
          const akj = a[k][j];
          const dr = fr * akj.re - fi * akj.im;
          const di = fr * akj.im + fi * akj.re;
          a[i][j] = { re: a[i][j].re - dr, im: a[i][j].im - di };
        }
      }
    }
    return new Complex(detRe, detIm);
  }

  /**
   * Test whether the matrix is unitary: both `M† * M ≈ I` and
   * `M * M† ≈ I` entrywise within `epsilon`.
   */
  isUnitary(epsilon: number = Complex.EPSILON): boolean {
    if (this.rows !== this.cols) return false;
    const d = this.dagger();
    const id = Matrix.identity(this.rows);
    return d.multiply(this).equals(id, epsilon) &&
      this.multiply(d).equals(id, epsilon);
  }

  /**
   * Entrywise approximate equality (Section 2). Requires both matrices
   * to have the same shape. Does NOT quotient by global phase.
   */
  equals(other: Matrix, epsilon: number = Complex.EPSILON): boolean {
    if (this.rows !== other.rows || this.cols !== other.cols) return false;
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        if (!this.data[i][j].equals(other.data[i][j], epsilon)) return false;
      }
    }
    return true;
  }

  /** Human-readable string representation (small matrices only). */
  toString(): string {
    return this.data.map((row) =>
      "[" + row.map((c) => c.toString()).join(", ") + "]"
    ).join("\n");
  }
}
