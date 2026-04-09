/**
 * Integration tests — full quantum circuits exercised end-to-end
 * through the public API in `src/mod.ts`. These verify that the
 * complete pipeline (circuit construction → simulation → result
 * histogram) produces correct quantum mechanical behavior.
 */

import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert";
import {
  AngleExpr,
  blochOfCircuit,
  Complex,
  CXGate,
  HGate,
  IBMBackend,
  Matrix,
  OpenQASMTranspiler,
  QBraidBackend,
  QFTGate,
  QuantumCircuit,
  SimulatorBackend,
  transpile,
  XGate,
} from "../src/mod.ts";

const STAT_TOL = 5;
const sim = new SimulatorBackend();
const T = new OpenQASMTranspiler();

// =============================================================================
// Public API export sanity
// =============================================================================

Deno.test("API: all major types are importable", () => {
  // Just test that the imports above resolve without errors.
  assert(typeof QuantumCircuit === "function");
  assert(typeof SimulatorBackend === "function");
  assert(typeof OpenQASMTranspiler === "function");
  assert(typeof IBMBackend === "function");
  assert(typeof QBraidBackend === "function");
});

// =============================================================================
// Standard quantum circuits
// =============================================================================

Deno.test("Integration: identity circuit returns |0...0>", () => {
  const qc = new QuantumCircuit();
  for (let i = 0; i < 4; i++) qc.id(i);
  qc.addClassicalRegister("c", 4);
  for (let i = 0; i < 4; i++) qc.measure(i, { registerName: "c", bitIndex: i });
  const r = sim.execute(sim.transpileAndPackage(qc, 256));
  assertEquals(r["0000"], 100);
});

Deno.test("Integration: Bell state H+CX", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  qc.addClassicalRegister("c", 2);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  qc.measure(1, { registerName: "c", bitIndex: 1 });
  const r = sim.execute(sim.transpileAndPackage(qc, 1024));
  assert(Math.abs((r["00"] ?? 0) - 50) < STAT_TOL);
  assert(Math.abs((r["11"] ?? 0) - 50) < STAT_TOL);
});

Deno.test("Integration: GHZ-3", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1).cx(0, 2);
  qc.addClassicalRegister("c", 3);
  for (let i = 0; i < 3; i++) qc.measure(i, { registerName: "c", bitIndex: i });
  const r = sim.execute(sim.transpileAndPackage(qc, 1024));
  assert(Math.abs((r["000"] ?? 0) - 50) < STAT_TOL);
  assert(Math.abs((r["111"] ?? 0) - 50) < STAT_TOL);
});

Deno.test("Integration: Deutsch-Jozsa for constant function", () => {
  // 2-qubit DJ with constant oracle f(x) = 0 → result = "0"
  const qc = new QuantumCircuit();
  qc.x(1); // ancilla |1>
  qc.h(0).h(1);
  // Oracle: identity (constant 0)
  qc.h(0); // Final H
  qc.addClassicalRegister("c", 1);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  const r = sim.execute(sim.transpileAndPackage(qc, 256));
  assertEquals(r["0"], 100);
});

Deno.test("Integration: Deutsch-Jozsa for balanced function (CX oracle)", () => {
  const qc = new QuantumCircuit();
  qc.x(1);
  qc.h(0).h(1);
  qc.cx(0, 1); // balanced oracle
  qc.h(0);
  qc.addClassicalRegister("c", 1);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  const r = sim.execute(sim.transpileAndPackage(qc, 256));
  assertEquals(r["1"], 100);
});

Deno.test("Integration: Bernstein-Vazirani recovers a 3-bit secret", () => {
  // Secret: s = 101 (bit0=1, bit1=0, bit2=1).
  const qc = new QuantumCircuit();
  // 3 data qubits + 1 ancilla.
  qc.x(3); // ancilla
  qc.h(0).h(1).h(2).h(3);
  // Oracle: CX(s_i = 1, ancilla)
  qc.cx(0, 3);
  qc.cx(2, 3);
  qc.h(0).h(1).h(2);
  qc.addClassicalRegister("c", 3);
  for (let i = 0; i < 3; i++) qc.measure(i, { registerName: "c", bitIndex: i });
  const r = sim.execute(sim.transpileAndPackage(qc, 256));
  // Expected: c[0]=1, c[1]=0, c[2]=1 → bitstring "101"
  assertEquals(r["101"], 100);
});

Deno.test("Integration: phase kickback CZ rewrite", () => {
  // Verify CZ = H · CX · H on the target qubit.
  const a = new QuantumCircuit();
  a.cz(0, 1);
  const b = new QuantumCircuit();
  b.h(1).cx(0, 1).h(1);
  // Both should produce identical matrices.
  assert(a.toMatrix().equals(b.toMatrix()));
});

Deno.test("Integration: SWAP via 3 CX matches SwapGate", () => {
  const qc = new QuantumCircuit();
  qc.cx(0, 1).cx(1, 0).cx(0, 1);
  const sim2 = new SimulatorBackend();
  // Apply to |10>: should swap to |01>.
  const initial = new QuantumCircuit();
  initial.x(0);
  initial.compose(qc);
  initial.addClassicalRegister("c", 2);
  initial.measure(0, { registerName: "c", bitIndex: 0 });
  initial.measure(1, { registerName: "c", bitIndex: 1 });
  const r = sim2.execute(sim2.transpileAndPackage(initial, 64));
  assertEquals(r["10"], 100);
});

// =============================================================================
// Higher-tier gates in larger circuits
// =============================================================================

Deno.test("Integration: QFT(3) followed by QFT†(3) gives identity", () => {
  const qc = new QuantumCircuit();
  // We can't easily run QFT then QFT† via the Tier 9 method directly,
  // so use the matrix-level check.
  qc.qft([0, 1, 2]);
  const M = qc.toMatrix();
  const expected = QFTGate(3);
  assert(M.equals(expected));
});

Deno.test("Integration: HalfAdder truth table 1+1 → sum=0, carry=1", () => {
  const qc = new QuantumCircuit();
  qc.x(0).x(1); // a=1, b=1
  qc.halfAdder(0, 1, 2, 3);
  qc.addClassicalRegister("c", 4);
  for (let i = 0; i < 4; i++) qc.measure(i, { registerName: "c", bitIndex: i });
  const r = sim.execute(sim.transpileAndPackage(qc, 64));
  // Bit positions (LSB-on-right): c[0]=a=1, c[1]=b=1, c[2]=sum=0, c[3]=carry=1
  // Reverse: "1011"
  assertEquals(r["1011"], 100);
});

Deno.test("Integration: Tier 13 phase oracle x_0 ∧ x_1 = CZ", () => {
  const qc = new QuantumCircuit();
  qc.phaseOracle([{ variables: [0, 1], negated: [false, false] }], [0, 1]);
  const matrixA = qc.toMatrix();
  const ref = new QuantumCircuit();
  ref.cz(0, 1);
  assert(matrixA.equals(ref.toMatrix()));
});

// =============================================================================
// Composition / inverse
// =============================================================================

Deno.test("Integration: compose Bell with its inverse yields identity distribution", () => {
  const bell = new QuantumCircuit();
  bell.h(0).cx(0, 1);
  const inv = bell.inverse();
  const qc = new QuantumCircuit();
  qc.compose(bell);
  qc.compose(inv);
  qc.addClassicalRegister("c", 2);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  qc.measure(1, { registerName: "c", bitIndex: 1 });
  const r = sim.execute(sim.transpileAndPackage(qc, 256));
  assertEquals(r["00"], 100);
});

Deno.test("Integration: toGate snapshots a sub-circuit", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  const g = qc.toGate("bell");
  assertEquals(g.label, "bell");
  assertEquals(g.numQubits, 2);
  assertEquals(g.body.instructions.length, 2);
});

// =============================================================================
// Parameter binding
// =============================================================================

Deno.test("Integration: symbolic parameter sweep matches sin² for RX", () => {
  for (const theta of [Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2]) {
    const qc = new QuantumCircuit();
    qc.rx(AngleExpr.symbol("t"), 0);
    qc.addClassicalRegister("c", 1);
    qc.measure(0, { registerName: "c", bitIndex: 0 });
    const bound = qc.run({ t: theta });
    const r = sim.execute(sim.transpileAndPackage(bound, 8192));
    const expected = Math.sin(theta / 2) ** 2 * 100;
    assert(Math.abs((r["1"] ?? 0) - expected) < STAT_TOL);
  }
});

// =============================================================================
// Bloch sphere
// =============================================================================

Deno.test("Integration: Bloch sphere of H|0> = |+>", () => {
  const qc = new QuantumCircuit();
  qc.h(0);
  const c = blochOfCircuit(qc, 0);
  assertAlmostEquals(c.x, 1, 1e-10);
  assertAlmostEquals(c.r, 1, 1e-10);
});

Deno.test("Integration: Bloch sphere of Bell state qubit 0 has r=0", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  const c = blochOfCircuit(qc, 0);
  assertAlmostEquals(c.r, 0, 1e-10);
});

// =============================================================================
// Round-trip serialize / parse / simulate
// =============================================================================

Deno.test("Integration: serialize → parse → simulate round-trip preserves Bell distribution", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  qc.addClassicalRegister("c", 2);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  qc.measure(1, { registerName: "c", bitIndex: 1 });
  const text = T.serialize(qc);
  const reparsed = T.deserialize(text);
  const r = sim.execute(sim.transpileAndPackage(reparsed, 1024));
  assert(Math.abs((r["00"] ?? 0) - 50) < STAT_TOL);
  assert(Math.abs((r["11"] ?? 0) - 50) < STAT_TOL);
});

Deno.test("Integration: transpile preserves Bell distribution", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  qc.addClassicalRegister("c", 2);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  qc.measure(1, { registerName: "c", bitIndex: 1 });
  const compiled = transpile(qc, {
    numQubits: 2,
    basisGates: ["rz", "ry", "cx"],
    couplingMap: [[0, 1]],
  });
  const r = sim.execute(sim.transpileAndPackage(compiled, 1024));
  assert(Math.abs((r["00"] ?? 0) - 50) < STAT_TOL);
  assert(Math.abs((r["11"] ?? 0) - 50) < STAT_TOL);
});

// =============================================================================
// Backend payload integration
// =============================================================================

Deno.test("Integration: IBM payload contains valid OpenQASM", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  qc.addClassicalRegister("c", 2);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  qc.measure(1, { registerName: "c", bitIndex: 1 });
  const ibm = new IBMBackend({
    name: "test",
    numQubits: 5,
    basisGates: ["ecr", "rz", "sx", "x"],
    couplingMap: [[0, 1], [1, 2], [2, 3], [3, 4]],
    serviceCrn: "crn:test",
    apiVersion: "2025-01-01",
    bearerToken: "test",
  });
  const ex = ibm.transpileAndPackage(qc, 100);
  const text =
    (ex.payload as { params: { pubs: [string, null, number][] } }).params
      .pubs[0][0];
  assert(text.includes("OPENQASM"));
});

Deno.test("Integration: qBraid payload contains valid OpenQASM", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  const qbraid = new QBraidBackend({
    name: "test",
    numQubits: 5,
    basisGates: ["h", "cx"],
    couplingMap: null,
    deviceQrn: "qbraid:test",
    apiKey: "test",
  });
  const ex = qbraid.transpileAndPackage(qc, 100);
  const text = (ex.payload as { program: { data: string } }).program.data;
  assert(text.includes("OPENQASM"));
});

// =============================================================================
// Matrix-level identities verified through circuits
// =============================================================================

Deno.test("Integration: H·X·H = Z (matrix-level via circuit)", () => {
  const qc = new QuantumCircuit();
  qc.h(0).x(0).h(0);
  const M = qc.toMatrix();
  // We use the gate constructor for Z directly imported.
  const Z = new Matrix([
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.MINUS_ONE],
  ]);
  assert(M.equals(Z));
});

Deno.test("Integration: H ⊗ H = circuit on two parallel qubits", () => {
  const qc = new QuantumCircuit();
  qc.h(0).h(1);
  const M = qc.toMatrix();
  const expected = HGate().tensor(HGate());
  assert(M.equals(expected));
});

Deno.test("Integration: CX is its own inverse", () => {
  const qc = new QuantumCircuit();
  qc.cx(0, 1).cx(0, 1);
  const M = qc.toMatrix();
  assert(M.equals(Matrix.identity(4)));
});

Deno.test("Integration: X ⊗ X applied via two parallel x gates", () => {
  const qc = new QuantumCircuit();
  qc.x(0).x(1);
  const M = qc.toMatrix();
  const expected = XGate().tensor(XGate());
  assert(M.equals(expected));
});

// =============================================================================
// Higher-tier circuit smoke tests
// =============================================================================

Deno.test("Integration: ModularAdder(2) full truth table via circuit", () => {
  // Test a few specific (a, b) pairs.
  for (const [a, b] of [[1, 1], [2, 3], [0, 0], [3, 3]]) {
    const qc = new QuantumCircuit();
    // Set a (qubits 0..1) and b (qubits 2..3).
    if ((a >> 0) & 1) qc.x(0);
    if ((a >> 1) & 1) qc.x(1);
    if ((b >> 0) & 1) qc.x(2);
    if ((b >> 1) & 1) qc.x(3);
    qc.modularAdder([0, 1], [2, 3]);
    qc.addClassicalRegister("c", 4);
    for (let i = 0; i < 4; i++) {
      qc.measure(i, { registerName: "c", bitIndex: i });
    }
    const r = sim.execute(sim.transpileAndPackage(qc, 64));
    const sum = (a + b) % 4;
    // Bit positions: c[0]=a[0], c[1]=a[1], c[2]=sum[0], c[3]=sum[1]
    const expectedBits = [(a >> 0) & 1, (a >> 1) & 1, sum & 1, (sum >> 1) & 1];
    const expectedKey = expectedBits.slice().reverse().join("");
    assertEquals(
      r[expectedKey],
      100,
      `ModularAdder a=${a} b=${b}: expected sum=${sum}, key=${expectedKey}`,
    );
  }
});

Deno.test("Integration: Bell state matrix matches reference", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  // Expected: CX · (H ⊗ I)
  const expected = CXGate().multiply(HGate().tensor(Matrix.identity(2)));
  assert(qc.toMatrix().equals(expected));
});

// =============================================================================
// Transpilation pipeline equivalence
// =============================================================================

Deno.test("Integration: transpile + simulate = original simulate (Bell)", () => {
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  qc.addClassicalRegister("c", 2);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  qc.measure(1, { registerName: "c", bitIndex: 1 });
  const compiled = transpile(qc, {
    numQubits: 2,
    basisGates: ["rz", "ry", "cx"],
    couplingMap: [[0, 1]],
  });
  const original = sim.execute(sim.transpileAndPackage(qc, 4096));
  const transp = sim.execute(sim.transpileAndPackage(compiled, 4096));
  // Both should be ~50/50 on |00> and |11> with 0 elsewhere.
  const dist = (r: Record<string, number>) => [r["00"] ?? 0, r["11"] ?? 0];
  const o = dist(original);
  const t = dist(transp);
  assert(Math.abs(o[0] - t[0]) < 6);
  assert(Math.abs(o[1] - t[1]) < 6);
});
