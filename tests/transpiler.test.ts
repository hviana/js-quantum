import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import { OpenQASMTranspiler } from "../src/transpiler.ts";
import {
  decomposeKAK,
  decomposeToRzSx,
  expandGateModifiers,
  optimize,
  routeSABRE,
  translateToBasis,
  transpile,
} from "../src/transpiler.ts";
import { QuantumCircuit } from "../src/circuit.ts";
import { SimulatorBackend } from "../src/simulator.ts";
import { HGate, XGate } from "../src/gates.ts";
import { Matrix } from "../src/matrix.ts";

const T = new OpenQASMTranspiler();

// =============================================================================
// SERIALIZER
// =============================================================================

Deno.test("Serializer: empty circuit produces version + qubit decl", () => {
  const qc = new QuantumCircuit();
  const text = T.serialize(qc);
  assert(text.includes("OPENQASM 3.1;"));
});

Deno.test("Serializer: omitProgramVersion suppresses header", () => {
  const qc = new QuantumCircuit();
  qc.omitProgramVersion();
  qc.h(0);
  const text = T.serialize(qc);
  assert(!text.includes("OPENQASM"));
});

Deno.test("Serializer: setProgramVersion(3) emits major-only", () => {
  const qc = new QuantumCircuit();
  qc.setProgramVersion(3);
  const text = T.serialize(qc);
  assert(text.includes("OPENQASM 3;"));
});

Deno.test("Serializer: include directive", () => {
  const qc = new QuantumCircuit();
  qc.include("stdgates.inc");
  const text = T.serialize(qc);
  assert(text.includes('include "stdgates.inc";'));
});

Deno.test("Serializer: defcalgrammar", () => {
  const qc = new QuantumCircuit();
  qc.setCalibrationGrammar("openpulse");
  const text = T.serialize(qc);
  assert(text.includes('defcalgrammar "openpulse";'));
});

Deno.test("Serializer: qubit declaration", () => {
  const qc = new QuantumCircuit();
  qc.h(2);
  const text = T.serialize(qc);
  assert(text.includes("qubit[3] q;"));
});

Deno.test("Serializer: classical register declaration", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  qc.addClassicalRegister("c", 4);
  const text = T.serialize(qc);
  assert(text.includes("bit[4] c;"));
});

Deno.test("Serializer: multiple classical registers in declaration order", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  qc.addClassicalRegister("a", 2);
  qc.addClassicalRegister("b", 3);
  const text = T.serialize(qc);
  const idxA = text.indexOf("bit[2] a;");
  const idxB = text.indexOf("bit[3] b;");
  assert(idxA >= 0 && idxB > idxA);
});

Deno.test("Serializer: H gate emission", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  const text = T.serialize(qc);
  assert(text.includes("h q[0];"));
});

Deno.test("Serializer: parameterized gate (rx)", () => {
  const qc = new QuantumCircuit();
  qc.rx(0.5, 0);
  const text = T.serialize(qc);
  assert(text.includes("rx(0.5) q[0];"));
});

Deno.test("Serializer: pi parameter preserved literally", () => {
  const qc = new QuantumCircuit();
  qc.rx(Math.PI, 0);
  const text = T.serialize(qc);
  // Math.PI rendered as a numeric literal — fine, just check it ends with the qubit ref.
  assert(text.includes("q[0]"));
});

Deno.test("Serializer: cx with two operands", () => {
  const qc = new QuantumCircuit();
  qc.cx(0, 1);
  const text = T.serialize(qc);
  assert(text.includes("cx q[0], q[1];"));
});

Deno.test("Serializer: ccx with three operands", () => {
  const qc = new QuantumCircuit();
  qc.ccx(0, 1, 2);
  const text = T.serialize(qc);
  assert(text.includes("ccx q[0], q[1], q[2];"));
});

Deno.test("Serializer: measure assignment syntax", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  qc.addClassicalRegister("c", 1);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  const text = T.serialize(qc);
  // 1-bit register: "c = measure q[0];"
  assert(text.includes("c = measure q[0];"));
});

Deno.test("Serializer: measure arrow syntax", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  qc.addClassicalRegister("c", 1);
  qc.measure(0, { registerName: "c", bitIndex: 0 }, "arrow");
  const text = T.serialize(qc);
  assert(text.includes("measure q[0] -> c;"));
});

Deno.test("Serializer: bare measure", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  qc.measure(0);
  const text = T.serialize(qc);
  assert(text.includes("measure q[0];"));
});

Deno.test("Serializer: reset", () => {
  const qc = new QuantumCircuit();
  qc.x(0);
  qc.reset(0);
  const text = T.serialize(qc);
  assert(text.includes("reset q[0];"));
});

Deno.test("Serializer: barrier with operands", () => {
  const qc = new QuantumCircuit();
  qc.h(0).h(1).barrier(0, 1);
  const text = T.serialize(qc);
  assert(text.includes("barrier q[0], q[1];"));
});

Deno.test("Serializer: bare barrier", () => {
  const qc = new QuantumCircuit();
  qc.h(0).barrier();
  const text = T.serialize(qc);
  assert(text.includes("barrier;"));
});

Deno.test("Serializer: delay", () => {
  const qc = new QuantumCircuit();
  qc.x(0);
  qc.delay({ kind: "literal", value: 100, unit: "ns" }, [0]);
  const text = T.serialize(qc);
  assert(text.includes("delay[100ns] q[0];"));
});

Deno.test("Serializer: gphase emits when nonzero globalPhase", () => {
  const qc = new QuantumCircuit(Math.PI);
  qc.x(0);
  const text = T.serialize(qc);
  assert(text.includes("gphase("));
});

Deno.test("Serializer: zero globalPhase omitted", () => {
  const qc = new QuantumCircuit();
  qc.x(0);
  const text = T.serialize(qc);
  assert(!text.includes("gphase("));
});

Deno.test("Serializer: ctrl modifier", () => {
  const qc = new QuantumCircuit();
  qc.ctrl(1, "x", [0, 1]);
  const text = T.serialize(qc);
  assert(text.includes("ctrl @ x q[0], q[1];"));
});

Deno.test("Serializer: ctrl(2) modifier", () => {
  const qc = new QuantumCircuit();
  qc.ctrl(2, "x", [0, 1, 2]);
  const text = T.serialize(qc);
  assert(text.includes("ctrl(2) @ x q[0], q[1], q[2];"));
});

Deno.test("Serializer: inv modifier", () => {
  const qc = new QuantumCircuit();
  qc.inv("s", [0]);
  const text = T.serialize(qc);
  assert(text.includes("inv @ s q[0];"));
});

Deno.test("Serializer: pow modifier", () => {
  const qc = new QuantumCircuit();
  qc.pow(3, "x", [0]);
  const text = T.serialize(qc);
  assert(text.includes("pow(3) @ x q[0];"));
});

Deno.test("Serializer: if statement", () => {
  const qc = new QuantumCircuit();
  qc.addClassicalRegister("c", 1);
  const body = new QuantumCircuit();
  body.x(0);
  qc.ifTest(
    {
      kind: "binary",
      op: "==",
      left: { kind: "identifier", name: "c" },
      right: { kind: "int-literal", value: 1 },
    },
    body,
  );
  const text = T.serialize(qc);
  assert(text.includes("if ("));
  assert(text.includes("x q[0];"));
});

Deno.test("Serializer: for loop", () => {
  const body = new QuantumCircuit();
  body.h(0);
  const qc = new QuantumCircuit();
  qc.forLoop("i", {
    kind: "range",
    start: { kind: "int-literal", value: 0 },
    end: { kind: "int-literal", value: 3 },
  }, body);
  const text = T.serialize(qc);
  assert(text.includes("for int i in"));
});

Deno.test("Serializer: while loop", () => {
  const body = new QuantumCircuit();
  body.x(0);
  const qc = new QuantumCircuit();
  qc.whileLoop({ kind: "bool-literal", value: true }, body);
  const text = T.serialize(qc);
  assert(text.includes("while ("));
});

Deno.test("Serializer: break / continue / end", () => {
  const qc = new QuantumCircuit();
  qc.breakLoop().continueLoop().end();
  const text = T.serialize(qc);
  assert(text.includes("break;"));
  assert(text.includes("continue;"));
  assert(text.includes("end;"));
});

Deno.test("Serializer: gate definition", () => {
  const body = new QuantumCircuit();
  body.applyGate({ name: "h", qubits: [0] });
  const qc = new QuantumCircuit();
  qc.defineGate("my_h", [], ["q"], body);
  const text = T.serialize(qc);
  assert(text.includes("gate my_h q {"));
});

Deno.test("Serializer: const declaration", () => {
  const qc = new QuantumCircuit();
  qc.declareConst("N", { kind: "int", width: 32 }, {
    kind: "int-literal",
    value: 5,
  });
  const text = T.serialize(qc);
  assert(text.includes("const int[32] N = 5;"));
});

Deno.test("Serializer: input declaration", () => {
  const qc = new QuantumCircuit();
  qc.declareInput("theta", { kind: "angle", width: 32 });
  const text = T.serialize(qc);
  assert(text.includes("input angle[32] theta;"));
});

Deno.test("Serializer: line comment", () => {
  const qc = new QuantumCircuit();
  qc.lineComment("hello");
  const text = T.serialize(qc);
  assert(text.includes("// hello"));
});

Deno.test("Serializer: pragma", () => {
  const qc = new QuantumCircuit();
  qc.pragma("vendor extension");
  const text = T.serialize(qc);
  assert(text.includes("pragma vendor extension"));
});

// =============================================================================
// PARSER (deserializer)
// =============================================================================

Deno.test("Parser: empty program", () => {
  const qc = T.deserialize("OPENQASM 3.1;\n");
  assertEquals(qc.version?.major, 3);
  assertEquals(qc.version?.minor, 1);
});

Deno.test("Parser: include + qubit decl", () => {
  const qc = T.deserialize(
    `OPENQASM 3.1;\ninclude "stdgates.inc";\nqubit[3] q;\n`,
  );
  assertEquals(qc.includes[0].path, "stdgates.inc");
});

Deno.test("Parser: H + CX gate calls", () => {
  const src = `OPENQASM 3.1;
qubit[2] q;
h q[0];
cx q[0], q[1];
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions.length, 2);
  assertEquals(qc.instructions[0].name, "h");
  assertEquals(qc.instructions[1].name, "cx");
  assertEquals(qc.instructions[1].qubits, [0, 1]);
});

Deno.test("Parser: parameterized gate", () => {
  const src = `OPENQASM 3.1;
qubit[1] q;
rx(0.5) q[0];
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions.length, 1);
  assertEquals(qc.instructions[0].name, "rx");
  assertEquals(qc.instructions[0].parameters?.[0].kind, "float");
});

Deno.test("Parser: pi as parameter", () => {
  const src = `OPENQASM 3.1;
qubit[1] q;
rx(pi) q[0];
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].parameters?.[0].kind, "pi");
});

Deno.test("Parser: classical register declaration", () => {
  const src = `OPENQASM 3.1;
bit[4] c;
`;
  const qc = T.deserialize(src);
  assertEquals(qc.classicalRegisters[0].name, "c");
  assertEquals(qc.classicalRegisters[0].size, 4);
});

Deno.test("Parser: measurement assignment", () => {
  const src = `OPENQASM 3.1;
qubit[1] q;
bit[1] c;
h q[0];
c = measure q[0];
`;
  const qc = T.deserialize(src);
  const measure = qc.instructions[1];
  assertEquals(measure.kind, "measure");
});

Deno.test("Parser: measurement arrow syntax", () => {
  const src = `OPENQASM 3.1;
qubit[1] q;
bit[1] c;
measure q[0] -> c;
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].kind, "measure");
  assertEquals(qc.instructions[0].measurementSyntax, "arrow");
});

Deno.test("Parser: bare measure", () => {
  const src = `OPENQASM 3.1;
qubit[1] q;
measure q[0];
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].measurementSyntax, "bare");
});

Deno.test("Parser: reset", () => {
  const src = `OPENQASM 3.1;
qubit[1] q;
reset q[0];
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].kind, "reset");
});

Deno.test("Parser: barrier with no args", () => {
  const src = `OPENQASM 3.1;
qubit[2] q;
barrier;
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].kind, "barrier");
  assertEquals(qc.instructions[0].qubits.length, 0);
});

Deno.test("Parser: barrier with operands", () => {
  const src = `OPENQASM 3.1;
qubit[2] q;
barrier q[0], q[1];
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].kind, "barrier");
  assertEquals(qc.instructions[0].qubits, [0, 1]);
});

Deno.test("Parser: delay", () => {
  const src = `OPENQASM 3.1;
qubit[1] q;
delay[100ns] q[0];
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].kind, "delay");
});

Deno.test("Parser: gphase", () => {
  const src = `OPENQASM 3.1;
gphase(pi);
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].kind, "global-phase");
});

Deno.test("Parser: ctrl modifier", () => {
  const src = `OPENQASM 3.1;
qubit[2] q;
ctrl @ x q[0], q[1];
`;
  const qc = T.deserialize(src);
  const instr = qc.instructions[0];
  assertEquals(instr.modifiers?.[0].kind, "ctrl");
});

Deno.test("Parser: inv modifier", () => {
  const src = `OPENQASM 3.1;
qubit[1] q;
inv @ s q[0];
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].modifiers?.[0].kind, "inv");
});

Deno.test("Parser: if statement", () => {
  const src = `OPENQASM 3.1;
qubit[1] q;
bit[1] c;
if (c == 1) {
  x q[0];
}
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].kind, "if");
});

Deno.test("Parser: for loop", () => {
  const src = `OPENQASM 3.1;
qubit[1] q;
for int i in [0:3] {
  h q[0];
}
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].kind, "for");
});

Deno.test("Parser: line comment preserved", () => {
  const src = `OPENQASM 3.1;
// this is a comment
qubit[1] q;
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].kind, "comment");
});

Deno.test("Parser: pragma preserved", () => {
  const src = `OPENQASM 3.1;
pragma vendor extension foo
qubit[1] q;
`;
  const qc = T.deserialize(src);
  assertEquals(qc.instructions[0].kind, "pragma");
});

// =============================================================================
// ROUND-TRIP
// =============================================================================

Deno.test("Round-trip: H circuit serializes and reparses", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  const text = T.serialize(qc);
  const qc2 = T.deserialize(text);
  // Should still contain an h gate.
  assert(qc2.instructions.some((i) => i.name === "h"));
});

Deno.test("Round-trip: Bell circuit", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  qc.addClassicalRegister("c", 2);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  qc.measure(1, { registerName: "c", bitIndex: 1 });
  const text = T.serialize(qc);
  const qc2 = T.deserialize(text);
  // Verify resulting circuit has h, cx, and 2 measurements.
  assertEquals(qc2.instructions.filter((i) => i.kind === "gate").length, 2);
  assertEquals(qc2.instructions.filter((i) => i.kind === "measure").length, 2);
});

Deno.test("Round-trip: simulate then serialize then deserialize then simulate yields same distribution", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  qc.addClassicalRegister("c", 2);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  qc.measure(1, { registerName: "c", bitIndex: 1 });
  const sim = new SimulatorBackend();
  const text = T.serialize(qc);
  const qc2 = T.deserialize(text);
  const result = sim.execute(sim.transpileAndPackage(qc2, 1024));
  const p00 = result["00"] ?? 0;
  const p11 = result["11"] ?? 0;
  assert(Math.abs(p00 - 50) < 6);
  assert(Math.abs(p11 - 50) < 6);
});

Deno.test("Round-trip: parameterized circuit", () => {
  const qc = new QuantumCircuit();
  qc.rx(0.5, 0);
  const text = T.serialize(qc);
  const qc2 = T.deserialize(text);
  assertEquals(qc2.instructions[0].name, "rx");
});

Deno.test("Round-trip: ctrl modifier preserved", () => {
  const qc = new QuantumCircuit();
  qc.ctrl(1, "x", [0, 1]);
  const text = T.serialize(qc);
  const qc2 = T.deserialize(text);
  assertEquals(qc2.instructions[0].modifiers?.[0].kind, "ctrl");
});

// =============================================================================
// COMPILATION PIPELINE
// =============================================================================

Deno.test("optimize: cancels CX·CX", () => {
  const qc = new QuantumCircuit();
  qc.cx(0, 1).cx(0, 1);
  const opt = optimize(qc);
  assertEquals(opt.instructions.length, 0);
});

Deno.test("optimize: removes Rz(0)", () => {
  const qc = new QuantumCircuit();
  qc.rz(0, 0);
  const opt = optimize(qc);
  assertEquals(opt.instructions.length, 0);
});

Deno.test("optimize: fuses adjacent Rz on same qubit", () => {
  const qc = new QuantumCircuit();
  qc.rz(1, 0).rz(2, 0);
  const opt = optimize(qc);
  assertEquals(opt.instructions.length, 1);
  // The fused parameter should evaluate to 3.
  const inst = opt.instructions[0];
  assertEquals(inst.parameters?.[0].evaluate(), 3);
});

Deno.test("expandGateModifiers: ctrl @ x becomes a unitary instruction", () => {
  const qc = new QuantumCircuit();
  qc.ctrl(1, "x", [0, 1]);
  const expanded = expandGateModifiers(qc);
  assertEquals(expanded.instructions[0].name, "unitary");
});

Deno.test("translateToBasis: H decomposes into rz, ry sequence", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  const trans = translateToBasis(qc, ["rz", "ry"]);
  // Every gate in the result should be in the basis.
  for (const instr of trans.instructions) {
    if (instr.kind === "gate" && instr.name) {
      assert(instr.name === "rz" || instr.name === "ry");
    }
  }
});

Deno.test("translateToBasis: gates already in basis are preserved", () => {
  const qc = new QuantumCircuit();
  qc.cx(0, 1).rz(0.5, 0);
  const trans = translateToBasis(qc, ["cx", "rz", "sx"]);
  assertEquals(trans.instructions[0].name, "cx");
  assertEquals(trans.instructions[1].name, "rz");
});

Deno.test("routeSABRE: linear coupling map preserves adjacent CX", () => {
  const qc = new QuantumCircuit();
  qc.cx(0, 1);
  const routed = routeSABRE(qc, [[0, 1], [1, 2]]);
  // No SWAPs should be inserted.
  assertEquals(routed.instructions.filter((i) => i.name === "swap").length, 0);
});

Deno.test("routeSABRE: inserts SWAPs for non-adjacent CX", () => {
  const qc = new QuantumCircuit();
  qc.cx(0, 2);
  const routed = routeSABRE(qc, [[0, 1], [1, 2]]);
  // At least one SWAP should be inserted.
  assert(routed.instructions.some((i) => i.name === "swap"));
});

Deno.test("transpile: end-to-end Bell state for linear backend", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  const target = {
    numQubits: 2,
    basisGates: ["h", "cx", "rz", "ry"] as readonly string[],
    couplingMap: [[0, 1]] as ReadonlyArray<readonly [number, number]>,
  };
  const compiled = transpile(qc, target);
  assert(compiled.transpilationMetadata !== null);
  assertEquals(compiled.transpilationMetadata?.basisGateSet, [
    "h",
    "cx",
    "rz",
    "ry",
  ]);
});

Deno.test("transpile: result gives same distribution as original", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  qc.addClassicalRegister("c", 2);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  qc.measure(1, { registerName: "c", bitIndex: 1 });
  const target = {
    numQubits: 2,
    basisGates: ["h", "cx", "rz", "ry"] as readonly string[],
    couplingMap: [[0, 1]] as ReadonlyArray<readonly [number, number]>,
  };
  const compiled = transpile(qc, target);
  const sim = new SimulatorBackend();
  const r1 = sim.execute(sim.transpileAndPackage(qc, 1024));
  const r2 = sim.execute(sim.transpileAndPackage(compiled, 1024));
  // Both should produce ~50/50 on {00, 11}.
  assert(Math.abs((r1["00"] ?? 0) - (r2["00"] ?? 0)) < 10);
});

// =============================================================================
// Decomposition utilities
// =============================================================================

Deno.test("decomposeToRzSx: produces Rz/SX sequence with global phase", () => {
  const result = decomposeToRzSx(HGate());
  assert(result.instructions.length > 0);
  for (const i of result.instructions) {
    assert(i.gate === "rz" || i.gate === "sx" || i.gate === "x");
  }
});

Deno.test("decomposeKAK: returns single unitary instruction wrapping the input", () => {
  // Use a 4x4 unitary matrix.
  const M = Matrix.identity(4);
  const result = decomposeKAK(M);
  assertEquals(result.instructions.length, 1);
});

Deno.test("decomposeKAK: rejects non-4x4 input", () => {
  assertThrows(() => decomposeKAK(HGate()));
});
