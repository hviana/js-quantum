/**
 * Shared types, interfaces, and tagged-union definitions used by every
 * other module in the SDK.
 *
 * This module is the single source of truth for the IR node model
 * described in Section 5 (Expansion API), for the `Instruction` shape
 * referenced by `QuantumCircuit`, and for the backend / simulator /
 * transpiler contracts.
 *
 * The types here are intentionally small and dependency-free. Runtime
 * helpers and builder logic live in the modules that own them
 * (`circuit.ts`, `gates.ts`, `transpiler.ts`, backends).
 */

import type { Complex } from "./complex.ts";
import type { Matrix } from "./matrix.ts";
import type { AngleExpr } from "./parameter.ts";

// =============================================================================
// Program-level metadata (Section 5.2)
// =============================================================================

/**
 * Optional OpenQASM version declaration. When absent, the program has
 * no explicit version header.
 */
export interface ProgramVersion {
  /** Major version, e.g. 3. */
  major: number;
  /** Minor version, e.g. 1. Omitted when only the major version was given. */
  minor?: number;
}

/** `include "path";` directive. */
export interface IncludeDirective {
  /** Unquoted include path. */
  path: string;
}

/** `defcalgrammar "name";` directive payload. */
export interface CalibrationGrammarSelection {
  /** Unquoted grammar name (e.g. "openpulse"). */
  name: string;
}

/**
 * Optional post-compilation provenance attached to a transpiled
 * `QuantumCircuit`. Null/undefined on manually constructed circuits.
 */
export interface TranspilationMetadata {
  /** Map from virtual qubit index to physical qubit index. */
  initialLayout?: Record<number, number>;
  /** SWAPs inserted by the routing pass, in insertion order. */
  routingSwaps?: SwapRecord[];
  /** Target device name or identifier. */
  targetDevice?: string;
  /** Basis gate set used by the compilation. */
  basisGateSet?: string[];
  /** Coupling map used for routing. */
  couplingMap?: ReadonlyArray<readonly [number, number]>;
}

/** Record of one routing-inserted SWAP. */
export interface SwapRecord {
  qubit0: number;
  qubit1: number;
  /** Index in the instruction list where the SWAP was inserted. */
  insertedBeforeInstruction: number;
}

// =============================================================================
// Classical memory (Section 5.6, Section 8.3)
// =============================================================================

/**
 * A named classical bit register. Sizes are fixed at declaration time.
 * The declaration order is preserved by `QuantumCircuit` and is the
 * canonical order used for result bitstring reconstruction in backends.
 */
export interface ClassicalRegister {
  /** Register name as seen in OpenQASM. */
  readonly name: string;
  /** Number of bits. */
  readonly size: number;
  /**
   * Flat offset at which this register's bits begin in the global
   * classical bit space used by `Instruction.clbits`.
   */
  readonly flatOffset: number;
}

/**
 * A reference to an individual classical bit by register name + index.
 * Used by round-trip-faithful IR nodes to preserve the original
 * register-scoped reference alongside the flat `clbits` index stored
 * on `Instruction`.
 */
export interface ClassicalBitRef {
  /** Register name. */
  registerName: string;
  /** Bit index within the register. */
  bitIndex: number;
}

// =============================================================================
// OpenQASM 3.1 classical type system (Section 5.3)
// =============================================================================

/**
 * Tagged-union representation of the OpenQASM 3.1 type system. Any
 * frontend that can represent the target language's type system
 * exactly MUST be able to round-trip values through this shape.
 */
export type ClassicalType =
  | { kind: "qubit"; size?: number }
  | { kind: "bit"; width?: number }
  | { kind: "int"; width?: number }
  | { kind: "uint"; width?: number }
  | { kind: "float"; width?: number }
  | { kind: "angle"; width?: number }
  | { kind: "bool" }
  | { kind: "complex"; component?: ClassicalType }
  | { kind: "duration" }
  | { kind: "stretch" }
  | { kind: "array"; baseType: ClassicalType; dimensions: readonly number[] }
  | { kind: "void" }
  | { kind: "legacy-qreg"; size: number }
  | { kind: "legacy-creg"; size: number };

/**
 * Parameter-reference type for array arguments: distinguishes
 * `readonly array[T, 4]` from `mutable array[T, #dim = 2]` etc.
 */
export interface ArrayReferenceType {
  baseType: ClassicalType;
  mode: "readonly" | "mutable";
  /** Either an exact size list or a rank-only constraint. */
  constraint:
    | { kind: "exact-dimensions"; sizes: readonly number[] }
    | { kind: "rank-only"; rank: number };
}

// =============================================================================
// Classical expression IR (Section 5.5)
// =============================================================================

/** Operator families used by `ClassicalExpr`. */
export type UnaryOperator = "-" | "!" | "~" | "+";
export type BinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "**"
  | "&"
  | "|"
  | "^"
  | "<<"
  | ">>"
  | "&&"
  | "||"
  | "<"
  | "<="
  | ">"
  | ">="
  | "=="
  | "!=";

/** Compound assignment operators (§5.10). */
export type AssignOp =
  | "="
  | "+="
  | "-="
  | "*="
  | "/="
  | "&="
  | "|="
  | "~="
  | "^="
  | "<<="
  | ">>="
  | "%="
  | "**=";

/**
 * Classical expression tree. Mirrors the Expression node set from
 * Section 5.5. Must be expressive enough to encode every classical
 * expression form accepted by OpenQASM 3.1.
 */
export type ClassicalExpr =
  // -------- literals --------
  | {
    kind: "int-literal";
    value: number;
    base?: "decimal" | "binary" | "octal" | "hex";
  }
  | { kind: "float-literal"; value: number }
  | { kind: "imaginary-literal"; value: number }
  | { kind: "bool-literal"; value: boolean }
  | { kind: "bitstring-literal"; value: string }
  | {
    kind: "duration-literal";
    value: number;
    unit: "ns" | "us" | "ms" | "s" | "dt";
  }
  | { kind: "builtin-constant"; name: "pi" | "tau" | "euler" | "im" }
  // -------- references --------
  | { kind: "identifier"; name: string }
  | { kind: "physical-qubit"; index: number }
  // -------- compound literals --------
  | { kind: "array-literal"; elements: readonly ClassicalExpr[] }
  | { kind: "set-literal"; elements: readonly ClassicalExpr[] }
  | {
    kind: "range";
    start?: ClassicalExpr;
    step?: ClassicalExpr;
    end?: ClassicalExpr;
  }
  // -------- operators --------
  | { kind: "unary"; op: UnaryOperator; operand: ClassicalExpr }
  | {
    kind: "binary";
    op: BinaryOperator;
    left: ClassicalExpr;
    right: ClassicalExpr;
  }
  // -------- type operations --------
  | { kind: "cast"; targetType: ClassicalType; value: ClassicalExpr }
  | { kind: "sizeof"; target: ClassicalExpr; dimension?: ClassicalExpr }
  | { kind: "real-part"; operand: ClassicalExpr }
  | { kind: "imag-part"; operand: ClassicalExpr }
  // -------- invocation --------
  | { kind: "call"; callee: string; args: readonly ClassicalExpr[] }
  // -------- indexing / concatenation --------
  | { kind: "index"; base: ClassicalExpr; selectors: readonly ClassicalExpr[] }
  | { kind: "concat"; parts: readonly ClassicalExpr[] }
  // -------- quantum-specific --------
  | { kind: "measure-expr"; source: QuantumOperand }
  | { kind: "duration-of"; body: QuantumCircuitBodyRef }
  // -------- grouping --------
  | { kind: "paren"; inner: ClassicalExpr };

/**
 * Opaque reference to a nested `QuantumCircuit` body used by
 * `duration-of`, box bodies, etc. The full object is stored on the
 * enclosing instruction; this avoids a cyclic import with `circuit.ts`.
 */
export interface QuantumCircuitBodyRef {
  /** Reserved — implementations store a real `QuantumCircuit` here. */
  readonly __body: unknown;
}

// =============================================================================
// Quantum operands (Section 5.4)
// =============================================================================

/**
 * Reference to a quantum operand (virtual qubit, physical qubit,
 * register, slice, alias, or concatenation).
 */
export type QuantumOperand =
  | { kind: "virtual"; index: number }
  | { kind: "physical"; index: number }
  | { kind: "identifier"; name: string }
  | { kind: "indexed"; base: QuantumOperand; indices: readonly ClassicalExpr[] }
  | { kind: "sliced"; base: QuantumOperand; slice: ClassicalExpr }
  | { kind: "concat"; parts: readonly QuantumOperand[] }
  | { kind: "alias"; name: string };

// =============================================================================
// Duration expressions (Section 5.14)
// =============================================================================

/**
 * Duration expressions for timing constructs (`delay`, `box[d]`, etc.).
 * Simple literals are also representable as `ClassicalExpr` via
 * `duration-literal`; this type covers the full arithmetic surface.
 */
export type DurationExpr =
  | { kind: "literal"; value: number; unit: "ns" | "us" | "ms" | "s" | "dt" }
  | { kind: "identifier"; name: string }
  | { kind: "duration-of"; body: QuantumCircuitBodyRef }
  | {
    kind: "binary";
    op: "+" | "-" | "*" | "/";
    left: DurationExpr;
    right: DurationExpr;
  }
  | { kind: "neg"; operand: DurationExpr };

// =============================================================================
// Gate modifiers (Section 5.7)
// =============================================================================

/**
 * A single gate modifier applied in outermost-first array order
 * (textual left-to-right). Application order is right-to-left: the
 * last element in the array is applied to the base gate first.
 */
export type GateModifier =
  | { kind: "inv" }
  | { kind: "pow"; exponent: AngleExpr }
  | { kind: "ctrl"; count: number }
  | { kind: "negctrl"; count: number };

// =============================================================================
// Instruction model (Section 8.3)
// =============================================================================

/**
 * A single instruction in a `QuantumCircuit` body. This is the
 * primary IR record: every gate call, measurement, reset, barrier,
 * delay, control-flow node, subroutine definition, and calibration
 * operation is stored as an `Instruction`.
 *
 * The design is a tagged union over `kind`, but with shared optional
 * fields (`qubits`, `clbits`, `clbitRefs`, `annotations`, `modifiers`,
 * `localPhase`, `duration`, `surfaceName`) for ergonomics.
 */
export interface Instruction {
  /** Discriminator used by every analysis pass. */
  readonly kind: InstructionKind;

  /** Virtual qubit indices this instruction acts on. */
  readonly qubits: readonly number[];

  /** Flat classical bit indices this instruction writes. */
  readonly clbits: readonly number[];

  /** Register-scoped references that round-trip faithfully. */
  readonly clbitRefs?: readonly ClassicalBitRef[];

  /** Gate or named operation identifier (when applicable). */
  readonly name?: string;

  /** Gate parameters (parametric gates). */
  readonly parameters?: readonly AngleExpr[];

  /**
   * Expression-local zero-qubit phase prefix, in radians. See Phase
   * Convention: this is semantically inside the gate expression and
   * is NOT the owning scope's scalar `globalPhase`.
   */
  readonly localPhase?: AngleExpr;

  /**
   * Preserved source-level gate-family spelling for exact round-trip
   * (e.g. "U", "u3", "phase", "cphase"). Required by
   * source-preserving APIs when the semantic gate + `localPhase` alone
   * does not uniquely determine the surface form.
   */
  readonly surfaceName?: string;

  /** Gate modifiers, outermost-first. See `GateModifier`. */
  readonly modifiers?: readonly GateModifier[];

  /** Classical condition, for legacy `if (c == v) ...` gating. */
  readonly condition?: Condition;

  /** Measurement syntax hint (for round-trip fidelity). */
  readonly measurementSyntax?: MeasurementSyntax;

  /** Attached annotations (Section 5.13). */
  readonly annotations?: readonly Annotation[];

  /** Duration designator, for `timed(...)` / `delay` / `box[d]`. */
  readonly duration?: DurationExpr;

  /**
   * Kind-specific payload. Kept as `unknown` here to avoid an
   * over-long discriminated union; each module that constructs a
   * given instruction kind narrows it locally.
   */
  readonly payload?: unknown;
}

/** Discriminator values for `Instruction.kind`. */
export type InstructionKind =
  // quantum primitives
  | "gate"
  | "measure"
  | "reset"
  | "barrier"
  | "delay"
  | "timed"
  // phase
  | "global-phase"
  // control flow
  | "if"
  | "for"
  | "while"
  | "switch"
  | "break"
  | "continue"
  | "end"
  | "box"
  | "block"
  | "return"
  // declarations
  | "classical-declaration"
  | "quantum-declaration"
  | "const-declaration"
  | "input-declaration"
  | "output-declaration"
  | "alias-declaration"
  | "legacy-register-declaration"
  // classical statements
  | "assignment"
  | "expression-statement"
  // definitions
  | "gate-definition"
  | "subroutine-definition"
  | "extern-declaration"
  // calibration
  | "cal-block"
  | "defcal-definition"
  | "port-declaration"
  | "frame-declaration"
  | "waveform-declaration"
  | "play"
  | "capture"
  | "frame-operation"
  // state preparation
  | "prepare-state"
  | "initialize"
  // metadata
  | "pragma"
  | "annotation-statement"
  | "comment"
  | "include"
  | "version"
  | "defcal-grammar";

/** Measurement syntax form used for round-trip serialization. */
export type MeasurementSyntax = "assignment" | "arrow" | "bare";

/** Legacy classical condition `if (c == v) ...`. */
export interface Condition {
  /** Target of the condition: a whole register or a single bit. */
  target: ClassicalBitRef | { registerName: string };
  /** Integer comparison value. */
  value: number;
}

/** Attached metadata annotation `@keyword payload`. */
export interface Annotation {
  keyword: string;
  payload?: string;
}

// =============================================================================
// Scopes (Section 5.17)
// =============================================================================

/**
 * The kind of an ordinary scope. Only `calibration` is NOT an
 * ordinary scope under Phase Convention 3.
 */
export type ScopeKind =
  | "global"
  | "local-block"
  | "subroutine"
  | "gate"
  | "calibration"
  | "box"
  | "control-flow";

// =============================================================================
// Circuit inspection (Section 8.3)
// =============================================================================

/** Aggregate statistics produced by `QuantumCircuit.complexity()`. */
export interface CircuitComplexity {
  /** Total number of instructions in the top-level body. */
  instructionCount: number;
  /** Count of gate instructions broken down by gate name. */
  gateCounts: Readonly<Record<string, number>>;
  /** Depth of the circuit (longest critical path over qubits). */
  depth: number;
  /** Total number of two-qubit gates. */
  twoQubitGateCount: number;
  /** Total number of multi-qubit (3+) gates. */
  multiQubitGateCount: number;
  /** Number of measurements. */
  measurementCount: number;
}

/** Bloch-sphere coordinates for a single-qubit reduced state. */
export interface BlochCoordinates {
  /** Cartesian x component. */
  x: number;
  /** Cartesian y component. */
  y: number;
  /** Cartesian z component. */
  z: number;
  /** Polar angle θ ∈ [0, π]. */
  theta: number;
  /** Azimuthal angle φ ∈ [0, 2π). */
  phi: number;
  /** Bloch vector length r ∈ [0, 1]. */
  r: number;
}

// =============================================================================
// Backend contracts (Section 8.3)
// =============================================================================

/** Result of a backend `execute(...)` call: bitstring → percentage. */
export type ExecutionResult = Readonly<Record<string, number>>;

/** Optional CORS-proxy transport config for browser runtimes. */
export interface CorsProxyConfig {
  enabled: boolean;
  mode: "browser-only" | "always";
  baseUrl: string;
}

/** Shared configuration fields for every backend. */
export interface BackendConfiguration {
  name: string;
  numQubits: number;
  basisGates: readonly string[];
  couplingMap: ReadonlyArray<readonly [number, number]> | null;
  corsProxy?: CorsProxyConfig;
}

/** IBM-specific backend configuration (Section 6). */
export interface IBMBackendConfiguration extends BackendConfiguration {
  serviceCrn: string;
  apiVersion: string;
  /** Exactly one of `bearerToken` or `apiKey` must be supplied. */
  bearerToken?: string;
  apiKey?: string;
  apiEndpoint?: string;
}

/** qBraid-specific backend configuration (Section 7). */
export interface QBraidBackendConfiguration extends BackendConfiguration {
  deviceQrn: string;
  apiKey: string;
  apiEndpoint?: string;
}

/**
 * `Target` — device description used by the transpiler. Stores
 * per-gate / per-qubit error and duration data where available.
 */
export interface Target {
  numQubits: number;
  instructions: Map<string, Map<string, GateProperties>>;
  couplingMap?: ReadonlyArray<readonly [number, number]>;
}

/** Per-gate metadata on a specific qubit tuple. */
export interface GateProperties {
  /** Error rate in [0, 1]. */
  error?: number;
  /** Duration in seconds. */
  duration?: number;
}

// =============================================================================
// State preparation (Section 5.19)
// =============================================================================

/** State specification used by `prepareState` and `initialize`. */
export type StateSpec =
  | { kind: "amplitude-vector"; amplitudes: readonly Complex[] }
  | { kind: "basis-state"; value: number }
  | { kind: "bitstring-state"; bits: string };

// =============================================================================
// Validation result (Section 5.18)
// =============================================================================

export type DiagnosticSeverity = "error" | "warning" | "info";

export type ValidationCategory =
  | "version-placement"
  | "include-placement"
  | "declaration-consistency"
  | "type-mismatch"
  | "scope-placement"
  | "gate-body-restriction"
  | "modifier-structure"
  | "measurement-target"
  | "timing-target"
  | "calibration-consistency"
  | "undefined-reference"
  | "duplicate-declaration"
  | "invalid-operand"
  | "phase-convention-violation";

/** A single validation diagnostic. */
export interface Diagnostic {
  severity: DiagnosticSeverity;
  category: ValidationCategory;
  message: string;
  location?: SourceLocation;
}

/** Optional source location for a diagnostic. */
export interface SourceLocation {
  statementIndex?: number;
  scopePath?: readonly string[];
}

/** Result produced by `validateProgram(...)`. */
export interface ValidationResult {
  valid: boolean;
  diagnostics: readonly Diagnostic[];
}

// =============================================================================
// Gate descriptor / deferred-gate model (Section 3)
// =============================================================================

/**
 * Section 3 distinguishes fixed-matrix gates from exact semantic
 * gate/template descriptors whose matrix materialization is deferred.
 * Concrete modules (`gates.ts`, `circuit.ts`) use this discriminated
 * union at the boundary where a gate is stored in an `Instruction`.
 */
export type GateDenotation =
  | { kind: "matrix"; matrix: Matrix }
  | {
    kind: "deferred";
    name: string;
    parameters: readonly unknown[];
    arity: number;
  };

// =============================================================================
// Re-exports of public helper types from peer modules for convenience
// =============================================================================

export type { Complex } from "./complex.ts";
export type { Matrix } from "./matrix.ts";
export type { AngleExpr } from "./parameter.ts";
