/**
 * Public API hub for the js-quantum SDK.
 *
 * This module re-exports every public symbol that callers may
 * use. Internal helpers are not re-exported here.
 */

// -------- Core value types --------
export { Complex } from "./complex.ts";
export { Matrix } from "./matrix.ts";
export {
  AngleExpr,
  asExactInteger,
  coerce,
  provablyEqual,
  provablyInteger,
  provablyTwoPiMultiple,
  provablyZero,
  toAffine,
  wrapPhase,
} from "./parameter.ts";

// -------- Shared types --------
export type {
  Annotation,
  ArrayReferenceType,
  AssignOp,
  BackendConfiguration,
  BinaryOperator,
  BlochCoordinates,
  CalibrationGrammarSelection,
  CircuitComplexity,
  ClassicalBitRef,
  ClassicalExpr,
  ClassicalRegister,
  ClassicalType,
  Condition,
  CorsProxyConfig,
  Diagnostic,
  DiagnosticSeverity,
  DurationExpr,
  ExecutionResult,
  GateDenotation,
  GateModifier,
  GateProperties,
  IBMBackendConfiguration,
  IncludeDirective,
  Instruction,
  InstructionKind,
  MeasurementSyntax,
  ProgramVersion,
  QBraidBackendConfiguration,
  QuantumCircuitBodyRef,
  QuantumOperand,
  ScopeKind,
  SourceLocation,
  StateSpec,
  SwapRecord,
  Target,
  TranspilationMetadata,
  UnaryOperator,
  ValidationCategory,
  ValidationResult,
} from "./types.ts";

// -------- Expression / operand factories --------
export {
  ALL_ASSIGN_OPS,
  BUILTIN_FUNCTION_NAMES,
  Dur,
  Expr,
  isAssignOp,
  isBuiltinFunction,
  Op,
  State,
} from "./expansion.ts";

// -------- Gate constructors (Tiers 0–14) --------
export {
  AndGate,
  BitFlipOracleGate,
  BitwiseXorGate,
  C3SXGate,
  C3XGate,
  C4XGate,
  CCXGate,
  CCXGateOptimized,
  CCZGate,
  CHGate,
  compose,
  CPhaseGate,
  CRXGate,
  CRYGate,
  CRZGate,
  CSdgGate,
  CSGate,
  CSwapGate,
  CSXGate,
  CUGate,
  CXGate,
  CYGate,
  CZGate,
  DCXGate,
  decomposeZYZ,
  DiagonalGate,
  ECRGate,
  type ESOPTerm,
  ExactReciprocalGate,
  FullAdderGate,
  GlobalPhaseGate,
  GraphStateGate,
  HalfAdderGate,
  HamiltonianGate,
  HGate,
  IGate,
  InnerProductGate,
  IntegerComparatorGate,
  Isometry,
  iSwapGate,
  liftGate,
  LinearAmplitudeFunctionGate,
  LinearFunction,
  LinearPauliRotationsGate,
  MCMTGate,
  MCPhaseGate,
  MCXGate,
  ModularAdderGate,
  MSGate,
  MultiplierGate,
  OrGate,
  PauliEvolutionGate,
  PauliGate,
  PauliProductRotationGate,
  type PauliTerm,
  PermutationGate,
  PhaseGate,
  PhaseOracleGate,
  PiecewiseChebyshevGate,
  PiecewiseLinearPauliRotationsGate,
  PiecewisePolynomialPauliRotationsGate,
  PolynomialPauliRotationsGate,
  QFTGate,
  QuadraticFormGate,
  RC3XGate,
  RCCXGate,
  RGate,
  RVGate,
  RXGate,
  RXXGate,
  RYGate,
  RYYGate,
  RZGate,
  RZXGate,
  RZZGate,
  SdgGate,
  SGate,
  SwapGate,
  SXdgGate,
  SXGate,
  TdgGate,
  TGate,
  UCGate,
  UCPauliRotGate,
  UCRXGate,
  UCRYGate,
  UCRZGate,
  UGate,
  UnitaryGate,
  WeightedSumGate,
  XGate,
  XXMinusYYGate,
  XXPlusYYGate,
  YGate,
  ZGate,
} from "./gates.ts";

// -------- Circuit builder --------
export { type Angle, materializeGate, QuantumCircuit } from "./circuit.ts";

// -------- Backend interface --------
export {
  type Backend,
  DEFAULT_SHOTS,
  type Executable,
  makeBasicTarget,
} from "./backend.ts";

// -------- Simulator --------
export {
  ALL_SIMULATOR_GATES,
  SimulatorBackend,
  type SimulatorExecutable,
} from "./simulator.ts";

// -------- Transpiler --------
export {
  decomposeKAK,
  decomposeToRzSx,
  expandGateModifiers,
  layoutSABRE,
  OpenQASMTranspiler,
  optimize,
  routeSABRE,
  translateToBasis,
  transpile,
  type Transpiler,
  unrollComposites,
} from "./transpiler.ts";

// -------- IBM backend --------
export {
  buildRequestUrl,
  type IBMApiConfig,
  IBMBackend,
  type IBMExecutable,
  parseSamplerV2Results,
} from "./ibm_backend.ts";

// -------- qBraid backend --------
export {
  parseQBraidResults,
  QBRAID_OTHER_STATUSES,
  QBRAID_TERMINAL_STATUSES,
  QBRAID_TRANSIENT_STATUSES,
  type QBraidApiConfig,
  QBraidBackend,
  type QBraidExecutable,
} from "./qbraid_backend.ts";

// -------- Bloch sphere --------
export { blochFromStateVector, blochOfCircuit } from "./bloch.ts";

// -------- High-Level API (experimental) --------
export * as hlapi from "./hlapi/mod.ts";
export { quantum, QuantumTask, ResultHandle } from "./hlapi/mod.ts";
