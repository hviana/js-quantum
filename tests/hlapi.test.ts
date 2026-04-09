/**
 * HLAPI tests — comprehensive coverage of all 12 algorithm families
 * and supporting infrastructure (transforms, solve strategies,
 * result analyses, resource estimation).
 *
 * Uses small qubit counts (2-9) so every test runs quickly on the
 * classical state-vector simulator.
 */

import { assert, assertEquals } from "jsr:@std/assert";
import { quantum } from "../src/hlapi/mod.ts";

// =============================================================================
// 1. Search (Grover's algorithm)
// =============================================================================

Deno.test("HLAPI Search: find item in small list", async () => {
  const r = await quantum("search").search_in([10, 42, 7, 99], 42).run();
  assertEquals(r.answer(), 42);
  assert(r.confidence() > 0.5, "confidence should be > 0.5");
});

Deno.test("HLAPI Search: find with predicate", async () => {
  const r = await quantum("search")
    .search_in([1, 2, 3, 4, 5, 6, 7, 8], (x: unknown) => (x as number) > 6)
    .run();
  const ans = r.answer() as number;
  assert(ans === 7 || ans === 8, `expected 7 or 8, got ${ans}`);
});

Deno.test("HLAPI Search: find with array target", async () => {
  const r = await quantum("search")
    .search_in([10, 20, 30, 40], [20, 30])
    .run();
  const ans = r.answer() as number;
  // 2/4 marked — amplification is weak; any item is acceptable
  assert(ans !== null && ans !== undefined, "answer should not be null");
});

Deno.test("HLAPI Search: inspect and circuit extraction", async () => {
  const task = quantum("search").search_in([1, 2, 3, 4], 3);
  const info = task.inspect("summary");
  assertEquals(info.supportStatus, "fully_executable");
  const circ = task.circuit();
  assert(circ !== null, "circuit should be extractable");
});

// =============================================================================
// 2. Factoring (Shor's algorithm)
// =============================================================================

Deno.test("HLAPI Factoring: factor 15", async () => {
  const r = await quantum("factoring").data("target", 15).run();
  const factors = r.answer() as number[];
  assert(factors.length >= 2, "should have at least 2 factors");
  assertEquals(factors.reduce((a, b) => a * b, 1), 15);
});

Deno.test("HLAPI Factoring: factor 6 (even)", async () => {
  const r = await quantum("factoring").data("target", 6).run();
  const factors = r.answer() as number[];
  assertEquals(factors.reduce((a, b) => a * b, 1), 6);
});

Deno.test("HLAPI Factoring: factor 2 (trivial)", async () => {
  const r = await quantum("factoring").data("target", 2).run();
  const factors = r.answer() as number[];
  assertEquals(factors[0], 2);
});

// =============================================================================
// 3. Period finding
// =============================================================================

Deno.test("HLAPI Period finding: f(x) = x mod 3", async () => {
  const r = await quantum("period_finding")
    .function((x: number) => x % 3)
    .run();
  assertEquals(r.answer(), 3);
});

Deno.test("HLAPI Period finding: f(x) = x mod 4", async () => {
  const r = await quantum("period_finding")
    .function((x: number) => x % 4)
    .run();
  assertEquals(r.answer(), 4);
});

// =============================================================================
// 4. Optimization (QAOA)
// =============================================================================

Deno.test("HLAPI Optimization: minimize cost (3 bits)", async () => {
  const r = await quantum("optimization")
    .cost_function((bits: number[]) => bits[0] + bits[1] + bits[2])
    .data("custom", 3, { name: "n_bits" })
    .run();
  const ans = r.answer() as { assignment: number[]; cost: number };
  assert(ans !== null, "answer should not be null");
  assert(typeof ans.cost === "number", "cost should be a number");
  assert(Array.isArray(ans.assignment), "assignment should be an array");
});

Deno.test("HLAPI Optimization: result inspect", async () => {
  const r = await quantum("optimization")
    .cost_function((bits: number[]) => bits[0] * 2 + bits[1])
    .data("custom", 2, { name: "n_bits" })
    .run();
  const info = r.inspect();
  assert(info.backend.length > 0, "backend should be reported");
  assert(info.supportStatus !== undefined, "supportStatus should be present");
});

// =============================================================================
// 5. Linear system (HHL)
// =============================================================================

Deno.test("HLAPI Linear system: 2x2 Ax=b", async () => {
  const r = await quantum("linear_system")
    .matrix([[2, 0], [0, 3]])
    .vector([1, 1])
    .run();
  const x = r.answer() as number[];
  assert(x.length >= 2, "solution should have 2 components");
  assert(x.some((v) => Math.abs(v) > 1e-10), "solution should be non-trivial");
});

Deno.test("HLAPI Linear system: confidence and method", async () => {
  const r = await quantum("linear_system")
    .matrix([[1, 0], [0, 2]])
    .vector([1, 1])
    .run();
  assert(r.confidence() > 0, "confidence should be positive");
  assert(r.raw().note.length > 0, "note should be present");
});

// =============================================================================
// 6. Simulation (Hamiltonian time evolution)
// =============================================================================

Deno.test("HLAPI Simulation: time evolution of Pauli Z", async () => {
  const r = await quantum("simulation")
    .system([[1, 0], [0, -1]])
    .run();
  assert(r.answer() !== null && r.answer() !== undefined);
  assert(r.inspect().supportStatus !== undefined);
});

Deno.test("HLAPI Simulation: time evolution of Pauli X", async () => {
  const r = await quantum("simulation")
    .system([[0, 1], [1, 0]])
    .run();
  assert(r.answer() !== null && r.answer() !== undefined);
  assert(r.raw().counts !== null, "should produce counts");
});

// =============================================================================
// 7. Ground state (VQE)
// =============================================================================

Deno.test("HLAPI Ground state: 2x2 off-diagonal Hamiltonian", async () => {
  const r = await quantum("ground_state")
    .system([[1, 0.5], [0.5, -1]])
    .run();
  const ans = r.answer() as { energy: number };
  assert(ans !== null, "answer should not be null");
  assert(
    ans.energy < 0,
    `ground-state energy should be negative, got ${ans.energy}`,
  );
});

Deno.test("HLAPI Ground state: diagonal Hamiltonian", async () => {
  const r = await quantum("ground_state")
    .system([[3, 0], [0, -2]])
    .run();
  const ans = r.answer() as { energy: number };
  assert(ans !== null, "answer should not be null");
  assert(ans.energy < -1, `energy should be close to -2, got ${ans.energy}`);
});

// =============================================================================
// 8. Sampling
// =============================================================================

Deno.test("HLAPI Sampling: basic quantum sampling", async () => {
  const r = await quantum("sampling").run();
  assert(r.answer() !== null && r.answer() !== undefined);
  const counts = r.raw().counts;
  assert(counts !== null, "should produce counts");
  assert(Object.keys(counts!).length > 0, "histogram should be non-empty");
});

// =============================================================================
// 9. Classification (quantum kernel)
// =============================================================================

Deno.test("HLAPI Classification: 2-feature dataset", async () => {
  const r = await quantum("classification")
    .training_data([
      { features: [0.1, 0.2], label: "A" },
      { features: [0.8, 0.9], label: "B" },
      { features: [0.15, 0.25], label: "A" },
      { features: [0.85, 0.85], label: "B" },
    ])
    .run();
  assert(r.answer() !== null && r.answer() !== undefined);
});

Deno.test("HLAPI Classification: confidence check", async () => {
  const r = await quantum("classification")
    .training_data([
      { features: [0.0, 0.0], label: 0 },
      { features: [1.0, 1.0], label: 1 },
    ])
    .run();
  assert(r.confidence() > 0, "confidence should be positive");
});

// =============================================================================
// 10. Phase estimation (QPE)
// =============================================================================

Deno.test("HLAPI Phase estimation: phase = 0.25", async () => {
  const r = await quantum("phase_estimation")
    .function((_x: number) => 0.25)
    .run();
  const ans = r.answer() as { phase: number; confidence: number };
  assert(ans !== null, "answer should not be null");
  assert(
    Math.abs(ans.phase - 0.25) < 0.05,
    `phase should be ~0.25, got ${ans.phase}`,
  );
});

Deno.test("HLAPI Phase estimation: phase = 0.5", async () => {
  const r = await quantum("phase_estimation")
    .function((_x: number) => 0.5)
    .run();
  const ans = r.answer() as { phase: number; confidence: number };
  assert(ans !== null, "answer should not be null");
  assert(
    Math.abs(ans.phase - 0.5) < 0.05,
    `phase should be ~0.5, got ${ans.phase}`,
  );
});

// =============================================================================
// 11. Error correction (repetition code)
// =============================================================================

Deno.test("HLAPI Error correction: 3-qubit code, no error", async () => {
  const r = await quantum("error_correction").system([0, 0, 0]).run();
  assert(r.answer() !== null && r.answer() !== undefined);
});

Deno.test("HLAPI Error correction: 3-qubit code, single bit flip", async () => {
  const r = await quantum("error_correction").system([1, 0, 0]).run();
  assert(r.answer() !== null && r.answer() !== undefined);
});

Deno.test("HLAPI Error correction: 3-qubit code, all 1s", async () => {
  const r = await quantum("error_correction").system([1, 1, 1]).run();
  assert(r.answer() !== null && r.answer() !== undefined);
});

// =============================================================================
// 12. Quantum walk
// =============================================================================

Deno.test("HLAPI Quantum walk: 4-node cycle", async () => {
  const adj = [
    [0, 1, 0, 1],
    [1, 0, 1, 0],
    [0, 1, 0, 1],
    [1, 0, 1, 0],
  ];
  const r = await quantum("quantum_walk").graph(adj).run();
  assert(r.answer() !== null && r.answer() !== undefined);
});

Deno.test("HLAPI Quantum walk: complete graph K3", async () => {
  const adj = [
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
  ];
  const r = await quantum("quantum_walk").graph(adj).run();
  assert(r.answer() !== null && r.answer() !== undefined);
});

// =============================================================================
// 13. Transforms
// =============================================================================

Deno.test("HLAPI Transform: controlled", () => {
  const task = quantum("custom")
    .input("oracle", [[1, 0], [0, -1]], { format: "matrix" })
    .transform("controlled");
  assert(task.inspect().inputs.length >= 2, "should create derived artifact");
});

Deno.test("HLAPI Transform: inverse/adjoint", () => {
  const task = quantum("custom")
    .input("oracle", [[0, 1], [1, 0]], { format: "matrix" })
    .transform("inverse");
  assert(task.inspect().inputs.length >= 2, "should create derived artifact");
});

Deno.test("HLAPI Transform: power", () => {
  const task = quantum("custom")
    .input("oracle", [[0, 1], [1, 0]], { format: "matrix" })
    .transform("power", { params: { exponent: 3 } });
  assert(task.inspect().inputs.length >= 2, "should create derived artifact");
});

Deno.test("HLAPI Transform: tensor product", () => {
  const task = quantum("custom")
    .input("custom", [[1, 0], [0, 1]], { format: "matrix", name: "A" })
    .input("custom", [[0, 1], [1, 0]], { format: "matrix", name: "B" })
    .transform("tensor", { source: ["A", "B"] });
  assert(task.inspect().inputs.length >= 3, "should create derived artifact");
});

Deno.test("HLAPI Transform: compose", () => {
  const task = quantum("custom")
    .input("custom", [[0, 1], [1, 0]], { format: "matrix", name: "A" })
    .input("custom", [[1, 0], [0, -1]], { format: "matrix", name: "B" })
    .transform("compose", { source: ["A", "B"] });
  assert(task.inspect().inputs.length >= 3, "should create derived artifact");
});

// =============================================================================
// 14. Solve strategies
// =============================================================================

Deno.test("HLAPI Solve: default strategy inference", () => {
  const task = quantum("search").search_in([1, 2, 3, 4], 3).solve();
  const pipeline = task.inspect().pipeline;
  assert(pipeline !== null, "pipeline should exist after solve()");
  assertEquals(pipeline!.family, "amplitude_amplification");
});

Deno.test("HLAPI Solve: custom pipeline steps", () => {
  const task = quantum("search")
    .search_in([1, 2, 3, 4], 3)
    .solve([
      { action: "prepare", input: "initial_state" },
      { action: "apply", input: "oracle" },
      { action: "measure" },
    ]);
  const pipeline = task.inspect().pipeline;
  assert(pipeline !== null, "pipeline should exist");
  assertEquals(pipeline!.steps.length, 3);
});

// =============================================================================
// 15. Result analyses
// =============================================================================

Deno.test("HLAPI Analysis: marginal", async () => {
  const r = await quantum("search").search_in([1, 2, 3, 4], 3).run();
  const a = r.analyze("marginal", { qubits: [0] });
  assertEquals(a.analyses_().length, 1);
});

Deno.test("HLAPI Analysis: estimate_error", async () => {
  const r = await quantum("search").search_in([1, 2, 3, 4], 3).run();
  const a = r.analyze("estimate_error", { confidence: 0.95 });
  const val = a.analyses_()[0].value as { interval: number[] };
  assertEquals(val.interval.length, 2);
  assert(val.interval[0] <= val.interval[1], "interval lower <= upper");
});

Deno.test("HLAPI Analysis: aggregate", async () => {
  const r = await quantum("sampling").run();
  const a = r.analyze("aggregate");
  const val = a.analyses_()[0].value as { mean: number; variance: number };
  assert(typeof val.mean === "number", "mean should be a number");
  assert(typeof val.variance === "number", "variance should be a number");
});

Deno.test("HLAPI Analysis: fit gaussian", async () => {
  const r = await quantum("sampling").run();
  const a = r.analyze("fit", { model: "gaussian" });
  const val = a.analyses_()[0].value as { model: string; mean: number };
  assertEquals(val.model, "gaussian");
});

Deno.test("HLAPI Analysis: certify", async () => {
  const r = await quantum("search").search_in([1, 2, 3, 4], 3).run();
  const a = r.analyze("certify", { threshold: 0.5 });
  const val = a.analyses_()[0].value as { certified: boolean };
  assert(typeof val.certified === "boolean", "certified should be boolean");
});

Deno.test("HLAPI Analysis: reconstruct distribution", async () => {
  const r = await quantum("sampling").run();
  const a = r.analyze("reconstruct");
  const val = a.analyses_()[0].value as {
    distribution: Record<string, number>;
  };
  assert(val.distribution !== undefined, "distribution should be present");
});

Deno.test("HLAPI Analysis: correlate", async () => {
  const r = await quantum("sampling").run();
  const a = r.analyze("correlate");
  assertEquals(a.analyses_().length, 1);
});

Deno.test("HLAPI Analysis: visualize histogram", async () => {
  const r = await quantum("sampling").run();
  const a = r.analyze("visualize", { format: "histogram" });
  assertEquals(a.analyses_().length, 1);
});

Deno.test("HLAPI Analysis: export csv", async () => {
  const r = await quantum("sampling").run();
  const a = r.analyze("export", { format: "csv" });
  const csv = a.analyses_()[0].value as string;
  assert(csv.includes("bitstring"), "CSV should have header");
});

Deno.test("HLAPI Analysis: export json", async () => {
  const r = await quantum("search").search_in([1, 2, 3, 4], 3).run();
  const a = r.analyze("export", { format: "json" });
  const parsed = JSON.parse(a.analyses_()[0].value as string);
  assert(parsed.task !== undefined, "exported JSON should have task");
});

Deno.test("HLAPI Analysis: chained analyses", async () => {
  const r = await quantum("search").search_in([1, 2, 3, 4], 3).run();
  const a = r
    .analyze("marginal", { qubits: [0] })
    .analyze("estimate_error")
    .analyze("certify");
  assertEquals(a.analyses_().length, 3);
});

// =============================================================================
// 16. Resource estimation
// =============================================================================

Deno.test("HLAPI Resource estimation via inspect", () => {
  const task = quantum("search").search_in([1, 2, 3, 4], 3).solve();
  const info = task.inspect("resources");
  assert(info.resources !== undefined, "resources should be present");
  assert(info.resources!.qubits > 0, "qubits should be positive");
  assert(info.resources!.gates > 0, "gates should be positive");
  assert(info.resources!.depth > 0, "depth should be positive");
});

// =============================================================================
// 17. Composition modes
// =============================================================================

Deno.test("HLAPI Composition: parallel executes steps concurrently", async () => {
  const r = await quantum("search")
    .search_in([1, 2, 3, 4], 3)
    .solve(
      [
        { action: "prepare", input: "initial_state" },
        { action: "apply", input: "oracle" },
        { action: "apply", input: "diffuser" },
        { action: "measure" },
      ],
      { composition: "parallel" },
    )
    .run();
  // Parallel composition should still produce a result.
  assert(r.raw().note !== undefined, "should have a note");
});

Deno.test("HLAPI Composition: branch selects matching step", async () => {
  const r = await quantum("search")
    .search_in([1, 2, 3, 4], 3)
    .solve(
      [
        {
          action: "prepare",
          input: "initial_state",
          params: { condition: { on: "pipelineFamily", equals: "custom" } },
        },
        { action: "apply", input: "oracle" },
        { action: "measure" },
      ],
      { composition: "branch" },
    )
    .run();
  assert(r.raw() !== null, "branch composition should produce a result");
});

Deno.test("HLAPI Composition: recursive converges", async () => {
  const r = await quantum("search")
    .search_in([1, 2, 3, 4], 3)
    .solve(
      [
        { action: "prepare", input: "initial_state" },
        { action: "apply", input: "oracle" },
        { action: "apply", input: "diffuser" },
        { action: "measure" },
      ],
      { composition: "recursive", control: { maxDepth: 3 } },
    )
    .run();
  assert(r.raw() !== null, "recursive composition should produce a result");
});

Deno.test("HLAPI Composition: map over data items", async () => {
  const r = await quantum("search")
    .search_in([1, 2, 3, 4], 3)
    .solve(
      [
        { action: "prepare", input: "initial_state" },
        { action: "apply", input: "oracle" },
        { action: "apply", input: "diffuser" },
        { action: "measure" },
      ],
      { composition: "map" },
    )
    .run();
  assert(r.raw() !== null, "map composition should produce a result");
});

// =============================================================================
// 18. Step executors: adapt, braid, repeat, branch, custom
// =============================================================================

Deno.test("HLAPI Step: adapt (measurement-based QC)", async () => {
  // 3-qubit linear graph state: adaptive measurement.
  const adj = [
    [0, 1, 0],
    [1, 0, 1],
    [0, 1, 0],
  ];
  const r = await quantum("custom")
    .graph_state(adj)
    .solve(
      [
        {
          action: "adapt",
          input: "graph_state",
          params: { outputQubits: [2] },
        },
      ],
    )
    .run();
  const raw = r.raw();
  assert(raw.counts !== null, "adapt should produce measurement counts");
  assert(
    raw.note!.includes("MBQC"),
    "note should mention MBQC",
  );
});

Deno.test("HLAPI Step: braid (topological QC, Ising model)", async () => {
  const r = await quantum("custom")
    .solve(
      [
        {
          action: "braid",
          params: {
            schedule: [[0, 1], [1, 2], [0, 1]],
            model: "ising",
          },
        },
        { action: "measure" },
      ],
    )
    .run();
  const raw = r.raw();
  // Braid sets circuitBuilt=true and n, so measure should fire.
  assert(raw !== null, "braid + measure should produce a result");
});

Deno.test("HLAPI Step: braid (topological QC, Fibonacci model)", async () => {
  const r = await quantum("custom")
    .solve(
      [
        {
          action: "braid",
          params: {
            schedule: [[0, 1], [1, 0]],
            model: "fibonacci",
          },
        },
        { action: "measure" },
      ],
    )
    .run();
  assert(r.raw() !== null, "fibonacci braid should produce a result");
});

Deno.test("HLAPI Step: repeat with nested sub-steps", async () => {
  const r = await quantum("search")
    .search_in([1, 2, 3, 4], 3)
    .solve(
      [
        { action: "prepare", input: "initial_state" },
        {
          action: "repeat",
          repeat: 2,
          steps: [
            { action: "apply", input: "oracle" },
            { action: "apply", input: "diffuser" },
          ],
        },
        { action: "measure" },
      ],
    )
    .run();
  assert(r.raw() !== null, "repeat with nested steps should produce a result");
});

Deno.test("HLAPI Step: branch conditional execution", async () => {
  // Branch that matches: pipelineFamily === "custom".
  const r = await quantum("search")
    .search_in([1, 2, 3, 4], 3)
    .solve(
      [
        { action: "prepare", input: "initial_state" },
        {
          action: "branch",
          params: { condition: { on: "pipelineFamily", equals: "custom" } },
          steps: [
            { action: "apply", input: "oracle" },
          ],
        },
        { action: "measure" },
      ],
    )
    .run();
  assert(r.raw() !== null, "branch step should produce a result");
});

Deno.test("HLAPI Step: branch skips when condition fails", async () => {
  const task = quantum("search")
    .search_in([1, 2, 3, 4], 3)
    .solve(
      [
        { action: "prepare", input: "initial_state" },
        {
          action: "branch",
          params: { condition: { on: "nonexistent", equals: "yes" } },
          steps: [
            { action: "apply", input: "oracle" },
          ],
        },
        { action: "measure" },
      ],
    );
  const r = await task.run();
  assert(r.raw() !== null, "branch skip should still produce a result");
});

Deno.test("HLAPI Step: custom with gate sequence", async () => {
  const r = await quantum("custom")
    .solve(
      [
        {
          action: "custom",
          params: {
            gates: [
              { gate: "h", qubits: [0] },
              { gate: "cx", qubits: [0, 1] },
              { gate: "h", qubits: [1] },
            ],
          },
        },
        { action: "measure" },
      ],
    )
    .run();
  const raw = r.raw();
  assert(raw.counts !== null, "custom gate sequence should produce counts");
});

Deno.test("HLAPI Step: custom with executor function", async () => {
  const r = await quantum("custom")
    .solve(
      [
        {
          action: "custom",
          params: {
            executor: (ctx: Record<string, unknown>) => {
              return {
                state: {
                  ...(ctx as { state: Record<string, unknown> }).state,
                  customRan: true,
                },
              };
            },
          },
        },
      ],
    )
    .run();
  assert(r.raw() !== null, "custom executor should produce a result");
});

// =============================================================================
// Pipeline stages (.then)
// =============================================================================

// --- Quantum → Function ---

Deno.test("HLAPI pipe: sync function after quantum stage", async () => {
  const r = await quantum("search")
    .search_in([10, 42, 7, 99], 42)
    .pipe(({ answer }) => ({ found: answer, processed: true }))
    .run();
  const ans = r.answer() as { found: unknown; processed: boolean };
  assertEquals(ans.found, 42);
  assertEquals(ans.processed, true);
});

Deno.test("HLAPI pipe: async function after quantum stage", async () => {
  const r = await quantum("search")
    .search_in([10, 42, 7, 99], 42)
    .pipe(async ({ answer }) => {
      await Promise.resolve();
      return (answer as number) * 2;
    })
    .run();
  assertEquals(r.answer(), 84);
});

Deno.test("HLAPI pipe: receives counts from quantum execution", async () => {
  let receivedCounts: unknown = null;
  await quantum("search")
    .search_in([10, 42, 7, 99], 42)
    .pipe(({ counts }) => {
      receivedCounts = counts;
      return counts;
    })
    .run();
  assert(receivedCounts !== null, "counts should be passed to then()");
  assert(
    typeof receivedCounts === "object",
    "counts should be an object (histogram)",
  );
});

Deno.test("HLAPI pipe: receives confidence, task, and fallback fields", async () => {
  const captured: { confidence: number; task: string; fallback: boolean }[] =
    [];
  await quantum("search")
    .search_in([10, 42, 7, 99], 42)
    .pipe((input) => {
      captured.push({
        confidence: input.confidence,
        task: input.task,
        fallback: input.fallback,
      });
      return input.answer;
    })
    .run();
  assertEquals(captured.length, 1);
  assert(captured[0].confidence >= 0 && captured[0].confidence <= 1);
  assertEquals(captured[0].task, "search");
  assertEquals(typeof captured[0].fallback, "boolean");
});

Deno.test("HLAPI pipe: non-interpreted task passes answer and counts", async () => {
  const r = await quantum("sampling")
    .data("items", [0, 1, 2, 3])
    .pipe(({ answer, counts }) => ({
      original: answer,
      hasCounts: counts !== null,
    }))
    .run();
  const ans = r.answer() as { original: unknown; hasCounts: boolean };
  assert(ans.original !== null && ans.original !== undefined);
  assertEquals(typeof ans.hasCounts, "boolean");
});

// --- Function → Function ---

Deno.test("HLAPI pipe: chained functions pass return values forward", async () => {
  const r = await quantum("search")
    .search_in([10, 42, 7, 99], 42)
    .pipe(({ answer }) => (answer as number) + 1)
    .pipe(({ answer }) => (answer as number) * 10)
    .run();
  // 42 + 1 = 43, then 43 * 10 = 430
  assertEquals(r.answer(), 430);
});

Deno.test("HLAPI pipe: chained async functions", async () => {
  const r = await quantum("factoring")
    .data("target", 15)
    .pipe(async ({ answer }) => {
      const factors = answer as number[];
      await Promise.resolve();
      return factors.reduce((a, b) => a + b, 0);
    })
    .pipe(async ({ answer }) => {
      await Promise.resolve();
      return { sum: answer, verified: true };
    })
    .run();
  const ans = r.answer() as { sum: number; verified: boolean };
  assertEquals(ans.verified, true);
  assert(typeof ans.sum === "number");
});

Deno.test("HLAPI pipe: counts persist across function stages", async () => {
  const snapshots: (Readonly<Record<string, number>> | null)[] = [];
  await quantum("search")
    .search_in([10, 42, 7, 99], 42)
    .pipe(({ counts }) => {
      snapshots.push(counts);
      return "intermediate";
    })
    .pipe(({ counts }) => {
      snapshots.push(counts);
      return "final";
    })
    .run();
  assertEquals(snapshots.length, 2);
  // counts from the quantum stage carry through function stages
  assert(snapshots[0] !== null);
  assertEquals(snapshots[0], snapshots[1]);
});

// --- Quantum → Function → Quantum ---

Deno.test("HLAPI pipe: function returns QuantumTask for quantum-to-quantum pipeline", async () => {
  const r = await quantum("search")
    .search_in([1, 2, 3, 4], 3)
    .pipe(({ answer }) => {
      // Use search result to configure a new quantum task
      const n = answer as number;
      return quantum("period_finding").function((x: number) => x % n);
    })
    .run();
  assertEquals(r.answer(), 3);
});

Deno.test("HLAPI pipe: quantum stage updates counts and confidence", async () => {
  const snapshots: { counts: unknown; confidence: number }[] = [];
  await quantum("search")
    .search_in([10, 42, 7, 99], 42)
    .pipe((input) => {
      snapshots.push({ counts: input.counts, confidence: input.confidence });
      // Trigger a fresh quantum execution (search produces real counts)
      return quantum("search").search_in([1, 2, 3, 4], 2);
    })
    .pipe((input) => {
      // This stage should see the second search's counts/confidence
      snapshots.push({ counts: input.counts, confidence: input.confidence });
      return input.answer;
    })
    .run();
  assertEquals(snapshots.length, 2);
  // Both quantum stages produced counts
  assert(snapshots[0].counts !== null);
  assert(snapshots[1].counts !== null);
});

// --- Quantum → Function → Quantum → Function ---

Deno.test("HLAPI pipe: full mixed pipeline Q→F→Q→F", async () => {
  const r = await quantum("search")
    .search_in([1, 2, 3, 4, 5, 6, 7, 8], 6)
    .pipe(({ answer }) => {
      // Use search result to set up a period-finding task
      const target = answer as number;
      return quantum("period_finding").function((x: number) => x % target);
    })
    .pipe(({ answer }) => {
      // Final function stage: wrap the period in a result object
      return { period: answer, label: "done" };
    })
    .run();
  const ans = r.answer() as { period: number; label: string };
  assertEquals(ans.period, 6);
  assertEquals(ans.label, "done");
});

// --- raw() preservation ---

Deno.test("HLAPI pipe: raw() returns last quantum stage data", async () => {
  const r = await quantum("search")
    .search_in([10, 42, 7, 99], 42)
    .pipe(() => quantum("search").search_in([1, 2, 3, 4], 2))
    .run();
  const raw = r.raw();
  // raw should reflect the second search execution
  assert(raw.counts !== null, "raw counts from last quantum stage");
  assert(raw.shots > 0);
  assertEquals(r.answer(), 2);
});

Deno.test("HLAPI pipe: raw() after function-only stages reflects initial quantum", async () => {
  const r = await quantum("search")
    .search_in([10, 42, 7, 99], 42)
    .pipe(() => "transformed")
    .run();
  assertEquals(r.answer(), "transformed");
  const raw = r.raw();
  assert(raw.counts !== null, "raw counts should be preserved");
  assert(raw.shots > 0, "raw shots should be preserved");
});
