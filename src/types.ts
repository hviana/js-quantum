/**
 * @module types
 * Core type definitions for the jsQuantum library.
 *
 * @author Henrique Emanoel Viana
 * @license MIT
 */

import type { Complex } from "./complex.ts";

/**
 * Represents the name of a supported quantum gate.
 */
export type GateName =
  | "h"
  | "x"
  | "y"
  | "z"
  | "s"
  | "sdg"
  | "t"
  | "tdg"
  | "sx"
  | "sxdg"
  | "rx"
  | "rz"
  | "rxx"
  | "rzz"
  | "p"
  | "u"
  | "cx"
  | "swap"
  | "ccx"
  | "id"
  | "rccx"
  | "rc3x"
  | "measure"
  | "reset";

/**
 * Classical condition for conditional gate execution.
 * The gate executes only if the classical register (interpreted as an integer)
 * equals the specified `value`.
 */
export interface ClassicalCondition {
  /** The integer value the classical register must match for the gate to execute. */
  value: number;
}

/**
 * A single instruction in a quantum circuit.
 * Records a gate application with its target qubits, parameters,
 * optional control qubit, and optional classical condition.
 */
export interface CircuitInstruction {
  /** The gate identifier. */
  gate: GateName;
  /** Target qubit indices. */
  targets: number[];
  /** Gate parameters (rotation angles, etc.). */
  params: number[];
  /** Optional control qubit index for controlled operations. */
  ctrl?: number;
  /** Optional classical condition for conditional execution. */
  condition?: ClassicalCondition;
  /** Parameter names referencing simulation-time values. */
  paramRefs?: string[];
}

/**
 * Options for gate operations, allowing control qubits and classical conditions.
 */
export interface GateOptions {
  /** Control qubit index. When specified, the gate executes only if this qubit is |1⟩. */
  ctrl?: number;
  /**
   * Classical condition value. The gate executes only if the classical register
   * (all classical bits interpreted as an integer) equals this value.
   */
  cif?: number;
}

/**
 * Serialized representation of a quantum circuit, suitable for JSON storage
 * and visual circuit reconstruction.
 */
export interface SerializedCircuit {
  /** Library identifier and version. */
  meta: {
    library: string;
    version: string;
  };
  /** Number of qubits in the circuit. */
  numQubits: number;
  /** Number of classical register bits. */
  numClassicalBits: number;
  /** Ordered list of circuit instructions. */
  instructions: SerializedInstruction[];
}

/**
 * Serialized form of a single circuit instruction.
 */
export interface SerializedInstruction {
  /** Step index (0-based order in the circuit). */
  step: number;
  /** Gate name. */
  gate: GateName;
  /** Target qubit indices. */
  targets: number[];
  /** Numeric gate parameters. */
  params: number[];
  /** Named parameter references (resolved at simulation time). */
  paramRefs?: string[];
  /** Control qubit index, if any. */
  ctrl?: number;
  /** Classical condition, if any. */
  condition?: ClassicalCondition;
}

/**
 * Simulation parameters: a key-value map of named parameters
 * that are resolved at simulation time (e.g., rotation angles).
 */
export type SimulationParams = Record<string, number>;

/**
 * Result of a quantum simulation, mapping computational basis state
 * labels (e.g., "00", "01", "10", "11") to their measured probabilities
 * as percentages (0–100).
 */
export type SimulationResult = Record<string, number>;

/**
 * Internal quantum state represented as an array of complex amplitudes.
 * For n qubits, this array has 2^n entries.
 */
export type StateVector = Complex[];

/**
 * Represents a quantum code block created by the `quantum()` function.
 * Encapsulates the circuit definition and provides methods for
 * serialization, deserialization, and simulation.
 */
export interface QuantumCode {
  /** Number of qubits. */
  readonly numQubits: number;
  /** Number of classical register bits. */
  readonly numClassicalBits: number;
  /** The ordered list of circuit instructions. */
  readonly instructions: ReadonlyArray<CircuitInstruction>;
  /** Parameter names referenced by the circuit. */
  readonly parameterNames: ReadonlyArray<string>;
}
