/**
 * @module circuit
 * Quantum circuit definition and builder.
 *
 * Provides the {@link CircuitBuilder} class used within the `quantum()` function
 * to construct a quantum circuit declaratively, and the {@link quantum} factory
 * function that creates a restricted scope for circuit construction.
 *
 * @example
 * ```ts
 * import { quantum } from "./circuit.ts";
 *
 * const code = quantum(2, 2, (qc) => {
 *   qc.h(0);
 *   qc.cx(0, 1);
 *   qc.measure(0, 0);
 *   qc.measure(1, 1);
 * });
 * ```
 *
 * @author Henrique Emanoel Viana
 * @license MIT
 */

import type {
  CircuitInstruction,
  ClassicalCondition,
  GateName,
  GateOptions,
  QuantumCode,
} from "./types.ts";

/**
 * A proxy that records quantum operations in order.
 *
 * This class is only instantiated by the {@link quantum} function.
 * Users interact with it through the callback parameter `qc`.
 * It exposes **only** quantum operations — any attempt to use
 * arbitrary JavaScript constructs will not affect the circuit.
 *
 * All gate methods accept an optional {@link GateOptions} object
 * as their last parameter, enabling:
 * - `ctrl`: a control qubit that conditions gate execution on |1⟩
 * - `cif`: a classical register value that conditions execution
 */
export class CircuitBuilder {
  /** @internal */
  private readonly _instructions: CircuitInstruction[] = [];
  /** @internal */
  private readonly _numQubits: number;
  /** @internal */
  private readonly _numClassicalBits: number;
  /** @internal */
  private readonly _paramNames: Set<string> = new Set();
  /** @internal */
  private _locked = false;

  /**
   * @internal
   * @param numQubits - Number of qubits in the circuit.
   * @param numClassicalBits - Number of classical register bits.
   */
  constructor(numQubits: number, numClassicalBits: number) {
    if (numQubits < 1) throw new Error("Circuit must have at least 1 qubit");
    if (numClassicalBits < 0) {
      throw new Error("Classical bits cannot be negative");
    }
    this._numQubits = numQubits;
    this._numClassicalBits = numClassicalBits;
  }

  // ─── Validation Helpers ──────────────────────────────────────────

  /** @internal Validates a qubit index. */
  private _validateQubit(q: number, label = "qubit"): void {
    if (!Number.isInteger(q) || q < 0 || q >= this._numQubits) {
      throw new Error(
        `Invalid ${label} index ${q}. Must be in [0, ${this._numQubits - 1}]`,
      );
    }
  }

  /** @internal Validates a classical bit index. */
  private _validateBit(b: number): void {
    if (!Number.isInteger(b) || b < 0 || b >= this._numClassicalBits) {
      throw new Error(
        `Invalid classical bit index ${b}. Must be in [0, ${
          this._numClassicalBits - 1
        }]`,
      );
    }
  }

  /** @internal Ensures distinct qubits. */
  private _validateDistinct(qubits: number[]): void {
    const seen = new Set(qubits);
    if (seen.size !== qubits.length) {
      throw new Error("Gate targets must be distinct qubits");
    }
  }

  /** @internal Validates options and ensures control qubit is distinct from targets. */
  private _validateOptions(
    opts: GateOptions | undefined,
    targets: number[],
  ): void {
    if (!opts) return;
    if (opts.ctrl !== undefined) {
      this._validateQubit(opts.ctrl, "control qubit");
      if (targets.includes(opts.ctrl)) {
        throw new Error("Control qubit must be different from target qubits");
      }
    }
    if (opts.cif !== undefined) {
      if (!Number.isInteger(opts.cif) || opts.cif < 0) {
        throw new Error(
          "Classical condition value must be a non-negative integer",
        );
      }
    }
  }

  /** @internal Adds an instruction. */
  private _addInstruction(
    gate: GateName,
    targets: number[],
    params: number[],
    opts?: GateOptions,
    paramRefs?: string[],
  ): this {
    if (this._locked) {
      throw new Error("Cannot modify circuit after it has been built");
    }
    const instr: CircuitInstruction = { gate, targets, params };
    if (opts?.ctrl !== undefined) instr.ctrl = opts.ctrl;
    if (opts?.cif !== undefined) instr.condition = { value: opts.cif };
    if (paramRefs && paramRefs.length > 0) instr.paramRefs = paramRefs;
    this._instructions.push(instr);
    return this;
  }

  // ─── Parameter Access ────────────────────────────────────────────

  /**
   * Declares and retrieves a named simulation parameter.
   *
   * Parameters are resolved at simulation time from the `params` object
   * passed to `simulate()`. During circuit construction, this returns 0
   * as a placeholder — the actual value is injected during simulation.
   *
   * @param name - The parameter name (e.g., `"theta"`).
   * @returns 0 (placeholder). The actual value is resolved at simulation time.
   *
   * @example
   * ```ts
   * const code = quantum(1, 0, (qc) => {
   *   qc.rx(qc.param("theta"), 0);
   * });
   * simulate(code, { theta: Math.PI / 4 }, 1024);
   * ```
   */
  param(name: string): number {
    this._paramNames.add(name);
    return 0; // Placeholder; actual value resolved during simulation
  }

  // ─── Single-Qubit Gates ──────────────────────────────────────────

  /**
   * Applies the Hadamard gate to a qubit.
   *
   * H|0⟩ = (|0⟩+|1⟩)/√2 — creates an equal superposition.
   *
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  h(qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("h", [qubit], [], opts);
  }

  /**
   * Applies the Pauli-X (NOT) gate to a qubit.
   *
   * Flips |0⟩ ↔ |1⟩.
   *
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  x(qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("x", [qubit], [], opts);
  }

  /**
   * Applies the Pauli-Y gate to a qubit.
   *
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  y(qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("y", [qubit], [], opts);
  }

  /**
   * Applies the Pauli-Z gate to a qubit.
   *
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  z(qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("z", [qubit], [], opts);
  }

  /**
   * Applies the S gate (√Z) to a qubit.
   *
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  s(qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("s", [qubit], [], opts);
  }

  /**
   * Applies the S† (S-dagger) gate to a qubit.
   *
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  sdg(qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("sdg", [qubit], [], opts);
  }

  /**
   * Applies the T gate (√S) to a qubit.
   *
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  t(qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("t", [qubit], [], opts);
  }

  /**
   * Applies the T† (T-dagger) gate to a qubit.
   *
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  tdg(qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("tdg", [qubit], [], opts);
  }

  /**
   * Applies the SX (√X) gate to a qubit.
   *
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  sx(qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("sx", [qubit], [], opts);
  }

  /**
   * Applies the SX† (SX-dagger) gate to a qubit.
   *
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  sxdg(qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("sxdg", [qubit], [], opts);
  }

  /**
   * Applies the Identity gate (no-op) to a qubit.
   *
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  id(qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("id", [qubit], [], opts);
  }

  // ─── Parameterized Single-Qubit Gates ────────────────────────────

  /**
   * Applies the Phase gate P(λ) to a qubit.
   *
   * Adds a phase e^(iλ) to |1⟩.
   *
   * @param lambda - Phase rotation angle in radians.
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  p(lambda: number, qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("p", [qubit], [lambda], opts);
  }

  /**
   * Applies the RZ gate (Z-axis rotation) to a qubit.
   *
   * @param lambda - Rotation angle in radians.
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  rz(lambda: number, qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("rz", [qubit], [lambda], opts);
  }

  /**
   * Applies the RX gate (X-axis rotation) to a qubit.
   *
   * @param theta - Rotation angle in radians.
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  rx(theta: number, qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("rx", [qubit], [theta], opts);
  }

  /**
   * Applies the general U gate U(θ, φ, λ) to a qubit.
   *
   * Any single-qubit unitary can be expressed as U(θ, φ, λ).
   *
   * @param theta - Polar angle θ.
   * @param phi - Azimuthal angle φ.
   * @param lambda - Phase angle λ.
   * @param qubit - Target qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  u(
    theta: number,
    phi: number,
    lambda: number,
    qubit: number,
    opts?: GateOptions,
  ): this {
    this._validateQubit(qubit);
    this._validateOptions(opts, [qubit]);
    return this._addInstruction("u", [qubit], [theta, phi, lambda], opts);
  }

  // ─── Two-Qubit Gates ─────────────────────────────────────────────

  /**
   * Applies the CNOT (CX) gate.
   *
   * Flips the target qubit if the control qubit is |1⟩.
   *
   * @param control - Control qubit index.
   * @param target - Target qubit index.
   * @param opts - Optional additional control qubit and/or classical condition.
   */
  cx(control: number, target: number, opts?: GateOptions): this {
    this._validateQubit(control, "control qubit");
    this._validateQubit(target, "target qubit");
    this._validateDistinct([control, target]);
    this._validateOptions(opts, [control, target]);
    return this._addInstruction("cx", [control, target], [], opts);
  }

  /**
   * Applies the SWAP gate.
   *
   * Swaps the states of two qubits.
   *
   * @param qubit1 - First qubit index.
   * @param qubit2 - Second qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  swap(qubit1: number, qubit2: number, opts?: GateOptions): this {
    this._validateQubit(qubit1, "qubit1");
    this._validateQubit(qubit2, "qubit2");
    this._validateDistinct([qubit1, qubit2]);
    this._validateOptions(opts, [qubit1, qubit2]);
    return this._addInstruction("swap", [qubit1, qubit2], [], opts);
  }

  /**
   * Applies the RXX gate (XX Ising interaction).
   *
   * @param theta - Rotation angle in radians.
   * @param qubit1 - First qubit index.
   * @param qubit2 - Second qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  rxx(theta: number, qubit1: number, qubit2: number, opts?: GateOptions): this {
    this._validateQubit(qubit1, "qubit1");
    this._validateQubit(qubit2, "qubit2");
    this._validateDistinct([qubit1, qubit2]);
    this._validateOptions(opts, [qubit1, qubit2]);
    return this._addInstruction("rxx", [qubit1, qubit2], [theta], opts);
  }

  /**
   * Applies the RZZ gate (ZZ Ising interaction).
   *
   * @param theta - Rotation angle in radians.
   * @param qubit1 - First qubit index.
   * @param qubit2 - Second qubit index.
   * @param opts - Optional control qubit and/or classical condition.
   */
  rzz(theta: number, qubit1: number, qubit2: number, opts?: GateOptions): this {
    this._validateQubit(qubit1, "qubit1");
    this._validateQubit(qubit2, "qubit2");
    this._validateDistinct([qubit1, qubit2]);
    this._validateOptions(opts, [qubit1, qubit2]);
    return this._addInstruction("rzz", [qubit1, qubit2], [theta], opts);
  }

  // ─── Three-Qubit Gates ────────────────────────────────────────────

  /**
   * Applies the Toffoli (CCX) gate — doubly-controlled NOT.
   *
   * Flips the target qubit only when both controls are |1⟩.
   *
   * @param control1 - First control qubit index.
   * @param control2 - Second control qubit index.
   * @param target - Target qubit index.
   * @param opts - Optional additional control qubit and/or classical condition.
   */
  ccx(
    control1: number,
    control2: number,
    target: number,
    opts?: GateOptions,
  ): this {
    this._validateQubit(control1, "control1");
    this._validateQubit(control2, "control2");
    this._validateQubit(target, "target");
    this._validateDistinct([control1, control2, target]);
    this._validateOptions(opts, [control1, control2, target]);
    return this._addInstruction("ccx", [control1, control2, target], [], opts);
  }

  /**
   * Applies the RCCX gate (relative-phase Toffoli).
   *
   * Same truth table as Toffoli but with relative phases on some states.
   * Requires 3 qubits.
   *
   * @param qubit0 - First control qubit.
   * @param qubit1 - Second control qubit.
   * @param qubit2 - Target qubit.
   * @param opts - Optional additional control qubit and/or classical condition.
   */
  rccx(
    qubit0: number,
    qubit1: number,
    qubit2: number,
    opts?: GateOptions,
  ): this {
    this._validateQubit(qubit0, "qubit0");
    this._validateQubit(qubit1, "qubit1");
    this._validateQubit(qubit2, "qubit2");
    this._validateDistinct([qubit0, qubit1, qubit2]);
    this._validateOptions(opts, [qubit0, qubit1, qubit2]);
    return this._addInstruction("rccx", [qubit0, qubit1, qubit2], [], opts);
  }

  // ─── Four-Qubit Gates ─────────────────────────────────────────────

  /**
   * Applies the RC3X gate (relative-phase 3-controlled X).
   *
   * Requires 4 qubits: 3 controls and 1 target.
   *
   * @param q0 - First control qubit.
   * @param q1 - Second control qubit.
   * @param q2 - Third control qubit.
   * @param q3 - Target qubit.
   * @param opts - Optional additional control qubit and/or classical condition.
   */
  rc3x(
    q0: number,
    q1: number,
    q2: number,
    q3: number,
    opts?: GateOptions,
  ): this {
    this._validateQubit(q0, "q0");
    this._validateQubit(q1, "q1");
    this._validateQubit(q2, "q2");
    this._validateQubit(q3, "q3");
    this._validateDistinct([q0, q1, q2, q3]);
    this._validateOptions(opts, [q0, q1, q2, q3]);
    return this._addInstruction("rc3x", [q0, q1, q2, q3], [], opts);
  }

  // ─── Non-Unitary Operations ───────────────────────────────────────

  /**
   * Measures a qubit in the computational (Z) basis.
   *
   * This is a **non-reversible** operation. It collapses the qubit state
   * to |0⟩ or |1⟩ based on the Born rule probabilities, and stores the
   * result in the specified classical bit.
   *
   * @param qubit - The qubit to measure.
   * @param classicalBit - The classical register bit to store the result.
   * @param opts - Optional classical condition.
   */
  measure(qubit: number, classicalBit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    this._validateBit(classicalBit);
    const o: GateOptions = { ...(opts ?? {}) };
    // Measure has no control qubit
    delete o.ctrl;
    return this._addInstruction("measure", [qubit], [classicalBit], o);
  }

  /**
   * Resets a qubit to the |0⟩ state.
   *
   * This is a **non-reversible** operation. Regardless of the current state,
   * the qubit is forced to |0⟩.
   *
   * @param qubit - The qubit to reset.
   * @param opts - Optional classical condition.
   */
  reset(qubit: number, opts?: GateOptions): this {
    this._validateQubit(qubit);
    const o: GateOptions = { ...(opts ?? {}) };
    delete o.ctrl;
    return this._addInstruction("reset", [qubit], [], o);
  }

  // ─── Build ────────────────────────────────────────────────────────

  /**
   * @internal Builds the immutable QuantumCode from the recorded instructions.
   */
  build(): QuantumCode {
    this._locked = true;
    return {
      numQubits: this._numQubits,
      numClassicalBits: this._numClassicalBits,
      instructions: Object.freeze([...this._instructions]),
      parameterNames: Object.freeze([...this._paramNames]),
    };
  }
}

/**
 * Creates a quantum circuit within a controlled scope.
 *
 * The `builder` callback receives a {@link CircuitBuilder} that exposes
 * only quantum operations. The resulting {@link QuantumCode} object can
 * then be serialized to JSON or executed via `simulate()`.
 *
 * @param numQubits - Number of qubits in the circuit.
 * @param numClassicalBits - Number of classical register bits.
 * @param builder - A callback that builds the circuit using `qc` methods.
 * @returns An immutable {@link QuantumCode} representing the circuit.
 *
 * @example
 * ```ts
 * import { quantum } from "@hev/js-quantum";
 *
 * const bellState = quantum(2, 2, (qc) => {
 *   qc.h(0);          // Hadamard on qubit 0
 *   qc.cx(0, 1);      // CNOT: control=0, target=1
 *   qc.measure(0, 0); // Measure qubit 0 into classical bit 0
 *   qc.measure(1, 1); // Measure qubit 1 into classical bit 1
 * });
 * ```
 *
 * @throws {Error} If `numQubits < 1` or `numClassicalBits < 0`.
 */
export function quantum(
  numQubits: number,
  numClassicalBits: number,
  builder: (qc: CircuitBuilder) => void,
): QuantumCode {
  if (!Number.isInteger(numQubits) || numQubits < 1) {
    throw new Error("numQubits must be a positive integer");
  }
  if (!Number.isInteger(numClassicalBits) || numClassicalBits < 0) {
    throw new Error("numClassicalBits must be a non-negative integer");
  }

  const qc = new CircuitBuilder(numQubits, numClassicalBits);

  try {
    builder(qc);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Circuit construction error: ${error.message}`);
    }
    throw new Error("Circuit construction error: unknown error");
  }

  return qc.build();
}
