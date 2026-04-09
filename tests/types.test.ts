import { assert, assertEquals } from "jsr:@std/assert";
import type {
  Annotation,
  ArrayReferenceType,
  BackendConfiguration,
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
  DurationExpr,
  ExecutionResult,
  GateDenotation,
  GateModifier,
  IBMBackendConfiguration,
  IncludeDirective,
  Instruction,
  InstructionKind,
  MeasurementSyntax,
  ProgramVersion,
  QBraidBackendConfiguration,
  QuantumOperand,
  ScopeKind,
  SourceLocation,
  StateSpec,
  SwapRecord,
  Target,
  TranspilationMetadata,
  ValidationCategory,
  ValidationResult,
} from "../src/types.ts";
import { AngleExpr } from "../src/parameter.ts";
import { Complex } from "../src/complex.ts";
import { Matrix } from "../src/matrix.ts";

// -------- classical register --------

Deno.test("types: ClassicalRegister fields", () => {
  const cr: ClassicalRegister = { name: "c", size: 4, flatOffset: 0 };
  assertEquals(cr.name, "c");
  assertEquals(cr.size, 4);
  assertEquals(cr.flatOffset, 0);
});

Deno.test("types: ClassicalRegister with nonzero offset", () => {
  const a: ClassicalRegister = { name: "a", size: 2, flatOffset: 0 };
  const b: ClassicalRegister = { name: "b", size: 3, flatOffset: 2 };
  assertEquals(a.flatOffset + a.size, b.flatOffset);
});

Deno.test("types: ClassicalBitRef", () => {
  const r: ClassicalBitRef = { registerName: "meas", bitIndex: 2 };
  assertEquals(r.registerName, "meas");
  assertEquals(r.bitIndex, 2);
});

// -------- instructions --------

Deno.test("types: Instruction minimal gate form", () => {
  const i: Instruction = { kind: "gate", qubits: [0], clbits: [], name: "h" };
  assertEquals(i.kind, "gate");
  assertEquals(i.name, "h");
  assertEquals(i.qubits.length, 1);
});

Deno.test("types: Instruction with parameters", () => {
  const i: Instruction = {
    kind: "gate",
    qubits: [0],
    clbits: [],
    name: "rx",
    parameters: [AngleExpr.PI],
  };
  assertEquals(i.parameters?.length, 1);
});

Deno.test("types: Instruction with localPhase distinct from globalPhase", () => {
  const i: Instruction = {
    kind: "gate",
    qubits: [0],
    clbits: [],
    name: "u",
    parameters: [AngleExpr.PI, AngleExpr.ZERO, AngleExpr.PI],
    localPhase: AngleExpr.PI.dividedBy(2),
  };
  assert(i.localPhase !== undefined);
});

Deno.test("types: Instruction with surfaceName", () => {
  const i: Instruction = {
    kind: "gate",
    qubits: [0],
    clbits: [],
    name: "u",
    parameters: [AngleExpr.ZERO, AngleExpr.ZERO, AngleExpr.ZERO],
    surfaceName: "u3",
  };
  assertEquals(i.surfaceName, "u3");
});

Deno.test("types: Instruction with modifiers outermost-first", () => {
  const i: Instruction = {
    kind: "gate",
    qubits: [0, 1],
    clbits: [],
    name: "x",
    modifiers: [{ kind: "inv" }, { kind: "ctrl", count: 1 }],
  };
  // inv @ ctrl @ x → [inv, ctrl] in outermost-first order
  assertEquals(i.modifiers?.[0].kind, "inv");
  assertEquals(i.modifiers?.[1].kind, "ctrl");
});

Deno.test("types: Instruction with ctrl count > 1", () => {
  const m: GateModifier = { kind: "ctrl", count: 2 };
  assertEquals(m.count, 2);
});

Deno.test("types: Instruction with negctrl modifier", () => {
  const m: GateModifier = { kind: "negctrl", count: 1 };
  assertEquals(m.kind, "negctrl");
});

Deno.test("types: Instruction with pow modifier carries exact exponent", () => {
  const m: GateModifier = { kind: "pow", exponent: AngleExpr.int(3) };
  assertEquals(m.kind, "pow");
});

Deno.test("types: Instruction with clbitRefs alongside flat clbits", () => {
  const i: Instruction = {
    kind: "measure",
    qubits: [0],
    clbits: [0],
    clbitRefs: [{ registerName: "c", bitIndex: 0 }],
    measurementSyntax: "assignment",
  };
  assertEquals(i.clbitRefs?.length, 1);
  assertEquals(i.measurementSyntax, "assignment");
});

Deno.test("types: Instruction annotations", () => {
  const ann: Annotation = { keyword: "reversible" };
  const i: Instruction = {
    kind: "gate",
    qubits: [0],
    clbits: [],
    annotations: [ann],
  };
  assertEquals(i.annotations?.length, 1);
  assertEquals(i.annotations?.[0].keyword, "reversible");
});

// -------- condition --------

Deno.test("types: Condition on single bit", () => {
  const c: Condition = { target: { registerName: "c", bitIndex: 2 }, value: 1 };
  assertEquals(c.value, 1);
});

Deno.test("types: Condition on whole register", () => {
  const c: Condition = { target: { registerName: "c" }, value: 3 };
  assertEquals(c.value, 3);
});

// -------- classical type system --------

Deno.test("types: ClassicalType bit", () => {
  const t: ClassicalType = { kind: "bit", width: 8 };
  assertEquals(t.kind, "bit");
});

Deno.test("types: ClassicalType int with width", () => {
  const t: ClassicalType = { kind: "int", width: 32 };
  if (t.kind === "int") assertEquals(t.width, 32);
});

Deno.test("types: ClassicalType angle default width", () => {
  const t: ClassicalType = { kind: "angle" };
  assertEquals(t.kind, "angle");
});

Deno.test("types: ClassicalType array multi-dim", () => {
  const t: ClassicalType = {
    kind: "array",
    baseType: { kind: "float", width: 64 },
    dimensions: [3, 2],
  };
  if (t.kind === "array") assertEquals(t.dimensions.length, 2);
});

Deno.test("types: ArrayReferenceType exact dimensions", () => {
  const t: ArrayReferenceType = {
    baseType: { kind: "int", width: 32 },
    mode: "readonly",
    constraint: { kind: "exact-dimensions", sizes: [4] },
  };
  assertEquals(t.mode, "readonly");
  if (t.constraint.kind === "exact-dimensions") {
    assertEquals(t.constraint.sizes[0], 4);
  }
});

Deno.test("types: ArrayReferenceType rank-only", () => {
  const t: ArrayReferenceType = {
    baseType: { kind: "float", width: 64 },
    mode: "mutable",
    constraint: { kind: "rank-only", rank: 2 },
  };
  if (t.constraint.kind === "rank-only") assertEquals(t.constraint.rank, 2);
});

// -------- classical expressions --------

Deno.test("types: ClassicalExpr int literal with base", () => {
  const e: ClassicalExpr = { kind: "int-literal", value: 255, base: "hex" };
  if (e.kind === "int-literal") assertEquals(e.base, "hex");
});

Deno.test("types: ClassicalExpr builtin constant pi", () => {
  const e: ClassicalExpr = { kind: "builtin-constant", name: "pi" };
  if (e.kind === "builtin-constant") assertEquals(e.name, "pi");
});

Deno.test("types: ClassicalExpr sizeof with dimension", () => {
  const e: ClassicalExpr = {
    kind: "sizeof",
    target: { kind: "identifier", name: "arr" },
    dimension: { kind: "int-literal", value: 0 },
  };
  assertEquals(e.kind, "sizeof");
});

Deno.test("types: ClassicalExpr real/imag parts", () => {
  const e: ClassicalExpr = {
    kind: "real-part",
    operand: { kind: "identifier", name: "z" },
  };
  assertEquals(e.kind, "real-part");
});

Deno.test("types: ClassicalExpr binary operator", () => {
  const e: ClassicalExpr = {
    kind: "binary",
    op: "+",
    left: { kind: "int-literal", value: 1 },
    right: { kind: "int-literal", value: 2 },
  };
  if (e.kind === "binary") assertEquals(e.op, "+");
});

Deno.test("types: ClassicalExpr range", () => {
  const e: ClassicalExpr = {
    kind: "range",
    start: { kind: "int-literal", value: 0 },
    end: { kind: "int-literal", value: 10 },
  };
  assertEquals(e.kind, "range");
});

// -------- quantum operands --------

Deno.test("types: QuantumOperand virtual", () => {
  const q: QuantumOperand = { kind: "virtual", index: 3 };
  if (q.kind === "virtual") assertEquals(q.index, 3);
});

Deno.test("types: QuantumOperand physical", () => {
  const q: QuantumOperand = { kind: "physical", index: 0 };
  if (q.kind === "physical") assertEquals(q.index, 0);
});

// -------- duration expressions --------

Deno.test("types: DurationExpr literal", () => {
  const d: DurationExpr = { kind: "literal", value: 100, unit: "ns" };
  if (d.kind === "literal") assertEquals(d.unit, "ns");
});

// -------- bloch / complexity --------

Deno.test("types: CircuitComplexity defaults", () => {
  const c: CircuitComplexity = {
    instructionCount: 0,
    gateCounts: {},
    depth: 0,
    twoQubitGateCount: 0,
    multiQubitGateCount: 0,
    measurementCount: 0,
  };
  assertEquals(c.depth, 0);
});

Deno.test("types: BlochCoordinates", () => {
  const b: BlochCoordinates = { x: 0, y: 0, z: 1, theta: 0, phi: 0, r: 1 };
  assertEquals(b.r, 1);
});

// -------- backends --------

Deno.test("types: BackendConfiguration basic", () => {
  const c: BackendConfiguration = {
    name: "sim",
    numQubits: 5,
    basisGates: ["h", "cx"],
    couplingMap: null,
  };
  assertEquals(c.couplingMap, null);
});

Deno.test("types: BackendConfiguration with coupling map", () => {
  const c: BackendConfiguration = {
    name: "ibm",
    numQubits: 5,
    basisGates: ["rz", "sx", "x", "ecr"],
    couplingMap: [[0, 1], [1, 2]],
  };
  assertEquals(c.couplingMap?.length, 2);
});

Deno.test("types: CorsProxyConfig defaults", () => {
  const cp: CorsProxyConfig = {
    enabled: false,
    mode: "browser-only",
    baseUrl: "https://proxy.corsfix.com/?",
  };
  assertEquals(cp.enabled, false);
});

Deno.test("types: IBMBackendConfiguration with bearerToken", () => {
  const c: IBMBackendConfiguration = {
    name: "ibm",
    numQubits: 5,
    basisGates: ["ecr", "id", "rz", "sx", "x"],
    couplingMap: [[0, 1]],
    serviceCrn: "crn:...",
    apiVersion: "2025-01-01",
    bearerToken: "tok",
  };
  assertEquals(c.bearerToken, "tok");
});

Deno.test("types: IBMBackendConfiguration with apiKey", () => {
  const c: IBMBackendConfiguration = {
    name: "ibm",
    numQubits: 5,
    basisGates: ["ecr", "id", "rz", "sx", "x"],
    couplingMap: [[0, 1]],
    serviceCrn: "crn:...",
    apiVersion: "2025-01-01",
    apiKey: "key",
  };
  assertEquals(c.apiKey, "key");
});

Deno.test("types: QBraidBackendConfiguration", () => {
  const c: QBraidBackendConfiguration = {
    name: "qbraid",
    numQubits: 5,
    basisGates: ["h", "cx"],
    couplingMap: null,
    deviceQrn: "qrn:...",
    apiKey: "key",
  };
  assertEquals(c.deviceQrn, "qrn:...");
});

Deno.test("types: Target minimal", () => {
  const t: Target = { numQubits: 2, instructions: new Map() };
  assertEquals(t.numQubits, 2);
});

// -------- state prep --------

Deno.test("types: StateSpec amplitude-vector", () => {
  const s: StateSpec = {
    kind: "amplitude-vector",
    amplitudes: [Complex.ONE, Complex.ZERO],
  };
  if (s.kind === "amplitude-vector") assertEquals(s.amplitudes.length, 2);
});

Deno.test("types: StateSpec basis-state", () => {
  const s: StateSpec = { kind: "basis-state", value: 3 };
  if (s.kind === "basis-state") assertEquals(s.value, 3);
});

Deno.test("types: StateSpec bitstring-state", () => {
  const s: StateSpec = { kind: "bitstring-state", bits: "1010" };
  if (s.kind === "bitstring-state") assertEquals(s.bits.length, 4);
});

// -------- validation --------

Deno.test("types: Diagnostic", () => {
  const d: Diagnostic = {
    severity: "error",
    category: "type-mismatch",
    message: "oops",
  };
  assertEquals(d.severity, "error");
});

Deno.test("types: ValidationResult valid with no diagnostics", () => {
  const r: ValidationResult = { valid: true, diagnostics: [] };
  assertEquals(r.valid, true);
});

Deno.test("types: ValidationResult invalid with error diagnostic", () => {
  const r: ValidationResult = {
    valid: false,
    diagnostics: [{
      severity: "error",
      category: "phase-convention-violation",
      message: "x",
    }],
  };
  assertEquals(r.valid, false);
});

// -------- execution result --------

Deno.test("types: ExecutionResult percentages sum near 100", () => {
  const r: ExecutionResult = { "00": 50, "11": 50 };
  const total = Object.values(r).reduce((a, b) => a + b, 0);
  assertEquals(total, 100);
});

// -------- program metadata --------

Deno.test("types: ProgramVersion with and without minor", () => {
  const v1: ProgramVersion = { major: 3 };
  const v2: ProgramVersion = { major: 3, minor: 1 };
  assertEquals(v1.major, 3);
  assertEquals(v2.minor, 1);
});

Deno.test("types: IncludeDirective", () => {
  const i: IncludeDirective = { path: "stdgates.inc" };
  assertEquals(i.path, "stdgates.inc");
});

Deno.test("types: CalibrationGrammarSelection", () => {
  const g: CalibrationGrammarSelection = { name: "openpulse" };
  assertEquals(g.name, "openpulse");
});

Deno.test("types: TranspilationMetadata optional", () => {
  const m: TranspilationMetadata = { targetDevice: "ibm-q" };
  assertEquals(m.targetDevice, "ibm-q");
});

Deno.test("types: SwapRecord", () => {
  const s: SwapRecord = { qubit0: 0, qubit1: 1, insertedBeforeInstruction: 5 };
  assertEquals(s.insertedBeforeInstruction, 5);
});

// -------- scope & gate denotation --------

Deno.test("types: ScopeKind values", () => {
  const kinds: ScopeKind[] = [
    "global",
    "local-block",
    "subroutine",
    "gate",
    "calibration",
    "box",
    "control-flow",
  ];
  assertEquals(kinds.length, 7);
});

Deno.test("types: MeasurementSyntax values", () => {
  const s: MeasurementSyntax[] = ["assignment", "arrow", "bare"];
  assertEquals(s.length, 3);
});

Deno.test("types: GateDenotation matrix form", () => {
  const g: GateDenotation = { kind: "matrix", matrix: Matrix.identity(2) };
  if (g.kind === "matrix") assertEquals(g.matrix.rows, 2);
});

Deno.test("types: GateDenotation deferred form", () => {
  const g: GateDenotation = {
    kind: "deferred",
    name: "unitary",
    parameters: [],
    arity: 3,
  };
  if (g.kind === "deferred") assertEquals(g.arity, 3);
});

// -------- instruction kind coverage --------

Deno.test("types: InstructionKind covers all major forms", () => {
  const kinds: InstructionKind[] = [
    "gate",
    "measure",
    "reset",
    "barrier",
    "delay",
    "global-phase",
    "if",
    "for",
    "while",
    "switch",
    "classical-declaration",
    "gate-definition",
    "subroutine-definition",
    "cal-block",
    "defcal-definition",
    "prepare-state",
    "initialize",
    "pragma",
    "comment",
  ];
  assert(kinds.length >= 19);
});
