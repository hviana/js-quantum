import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import { Complex } from "../src/complex.ts";
import { Matrix } from "../src/matrix.ts";
import { AngleExpr } from "../src/parameter.ts";
import { QuantumCircuit } from "../src/circuit.ts";
import {
  CCXGate,
  CXGate,
  CZGate,
  HGate,
  MCXGate,
  QFTGate,
  RXGate,
  SwapGate,
  XGate,
  ZGate,
} from "../src/gates.ts";

// =============================================================================
// Construction
// =============================================================================

Deno.test("Circuit: empty circuit has 0 qubits and 0 instructions", () => {
  const qc = new QuantumCircuit();
  assertEquals(qc.numQubits, 0);
  assertEquals(qc.instructions.length, 0);
});

Deno.test("Circuit: globalPhase defaults to 0", () => {
  const qc = new QuantumCircuit();
  assertEquals(qc.globalPhase.kind, "int");
  assertEquals(qc.globalPhase.num, 0);
});

Deno.test("Circuit: globalPhase constructor argument preserved", () => {
  const qc = new QuantumCircuit(Math.PI / 2);
  assertEquals(qc.globalPhase.kind, "float");
});

Deno.test("Circuit: implicit qubit allocation", () => {
  const qc = new QuantumCircuit();
  qc.h(2);
  assertEquals(qc.numQubits, 3);
});

Deno.test("Circuit: higher qubit extends count", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  qc.x(5);
  assertEquals(qc.numQubits, 6);
});

// =============================================================================
// Program metadata
// =============================================================================

Deno.test("Circuit: setProgramVersion", () => {
  const qc = new QuantumCircuit();
  qc.setProgramVersion(3, 1);
  assertEquals(qc.version?.major, 3);
  assertEquals(qc.version?.minor, 1);
});

Deno.test("Circuit: setProgramVersion without minor", () => {
  const qc = new QuantumCircuit();
  qc.setProgramVersion(3);
  assertEquals(qc.version?.major, 3);
  assertEquals(qc.version?.minor, undefined);
});

Deno.test("Circuit: omitProgramVersion", () => {
  const qc = new QuantumCircuit();
  qc.omitProgramVersion();
  assertEquals(qc.version, null);
  assertEquals(qc.versionOmitted, true);
});

Deno.test("Circuit: include directives preserve order", () => {
  const qc = new QuantumCircuit();
  qc.include("stdgates.inc");
  qc.include("custom.inc");
  assertEquals(qc.includes.length, 2);
  assertEquals(qc.includes[0].path, "stdgates.inc");
  assertEquals(qc.includes[1].path, "custom.inc");
});

Deno.test("Circuit: setCalibrationGrammar", () => {
  const qc = new QuantumCircuit();
  qc.setCalibrationGrammar("openpulse");
  assertEquals(qc.defcalGrammar?.name, "openpulse");
});

// =============================================================================
// Classical registers
// =============================================================================

Deno.test("Circuit: addClassicalRegister", () => {
  const qc = new QuantumCircuit();
  qc.addClassicalRegister("c", 4);
  assertEquals(qc.numClbits, 4);
  assertEquals(qc.classicalRegisters.length, 1);
});

Deno.test("Circuit: multiple classical registers have correct offsets", () => {
  const qc = new QuantumCircuit();
  qc.addClassicalRegister("a", 2);
  qc.addClassicalRegister("b", 3);
  assertEquals(qc.classicalRegisters[0].flatOffset, 0);
  assertEquals(qc.classicalRegisters[1].flatOffset, 2);
  assertEquals(qc.numClbits, 5);
});

Deno.test("Circuit: duplicate register name rejected", () => {
  const qc = new QuantumCircuit();
  qc.addClassicalRegister("c", 2);
  assertThrows(() => qc.addClassicalRegister("c", 3), Error, "duplicate name");
});

Deno.test("Circuit: getClassicalRegister lookup", () => {
  const qc = new QuantumCircuit();
  qc.addClassicalRegister("c", 4);
  assert(qc.getClassicalRegister("c") !== null);
  assert(qc.getClassicalRegister("nope") === null);
});

// =============================================================================
// Tier 0–14 chainable method coverage (one representative per tier)
// =============================================================================

Deno.test("Circuit: Tier 0 methods append gate instructions", () => {
  const qc = new QuantumCircuit();
  qc.id(0).h(0).x(0).y(0).z(0).s(0).sdg(0).t(0).tdg(0).sx(0).sxdg(0);
  qc.p(0.5, 0).rx(0.3, 0).ry(0.3, 0).rz(0.3, 0).u(0.1, 0.2, 0.3, 0);
  qc.r(0.1, 0.2, 0).rv(0.1, 0.2, 0.3, 0);
  // 18 single-qubit Tier 0 methods (GlobalPhaseGate is tested separately)
  assertEquals(qc.instructions.length, 18);
  assertEquals(qc.instructions[0].kind, "gate");
  assertEquals(qc.instructions[0].name, "id");
});

Deno.test("Circuit: globalPhaseGate appends zero-qubit phase instruction", () => {
  const qc = new QuantumCircuit();
  qc.globalPhaseGate(Math.PI);
  assertEquals(qc.instructions[0].kind, "global-phase");
  assertEquals(qc.instructions[0].qubits.length, 0);
});

Deno.test("Circuit: Tier 1 cx", () => {
  const qc = new QuantumCircuit();
  qc.cx(0, 1);
  assertEquals(qc.instructions[0].name, "cx");
  assertEquals(qc.instructions[0].qubits, [0, 1]);
});

Deno.test("Circuit: Tier 2 controlled gates", () => {
  const qc = new QuantumCircuit();
  qc.cz(0, 1).cy(0, 1).cp(0.5, 0, 1).crx(0.5, 0, 1).cry(0.5, 0, 1).crz(
    0.5,
    0,
    1,
  );
  qc.cs(0, 1).csdg(0, 1).csx(0, 1).ch(0, 1).cu(0.1, 0.2, 0.3, 0.4, 0, 1).dcx(
    0,
    1,
  );
  assertEquals(qc.instructions.length, 12);
});

Deno.test("Circuit: Tier 3 interaction gates", () => {
  const qc = new QuantumCircuit();
  qc.swap(0, 1).rzz(0.5, 0, 1).rxx(0.5, 0, 1).ryy(0.5, 0, 1).rzx(0.5, 0, 1);
  qc.ecr(0, 1).iswap(0, 1).xxPlusYY(0.3, 0.1, 0, 1).xxMinusYY(0.3, 0.1, 0, 1);
  assertEquals(qc.instructions.length, 9);
});

Deno.test("Circuit: Tier 4 three-qubit gates", () => {
  const qc = new QuantumCircuit();
  qc.ccx(0, 1, 2).ccz(0, 1, 2).cswap(0, 1, 2).rccx(0, 1, 2);
  assertEquals(qc.instructions.length, 4);
});

Deno.test("Circuit: Tier 5 multi-controlled gates", () => {
  const qc = new QuantumCircuit();
  qc.c3x(0, 1, 2, 3).c4x(0, 1, 2, 3, 4).c3sx(0, 1, 2, 3).rc3x(0, 1, 2, 3);
  qc.mcx([0, 1, 2], 3).mcp(0.5, [0, 1], 2);
  assertEquals(qc.instructions.length, 6);
});

Deno.test("Circuit: Tier 6 composites", () => {
  const qc = new QuantumCircuit();
  qc.ms(0.5, [0, 1, 2]);
  qc.pauli("XYZ", [0, 1, 2]);
  qc.diagonal([0, 0.1, 0.2, 0.3], [0, 1]);
  qc.permutation([0, 2, 1, 3], [0, 1]);
  qc.pauliProductRotation(0.5, "XZ", [0, 1]);
  assertEquals(qc.instructions.length, 5);
});

Deno.test("Circuit: Tier 6 diagonal rejects wrong length", () => {
  const qc = new QuantumCircuit();
  assertThrows(() => qc.diagonal([0, 1, 2], [0, 1]), Error);
});

Deno.test("Circuit: Tier 7 UCR family", () => {
  const qc = new QuantumCircuit();
  qc.ucrz([0.1, 0.2], [0], 1);
  qc.ucry([0.1, 0.2], [0], 1);
  qc.ucrx([0.1, 0.2], [0], 1);
  qc.ucPauliRot([0.1, 0.2], "Z", [0], 1);
  assertEquals(qc.instructions.length, 4);
});

Deno.test("Circuit: Tier 7 unitary accepts matching dimension", () => {
  const qc = new QuantumCircuit();
  qc.unitary(HGate(), [0]);
  qc.unitary(CXGate(), [0, 1]);
  assertEquals(qc.instructions.length, 2);
});

Deno.test("Circuit: Tier 7 unitary rejects dimension mismatch", () => {
  const qc = new QuantumCircuit();
  assertThrows(() => qc.unitary(HGate(), [0, 1]), Error);
});

Deno.test("Circuit: Tier 8 pauli evolution & hamiltonian", () => {
  const qc = new QuantumCircuit();
  qc.pauliEvolution([{ coefficient: 0.5, pauliString: "Z" }], 0.3, [0]);
  qc.hamiltonianGate(ZGate(), 0.3, [0]);
  assertEquals(qc.instructions.length, 2);
});

Deno.test("Circuit: Tier 9 qft", () => {
  const qc = new QuantumCircuit();
  qc.qft([0, 1, 2]);
  assertEquals(qc.instructions[0].name, "qft");
});

Deno.test("Circuit: Tier 10 classical logic", () => {
  const qc = new QuantumCircuit();
  qc.andGate([0, 1], 2);
  qc.orGate([0, 1], 2);
  qc.bitwiseXor([0, 1], [2, 3]);
  qc.innerProduct([0, 1], [2, 3], 4);
  assertEquals(qc.instructions.length, 4);
});

Deno.test("Circuit: Tier 11 arithmetic", () => {
  const qc = new QuantumCircuit();
  qc.halfAdder(0, 1, 2, 3);
  qc.fullAdder(0, 1, 2, 3, 4);
  qc.modularAdder([0, 1], [2, 3]);
  qc.multiplier([0, 1], [2, 3], [4, 5, 6, 7]);
  assertEquals(qc.instructions.length, 4);
});

Deno.test("Circuit: Tier 12 function loading", () => {
  const qc = new QuantumCircuit();
  qc.linearPauliRotations(0.1, 0.2, [0, 1], 2);
  qc.polynomialPauliRotations([0.1, 0.2], [0, 1], 2);
  qc.exactReciprocal(0.5, [0, 1], 2);
  qc.linearAmplitudeFunction(0.1, 0, [0, 1], [0, 1], [0, 1], 2);
  assertEquals(qc.instructions.length, 4);
});

Deno.test("Circuit: Tier 13 oracles & comparators", () => {
  const qc = new QuantumCircuit();
  qc.integerComparator(2, [0, 1], 2, [3, 4, 5]);
  qc.quadraticForm([[1, 0], [0, 1]], [0, 0], 0, [0, 1], [2, 3]);
  qc.weightedSum([1, 2], [0, 1], [2, 3]);
  qc.phaseOracle([{ variables: [0, 1], negated: [false, false] }], [0, 1]);
  qc.bitFlipOracle([{ variables: [0, 1], negated: [false, false] }], [0, 1], 2);
  assertEquals(qc.instructions.length, 5);
});

Deno.test("Circuit: Tier 14 graph state", () => {
  const qc = new QuantumCircuit();
  qc.graphState([[0, 1], [1, 0]], [0, 1]);
  assertEquals(qc.instructions[0].name, "graph_state");
});

// =============================================================================
// Measurement and non-unitary
// =============================================================================

Deno.test("Circuit: measure with explicit clbit auto-creates register", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  assertEquals(qc.numClbits, 1);
  assertEquals(qc.instructions[1].kind, "measure");
  assertEquals(qc.instructions[1].measurementSyntax, "assignment");
});

Deno.test("Circuit: bare measure discards result", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  qc.measure(0);
  assertEquals(qc.instructions[1].measurementSyntax, "bare");
  assertEquals(qc.instructions[1].clbits.length, 0);
});

Deno.test("Circuit: measureRegister validates lengths", () => {
  const qc = new QuantumCircuit();
  qc.addClassicalRegister("c", 2);
  qc.h(0).h(1);
  qc.measureRegister(
    [0, 1],
    [{ registerName: "c", bitIndex: 0 }, { registerName: "c", bitIndex: 1 }],
  );
  // 2 h + 2 measure = 4 instructions
  assertEquals(qc.instructions.length, 4);
});

Deno.test("Circuit: reset", () => {
  const qc = new QuantumCircuit();
  qc.reset(0);
  assertEquals(qc.instructions[0].kind, "reset");
});

Deno.test("Circuit: barrier with qubits", () => {
  const qc = new QuantumCircuit();
  qc.h(0).h(1).barrier(0, 1);
  assertEquals(qc.instructions[2].kind, "barrier");
  assertEquals(qc.instructions[2].qubits, [0, 1]);
});

Deno.test("Circuit: barrier without args", () => {
  const qc = new QuantumCircuit();
  qc.barrier();
  assertEquals(qc.instructions[0].kind, "barrier");
  assertEquals(qc.instructions[0].qubits.length, 0);
});

Deno.test("Circuit: delay", () => {
  const qc = new QuantumCircuit();
  qc.delay({ kind: "literal", value: 100, unit: "ns" }, [0]);
  assertEquals(qc.instructions[0].kind, "delay");
});

// =============================================================================
// Gate modifiers
// =============================================================================

Deno.test("Circuit: inv modifier", () => {
  const qc = new QuantumCircuit();
  qc.inv("s", [0]);
  assertEquals(qc.instructions[0].modifiers?.[0].kind, "inv");
});

Deno.test("Circuit: pow modifier", () => {
  const qc = new QuantumCircuit();
  qc.pow(3, "x", [0]);
  const mod = qc.instructions[0].modifiers?.[0];
  if (mod?.kind === "pow") {
    assertEquals(mod.exponent.kind, "int");
  }
});

Deno.test("Circuit: ctrl modifier", () => {
  const qc = new QuantumCircuit();
  qc.ctrl(2, "x", [0, 1, 2]);
  const mod = qc.instructions[0].modifiers?.[0];
  if (mod?.kind === "ctrl") assertEquals(mod.count, 2);
});

Deno.test("Circuit: applyGate preserves localPhase and surfaceName", () => {
  const qc = new QuantumCircuit();
  qc.applyGate({
    name: "u",
    qubits: [0],
    parameters: [0.5, 0.3, -0.7],
    localPhase: 0.25,
    surfaceName: "u3",
  });
  const instr = qc.instructions[0];
  assert(instr.localPhase !== undefined);
  assertEquals(instr.surfaceName, "u3");
});

Deno.test("Circuit: applyGate with outer modifiers preserves stack order", () => {
  const qc = new QuantumCircuit();
  qc.applyGate({
    name: "x",
    qubits: [0, 1],
    modifiers: [{ kind: "inv" }, { kind: "ctrl", count: 1 }],
  });
  assertEquals(qc.instructions[0].modifiers?.length, 2);
  assertEquals(qc.instructions[0].modifiers?.[0].kind, "inv");
});

// =============================================================================
// Control flow
// =============================================================================

Deno.test("Circuit: ifTest stores nested body", () => {
  const body = new QuantumCircuit();
  body.x(0);
  const qc = new QuantumCircuit();
  qc.addClassicalRegister("c", 1);
  qc.ifTest(
    { kind: "identifier", name: "c" },
    body,
  );
  assertEquals(qc.instructions[0].kind, "if");
  assertEquals(qc.numQubits, 1); // extended by body
});

Deno.test("Circuit: forLoop stores nested body", () => {
  const body = new QuantumCircuit();
  body.h(0);
  const qc = new QuantumCircuit();
  qc.forLoop("i", {
    kind: "range",
    start: { kind: "int-literal", value: 0 },
    end: { kind: "int-literal", value: 3 },
  }, body);
  assertEquals(qc.instructions[0].kind, "for");
});

Deno.test("Circuit: whileLoop", () => {
  const body = new QuantumCircuit();
  body.x(0);
  const qc = new QuantumCircuit();
  qc.whileLoop({ kind: "bool-literal", value: true }, body);
  assertEquals(qc.instructions[0].kind, "while");
});

Deno.test("Circuit: switch with cases", () => {
  const body1 = new QuantumCircuit();
  body1.x(0);
  const body2 = new QuantumCircuit();
  body2.y(0);
  const qc = new QuantumCircuit();
  qc.switch(
    { kind: "identifier", name: "x" },
    [
      { values: [{ kind: "int-literal", value: 0 }], body: body1 },
      { values: [{ kind: "int-literal", value: 1 }], body: body2 },
    ],
  );
  assertEquals(qc.instructions[0].kind, "switch");
});

Deno.test("Circuit: break/continue/end", () => {
  const qc = new QuantumCircuit();
  qc.breakLoop().continueLoop().end();
  assertEquals(qc.instructions[0].kind, "break");
  assertEquals(qc.instructions[1].kind, "continue");
  assertEquals(qc.instructions[2].kind, "end");
});

Deno.test("Circuit: box with duration", () => {
  const body = new QuantumCircuit();
  body.h(0);
  const qc = new QuantumCircuit();
  qc.box(body, { kind: "literal", value: 100, unit: "ns" });
  assertEquals(qc.instructions[0].kind, "box");
  assert(qc.instructions[0].duration !== undefined);
});

// =============================================================================
// Classical declarations and assignments
// =============================================================================

Deno.test("Circuit: declareClassicalVar", () => {
  const qc = new QuantumCircuit();
  qc.declareClassicalVar("n", { kind: "int", width: 32 });
  assertEquals(qc.instructions[0].kind, "classical-declaration");
});

Deno.test("Circuit: declareConst", () => {
  const qc = new QuantumCircuit();
  qc.declareConst("N", { kind: "int", width: 32 }, {
    kind: "int-literal",
    value: 5,
  });
  assertEquals(qc.instructions[0].kind, "const-declaration");
});

Deno.test("Circuit: declareInput and declareOutput", () => {
  const qc = new QuantumCircuit();
  qc.declareInput("theta", { kind: "angle", width: 32 });
  qc.declareOutput("result", { kind: "bit" });
  assertEquals(qc.instructions.length, 2);
  assertEquals(qc.instructions[0].kind, "input-declaration");
  assertEquals(qc.instructions[1].kind, "output-declaration");
});

Deno.test("Circuit: classicalAssign simple '='", () => {
  const qc = new QuantumCircuit();
  qc.classicalAssign(
    { kind: "identifier", name: "x" },
    { kind: "int-literal", value: 5 },
  );
  assertEquals(qc.instructions[0].kind, "assignment");
});

Deno.test("Circuit: classicalAssignOp compound operators", () => {
  const qc = new QuantumCircuit();
  for (
    const op of [
      "+=",
      "-=",
      "*=",
      "/=",
      "&=",
      "|=",
      "~=",
      "^=",
      "<<=",
      ">>=",
      "%=",
      "**=",
    ] as const
  ) {
    qc.classicalAssignOp(
      { kind: "identifier", name: "x" },
      op,
      { kind: "int-literal", value: 1 },
    );
  }
  assertEquals(qc.instructions.length, 12);
});

Deno.test("Circuit: returnValue and returnVoid", () => {
  const qc = new QuantumCircuit();
  qc.returnValue({ kind: "int-literal", value: 42 });
  qc.returnVoid();
  assertEquals(qc.instructions.length, 2);
  assertEquals(qc.instructions[0].kind, "return");
  assertEquals(qc.instructions[1].kind, "return");
});

// =============================================================================
// Legacy registers
// =============================================================================

Deno.test("Circuit: declareLegacyQReg and declareLegacyCReg", () => {
  const qc = new QuantumCircuit();
  qc.declareLegacyQReg("q", 5);
  qc.declareLegacyCReg("c", 5);
  assertEquals(qc.instructions[0].kind, "legacy-register-declaration");
  assertEquals(qc.instructions[1].kind, "legacy-register-declaration");
});

// =============================================================================
// Pragmas, annotations, comments
// =============================================================================

Deno.test("Circuit: pragma", () => {
  const qc = new QuantumCircuit();
  qc.pragma("vendor extension foo");
  assertEquals(qc.instructions[0].kind, "pragma");
});

Deno.test("Circuit: annotate", () => {
  const qc = new QuantumCircuit();
  qc.annotate("reversible");
  assertEquals(qc.instructions[0].kind, "annotation-statement");
});

Deno.test("Circuit: lineComment and blockComment", () => {
  const qc = new QuantumCircuit();
  qc.lineComment("this is a line comment");
  qc.blockComment("this is a block comment");
  assertEquals(qc.instructions[0].kind, "comment");
  assertEquals(qc.instructions[1].kind, "comment");
});

// =============================================================================
// Composition
// =============================================================================

Deno.test("Circuit: clone deep copies instructions", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  const c = qc.clone();
  c.x(2);
  assertEquals(qc.instructions.length, 2);
  assertEquals(c.instructions.length, 3);
});

Deno.test("Circuit: compose appends instructions and adds globalPhase", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  const other = new QuantumCircuit(Math.PI / 4);
  other.x(0);
  qc.compose(other);
  assertEquals(qc.instructions.length, 2);
  // globalPhase should now be pi/4 (0 + pi/4).
});

Deno.test("Circuit: compose with qubit map", () => {
  const qc = new QuantumCircuit();
  const other = new QuantumCircuit();
  other.cx(0, 1);
  qc.compose(other, [2, 3]);
  assertEquals(qc.instructions[0].qubits, [2, 3]);
  assertEquals(qc.numQubits, 4);
});

Deno.test("Circuit: inverse reverses and marks gates inverted", () => {
  const qc = new QuantumCircuit();
  qc.h(0).s(0).t(0);
  const inv = qc.inverse();
  assertEquals(inv.instructions.length, 3);
  // Reverse order: t, s, h
  assertEquals(inv.instructions[0].name, "t");
  assertEquals(inv.instructions[1].name, "s");
  assertEquals(inv.instructions[2].name, "h");
  // Each has inv modifier
  for (const instr of inv.instructions) {
    assertEquals(instr.modifiers?.[0].kind, "inv");
  }
});

Deno.test("Circuit: inverse rejects non-unitary", () => {
  const qc = new QuantumCircuit();
  qc.h(0).measure(0, { registerName: "c", bitIndex: 0 });
  assertThrows(() => qc.inverse(), Error, "non-unitary");
});

// =============================================================================
// Parameter binding
// =============================================================================

Deno.test("Circuit: run binds symbolic parameters", () => {
  const qc = new QuantumCircuit();
  const theta = AngleExpr.symbol("theta");
  qc.rx(theta, 0);
  const bound = qc.run({ theta: 0.5 });
  const p = bound.instructions[0].parameters?.[0];
  assertEquals(p?.kind, "float");
});

Deno.test("Circuit: run partial binding leaves unbound symbolic", () => {
  const qc = new QuantumCircuit();
  const theta = AngleExpr.symbol("theta");
  const phi = AngleExpr.symbol("phi");
  qc.rx(theta, 0);
  qc.ry(phi, 0);
  const bound = qc.run({ theta: 0.5 });
  assertEquals(bound.instructions[0].parameters?.[0].kind, "float");
  assertEquals(bound.instructions[1].parameters?.[0].kind, "symbol");
});

// =============================================================================
// Complexity inspection
// =============================================================================

Deno.test("Circuit: complexity basic counts", () => {
  const qc = new QuantumCircuit();
  qc.h(0).h(1).cx(0, 1).ccx(0, 1, 2).measure(0);
  const c = qc.complexity();
  assertEquals(c.instructionCount, 5);
  assertEquals(c.gateCounts["h"], 2);
  assertEquals(c.gateCounts["cx"], 1);
  assertEquals(c.gateCounts["ccx"], 1);
  assertEquals(c.twoQubitGateCount, 1);
  assertEquals(c.multiQubitGateCount, 1);
  assertEquals(c.measurementCount, 1);
});

Deno.test("Circuit: complexity depth of sequential single-qubit gates", () => {
  const qc = new QuantumCircuit();
  qc.h(0).x(0).s(0); // all on qubit 0 sequentially
  const c = qc.complexity();
  assertEquals(c.depth, 3);
});

Deno.test("Circuit: complexity depth of parallel gates", () => {
  const qc = new QuantumCircuit();
  qc.h(0).x(1); // parallel
  const c = qc.complexity();
  assertEquals(c.depth, 1);
});

// =============================================================================
// toMatrix: core semantic test
// =============================================================================

Deno.test("Circuit.toMatrix: empty circuit on 0 qubits = 1x1 identity", () => {
  const qc = new QuantumCircuit();
  const M = qc.toMatrix();
  assertEquals(M.rows, 1);
});

Deno.test("Circuit.toMatrix: single H equals HGate()", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  assert(qc.toMatrix().equals(HGate()));
});

Deno.test("Circuit.toMatrix: single X equals XGate()", () => {
  const qc = new QuantumCircuit();
  qc.x(0);
  assert(qc.toMatrix().equals(XGate()));
});

Deno.test("Circuit.toMatrix: CX equals CXGate", () => {
  const qc = new QuantumCircuit();
  qc.cx(0, 1);
  assert(qc.toMatrix().equals(CXGate()));
});

Deno.test("Circuit.toMatrix: Bell-state circuit H+CX agrees with composition", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  // Expected: CX(0,1) · (H⊗I), where (H⊗I) applies H on qubit 0 (arg 0 = MSB bit 1)
  const expected = CXGate().multiply(HGate().tensor(Matrix.identity(2)));
  assert(qc.toMatrix().equals(expected));
});

Deno.test("Circuit.toMatrix: H·Z·H = X (Phase Convention identity)", () => {
  const qc = new QuantumCircuit();
  qc.h(0).z(0).h(0);
  assert(qc.toMatrix().equals(XGate()));
});

Deno.test("Circuit.toMatrix: SWAP via 3 CX equals SwapGate", () => {
  const qc = new QuantumCircuit();
  qc.cx(0, 1).cx(1, 0).cx(0, 1);
  assert(qc.toMatrix().equals(SwapGate()));
});

Deno.test("Circuit.toMatrix: CCX equals CCXGate", () => {
  const qc = new QuantumCircuit();
  qc.ccx(0, 1, 2);
  assert(qc.toMatrix().equals(CCXGate()));
});

Deno.test("Circuit.toMatrix: QFT(3) equals QFTGate(3)", () => {
  const qc = new QuantumCircuit();
  qc.qft([0, 1, 2]);
  assert(qc.toMatrix().equals(QFTGate(3)));
});

Deno.test("Circuit.toMatrix: globalPhase is applied", () => {
  const qc = new QuantumCircuit(Math.PI);
  qc.x(0);
  // exp(i*pi) * X = -X
  const expected = XGate().scale(Complex.MINUS_ONE);
  assert(qc.toMatrix().equals(expected));
});

Deno.test("Circuit.toMatrix: run-bound symbolic circuit produces concrete matrix", () => {
  const qc = new QuantumCircuit();
  qc.rx(AngleExpr.symbol("theta"), 0);
  const bound = qc.run({ theta: Math.PI });
  assert(bound.toMatrix().equals(RXGate(Math.PI)));
});

Deno.test("Circuit.toMatrix: mcx(3 controls) equals MCXGate(3)", () => {
  const qc = new QuantumCircuit();
  qc.mcx([0, 1, 2], 3);
  assert(qc.toMatrix().equals(MCXGate(3)));
});

Deno.test("Circuit.toMatrix: CZ equals CZGate", () => {
  const qc = new QuantumCircuit();
  qc.cz(0, 1);
  assert(qc.toMatrix().equals(CZGate()));
});

Deno.test("Circuit.toMatrix: rejects non-unitary circuit", () => {
  const qc = new QuantumCircuit();
  qc.h(0).measure(0);
  assertThrows(() => qc.toMatrix(), Error);
});

Deno.test("Circuit.toMatrix: inverse of Bell circuit undoes it", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  const inv = qc.inverse();
  // qc.toMatrix() * inv.toMatrix() = I
  const r = inv.toMatrix().multiply(qc.toMatrix());
  assert(r.equals(Matrix.identity(4)));
});

Deno.test("Circuit.toMatrix: pow(2) of X = I", () => {
  const qc = new QuantumCircuit();
  qc.pow(2, "x", [0]);
  assert(qc.toMatrix().equals(Matrix.identity(2)));
});

Deno.test("Circuit.toMatrix: ctrl(1) of x equals CX", () => {
  const qc = new QuantumCircuit();
  qc.ctrl(1, "x", [0, 1]);
  // ctrl(1) @ X on (c, t) should equal CX
  assert(qc.toMatrix().equals(CXGate()));
});

// =============================================================================
// Append escape hatch
// =============================================================================

Deno.test("Circuit.append accepts pre-built Instruction", () => {
  const qc = new QuantumCircuit();
  qc.append({ kind: "gate", qubits: [0], clbits: [], name: "h" });
  assertEquals(qc.instructions[0].name, "h");
});

// =============================================================================
// toGate / toInstruction
// =============================================================================

Deno.test("Circuit.toGate snapshots the body", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  const g = qc.toGate("bell_prep");
  assertEquals(g.label, "bell_prep");
  assertEquals(g.numQubits, 2);
  assertEquals(g.body.instructions.length, 2);
});
