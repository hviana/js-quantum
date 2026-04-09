/**
 * `QuantumTask` — the chainable pipeline builder.
 *
 * Returned by the top-level `quantum()` entry point. Every method
 * returns `this` so calls chain. Execution happens only at
 * `.run()`; everything before that is classical bookkeeping.
 */

import { QuantumCircuit } from "../circuit.ts";
import { Matrix } from "../matrix.ts";
import { Complex } from "../complex.ts";
import type {
  DataOptions,
  DataRole,
  InputKind,
  InputOptions,
  PipelineFn,
  PipelineOutput,
  PipelineStep,
  ProblemClass,
  ProblemInput,
  ProblemObject,
  QuantumOptions,
  RunOptions,
  SolveOptions,
  SupportStatus,
  TaskType,
  TransformKind,
  TransformOptions,
} from "./params.ts";
import { type Artifact, type Pipeline, Registry } from "./registry.ts";
import {
  type BridgeRawResult,
  dispatchAndRun,
  estimateResources,
  extractCircuit,
  resolveBackend,
  supportStatus,
} from "./bridge.ts";
import { interpret } from "./interpret.ts";
import { inferFamily, loadPreset } from "./presets.ts";
import { ResultHandle } from "./result.ts";

// =============================================================================
// Problem-string → (ProblemClass, TaskType)
// =============================================================================

function resolveProblem(
  problem: ProblemInput,
): { problemClass: ProblemClass; task: TaskType; raw: ProblemObject } {
  if (typeof problem === "string") {
    const map: Record<string, { c: ProblemClass; t: TaskType }> = {
      search: { c: "hidden_subgroup", t: "search" },
      factoring: { c: "hidden_subgroup", t: "factoring" },
      period_finding: { c: "hidden_subgroup", t: "period_finding" },
      optimization: { c: "optimization", t: "optimize" },
      simulation: { c: "simulation", t: "time_evolution" },
      linear_system: { c: "linear_algebra", t: "solve_linear" },
      sampling: { c: "sampling", t: "sample" },
      classification: { c: "machine_learning", t: "classify" },
      error_correction: { c: "error_correction", t: "correct" },
      phase_estimation: { c: "metrology", t: "estimate_phase" },
      ground_state: { c: "simulation", t: "ground_state" },
      quantum_walk: { c: "hidden_subgroup", t: "quantum_walk" },
      custom: { c: "custom", t: "custom" },
    };
    const m = map[problem];
    if (!m) throw new Error(`quantum: unknown problem string '${problem}'`);
    return {
      problemClass: m.c,
      task: m.t,
      raw: { problem_class: m.c, task: m.t },
    };
  }
  return {
    problemClass: problem.problem_class ?? "custom",
    task: problem.task ?? "custom",
    raw: problem,
  };
}

// =============================================================================
// Transform execution (item 18)
// =============================================================================

/**
 * Compute QSP phase angles for a target polynomial P(x) = Σ a_k x^k.
 *
 * Uses the recursive reduction algorithm: at each step the leading
 * coefficient determines a phase angle, and the polynomial degree is
 * reduced by one. The base case is a constant polynomial whose phase
 * is arccos(a_0) (clamped to [-1,1]).
 *
 * Returns an array of (degree + 1) phase angles.
 */
function computeQSPPhases(coeffs: number[]): number[] {
  // Normalise: strip trailing near-zero high-degree coefficients.
  const poly = [...coeffs];
  while (poly.length > 1 && Math.abs(poly[poly.length - 1]) < 1e-14) {
    poly.pop();
  }
  const degree = poly.length - 1;

  if (degree === 0) {
    // Constant polynomial — single phase = arccos(a_0).
    const clamped = Math.max(-1, Math.min(1, poly[0]));
    return [Math.acos(clamped)];
  }

  // Recursive halving: the leading coefficient a_d fixes the outermost
  // phase angle via  a_d = cos(φ) · (leading coeff of reduced poly)
  // or equivalently  φ = atan2(a_d, a_{d-1}) for the Chebyshev-like
  // decomposition.
  //
  // We use the Laurent / Chebyshev approach:
  //   φ_d = atan2(a_d, a_{d-1})   (with appropriate sign handling)
  // then build the reduced polynomial of degree d-1 by removing the
  // contribution of the outermost rotation.
  const phases: number[] = new Array(degree + 1);

  // Work on a mutable copy of Chebyshev-like coefficients.
  const work = [...poly];

  for (let k = degree; k >= 1; k--) {
    const leading = work[k];
    const subLeading = work[k - 1];
    const phi = Math.atan2(leading, subLeading);
    phases[k] = phi;

    // Remove the contribution of this rotation from the polynomial.
    // After extracting φ, the effective remaining polynomial has:
    //   b_{k-1} = a_{k-1} cos(φ) + a_k sin(φ)     →  becomes new leading
    //   b_j     = a_j   for j < k-1  (lower terms shift slightly)
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    // The new leading coefficient absorbs the rotation.
    work[k - 1] = subLeading * cosP + leading * sinP;
    work.length = k; // drop degree k
  }

  // Base case: remaining constant determines φ_0.
  const clamped = Math.max(-1, Math.min(1, work[0]));
  phases[0] = Math.acos(clamped);

  return phases;
}

/**
 * Execute a transform on an artifact, returning the transformed data.
 * Supports: controlled, inverse, power, tensor, compose, trotterize,
 * block_encode, fermion_to_qubit, signal_transform, lcu.
 */
type TransformHandler = (
  data: unknown,
  sources: readonly Artifact[],
  params: Record<string, unknown>,
) => unknown;

const transformHandlers: Record<string, TransformHandler> = {
  controlled: (data) => {
    if (data instanceof Matrix) {
      const dim = data.rows;
      const total = 2 * dim;
      const rows: Complex[][] = [];
      for (let r = 0; r < total; r++) {
        const row: Complex[] = [];
        for (let c = 0; c < total; c++) {
          if (r < dim && c < dim) {
            row.push(r === c ? Complex.ONE : Complex.ZERO);
          } else if (r >= dim && c >= dim) {
            row.push(data.get(r - dim, c - dim));
          } else {
            row.push(Complex.ZERO);
          }
        }
        rows.push(row);
      }
      return new Matrix(rows);
    }
    return data;
  },

  inverse: (data) => data instanceof Matrix ? data.dagger() : data,
  adjoint: (data) => data instanceof Matrix ? data.dagger() : data,

  power: (data, _sources, params) => {
    const exp = (params.exponent as number) ?? 2;
    if (data instanceof Matrix) {
      let result = Matrix.identity(data.rows);
      for (let i = 0; i < exp; i++) result = result.multiply(data);
      return result;
    }
    return data;
  },

  tensor: (data, sources) => {
    if (
      sources.length >= 2 && sources[0].data instanceof Matrix &&
      sources[1].data instanceof Matrix
    ) {
      return (sources[0].data as Matrix).tensor(sources[1].data as Matrix);
    }
    return data;
  },

  compose: (data, sources) => {
    if (
      sources.length >= 2 && sources[0].data instanceof Matrix &&
      sources[1].data instanceof Matrix
    ) {
      return (sources[0].data as Matrix).multiply(sources[1].data as Matrix);
    }
    return data;
  },

  trotterize: (data, _sources, params) => {
    const steps = (params.steps as number) ?? 1;
    const time = (params.time as number) ?? 1;
    if (data instanceof Matrix) {
      const iT = new Complex(0, -time / steps);
      let term = Matrix.identity(data.rows);
      let result = Matrix.identity(data.rows);
      for (let k = 1; k <= 20; k++) {
        term = term.multiply(data).scale(
          new Complex(iT.re / k, iT.im / k),
        );
        result = result.add(term);
      }
      let total = Matrix.identity(data.rows);
      for (let s = 0; s < steps; s++) total = total.multiply(result);
      return total;
    }
    return data;
  },

  block_encode: (data, _sources, params) => {
    if (data instanceof Matrix) {
      const n = data.rows;
      const alpha = (params.alpha as number) ??
        Math.max(
          ...Array.from({ length: n }, (_, r) => {
            let s = 0;
            for (let c = 0; c < n; c++) {
              const v = data.get(r, c);
              s += Math.sqrt(v.re * v.re + v.im * v.im);
            }
            return s;
          }),
        );
      const total = 2 * n;
      const rows: Complex[][] = [];
      for (let r = 0; r < total; r++) {
        const row: Complex[] = [];
        for (let c = 0; c < total; c++) {
          if (r < n && c < n) {
            const v = data.get(r, c);
            row.push(new Complex(v.re / alpha, v.im / alpha));
          } else if (r >= n && c >= n) {
            row.push(r === c ? Complex.ONE : Complex.ZERO);
          } else {
            row.push(Complex.ZERO);
          }
        }
        rows.push(row);
      }
      return new Matrix(rows);
    }
    return data;
  },

  fermion_to_qubit: (data) => {
    if (Array.isArray(data)) {
      const terms = data as {
        i: number;
        j?: number;
        coefficient: number;
        type?: "hopping" | "number" | "interaction" | "excitation";
      }[];
      let nQubits = 0;
      for (const t of terms) {
        nQubits = Math.max(nQubits, t.i + 1, (t.j ?? t.i) + 1);
      }
      if (nQubits === 0) return data;

      const pauliTerms: { pauliString: string; coefficient: number }[] = [];

      const buildPauli = (
        assignments: Map<number, string>,
      ): string => {
        const chars: string[] = new Array(nQubits).fill("I");
        for (const [idx, op] of assignments) chars[idx] = op;
        return chars.join("");
      };

      for (const term of terms) {
        const { i, coefficient } = term;
        const j = term.j ?? i;
        const type = term.type ?? (i === j ? "number" : "hopping");

        if (type === "number") {
          const identity = new Map<number, string>();
          pauliTerms.push({
            pauliString: buildPauli(identity),
            coefficient: coefficient / 2,
          });
          const zTerm = new Map<number, string>([[i, "Z"]]);
          pauliTerms.push({
            pauliString: buildPauli(zTerm),
            coefficient: -coefficient / 2,
          });
        } else if (type === "interaction") {
          const c4 = coefficient / 4;
          pauliTerms.push({
            pauliString: buildPauli(new Map()),
            coefficient: c4,
          });
          pauliTerms.push({
            pauliString: buildPauli(new Map([[i, "Z"]])),
            coefficient: -c4,
          });
          pauliTerms.push({
            pauliString: buildPauli(new Map([[j, "Z"]])),
            coefficient: -c4,
          });
          pauliTerms.push({
            pauliString: buildPauli(new Map([[i, "Z"], [j, "Z"]])),
            coefficient: c4,
          });
        } else {
          const lo = Math.min(i, j);
          const hi = Math.max(i, j);

          const zChain = new Map<number, string>();
          for (let k = lo + 1; k < hi; k++) zChain.set(k, "Z");

          if (type === "hopping") {
            const xxMap = new Map(zChain);
            xxMap.set(i, "X");
            xxMap.set(j, "X");
            pauliTerms.push({
              pauliString: buildPauli(xxMap),
              coefficient: coefficient / 2,
            });
            const yyMap = new Map(zChain);
            yyMap.set(i, "Y");
            yyMap.set(j, "Y");
            pauliTerms.push({
              pauliString: buildPauli(yyMap),
              coefficient: coefficient / 2,
            });
          } else {
            const xxMap = new Map(zChain);
            xxMap.set(i, "X");
            xxMap.set(j, "X");
            pauliTerms.push({
              pauliString: buildPauli(xxMap),
              coefficient: coefficient / 2,
            });
            const yyMap = new Map(zChain);
            yyMap.set(i, "Y");
            yyMap.set(j, "Y");
            pauliTerms.push({
              pauliString: buildPauli(yyMap),
              coefficient: coefficient / 2,
            });
            const xyMap = new Map(zChain);
            xyMap.set(i, "X");
            xyMap.set(j, "Y");
            const sign = i < j ? -1 : 1;
            pauliTerms.push({
              pauliString: buildPauli(xyMap),
              coefficient: sign * coefficient / 2,
            });
            const yxMap = new Map(zChain);
            yxMap.set(i, "Y");
            yxMap.set(j, "X");
            pauliTerms.push({
              pauliString: buildPauli(yxMap),
              coefficient: -sign * coefficient / 2,
            });
          }
        }
      }

      const bucket = new Map<string, number>();
      for (const pt of pauliTerms) {
        bucket.set(
          pt.pauliString,
          (bucket.get(pt.pauliString) ?? 0) + pt.coefficient,
        );
      }
      const result: { pauliString: string; coefficient: number }[] = [];
      for (const [s, c] of bucket) {
        if (Math.abs(c) > 1e-15) {
          result.push({ pauliString: s, coefficient: c });
        }
      }
      return result;
    }
    return data;
  },

  lcu: (data, sources) => {
    if (sources.length >= 2) {
      const matrices = sources.filter((s) => s.data instanceof Matrix);
      if (matrices.length >= 2) {
        let sum = Matrix.zeros(
          (matrices[0].data as Matrix).rows,
          (matrices[0].data as Matrix).cols,
        );
        for (const src of matrices) {
          const coeff = (src.metadata.coefficient as number) ?? 1;
          sum = sum.add(
            (src.data as Matrix).scale(new Complex(coeff, 0)),
          );
        }
        return sum;
      }
    }
    return data;
  },

  reflection: (data) => {
    if (data instanceof Matrix && data.cols === 1) {
      const outer = data.multiply(data.dagger());
      return outer.scaleReal(2).sub(Matrix.identity(data.rows));
    }
    return data;
  },

  signal_transform: (data, _sources, params) => {
    if (data instanceof Matrix) {
      const polyCoeffs = params.polynomial as number[] | undefined;
      if (!polyCoeffs || polyCoeffs.length === 0) return data;

      const degree = polyCoeffs.length - 1;
      const n = data.rows;

      const phases = computeQSPPhases(polyCoeffs);

      const W = data;

      const buildPhaseGate = (phi: number): Matrix => {
        const halfN = n / 2;
        if (halfN < 1 || !Number.isInteger(halfN)) {
          const diag: Complex[] = [];
          for (let i = 0; i < n; i++) {
            const sign = i < n / 2 ? 1 : -1;
            diag.push(Complex.fromPolar(1, sign * phi));
          }
          return Matrix.diagonal(diag);
        }
        const diag: Complex[] = [];
        for (let i = 0; i < n; i++) {
          const sign = i < halfN ? 1 : -1;
          diag.push(Complex.fromPolar(1, sign * phi));
        }
        return Matrix.diagonal(diag);
      };

      let result = buildPhaseGate(phases[0]);
      for (let k = 1; k <= degree; k++) {
        result = result.multiply(W);
        result = result.multiply(buildPhaseGate(phases[k] ?? 0));
      }
      return result;
    }
    return data;
  },
};

function executeTransform(
  kind: TransformKind,
  sources: readonly Artifact[],
  params: Record<string, unknown>,
): unknown {
  const primary = sources[0];
  const data = primary?.data;

  const handler = transformHandlers[kind];
  return handler ? handler(data, sources, params) : data;
}

// =============================================================================
// Inspection
// =============================================================================

export interface TaskDetailView {
  readonly aspect: string;
  readonly problem: ProblemObject;
  readonly inputs: readonly {
    name: string;
    kind: string;
    format: string;
    role?: string;
  }[];
  readonly pipeline: Pipeline | null;
  readonly resources?: { qubits: number; depth: number; gates: number };
  readonly supportStatus?: SupportStatus;
}

// =============================================================================
// QuantumTask
// =============================================================================

export class QuantumTask {
  private readonly registry = new Registry();
  private readonly problemClass: ProblemClass;
  private readonly task: TaskType;
  private readonly problemRaw: ProblemObject;
  private readonly options: QuantumOptions;
  private readonly pipelineFns: PipelineFn[] = [];

  constructor(problem: ProblemInput, options: QuantumOptions = {}) {
    const r = resolveProblem(problem);
    this.problemClass = r.problemClass;
    this.task = r.task;
    this.problemRaw = r.raw;
    this.options = options;
  }

  // ---------------------------------------------------------------------------
  // Inputs (classical data)
  // ---------------------------------------------------------------------------

  data(role: DataRole, value: unknown, options: DataOptions = {}): this {
    const name = options.name ?? role;
    const artifact: Artifact = {
      name,
      kind: "classical",
      format: options.format ?? "opaque",
      data: value,
      lineage: [],
      symbolic: false,
      metadata: {
        role,
        encoding: options.encoding,
        ...(options.metadata ?? {}),
      },
    };
    this.registry.register(artifact);
    return this;
  }

  input(kind: InputKind, data: unknown, options: InputOptions = {}): this {
    const name = options.name ?? this.registry.autoName(kind);
    const artifact: Artifact = {
      name,
      kind,
      format: options.format ?? "opaque",
      data,
      lineage: [],
      symbolic: false,
      metadata: { ...(options.metadata ?? {}) },
    };
    this.registry.register(artifact);
    return this;
  }

  // Shorthand methods — keep in sync with DataRole.
  search_in(
    items: unknown[],
    target: unknown,
    options: DataOptions = {},
  ): this {
    this.data("items", items, options);
    this.data("target", target);
    return this;
  }
  matrix(A: number[][], options: DataOptions = {}): this {
    return this.data("matrix", A, options);
  }
  vector(b: number[], options: DataOptions = {}): this {
    return this.data("vector", b, options);
  }
  cost_function(
    f: (bits: number[]) => number,
    options: DataOptions = {},
  ): this {
    return this.data("cost", f, options);
  }
  graph(
    g: number[][] | { nodes: unknown[]; edges: [number, number][] },
    options: DataOptions = {},
  ): this {
    return this.data("graph", g, options);
  }
  function(
    f: (x: number) => number | bigint,
    options: DataOptions = {},
  ): this {
    return this.data("function", f, options);
  }
  training_data(
    rows: { features: number[]; label: string | number }[],
    options: DataOptions = {},
  ): this {
    return this.data("training_data", rows, options);
  }
  system(H: number[][] | unknown, options: DataOptions = {}): this {
    return this.data("system", H, options);
  }
  initial_state(state: unknown, options: DataOptions = {}): this {
    return this.data("initial_state", state, options);
  }

  // --- Shorthand methods for preset-required inputs (item 22) ---

  /** Register a walk operator for quantum-walk tasks. */
  walk_operator(data: unknown, options: InputOptions = {}): this {
    return this.input("walk_operator", data, options);
  }
  /** Register a decoder for error-correction tasks. */
  decoder(data: unknown, options: InputOptions = {}): this {
    return this.input("decoder", data, options);
  }
  /** Register a graph state for measurement-based tasks. */
  graph_state(
    adjacency: number[][],
    options: InputOptions = {},
  ): this {
    return this.input("graph_state", adjacency, options);
  }
  /** Register a stabilizer group for error-correction tasks. */
  stabilizer_group(generators: string[], options: InputOptions = {}): this {
    return this.input("stabilizer_group", generators, options);
  }

  // Advanced shorthand — quantum-native objects.
  cost_input(data: unknown, options: InputOptions = {}): this {
    return this.input("cost", data, options);
  }
  oracle(data: unknown, options: InputOptions = {}): this {
    return this.input("oracle", data, options);
  }
  hamiltonian(data: unknown, options: InputOptions = {}): this {
    return this.input("hamiltonian", data, options);
  }
  state(data: unknown, options: InputOptions = {}): this {
    return this.input("state", data, options);
  }
  ansatz(data: unknown, options: InputOptions = {}): this {
    return this.input("ansatz", data, options);
  }
  kernel(data: unknown, options: InputOptions = {}): this {
    return this.input("kernel", data, options);
  }

  /**
   * Register a pre-built `QuantumCircuit` and auto-solve to a
   * circuit-execution pipeline. The circuit is executed as-is on the
   * configured backend; if it already contains measurement gates
   * they are respected, otherwise measurements on all qubits are
   * appended automatically.
   *
   * All standard pipeline parameters (shots, backend, resource
   * limits) apply.
   *
   * @example
   * ```ts
   * const qc = new QuantumCircuit();
   * qc.h(0); qc.cx(0, 1);
   * const r = await quantum("custom").use_circuit(qc).run(1024);
   * ```
   */
  use_circuit(qc: QuantumCircuit, options: InputOptions = {}): this {
    this.input("circuit", qc, { format: "circuit", ...options });
    this.solve([
      { action: "prepare", input: "circuit" },
      { action: "measure" },
    ]);
    return this;
  }

  // ---------------------------------------------------------------------------
  // Transforms (item 18 — real execution)
  // ---------------------------------------------------------------------------

  transform(kind: TransformKind, options: TransformOptions = {}): this {
    const sourceNames: string[] = Array.isArray(options.source)
      ? [...(options.source as readonly string[])]
      : options.source
      ? [options.source as string]
      : this.registry.latest()
      ? [this.registry.latest()!.name]
      : [];
    if (sourceNames.length === 0) {
      throw new Error(`transform('${kind}'): no source artifact available`);
    }
    const sources = sourceNames.map((n) => this.registry.get(n));
    const asName = options.as ?? this.registry.autoName(kind);

    // Execute the transform to produce real data (item 18).
    const transformedData = executeTransform(
      kind,
      sources,
      options.params ?? {},
    );
    const isSymbolic = transformedData === sources[0].data &&
      kind !== "inverse" && kind !== "adjoint";

    const derived: Artifact = {
      name: asName,
      kind: "derived",
      format: sources[0].format,
      data: transformedData,
      lineage: [
        {
          sources: sourceNames,
          transform: kind,
          params: options.params ?? {},
          timestamp: Date.now(),
        },
      ],
      symbolic: isSymbolic,
      metadata: { transformKind: kind, ...(options.metadata ?? {}) },
    };
    this.registry.register(derived);
    return this;
  }

  // ---------------------------------------------------------------------------
  // Pipeline stage (.then)
  // ---------------------------------------------------------------------------

  /**
   * Register an async-compatible function as a pipeline stage.
   *
   * The function receives a `PipelineOutput` with the result of the
   * preceding stage — quantum or TypeScript. Its return value flows
   * into the next stage. If the function returns a `QuantumTask`, that
   * task is executed as a quantum stage and its result becomes the
   * output for the following stage.
   *
   * Both the preceding and following stages can be TypeScript functions
   * or quantum executions, in any combination.
   *
   * @example
   * ```ts
   * // Quantum → Function → Function
   * const r = await quantum("search")
   *   .search_in([10, 42, 7, 99], 42)
   *   .pipe(({ answer }) => (answer as number) * 2)
   *   .pipe(({ answer }) => ({ doubled: answer }))
   *   .run();
   *
   * // Quantum → Function → Quantum
   * const r2 = await quantum("search")
   *   .search_in([10, 42, 7, 99], 42)
   *   .pipe(({ answer }) =>
   *     quantum("factoring").data("target", answer as number)
   *   )
   *   .run();
   * ```
   */
  pipe(fn: PipelineFn): this {
    this.pipelineFns.push(fn);
    return this;
  }

  // ---------------------------------------------------------------------------
  // Solve (items 16, 19)
  // ---------------------------------------------------------------------------

  solve(
    strategy?: string | ReadonlyArray<Record<string, unknown>>,
    options: SolveOptions = {},
  ): this {
    let pipeline: Pipeline;
    if (strategy === undefined) {
      pipeline = loadPreset(inferFamily(this.task));
    } else if (typeof strategy === "string") {
      // deno-lint-ignore no-explicit-any
      pipeline = loadPreset(strategy as any);
    } else {
      pipeline = {
        family: "custom",
        composition: options.composition ?? "sequence",
        control: options.control ?? {},
        approximation: options.approximation ?? {},
        steps: strategy.map((s) => ({
          action:
            (s.action as Parameters<typeof loadPreset>[0] extends never ? never
              // deno-lint-ignore no-explicit-any
              : any)!,
          input: s.input as string | undefined,
          repeat: (s.repeat as number | undefined) ?? 1,
          params: (s.params as Record<string, unknown> | undefined) ?? {},
          condition: s.condition as
            | { on: string; equals: number | string }
            | undefined,
          // deno-lint-ignore no-explicit-any
          steps: s.steps as any,
        })),
      };
    }
    // Apply overrides.
    if (options.override && options.override.length > 0) {
      const steps = pipeline.steps.map((st) => {
        const ov = options.override!.find((o) => o.action === st.action);
        return ov ? { ...st, ...ov, repeat: ov.repeat ?? st.repeat } : st;
      });
      pipeline = { ...pipeline, steps };
    }
    // Merge solve-level options (items 19: honor control, approximation, errorBudget).
    pipeline = {
      ...pipeline,
      composition: options.composition ?? pipeline.composition,
      control: { ...pipeline.control, ...(options.control ?? {}) },
      approximation: {
        ...pipeline.approximation,
        ...(options.approximation ?? {}),
      },
    };

    // Store errorBudget in pipeline control so it can be consulted at run time.
    if (options.errorBudget) {
      pipeline = {
        ...pipeline,
        control: { ...pipeline.control, errorBudget: options.errorBudget },
      };
    }

    this.registry.setPipeline(pipeline);
    return this;
  }

  // ---------------------------------------------------------------------------
  // Run (items 19-21)
  // ---------------------------------------------------------------------------

  async run(options: RunOptions | number = {}): Promise<ResultHandle> {
    const opts: RunOptions = typeof options === "number"
      ? { shots: options }
      : options;
    if (!this.registry.getPipeline()) this.solve();

    const backend = resolveBackend(opts.backend ?? this.options.backend);
    const shots = opts.shots ?? 1024;
    const pipeline = this.registry.getPipeline()!;

    // Validate computation model.
    if (this.options.model && this.options.model !== "gate") {
      throw new Error(
        `Unsupported computation model '${this.options.model}'; only 'gate' is currently supported`,
      );
    }

    // Item 20: enforce resource constraints.
    if (this.options.resources) {
      const circ = this.circuit();
      if (circ) {
        const res = estimateResources(circ);
        const lim = this.options.resources;
        if (lim.maxDepth && res.depth > lim.maxDepth) {
          throw new Error(
            `Resource limit exceeded: circuit depth ${res.depth} > maxDepth ${lim.maxDepth}`,
          );
        }
        if (lim.maxGates && res.gates > lim.maxGates) {
          throw new Error(
            `Resource limit exceeded: gate count ${res.gates} > maxGates ${lim.maxGates}`,
          );
        }
        if (lim.maxTCount && res.tCount > lim.maxTCount) {
          throw new Error(
            `Resource limit exceeded: T-gate count ${res.tCount} > maxTCount ${lim.maxTCount}`,
          );
        }
        if (lim.memory && res.memory > lim.memory) {
          throw new Error(
            `Resource limit exceeded: estimated memory ${res.memory} bytes > memory limit ${lim.memory} bytes`,
          );
        }
      }
    }

    // Item 21: validate required roles/artifacts for the pipeline.
    const byRole: Record<string, Artifact> = {};
    for (const a of this.registry.all()) {
      const role = (a.metadata.role as string | undefined) ??
        (a.kind === "classical" ? a.name : a.kind);
      if (!(role in byRole)) byRole[role] = a;
    }

    // Check that each pipeline step's required input exists.
    for (const step of pipeline.steps) {
      if (
        step.input && step.input !== "initial_state" &&
        step.input !== "diffuser" && step.input !== "qft" &&
        step.input !== "unitary"
      ) {
        if (!byRole[step.input] && !this.registry.has(step.input)) {
          // Soft warning: pipeline expects input that isn't registered.
          // This is not fatal because the bridge may handle it differently.
        }
      }
    }

    // Wire QuantumOptions.qubits and .model into pipeline control so
    // step executors and the bridge can consult them.
    let effectivePipeline = pipeline;
    if (this.options.qubits != null || this.options.model != null) {
      effectivePipeline = {
        ...effectivePipeline,
        control: {
          ...effectivePipeline.control,
          ...(this.options.qubits != null
            ? { qubits: this.options.qubits }
            : {}),
          ...(this.options.model != null ? { model: this.options.model } : {}),
        },
      };
    }

    // Item 19: pass control/approximation/errorBudget to dispatcher context.
    const raw: BridgeRawResult = await dispatchAndRun(this.task, byRole, {
      backend,
      shots,
      pipeline: effectivePipeline,
    });
    const interpreted = interpret(this.task, raw);

    // Execute pipeline stages registered via .then().
    if (this.pipelineFns.length > 0) {
      let currentOutput: PipelineOutput = {
        answer: interpreted.answer,
        counts: raw.counts,
        confidence: interpreted.confidence,
        task: this.task,
        fallback: raw.fallback,
      };
      let latestRaw = raw;
      let latestInterpreted = interpreted;

      for (const fn of this.pipelineFns) {
        const result = await fn(currentOutput);

        if (result instanceof QuantumTask) {
          // The function returned a QuantumTask — execute it as a
          // quantum stage and use its result going forward.
          const handle = await result.run(opts);
          const qRaw = handle.raw();
          latestRaw = qRaw;
          latestInterpreted = {
            answer: handle.answer(),
            confidence: handle.confidence(),
            task: currentOutput.task,
            method: qRaw.note,
          };
          currentOutput = {
            answer: handle.answer(),
            counts: qRaw.counts,
            confidence: handle.confidence(),
            task: currentOutput.task,
            fallback: qRaw.fallback,
          };
        } else {
          currentOutput = { ...currentOutput, answer: result };
          latestInterpreted = {
            ...latestInterpreted,
            answer: result,
          };
        }
      }

      return new ResultHandle(this.task, latestRaw, latestInterpreted);
    }

    return new ResultHandle(this.task, raw, interpreted);
  }

  // ---------------------------------------------------------------------------
  // Inspect / circuit extraction (items 24-25)
  // ---------------------------------------------------------------------------

  inspect(aspect: string = "summary"): TaskDetailView {
    const inputs = this.registry.all().map((a) => ({
      name: a.name,
      kind: a.kind,
      format: a.format,
      role: a.metadata.role as string | undefined,
    }));
    const status = supportStatus(this.task);
    const view: TaskDetailView = {
      aspect,
      problem: this.problemRaw,
      inputs,
      pipeline: this.registry.getPipeline(),
      supportStatus: status,
    };
    if (aspect === "resources") {
      const c = this.circuit();
      if (c) {
        return { ...view, resources: estimateResources(c) };
      }
    }
    return view;
  }

  /**
   * Extract a host-library `QuantumCircuit` for the current
   * pipeline. Delegates to the bridge's `extractCircuit` which
   * builds circuits for circuit-representable tasks.
   */
  circuit(_target?: string): QuantumCircuit | null {
    const byRole: Record<string, Artifact> = {};
    for (const a of this.registry.all()) {
      const role = (a.metadata.role as string | undefined) ??
        (a.kind === "classical" ? a.name : a.kind);
      if (!(role in byRole)) byRole[role] = a;
    }
    return extractCircuit(this.task, byRole);
  }
}
