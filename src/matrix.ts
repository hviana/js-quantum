/**
 * @module matrix
 * Matrix algebra for quantum computing.
 *
 * Provides matrix operations essential for quantum gate representation,
 * including multiplication, tensor (Kronecker) product, and
 * conjugate transpose (dagger) operations.
 *
 * @author Henrique Emanoel Viana
 * @license MIT
 */

import { Complex } from "./complex.ts";

/**
 * Represents a complex-valued matrix used for quantum gate operations.
 *
 * Quantum gates are represented as unitary matrices. This class supports
 * all operations needed to construct, compose, and apply gate matrices
 * to quantum state vectors.
 *
 * Matrices are immutable — all operations return new instances.
 *
 * @example
 * ```ts
 * import { Matrix } from "./matrix.ts";
 * import { Complex } from "./complex.ts";
 *
 * // Identity matrix
 * const I = Matrix.identity(2);
 *
 * // Pauli X gate
 * const X = new Matrix(2, 2, [
 *   [Complex.ZERO, Complex.ONE],
 *   [Complex.ONE,  Complex.ZERO],
 * ]);
 * ```
 */
export class Matrix {
  /** Number of rows. */
  readonly rows: number;
  /** Number of columns. */
  readonly cols: number;
  /** Matrix data in row-major order. */
  readonly data: ReadonlyArray<ReadonlyArray<Complex>>;

  /**
   * Creates a new matrix.
   * @param rows - Number of rows.
   * @param cols - Number of columns.
   * @param data - 2D array of Complex values in row-major order.
   */
  constructor(rows: number, cols: number, data: Complex[][]) {
    if (data.length !== rows) {
      throw new Error(`Expected ${rows} rows, got ${data.length}`);
    }
    for (let i = 0; i < rows; i++) {
      if (data[i]!.length !== cols) {
        throw new Error(
          `Row ${i}: expected ${cols} cols, got ${data[i]!.length}`,
        );
      }
    }
    this.rows = rows;
    this.cols = cols;
    this.data = data;
  }

  /**
   * Gets the element at position (row, col).
   * @param row - Row index (0-based).
   * @param col - Column index (0-based).
   * @returns The Complex element at the given position.
   */
  get(row: number, col: number): Complex {
    return this.data[row]![col]!;
  }

  /**
   * Creates an identity matrix of the given size.
   * @param n - Matrix dimension (n×n).
   * @returns The n×n identity matrix.
   */
  static identity(n: number): Matrix {
    const data: Complex[][] = [];
    for (let i = 0; i < n; i++) {
      const row: Complex[] = [];
      for (let j = 0; j < n; j++) {
        row.push(i === j ? Complex.ONE : Complex.ZERO);
      }
      data.push(row);
    }
    return new Matrix(n, n, data);
  }

  /**
   * Creates a zero matrix.
   * @param rows - Number of rows.
   * @param cols - Number of columns.
   * @returns A matrix filled with Complex.ZERO.
   */
  static zeros(rows: number, cols: number): Complex[][] {
    const data: Complex[][] = [];
    for (let i = 0; i < rows; i++) {
      const row: Complex[] = [];
      for (let j = 0; j < cols; j++) {
        row.push(Complex.ZERO);
      }
      data.push(row);
    }
    return data;
  }

  /**
   * Matrix multiplication: this × other.
   * @param other - The right-hand matrix.
   * @returns The product matrix.
   * @throws {Error} If dimensions are incompatible.
   */
  multiply(other: Matrix): Matrix {
    if (this.cols !== other.rows) {
      throw new Error(
        `Cannot multiply ${this.rows}×${this.cols} by ${other.rows}×${other.cols}`,
      );
    }
    const result = Matrix.zeros(this.rows, other.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        let sum = Complex.ZERO;
        for (let k = 0; k < this.cols; k++) {
          sum = sum.add(this.data[i]![k]!.mul(other.data[k]![j]!));
        }
        result[i]![j] = sum;
      }
    }
    return new Matrix(this.rows, other.cols, result);
  }

  /**
   * Multiplies every element by a complex scalar.
   * @param scalar - The scalar multiplier.
   * @returns The scaled matrix.
   */
  scalarMul(scalar: Complex): Matrix {
    const result: Complex[][] = this.data.map((row) =>
      row.map((v) => v.mul(scalar))
    );
    return new Matrix(this.rows, this.cols, result);
  }

  /**
   * Adds two matrices element-wise.
   * @param other - The addend matrix.
   * @returns The sum matrix.
   */
  add(other: Matrix): Matrix {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      throw new Error("Matrix dimensions must match for addition");
    }
    const result: Complex[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row: Complex[] = [];
      for (let j = 0; j < this.cols; j++) {
        row.push(this.data[i]![j]!.add(other.data[i]![j]!));
      }
      result.push(row);
    }
    return new Matrix(this.rows, this.cols, result);
  }

  /**
   * Subtracts another matrix element-wise.
   * @param other - The subtrahend matrix.
   * @returns The difference matrix.
   */
  sub(other: Matrix): Matrix {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      throw new Error("Matrix dimensions must match for subtraction");
    }
    const result: Complex[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const row: Complex[] = [];
      for (let j = 0; j < this.cols; j++) {
        row.push(this.data[i]![j]!.sub(other.data[i]![j]!));
      }
      result.push(row);
    }
    return new Matrix(this.rows, this.cols, result);
  }

  /**
   * Computes the tensor (Kronecker) product: this ⊗ other.
   *
   * The tensor product is fundamental to quantum computing — it combines
   * the state spaces of individual qubits into a composite system.
   *
   * For an m×n matrix A and a p×q matrix B, the result is an (mp)×(nq) matrix.
   *
   * @param other - The right-hand matrix.
   * @returns The Kronecker product matrix.
   */
  tensor(other: Matrix): Matrix {
    const rRows = this.rows * other.rows;
    const rCols = this.cols * other.cols;
    const result = Matrix.zeros(rRows, rCols);

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        for (let k = 0; k < other.rows; k++) {
          for (let l = 0; l < other.cols; l++) {
            result[i * other.rows + k]![j * other.cols + l] = this.data[i]![j]!
              .mul(other.data[k]![l]!);
          }
        }
      }
    }

    return new Matrix(rRows, rCols, result);
  }

  /**
   * Computes the conjugate transpose (Hermitian adjoint / dagger): A†.
   *
   * For a unitary gate U, U† is its inverse: U·U† = I.
   *
   * @returns The conjugate transpose matrix.
   */
  dagger(): Matrix {
    const result: Complex[][] = [];
    for (let j = 0; j < this.cols; j++) {
      const row: Complex[] = [];
      for (let i = 0; i < this.rows; i++) {
        row.push(this.data[i]![j]!.conjugate());
      }
      result.push(row);
    }
    return new Matrix(this.cols, this.rows, result);
  }

  /**
   * Applies this matrix to a state vector: |ψ'⟩ = M|ψ⟩.
   * @param vec - The state vector (array of Complex amplitudes).
   * @returns The resulting state vector.
   */
  apply(vec: Complex[]): Complex[] {
    if (vec.length !== this.cols) {
      throw new Error(
        `Vector length ${vec.length} doesn't match matrix columns ${this.cols}`,
      );
    }
    const result: Complex[] = [];
    for (let i = 0; i < this.rows; i++) {
      let sum = Complex.ZERO;
      for (let j = 0; j < this.cols; j++) {
        sum = sum.add(this.data[i]![j]!.mul(vec[j]!));
      }
      result.push(sum);
    }
    return result;
  }

  /**
   * Computes the trace of this matrix (sum of diagonal elements).
   * @returns The trace as a Complex number.
   */
  trace(): Complex {
    let sum = Complex.ZERO;
    const n = Math.min(this.rows, this.cols);
    for (let i = 0; i < n; i++) {
      sum = sum.add(this.data[i]![i]!);
    }
    return sum;
  }

  /**
   * Checks if this matrix is approximately unitary: M·M† ≈ I.
   * @param epsilon - Tolerance for comparison.
   * @returns True if the matrix is approximately unitary.
   */
  isUnitary(epsilon = 1e-8): boolean {
    if (this.rows !== this.cols) return false;
    const product = this.multiply(this.dagger());
    const identity = Matrix.identity(this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        if (!product.data[i]![j]!.equals(identity.data[i]![j]!, epsilon)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Returns a formatted string representation of the matrix.
   */
  toString(): string {
    return this.data
      .map((row) =>
        "[ " + row.map((v) => v.toString().padStart(10)).join(", ") + " ]"
      )
      .join("\n");
  }
}
