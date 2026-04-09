# HLAPI Replication Guide

> **Purpose of this document.** An AI agent (or human developer) reading this
> file should be able to **faithfully reimplement** the js-quantum High-Level
> API (HLAPI) in any language and on any quantum computing framework. Every
> feature, type, algorithm, and behavioral contract is described in enough
> detail for a deterministic implementation.
>
> **First step.** Before implementing, the agent **must** ask the user:
>
> 1. **Target language** — e.g. Python, Rust, C#, Go, Java.
> 2. **Target quantum framework** — e.g. Qiskit, Cirq, PennyLane, Amazon Braket,
>    Q#, or a custom simulator.
> 3. **Execution environment** — e.g. local simulator only, cloud hardware
>    access, hybrid.
> 4. **Scope** — full replication or a subset of algorithm families.
>
> These answers determine naming conventions, package structure, and which
> circuit-building primitives map to framework-native constructs.

---

## 1. Project Overview

The HLAPI is a **classical-first abstraction layer** for quantum computing.
Users supply classical data (numbers, lists, matrices, callables) and a problem
description; the module translates this into quantum circuits, executes them on
a backend, and returns a classical answer. Quantum-mechanical details (qubits,
gates, oracles, Hamiltonians, bitstrings) are internal and never surface unless
the user explicitly requests them. The module covers 12 algorithm families
(Grover search, Shor factoring, QAOA/VQE optimization, Hamiltonian simulation,
HHL linear solver, quantum phase estimation, quantum walks, kernel-based
classification, error correction, sampling, measurement-based QC, and
topological QC) with a unified fluent builder API and a pluggable pipeline
execution engine.

---

## 2. Architecture

### 2.1 Design Decisions

| Decision                           | Rationale                                                                                                                                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fluent builder** (`QuantumTask`) | Every method returns `this`; users chain calls ending with `.run()`. No subclassing, no inheritance.                                                                                                                              |
| **Single bridge module**           | Only one module imports host-library primitives (circuit builder, simulator, gate library). All other modules are pure data transformation and orchestration. This is the only file that changes when porting to a new framework. |
| **Artifact registry**              | An in-memory key-value store tracks every piece of data the user registers. Transforms produce new artifacts with a derivation lineage. The registry is scoped to one `QuantumTask` instance.                                     |
| **Preset pipelines + overrides**   | Each algorithm family has a default pipeline skeleton (a list of step actions). Users can override steps, change composition mode, or supply a fully custom pipeline.                                                             |
| **Composition modes**              | The pipeline runner supports 8 execution modes (sequence, loop, parallel, branch, recursive, map, repeat, pipeline) to handle variational loops, data-parallel classification, conditional branching, etc.                        |
| **Interpretation layer**           | A dedicated module converts raw measurement histograms into task-specific classical answers with algorithm-aware confidence scores.                                                                                               |
| **Classical fallback**             | When a problem exceeds simulator capacity, a well-defined classical algorithm produces the correct answer and marks the result with `fallback: true`.                                                                             |

### 2.2 Component Diagram

```
User Code
    |
    v
quantum(problem, options?) -----> QuantumTask (fluent builder)
    |                                  |
    |  .data() / .input() / .search_in() / .matrix() / ...
    |  .transform()
    |  .solve(strategy?, options?)
    |  .pipe(fn)
    |                                  |
    v                                  v
 .run(shots?)                     Registry (artifacts + pipeline)
    |                                  |
    v                                  v
 dispatchAndRun()              Pipeline Runner
    |                           (composition modes)
    |                                  |
    v                                  v
 Bridge Layer                   Step Executors
 (host-library imports,         (prepare, apply, evolve,
  circuit building,              measure, encode, correct,
  classical fallbacks)           optimize, adapt, braid,
    |                            sample, repeat, branch,
    v                            custom)
 Backend.execute()                     |
    |                                  v
    v                           interpret(task, raw)
 BridgeRawResult                       |
    |                                  v
    v                           InterpretedResult
 ResultHandle                          |
 (.answer(), .confidence(),            |
  .raw(), .inspect(),                  |
  .analyze(), .analyses_())  <---------+
```

### 2.3 Execution Flow (Detailed)

1. `quantum(problemString)` creates a `QuantumTask`, mapping the problem string
   to a `(ProblemClass, TaskType)` pair.
2. The user chains `.data()` / `.input()` calls to register classical data as
   artifacts in the task's Registry.
3. `.transform()` calls execute matrix operations (controlled, inverse, tensor,
   etc.) eagerly and register derived artifacts.
4. `.solve(strategy?, options?)` selects a pipeline skeleton (from presets or
   custom) and stores it in the Registry.
5. `.pipe(fn)` registers pipeline stage functions. Each stage receives the
   output of the preceding stage (quantum or TypeScript) and its return value
   flows into the next stage. If a stage returns a `QuantumTask`, that task is
   executed as a quantum stage and its result becomes the input for the
   following stage. Both preceding and following stages can be TypeScript
   functions or quantum executions, in any combination.
6. `.run(shots?)` triggers execution: a. If no pipeline was set, `.solve()` is
   called with defaults. b. Resource constraints are validated (depth, gates,
   T-count, memory). c. `dispatchAndRun()` decides the execution path:
   - **Bridge-handled tasks** (classify, solve_linear, factoring,
     period_finding) bypass the pipeline runner and go directly to their
     handler, which builds circuits internally.
   - **All other tasks** go through the pipeline runner, which walks the steps
     respecting the composition mode. d. Step executors build circuit fragments
     on a shared `QuantumCircuit`. The `measure`/`sample` step executes the
     circuit on the backend. e. If no step produced a final result, the pipeline
     runner falls back to the legacy bridge handler. f. `interpret(task, raw)`
     converts the raw histogram into a task-specific classical answer with
     confidence. g. `.pipe()` stages are executed sequentially; each receives
     the output of the preceding stage. If a stage returns a plain value, it is
     wrapped as the `answer` of a `PipelineOutput` for the next stage. If a
     stage returns a `QuantumTask`, that task is executed as a quantum stage and
     its result becomes the input for the next stage. h. A `ResultHandle` wraps
     the final result.

---

## 3. Directory Structure

```
hlapi/
  mod.ts              — Public entry point: quantum(), re-exports
  task.ts             — QuantumTask builder class
  params.ts           — All type definitions, enums, interfaces
  result.ts           — ResultHandle class + analysis implementations
  bridge.ts           — Classical<->quantum translation (ONLY host-library import)
  registry.ts         — Artifact registry + Pipeline types
  interpret.ts        — Raw result -> classical answer + confidence
  presets.ts          — Default pipeline skeletons per algorithm family
  pipeline_runner.ts  — Pipeline execution engine (composition modes)
  step_executors.ts   — One function per StepAction
  examples/           — One example per algorithm family
```

---

## 4. Key Files

| File                 | Role                                                                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mod.ts`             | Public API surface. Exports `quantum()`, `QuantumTask`, `ResultHandle`, and all types.                                                                                                                               |
| `task.ts`            | Core builder. Owns the `Registry`, resolves problems, executes transforms, chains pipelines, runs execution.                                                                                                         |
| `params.ts`          | Single source of truth for all enums and interfaces. Every type the system uses is defined here.                                                                                                                     |
| `bridge.ts`          | **The only file that imports host-library primitives.** Contains all circuit-building functions, classical fallbacks, and the dispatch router. When porting to a new framework, this is the primary file to rewrite. |
| `step_executors.ts`  | Implements each pipeline step action (prepare, apply, evolve, measure, etc.). Builds real circuit fragments.                                                                                                         |
| `pipeline_runner.ts` | Orchestrates step execution with composition modes (sequence, loop, parallel, branch, recursive, map).                                                                                                               |
| `presets.ts`         | Maps each algorithm family to its default pipeline skeleton. Also maps TaskType to AlgorithmFamily.                                                                                                                  |
| `interpret.ts`       | Decodes raw measurement histograms into task-specific answers with algorithm-aware confidence scoring.                                                                                                               |
| `result.ts`          | `ResultHandle` class with `.answer()`, `.confidence()`, `.raw()`, `.inspect()`, `.analyze()`.                                                                                                                        |
| `registry.ts`        | In-memory artifact store with lineage tracking. Internal only, not exported from `mod.ts`.                                                                                                                           |

---

## 5. Conventions

### 5.1 Naming

- **Problem strings** are user-facing: `"search"`, `"factoring"`,
  `"optimization"`, `"linear_system"`, `"simulation"`, etc.
- **Task types** are internal identifiers: `"search"`, `"factoring"`,
  `"optimize"`, `"time_evolution"`, `"solve_linear"`, etc.
- **Algorithm families** name the algorithmic strategy:
  `"amplitude_amplification"`, `"fourier_analysis"`, `"variational"`, etc.
- **Data roles** (`DataRole`) name what classical data represents: `"items"`,
  `"target"`, `"cost"`, `"matrix"`, `"vector"`, etc.
- **Input kinds** (`InputKind`) name quantum-native objects: `"hamiltonian"`,
  `"oracle"`, `"ansatz"`, `"kernel"`, etc.

### 5.2 Qubit Ordering

All internal code uses **MSB-first** qubit ordering:

- For an m-qubit gate on qubits `[q0, q1, ..., q_{m-1}]`, qubit `q0` is the
  most-significant bit of the gate matrix index.
- Integer `x` encoded across `n` qubits `[0, 1, ..., n-1]`:
  `qubit i carries bit (n - 1 - i) of x`.
- Measurements map qubit `i` to classical bit `n - 1 - i`, so
  `parseInt(bitstring, 2)` recovers the integer directly.
- Diagonal gates: gate-local index `k` corresponds to qubit `i` having value
  `(k >> (n - 1 - i)) & 1`.
- **Never** use LSB-first `(x >> i) & 1` to map bit `i` onto qubit `i`.
- **Never** use `bitReverse` to fix ordering.

### 5.3 Error Handling

- Invalid problem strings throw immediately.
- Missing required artifacts (e.g., no `items` for search) throw at `.run()`
  time, inside the bridge handler.
- Resource limit violations throw before circuit execution.
- Duplicate artifact names throw at registration time.
- Unknown task types return `supportStatus: "unsupported"` with a null answer
  (no throw).

### 5.4 Immutability

- `ResultHandle.analyze()` returns a **new** `ResultHandle`; it does not mutate
  the original.
- Pipeline presets are frozen structures; overrides produce new copies.
- Artifacts are readonly after registration.

---

## 6. Dependencies & Environment

### 6.1 Host-Library Modules (the quantum framework)

The bridge imports these from the parent library. When porting, map each to the
target framework's equivalent:

| Module         | What it provides                                                                                                                                                                                                                                         | Framework equivalent needed |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `circuit.ts`   | `QuantumCircuit` builder with methods: `h()`, `x()`, `z()`, `cx()`, `swap()`, `ry()`, `rz()`, `p()`, `mcx()`, `unitary()`, `phaseOracle()`, `measure()`, `addClassicalRegister()`, `compose()`, `numQubits`, `numClbits`, `instructions`, `complexity()` | Circuit builder class       |
| `simulator.ts` | `SimulatorBackend` implementing `Backend.execute(circuit, shots)` returning `ExecutionResult` (histogram `Record<string, number>` of percentage values)                                                                                                  | State-vector simulator      |
| `backend.ts`   | `Backend` interface with `.execute()` and `.name`                                                                                                                                                                                                        | Backend abstraction         |
| `types.ts`     | `ExecutionResult = Record<string, number>` (bitstring -> percentage)                                                                                                                                                                                     | Histogram type              |
| `gates.ts`     | `HamiltonianGate(matrix)`, `QFTGate(n)` returning `Matrix`; `PauliTerm { pauliString, coefficient }`; `ESOPTerm { variables, negated }`                                                                                                                  | Gate matrix constructors    |
| `matrix.ts`    | `Matrix` class with `multiply()`, `dagger()`, `tensor()`, `add()`, `sub()`, `scale()`, `scaleReal()`, `get()`, `identity()`, `zeros()`, `diagonal()`, `.rows`, `.cols`                                                                                   | Linear algebra              |
| `complex.ts`   | `Complex` class with `.re`, `.im`, `Complex.ONE`, `Complex.ZERO`, `Complex.fromPolar()`                                                                                                                                                                  | Complex numbers             |

### 6.2 Runtime

- **Deno** (TypeScript, no transpilation step)
- No external npm/jsr dependencies beyond the host library
- `deno test --allow-env` to run tests
- `jsr.json` for package metadata

### 6.3 Simulator Limits

- `MAX_BRIDGE_QUBITS = 18` — problems requiring more qubits fall back to
  classical algorithms.
- State-vector memory: `2^n * 16` bytes (complex doubles).

---

## 7. Testing

- **Framework:** Deno's built-in `Deno.test` with `jsr:@std/assert`.
- **Test file:** `tests/hlapi.test.ts` (relative to project root).
- **Run:** `deno test --allow-env` or `deno task test:quick`.
- **Coverage:** All 12 algorithm families, transforms, solve strategies, result
  analyses, resource estimation, pipeline stages, edge cases (empty inputs,
  classical fallbacks).
- **Qubit counts:** Tests use 2-9 qubits for fast execution.
- **Assertion style:** `assertEquals` for exact values, `assert` with conditions
  for probabilistic quantum outputs.

When porting, replicate the test structure: one test group per algorithm family,
one group for transforms, one for analyses, one for pipeline mechanics.

---

## 8. Common Tasks

### 8.1 Add a New Algorithm Family

1. **Define the family** in `params.ts`: add a new literal to the
   `AlgorithmFamily` union type.
2. **Map tasks to the family** in `presets.ts`:
   - Add a case to `inferFamily(task)`.
   - Add a case to `loadPreset(family)` returning a `Pipeline` with the default
     step sequence, composition mode, and control params.
3. **Implement the bridge handler** in `bridge.ts`:
   - Write `runMyAlgorithm(artifacts, ctx)` that builds a `QuantumCircuit`,
     executes it, and returns a `BridgeRawResult`.
   - Include a classical fallback for when qubits exceed `MAX_BRIDGE_QUBITS`.
   - Add the handler to the `switch` in `dispatchAndRun()`.
   - If the task should bypass the pipeline runner (because the handler builds
     its own circuits), add it to `bridgeHandledTasks`.
4. **Implement step executors** in `step_executors.ts` if the algorithm
   decomposes into prepare/apply/evolve/measure steps.
5. **Add interpretation** in `interpret.ts`: add a case to `interpret()` with
   task-specific answer decoding and confidence scoring.
6. **Update the support matrix** in `bridge.ts`: add the task to
   `SUPPORT_MATRIX`.
7. **Add convenience methods** to `QuantumTask` in `task.ts` if the family needs
   specific data shorthands.
8. **Write tests** covering: basic execution, confidence > threshold, classical
   fallback, inspect/circuit extraction.
9. **Write an example** in `examples/`.

### 8.2 Add a New Data Shorthand

1. Add the role to the `DataRole` union in `params.ts` (if not already there).
2. Add a method to `QuantumTask` in `task.ts` that calls
   `this.data(role, value, options)` and returns `this`.
3. The bridge handler or step executor should look up the artifact by role name.

### 8.3 Add a New Transform

1. Add the kind to the `TransformKind` union in `params.ts`.
2. Add a case to `executeTransform()` in `task.ts` that operates on `Matrix`
   objects (or other artifact data).
3. The transform is called eagerly when the user calls
   `.transform(kind, options)`.

### 8.4 Add a New Analysis Type

1. Add a case to `runAnalysis()` in `result.ts`.
2. The analysis receives `(raw, interpreted, task, options)` and returns any
   value.
3. Analyses are chained: `result.analyze("a").analyze("b")` produces a new
   `ResultHandle` each time.

### 8.5 Add a New Composition Mode

1. Add the mode to the `CompositionMode` union in `params.ts`.
2. Implement `runMyComposition(pipeline, ctx)` in `pipeline_runner.ts`.
3. Add a case to the `switch` in `runPipeline()`.

### 8.6 Add a New Step Action

1. Add the action to the `StepAction` union in `params.ts`.
2. Implement `executeMyAction(step, ctx)` in `step_executors.ts`.
3. Register it in the `STEP_EXECUTORS` record.

---

## 9. Gotchas & Constraints

### 9.1 Bridge-Handled Tasks Bypass the Pipeline Runner

The tasks `classify`, `solve_linear`, `factoring`, and `period_finding` are
routed directly to their bridge handler, even when a pipeline is set. Their step
executors are no-ops; the handler builds its own circuits internally. If you add
a new complex task that needs internal circuit management, add it to
`bridgeHandledTasks` in `dispatchAndRun()`.

### 9.2 Fallback-Then-Handler Pattern

When the pipeline runner finishes all steps without any step producing a
`fullResult`, it calls `delegateToHandler()` which dispatches to the legacy
bridge handler. This is the normal path for complex tasks whose step executors
just set state flags.

### 9.3 Histogram Values Are Percentages

`ExecutionResult` values are **percentages** (0-100), not raw counts or
probabilities. Confidence scoring in `interpret.ts` divides by 100. When
porting, ensure your backend's histogram format matches or adjust the
conversion.

### 9.4 The `custom` Escape Hatch

Every enum includes `"custom"` as the last variant. This allows users to extend
the system without modifying the type definitions.

### 9.5 Resource Estimation Is Pre-Execution

Resource constraints (`maxDepth`, `maxGates`, `maxTCount`, `memory`) are checked
**before** pipeline execution by extracting a circuit via `.circuit()`. If the
circuit cannot be extracted pre-execution (e.g., variational algorithms),
constraints are not enforced.

### 9.6 Error Budget Is Post-Execution

Error budget enforcement happens **after** pipeline execution. It uses a simple
depolarizing noise model: `error = 1 - (1 - p_gate)^numGates`. The default
per-gate error rate is `1e-3`. Budget violations produce a warning annotation in
the result note, not an exception.

### 9.7 Pipeline Stage Functions (.pipe)

`.pipe()` registers pipeline stage functions that execute sequentially after the
initial quantum stage. Each stage receives a `PipelineOutput` from the preceding
stage — which may be the initial quantum result, a TypeScript function's return
value, or another quantum execution's result. If a stage returns a
`QuantumTask`, that task is executed as a quantum stage and its result becomes
the input for the following stage. Both the preceding and following stages can
be TypeScript functions or quantum executions, in any combination.

### 9.8 Artifact Names Must Be Unique

The Registry throws on duplicate names. Use `autoName(kind)` for generated
names. The `data()` method defaults the name to the role string, so registering
two artifacts with the same role without explicit names will throw.

### 9.9 Transforms Execute Eagerly

Unlike pipeline steps (which are deferred), `.transform()` calls execute the
matrix operation immediately and register the result as a derived artifact. This
means transforms on large matrices will consume memory at build time, not at
`.run()` time.

### 9.10 QSP Phase Computation

The `signal_transform` transform uses a recursive halving algorithm to compute
QSP phase angles from polynomial coefficients. The polynomial is specified as
`params.polynomial = [a_0, a_1, ..., a_d]`. The algorithm iteratively extracts
phase angles using `atan2(a_k, a_{k-1})` and reduces the polynomial degree.

### 9.11 Jordan-Wigner Transform

The `fermion_to_qubit` transform maps fermionic operators to Pauli strings. It
supports four term types: `number` (n_i), `hopping` (c^dag_i c_j + h.c.),
`interaction` (n_i n_j), and `excitation` (c^dag_i c_j one-directional). Like
terms are collected and near-zero coefficients (< 1e-15) are dropped.

---

## 10. Definition of Done

An implementation is complete when:

- [ ] All 13 `ProblemString` values are accepted and map to the correct
      `(ProblemClass, TaskType)` pair.
- [ ] All 12 algorithm families have preset pipelines that match the step
      sequences in section 12.
- [ ] All 13 step actions have working executors.
- [ ] All 8 composition modes execute correctly.
- [ ] All 12 transform kinds produce correct results on `Matrix` inputs.
- [ ] All 13 analysis types in `ResultHandle.analyze()` produce correct output.
- [ ] The fluent API chains correctly: every builder method returns `this`.
- [ ] `.pipe()` supports pipeline stages where each stage receives the output of
      the preceding stage. Plain return values are wrapped as the `answer` of a
      `PipelineOutput`; `QuantumTask` returns are executed as quantum stages.
      Both TypeScript functions and quantum executions can precede or follow
      each other in any combination.
- [ ] Classical fallback works for every task when qubits exceed the simulator
      limit.
- [ ] Resource constraints and error budgets are enforced as described.
- [ ] Confidence scoring matches the algorithm-specific formulas in section 14.
- [ ] All tests pass.
- [ ] The bridge module is the **only** module importing host-library
      primitives.

---

## 11. Complete Type Reference

### 11.1 Problem Vocabulary

```
ProblemString = "search" | "factoring" | "period_finding"
  | "optimization" | "simulation" | "linear_system" | "sampling"
  | "classification" | "error_correction" | "phase_estimation"
  | "ground_state" | "quantum_walk" | "custom"

ProblemClass = "hidden_subgroup" | "optimization" | "simulation"
  | "linear_algebra" | "sampling" | "machine_learning"
  | "error_correction" | "metrology" | "custom"

TaskType = "search" | "factoring" | "period_finding" | "optimize"
  | "time_evolution" | "ground_state" | "solve_linear" | "sample"
  | "classify" | "correct" | "estimate_phase" | "quantum_walk"
  | "custom"
```

**Problem string -> (ProblemClass, TaskType) mapping:**

| ProblemString        | ProblemClass       | TaskType         |
| -------------------- | ------------------ | ---------------- |
| `"search"`           | `hidden_subgroup`  | `search`         |
| `"factoring"`        | `hidden_subgroup`  | `factoring`      |
| `"period_finding"`   | `hidden_subgroup`  | `period_finding` |
| `"optimization"`     | `optimization`     | `optimize`       |
| `"simulation"`       | `simulation`       | `time_evolution` |
| `"linear_system"`    | `linear_algebra`   | `solve_linear`   |
| `"sampling"`         | `sampling`         | `sample`         |
| `"classification"`   | `machine_learning` | `classify`       |
| `"error_correction"` | `error_correction` | `correct`        |
| `"phase_estimation"` | `metrology`        | `estimate_phase` |
| `"ground_state"`     | `simulation`       | `ground_state`   |
| `"quantum_walk"`     | `hidden_subgroup`  | `quantum_walk`   |
| `"custom"`           | `custom`           | `custom`         |

### 11.2 Data & Input Vocabulary

```
DataRole = "items" | "target" | "function" | "cost" | "matrix"
  | "vector" | "graph" | "initial_state" | "training_data"
  | "system" | "custom"

InputKind = "hamiltonian" | "oracle" | "state" | "ansatz" | "cost"
  | "kernel" | "walk_operator" | "stabilizer_group" | "decoder"
  | "graph_state" | "circuit" | "custom"

RepFormat = "pauli_sum" | "matrix" | "circuit" | "truth_table"
  | "symbolic" | "opaque" | "oracle_circuit" | "angle_sequence"
  | "graph" | "stabilizer_list" | "custom"
```

### 11.3 Transform & Step Vocabulary

```
TransformKind = "adjoint" | "controlled" | "power" | "tensor"
  | "compose" | "reflection" | "block_encode" | "signal_transform"
  | "fermion_to_qubit" | "trotterize" | "lcu" | "inverse" | "custom"

StepAction = "prepare" | "apply" | "evolve" | "measure" | "encode"
  | "correct" | "adapt" | "braid" | "sample" | "optimize"
  | "repeat" | "branch" | "custom"

AlgorithmFamily = "fourier_analysis" | "amplitude_amplification"
  | "quantum_walk" | "hamiltonian_simulation" | "linear_solver"
  | "variational" | "sampling" | "kernel_method"
  | "error_correction" | "measurement_based" | "topological"
  | "phase_estimation" | "custom"

CompositionMode = "sequence" | "parallel" | "repeat" | "loop"
  | "branch" | "recursive" | "pipeline" | "map" | "custom"
```

### 11.4 Options Interfaces

```
QuantumOptions {
  qubits?: number
  model?: "gate" | "custom"       // only "gate" is implemented
  resources?: {
    maxDepth?: number
    maxGates?: number
    maxTCount?: number
    memory?: number               // bytes
  }
  backend?: "simulator" | Backend
}

DataOptions {
  name?: string
  format?: RepFormat
  encoding?: "amplitude" | "basis" | "angle" | "block" | "custom"
  metadata?: Record<string, unknown>
}

InputOptions {
  name?: string
  format?: RepFormat
  metadata?: Record<string, unknown>
}

TransformOptions {
  source?: string | string[]      // artifact name(s); defaults to latest
  as?: string                     // name for the derived artifact
  params?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

PipelineStep {
  action: StepAction
  input?: string                  // artifact name or role
  repeat?: number                 // default 1
  condition?: { on: string; equals: number | string }
  params?: Record<string, unknown>
}

SolveOptions {
  composition?: CompositionMode
  approximation?: {
    method?: string               // e.g. "trotter"
    tolerance?: number
    maxTerms?: number
    ordering?: string
  }
  control?: {
    maxIterations?: number
    maxDepth?: number
    convergenceThreshold?: number
    optimizer?: string            // e.g. "cobyla"
    schedule?: string
    feedforward?: boolean
  }
  errorBudget?: {
    total?: number
    perStep?: number
    perGate?: number              // default 1e-3
  }
  override?: PipelineStep[]       // replace steps by matching action
}

RunOptions {
  shots?: number                  // default 1024
  backend?: "simulator" | Backend
}
```

### 11.5 Output Interfaces

```
PipelineOutput {
  readonly answer: unknown
  readonly counts: Record<string, number> | null
  readonly confidence: number     // [0, 1]
  readonly task: TaskType
  readonly fallback: boolean
}

// Pipeline stage function: receives preceding stage output (quantum or TS),
// returns a value for the next stage. If it returns a QuantumTask, that task
// is executed as a quantum stage. Both preceding and following stages can be
// TypeScript functions or quantum executions, in any combination.
PipelineFn = (input: PipelineOutput) => unknown | Promise<unknown>

BridgeRawResult {
  readonly counts: Record<string, number> | null  // percentages
  readonly classicalAnswer: unknown
  readonly fallback: boolean
  readonly note: string
  readonly shots: number
  readonly backendName: string
  readonly circuit: QuantumCircuit | null
  readonly supportStatus: SupportStatus
}

SupportStatus = "fully_executable" | "classical_fallback"
  | "symbolic_only" | "unsupported"

InterpretedResult {
  readonly answer: unknown
  readonly confidence: number
  readonly task: TaskType
  readonly method: string
}
```

### 11.6 Artifact & Registry Interfaces

```
Artifact {
  readonly name: string
  readonly kind: InputKind | "classical" | "derived"
  readonly format: RepFormat
  readonly data: any
  readonly lineage: DerivationRecord[]
  readonly metadata: Record<string, unknown>
  readonly symbolic: boolean
}

DerivationRecord {
  readonly sources: string[]
  readonly transform: string
  readonly params: Record<string, unknown>
  readonly timestamp: number
}

Pipeline {
  readonly family: string
  readonly steps: PipelineStepInternal[]
  readonly composition: string
  readonly control: Record<string, unknown>
  readonly approximation: Record<string, unknown>
}
```

---

## 12. Preset Pipeline Skeletons

Each algorithm family has a default pipeline. The table shows the step sequence,
composition mode, and default control parameters.

| Family                    | Steps                                                                           | Composition | Control                               |
| ------------------------- | ------------------------------------------------------------------------------- | ----------- | ------------------------------------- |
| `amplitude_amplification` | prepare(initial_state) -> apply(oracle) -> apply(diffuser) -> measure           | sequence    | —                                     |
| `fourier_analysis`        | prepare(initial_state) -> apply(oracle) -> apply(qft) -> measure                | sequence    | —                                     |
| `variational`             | prepare(ansatz) -> evolve(cost) -> measure -> optimize                          | loop        | maxIterations=100, optimizer="cobyla" |
| `linear_solver`           | prepare(vector) -> apply(matrix, method=hhl) -> measure                         | sequence    | —                                     |
| `hamiltonian_simulation`  | prepare(initial_state) -> evolve(system) -> measure                             | sequence    | approximation: method="trotter"       |
| `phase_estimation`        | prepare(initial_state) -> apply(unitary) -> apply(qft, inverse=true) -> measure | sequence    | —                                     |
| `sampling`                | prepare(initial_state) -> apply(entangler) -> sample                            | sequence    | —                                     |
| `kernel_method`           | prepare(training_data) -> apply(kernel) -> measure                              | map         | —                                     |
| `quantum_walk`            | prepare(initial_state) -> apply(walk_operator) -> measure                       | repeat      | —                                     |
| `error_correction`        | encode(system) -> correct(decoder) -> measure                                   | sequence    | —                                     |
| `measurement_based`       | prepare(graph_state) -> adapt(graph_state) -> measure                           | sequence    | —                                     |
| `topological`             | braid(system) -> measure                                                        | sequence    | —                                     |

**TaskType -> AlgorithmFamily mapping:**

| TaskType         | AlgorithmFamily           |
| ---------------- | ------------------------- |
| `search`         | `amplitude_amplification` |
| `factoring`      | `fourier_analysis`        |
| `period_finding` | `fourier_analysis`        |
| `optimize`       | `variational`             |
| `ground_state`   | `variational`             |
| `solve_linear`   | `linear_solver`           |
| `time_evolution` | `hamiltonian_simulation`  |
| `sample`         | `sampling`                |
| `classify`       | `kernel_method`           |
| `correct`        | `error_correction`        |
| `estimate_phase` | `phase_estimation`        |
| `quantum_walk`   | `quantum_walk`            |

---

## 13. Step Executor Specifications

Each step action has a specific executor. Here is what each does:

### 13.1 `prepare`

Initializes the quantum register based on the `input` field:

- **`initial_state`**: Task-specific preparation. For search: uniform
  superposition (H on all qubits). For simulation: basis state encoding. For
  sampling: Hadamard layer. For quantum walk: basis state preparation. For phase
  estimation: system state preparation.
- **`ansatz`**: Build a parameterized ansatz circuit (VQE-style
  hardware-efficient ansatz: alternating Ry/Rz layers + CNOT entanglement).
- **`circuit`**: Append a user-provided `QuantumCircuit` directly.
- **`vector`/`matrix`/`training_data`**: Encoding-aware data preparation using
  the artifact's `encoding` metadata.
- **`graph_state`**: Build a graph state from an adjacency matrix (H on all
  qubits, then CZ for each edge).

**Data encoding methods:**

| Encoding    | Method                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| `amplitude` | Normalize the data vector, apply Ry rotations on each qubit with angle `2 * arcsin(sqrt(abs(normalized[i])))` |
| `basis`     | Apply X gates to qubits whose corresponding bit is 1                                                          |
| `angle`     | Apply Ry rotations with angle `data[i] * pi` on qubit `i`                                                     |
| `block`     | Same as `amplitude` (block encoding in preparation context)                                                   |

### 13.2 `apply`

Applies a unitary operator based on the `input` field:

- **`oracle`**: Grover oracle via `phaseOracle(esop, qubits)`.
- **`diffuser`**: Grover diffuser: H -> X -> multi-controlled-Z -> X -> H.
- **`qft`**: Forward or inverse QFT. If `params.inverse` is true, apply inverse
  QFT via `appendInverseQFT()`.
- **`walk_operator`**: Quantum walk step operator built from the graph adjacency
  matrix.
- **`entangler`**: IQP-style entangling layer (CZ on all pairs, Rz rotations).
- **`unitary`**: Generic unitary application from a Matrix artifact.
- **`kernel`**: Quantum kernel circuit for classification.
- **`matrix`** (with `method=hhl`): Full HHL linear system solving.

### 13.3 `evolve`

Hamiltonian evolution `exp(-iHt)`:

- If the Hamiltonian is a Pauli sum (`PauliTerm[]`): use `HamiltonianGate` for
  Trotter decomposition.
- If the Hamiltonian is a `Matrix`: use direct matrix exponentiation via Taylor
  series (20 terms) or Trotter decomposition.
- LCU (Linear Combination of Unitaries): if params specify LCU mode.
- Time parameter from `params.time` (default 1.0).
- Trotter steps from `approximation.steps` or params.

### 13.4 `measure`

Executes the accumulated circuit on the backend:

1. If the circuit has no qubits yet, delegate to the legacy handler.
2. Add a classical register if none exists.
3. Add measurement instructions (qubit `i` -> classical bit `n-1-i`).
4. Execute via `backend.execute(circuit, shots)`.
5. If the task is search: decode the most likely bitstring to the original item.
6. Return a `fullResult` with counts and classical answer.

### 13.5 `sample`

Identical to `measure` but semantically emphasizes distribution sampling.
Returns the full histogram as the classical answer.

### 13.6 `encode`

Error correction encoding:

1. Determine code distance from the system artifact or default to 3.
2. Build a repetition code circuit: for each data qubit, add CNOT gates to
   `codeDistance - 1` ancilla qubits.
3. Set state flags for the `correct` step.

### 13.7 `correct`

Syndrome measurement and error correction:

1. Measure syndrome qubits.
2. Decode the syndrome to identify the error location.
3. Apply correction (X gate on the identified qubit).
4. Measure the corrected data qubits.

### 13.8 `optimize`

Classical parameter update for variational algorithms:

- **COBYLA**: Simplex-based optimizer. Evaluates the cost function by building a
  QAOA circuit with current parameters, executing it, and computing the
  expectation value.
- **Gradient descent**: Finite-difference gradient estimation with configurable
  learning rate.
- Convergence check: if cost improvement is below `convergenceThreshold`, set
  `converged = true`.

### 13.9 `adapt`

Adaptive measurement for measurement-based quantum computing. Measures qubits in
sequence, using outcomes to choose subsequent measurement bases (feedforward).
If `control.feedforward` is false, measures all qubits in the Z basis.

### 13.10 `braid`

Topological braiding (stub implementation). Returns a placeholder result.

### 13.11 `repeat` / `branch` / `custom`

- **repeat**: Loop control, delegates to the composition mode.
- **branch**: Evaluates `step.condition` against `ctx.state`. Only executes if
  `state[condition.on] === condition.equals`.
- **custom**: No-op; returns current state unchanged.

---

## 14. Confidence Scoring Formulas

Each task type uses a specific confidence scoring function:

| Task             | Formula                                                                                | Notes                                                |
| ---------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `search`         | `topProbability(raw)`                                                                  | Highest percentage in histogram / 100, capped at 1.0 |
| `factoring`      | Product verification: 1.0 if `factors.reduce(*, 1) > 1`, else `topProbability`         | Deterministic verification                           |
| `period_finding` | `topProbability` if quantum, 0.95 if fallback                                          | Period r > 0 required                                |
| `solve_linear`   | `topProbability` if quantum, 0.99 if fallback                                          | Classical solution is exact                          |
| `optimize`       | `top + (top - second)` where top/second are highest/second-highest probabilities / 100 | Rewards gap between best and runner-up               |
| `ground_state`   | Same as optimize, or 0.95 if fallback                                                  |                                                      |
| `time_evolution` | `entropyConfidence(raw)` if quantum, 0.5 if fallback                                   |                                                      |
| `sample`         | `entropyConfidence(raw)`                                                               |                                                      |
| `classify`       | 0.90 if quantum, 0.85 if fallback                                                      | Fixed heuristic                                      |
| `estimate_phase` | `result.confidence` (from QPE) or `topProbability`                                     | QPE provides its own                                 |
| `correct`        | `topProbability(raw)`                                                                  | Corrected state should dominate                      |
| `quantum_walk`   | `topProbability(raw)`                                                                  | Marked vertex should dominate                        |

**`entropyConfidence` formula:**

```
H = -sum(p * log2(p)) for each outcome
normalized = H / log2(numOutcomes)
confidence = max(0.1, 1 - abs(normalized - 0.5))
```

Peaks when entropy is moderate (neither trivial nor uniform).

---

## 15. Analysis Types Reference

`ResultHandle.analyze(kind, options)` supports these analysis kinds:

| Kind             | Input Options                             | Output                                                                                                 |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `marginal`       | `{ qubits: number[] }`                    | Marginal probability distribution over specified qubits                                                |
| `estimate_error` | `{ confidence?: number }` (default 0.95)  | Wilson score confidence interval `{ confidence, interval: [lo, hi], shots, method }`                   |
| `decode`         | —                                         | Task-specific structured decoding (e.g., binary fraction for QPE)                                      |
| `aggregate`      | —                                         | `{ mean, variance, stddev, numOutcomes }` of measured integer values                                   |
| `fit`            | `{ model?: string }` (default "gaussian") | Distribution fitting: `{ model, mean, variance, stddev }`                                              |
| `certify`        | `{ threshold?: number }` (default 0.9)    | `{ certified: boolean, threshold, confidence, method, fallback, supportStatus }`                       |
| `reconstruct`    | —                                         | Normalized probability distribution `{ distribution, totalPercentage }`                                |
| `correlate`      | `{ qubits?: number[] }`                   | Pairwise `<Z_i Z_j>` correlations. Default: all qubit pairs                                            |
| `visualize`      | `{ format?: string }`                     | Formats: `histogram`, `sorted`, `spectrum`, `optimizer_trace`, `kernel_summary`, `decoder_diagnostics` |
| `export`         | `{ format?: string }`                     | Formats: `json`, `csv`, `interpreted`, `circuit`, `raw`                                                |

---

## 16. Transform Specifications

Each transform operates on `Matrix` artifact data:

| Transform             | Operation                                                       | Parameters                                                     |
| --------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| `controlled`          | `[[I, 0], [0, U]]` — controlled version of unitary              | —                                                              |
| `inverse` / `adjoint` | `U.dagger()` — conjugate transpose                              | —                                                              |
| `power`               | `U^exp` — repeated matrix multiplication                        | `params.exponent` (default 2)                                  |
| `tensor`              | `A tensor B` — Kronecker product of two sources                 | Two source artifacts required                                  |
| `compose`             | `A * B` — matrix product of two sources                         | Two source artifacts required                                  |
| `reflection`          | `2                                                              | psi><psi                                                       |
| `block_encode`        | Embed `A/alpha` in upper-left block of `2n x 2n` matrix         | `params.alpha` (default: max row L1 norm)                      |
| `trotterize`          | `exp(-iHt)` via Taylor series to 20 terms, applied `n` times    | `params.steps` (default 1), `params.time` (default 1)          |
| `lcu`                 | `sum(alpha_k * U_k)` — weighted sum of multiple unitary sources | Sources must have `metadata.coefficient`                       |
| `fermion_to_qubit`    | Jordan-Wigner transform of fermionic operators to Pauli strings | Input: array of `{ i, j?, coefficient, type? }`                |
| `signal_transform`    | QSP: `e^{i*phi_0*Z} * prod(W * e^{i*phi_k*Z})`                  | `params.polynomial: number[]` — coefficients `[a_0, ..., a_d]` |

---

## 17. Algorithm Implementation Details

### 17.1 Search (Grover)

1. `n = ceil(log2(items.length))`, pad items to `2^n` with `null`.
2. Find `markedIndices` using `matchingIndices(items, target)`:
   - Target is a value: exact equality match.
   - Target is an array: set membership.
   - Target is a function: predicate `(item, index) => boolean`.
3. Compute iterations: `round(pi/4 / arcsin(sqrt(M/N)) - 0.5)`, minimum 1.
4. Build circuit: H on all qubits, then `iterations` rounds of (oracle +
   diffuser). Oracle uses `phaseOracle(esop, qubits)`. Diffuser: H -> X ->
   multi-controlled-Z -> X -> H.
5. Measure with MSB-first mapping. Decode most-likely bitstring to item index:
   `items[parseInt(bitstring, 2)]`.

### 17.2 Factoring (Shor)

1. Handle trivial cases: N <= 1, N even (factor is 2), N is prime power.
2. Trial division for small factors up to `sqrt(N)`.
3. For each random base `a` coprime to N: a. Build QPE circuit with
   `modMultUnitary(a, N, n)` where `n = bitsFor(N)`. b. QPE uses `2*n` ancilla
   qubits + `n` system qubits. c. Execute circuit, extract phase from
   measurement. d. Use continued fractions to find period `r`. e. If `r` is even
   and `a^(r/2) != -1 mod N`, compute `gcd(a^(r/2) +/- 1, N)` to find factors.
4. Classical fallback: trial division + Pollard's rho.

### 17.3 Optimization (QAOA/VQE)

**QAOA:**

1. Build a cost function from the user's cost function or graph.
2. Initialize parameters: `gamma` and `beta` arrays for `p` layers.
3. Classical optimizer (COBYLA or gradient descent) loop: a. Build QAOA circuit:
   H on all qubits, then for each layer: cost unitary (diagonal gate from cost
   function using MSB-first bit ordering) + mixer unitary (Rx(2*beta) on each
   qubit). b. Execute circuit, compute expectation value of cost function. c.
   Update parameters to minimize cost.
4. Return best assignment and cost.

**VQE:**

1. Build parameterized ansatz (Ry/Rz layers + CNOT entanglement).
2. Evaluate Hamiltonian expectation value from state vector or measurement.
3. Same classical optimization loop as QAOA.

### 17.4 Hamiltonian Simulation

1. If the system is a Pauli sum: use `HamiltonianGate(matrix)` to build
   `exp(-iHt)`.
2. If the system is a matrix: direct exponentiation via Taylor series or Trotter
   decomposition.
3. Default time = 1.0, configurable via `params.time` or `approximation`.

### 17.5 Linear System (HHL)

1. Build HHL circuit with `numQPEBits` ancilla qubits (default 3).
2. Prepare `|b>` state on system qubits.
3. QPE to extract eigenvalues of A.
4. Controlled rotation for eigenvalue inversion.
5. Inverse QPE.
6. Measure ancilla; post-select on success.
7. Classical fallback: direct matrix solve (Gaussian elimination).

### 17.6 Phase Estimation (QPE)

1. Build QPE circuit with `numAncilla` ancilla qubits.
2. Initialize system qubits (default: `|1>` state).
3. H on all ancilla qubits.
4. Controlled-U^(2^k) operations from each ancilla to system.
5. Inverse QFT on ancilla.
6. Measure ancilla qubits; extract phase as binary fraction.

### 17.7 Classification (Kernel Method)

1. For each test point, compute kernel values against all training points using
   quantum kernel circuits.
2. Kernel circuit: feature map on register A, inverse feature map on register B,
   measure overlap.
3. Feature map: Ry and Rz rotations encoding features, then CX entanglement.
4. Predict label by weighted majority vote of training labels, weighted by
   kernel values.

### 17.8 Error Correction

1. Build repetition code circuit with given code distance.
2. Encode: CNOT from data qubit to `codeDistance - 1` ancilla qubits.
3. Optionally inject an error (X gate on one qubit).
4. Syndrome measurement: CNOT between adjacent qubits into syndrome ancilla,
   measure syndrome.
5. Correct: apply X to the identified error qubit.
6. Measure corrected data qubits.

### 17.9 Quantum Walk

1. Build adjacency matrix from graph data.
2. Compute walk unitary: `exp(-i * A * t)` where `A` is the adjacency matrix and
   `t` scales with `pi / (2 * sqrt(numNodes))`.
3. If marked vertices exist: build oracle and walk operator alternation.
4. Execute for `steps` iterations (default: `ceil(sqrt(numNodes))`).
5. Measure; the marked vertex should have amplified probability.

### 17.10 Sampling

1. Build an IQP-style (Instantaneous Quantum Polynomial) circuit: H on all
   qubits, CZ on all pairs, Rz rotations, H again.
2. If a cost function is provided: use it to determine Rz angles for structured
   sampling.
3. Measure all qubits; return the full histogram as the answer.

---

## 18. Public API Surface

### 18.1 Entry Point

```
quantum(problem: ProblemString | ProblemObject | QuantumCircuit,
        options?: QuantumOptions): QuantumTask
```

If `problem` is a `QuantumCircuit`, creates a custom task with the circuit
registered via `use_circuit()`.

### 18.2 QuantumTask Methods

**Data registration (return `this`):**

| Method                                   | Registers                                     |
| ---------------------------------------- | --------------------------------------------- |
| `data(role, value, options?)`            | Classical data artifact with given role       |
| `input(kind, data, options?)`            | Quantum-native input artifact                 |
| `search_in(items, target, options?)`     | `items` + `target` artifacts                  |
| `matrix(A, options?)`                    | Matrix data (for linear systems)              |
| `vector(b, options?)`                    | Vector data                                   |
| `cost_function(f, options?)`             | Cost function `(bits: number[]) => number`    |
| `graph(g, options?)`                     | Graph as adjacency matrix or `{nodes, edges}` |
| `function(f, options?)`                  | Generic function `(x: number) => number`      |
| `training_data(rows, options?)`          | Array of `{features, label}`                  |
| `system(H, options?)`                    | Hamiltonian (matrix or Pauli sum)             |
| `initial_state(state, options?)`         | Initial quantum state                         |
| `walk_operator(data, options?)`          | Walk operator for quantum walk                |
| `decoder(data, options?)`                | Decoder for error correction                  |
| `graph_state(adjacency, options?)`       | Graph state adjacency matrix                  |
| `stabilizer_group(generators, options?)` | Stabilizer generators                         |
| `cost_input(data, options?)`             | Cost input (quantum-native)                   |
| `oracle(data, options?)`                 | Oracle (quantum-native)                       |
| `hamiltonian(data, options?)`            | Hamiltonian (quantum-native)                  |
| `state(data, options?)`                  | State (quantum-native)                        |
| `ansatz(data, options?)`                 | Ansatz (quantum-native)                       |
| `kernel(data, options?)`                 | Kernel (quantum-native)                       |
| `use_circuit(qc, options?)`              | Pre-built circuit + auto-solve                |

**Transforms:**

```
transform(kind: TransformKind, options?: TransformOptions): this
```

**Pipeline:**

```
solve(strategy?: string | PipelineStep[], options?: SolveOptions): this
pipe(fn: PipelineFn): this   // pipeline stage — not only post-processing
```

`pipe(fn)` registers a pipeline stage function. `fn` receives a `PipelineOutput`
from the preceding stage (quantum execution or TypeScript function). If `fn`
returns a `QuantumTask`, it is executed as a quantum stage and its result flows
into the next stage. If `fn` returns a plain value, it is wrapped as the
`answer` of a `PipelineOutput` for the following stage. Multiple `.pipe()` calls
chain stages in order — any combination of TypeScript functions and quantum
executions is supported.

**Execution:**

```
run(options?: RunOptions | number): Promise<ResultHandle>
```

When `options` is a number, it is treated as `{ shots: number }`. Default
shots: 1024.

**Inspection:**

```
inspect(aspect?: string): TaskDetailView
circuit(target?: string): QuantumCircuit | null
```

### 18.3 ResultHandle Methods

```
answer(): unknown              — Interpreted classical answer
confidence(): number           — [0, 1] confidence score
raw(): BridgeRawResult         — Raw quantum measurement data
inspect(aspect?: string): ResultDetailView
analyze(kind, options?): ResultHandle  — Returns NEW ResultHandle
analyses_(): { kind, value }[]  — All analyses applied so far
```

---

## 19. Composition Mode Specifications

### 19.1 `sequence` / `pipeline` / `repeat`

Execute steps linearly. Each step's executor is called with the shared context.
Step results merge into context state. If a step returns `fullResult`, return
immediately. If no step produces a `fullResult`, delegate to the legacy bridge
handler.

For `repeat` composition, the step's `repeat` count controls iteration.

### 19.2 `loop`

Variational optimization loop:

1. Execute all pipeline steps in order.
2. If any step sets `converged = true`, return.
3. Repeat up to `control.maxIterations` times (default 100).
4. If no convergence, delegate to the legacy handler.

### 19.3 `parallel`

Execute all steps concurrently, each on a fresh circuit:

1. Create a branch context with a new `QuantumCircuit` for each step.
2. Run all branches via `Promise.all()`.
3. If any branch produces a `fullResult`, return it (first wins).
4. Merge all branch circuits into the main circuit via `compose()`.
5. Merge states left-to-right.
6. Delegate to the legacy handler.

### 19.4 `branch`

Conditional execution:

1. For each step, evaluate `step.condition` against `ctx.state`.
2. Execute only the first step whose `state[condition.on] === condition.equals`
   (or that has no condition).
3. If the step has nested `steps`, execute those too.
4. Only the first matching branch executes.

### 19.5 `recursive`

Recursive refinement:

1. For each recursion level (up to `control.maxDepth` or
   `control.maxIterations`, default 10):
   - Create a fresh circuit.
   - Set `state.recursionDepth = depth`.
   - Execute all steps.
   - If any step sets `converged = true`, return.
2. If no convergence, delegate to the legacy handler.

### 19.6 `map`

Data-parallel execution:

1. Find the iterable data artifact (`training_data`, `items`, or first array
   artifact).
2. For each item in the data:
   - Create a fresh circuit and per-item context.
   - Set `state.mapIndex` and `state.mapItem`.
   - Execute all pipeline steps.
   - Collect counts and answers.
3. Return aggregated result.

---

## 20. Bridge Helper Functions

These utility functions are used across the bridge and step executors.
Reimplement them in the target framework:

| Function                                         | Signature                     | Description                                               |
| ------------------------------------------------ | ----------------------------- | --------------------------------------------------------- |
| `bitsFor(N)`                                     | `(N: number) => number`       | `max(1, ceil(log2(max(2, N))))`                           |
| `intToBits(x, n)`                                | `(x, n) => number[]`          | MSB-first: `bits[i] = (x >> (n-1-i)) & 1`                 |
| `matchingIndices(items, target)`                 | `(items, target) => number[]` | Find indices matching target (value, array, or predicate) |
| `groverIterations(N, M)`                         | `(N, M) => number`            | `max(1, round(pi/4 / arcsin(sqrt(M/N)) - 0.5))`           |
| `gcd(a, b)`                                      | `(a, b) => number`            | Euclidean GCD                                             |
| `modPow(base, exp, m)`                           | `(base, exp, m) => number`    | Modular exponentiation by squaring                        |
| `esopForIndices(indices, n)`                     | `(indices, n) => ESOPTerm[]`  | Convert marked indices to ESOP terms for phase oracle     |
| `controlledUnitaryMatrix(U)`                     | `(U: Matrix) => Matrix`       | `[[I, 0], [0, U]]`                                        |
| `appendQFT(qc, qubits)`                          | side-effect                   | Swap network + QFT gate                                   |
| `appendInverseQFT(qc, qubits)`                   | side-effect                   | Inverse QFT gate + swap network                           |
| `buildGroverCircuit(n, marked, iters)`           | `=> QuantumCircuit`           | Full Grover circuit                                       |
| `buildQPECircuit(U, nAnc, nSys, init?)`          | `=> QuantumCircuit`           | Full QPE circuit                                          |
| `buildQAOACircuitCore(cost, n, gamma, beta)`     | `=> QuantumCircuit`           | Single-layer QAOA circuit                                 |
| `buildVQEAnsatz(params, n, layers)`              | `=> QuantumCircuit`           | Hardware-efficient VQE ansatz                             |
| `buildKernelCircuit(x1, x2, nFeatures)`          | `=> QuantumCircuit`           | Quantum kernel evaluation circuit                         |
| `buildRepetitionCodeCircuit(data, dist)`         | `=> QuantumCircuit`           | Repetition error-correction code                          |
| `buildQuantumWalkCircuit(adj, n, marked, steps)` | `=> QuantumCircuit`           | Quantum walk circuit                                      |
| `buildHHLCircuit(A, b, nQPE)`                    | `=> QuantumCircuit`           | HHL linear solver circuit                                 |
| `mostLikelyBitstring(counts)`                    | `=> string`                   | Highest-percentage bitstring from histogram               |
| `runCircuit(qc, backend, shots)`                 | `=> ExecutionResult`          | Execute circuit, return histogram                         |
| `estimateExpectationValue(sv, cost, n)`          | `=> number`                   | Cost expectation from state vector                        |
| `evaluateHamiltonianExpectation(sv, H)`          | `=> number`                   | `<psi                                                     |
| `continuedFractionPeriods(meas, prec, N)`        | `=> number[]`                 | Extract period candidates via continued fractions         |
| `classicalEigenvalues(A)`                        | `=> number[]`                 | Classical eigenvalue computation (for HHL fallback)       |
| `minimizeCost(cost, n)`                          | `=> { assignment, cost }`     | Classical brute-force cost minimization                   |
| `findPeriod(f, maxN)`                            | `=> number`                   | Classical period finding                                  |
| `factorInteger(N)`                               | `=> number[]`                 | Classical factoring (trial division + Pollard's rho)      |
| `solveLinearSystem(A, b)`                        | `=> number[]`                 | Classical Gaussian elimination                            |

---

## 21. Solve Options Override Mechanism

When the user calls `.solve(strategy, options)`:

1. **Strategy resolution:**
   - `undefined`: load preset for the inferred algorithm family.
   - `string`: load preset for the named family.
   - `PipelineStep[]`: build a custom pipeline.

2. **Override application:** If `options.override` is provided, each override
   replaces the pipeline step whose `action` matches.

3. **Option merging:** `composition`, `control`, `approximation`, and
   `errorBudget` from `SolveOptions` are merged into the pipeline, with user
   values taking precedence.

4. **QuantumOptions propagation:** `qubits` and `model` from `QuantumOptions`
   are injected into `pipeline.control` so step executors can access them.
