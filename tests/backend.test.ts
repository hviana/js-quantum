import { assert, assertEquals } from "jsr:@std/assert";
import type { Backend, Executable } from "../src/backend.ts";
import { DEFAULT_SHOTS, makeBasicTarget } from "../src/backend.ts";
import { QuantumCircuit } from "../src/circuit.ts";
import type { ExecutionResult } from "../src/types.ts";

// -------- DEFAULT_SHOTS --------

Deno.test("backend: DEFAULT_SHOTS is 1024", () => {
  assertEquals(DEFAULT_SHOTS, 1024);
});

// -------- makeBasicTarget --------

Deno.test("makeBasicTarget: stores numQubits and basis gates", () => {
  const t = makeBasicTarget(5, ["h", "cx", "rz"], null);
  assertEquals(t.numQubits, 5);
  assertEquals(t.instructions.has("h"), true);
  assertEquals(t.instructions.has("cx"), true);
  assertEquals(t.instructions.has("rz"), true);
});

Deno.test("makeBasicTarget: null coupling map becomes undefined on target", () => {
  const t = makeBasicTarget(3, ["x"], null);
  assertEquals(t.couplingMap, undefined);
});

Deno.test("makeBasicTarget: preserves coupling map", () => {
  const cm: [number, number][] = [[0, 1], [1, 2]];
  const t = makeBasicTarget(3, ["cx"], cm);
  assertEquals(t.couplingMap?.length, 2);
});

// -------- Backend contract (via a mock) --------

class MockBackend implements Backend {
  readonly name = "mock";
  readonly numQubits: number;
  readonly basisGates: readonly string[];
  readonly couplingMap: null = null;

  constructor(numQubits: number, basisGates: readonly string[]) {
    this.numQubits = numQubits;
    this.basisGates = basisGates;
  }

  transpileAndPackage(
    circuit: QuantumCircuit,
    shots: number = DEFAULT_SHOTS,
  ): Executable {
    return {
      compiledCircuit: circuit,
      target: makeBasicTarget(this.numQubits, this.basisGates, null),
      numShots: shots,
    };
  }

  execute(executable: Executable, shots?: number): ExecutionResult {
    const _shots = shots ?? executable.numShots;
    // Mock: return 100% on "0" unconditionally.
    return { "0": 100 };
  }
}

Deno.test("Backend contract: mock backend transpileAndPackage produces executable", () => {
  const b = new MockBackend(5, ["h", "cx"]);
  const qc = new QuantumCircuit();
  qc.h(0);
  const ex = b.transpileAndPackage(qc, 512);
  assertEquals(ex.numShots, 512);
  assertEquals(ex.compiledCircuit, qc);
});

Deno.test("Backend contract: default shot count when not supplied", () => {
  const b = new MockBackend(5, ["h"]);
  const qc = new QuantumCircuit();
  const ex = b.transpileAndPackage(qc);
  assertEquals(ex.numShots, DEFAULT_SHOTS);
});

Deno.test("Backend contract: execute returns ExecutionResult", () => {
  const b = new MockBackend(5, ["h"]);
  const qc = new QuantumCircuit();
  qc.h(0);
  const ex = b.transpileAndPackage(qc);
  const res = b.execute(ex);
  assert(typeof res === "object");
  // percentages sum to 100
  const total = Object.values(res as Record<string, number>).reduce(
    (a, b) => a + b,
    0,
  );
  assertEquals(total, 100);
});
