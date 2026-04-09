/**
 * Internal artifact registry for a single `QuantumTask`.
 *
 * Every call to `quantum()` creates a fresh registry. Not exported
 * from `hlapi/mod.ts` — purely an implementation detail.
 */

import type { InputKind, RepFormat, StepAction } from "./params.ts";

/**
 * Entry in an artifact's derivation history. Recorded whenever
 * `.transform()` is used to build a new artifact from existing ones.
 */
export interface DerivationRecord {
  readonly sources: readonly string[];
  readonly transform: string;
  readonly params: Record<string, unknown>;
  readonly timestamp: number;
}

/**
 * Internal handle on a piece of data registered via `.data()`,
 * `.input()`, or produced by `.transform()`. The `data` field holds
 * the host-library object (or classical value, for pre-translation
 * artifacts) and is never exposed to the user.
 */
export interface Artifact {
  readonly name: string;
  readonly kind: InputKind | "classical" | "derived";
  readonly format: RepFormat;
  // deno-lint-ignore no-explicit-any
  readonly data: any;
  readonly lineage: readonly DerivationRecord[];
  readonly metadata: Record<string, unknown>;
  /** True if the artifact is symbolic (no executable host-library object). */
  readonly symbolic: boolean;
}

/** A single step in a compiled pipeline. */
export interface PipelineStepInternal {
  readonly action: StepAction;
  readonly input?: string;
  readonly repeat: number;
  readonly params: Record<string, unknown>;
  /** Condition for `branch` steps: run only when `state[on] === equals`. */
  readonly condition?: { on: string; equals: number | string };
  /** Nested sub-steps for `repeat` / `branch` step actions. */
  readonly steps?: readonly PipelineStepInternal[];
}

export interface Pipeline {
  readonly family: string;
  readonly steps: readonly PipelineStepInternal[];
  readonly composition: string;
  readonly control: Record<string, unknown>;
  readonly approximation: Record<string, unknown>;
}

/**
 * In-memory registry mapping names to artifacts. Scoped to one
 * `QuantumTask` instance.
 */
export class Registry {
  private readonly artifacts = new Map<string, Artifact>();
  private autoCounter = 0;
  private pipeline: Pipeline | null = null;

  /** Register a new artifact. Throws on name collision. */
  register(a: Artifact): Artifact {
    if (this.artifacts.has(a.name)) {
      throw new Error(
        `Registry: artifact name '${a.name}' is already registered`,
      );
    }
    this.artifacts.set(a.name, a);
    return a;
  }

  /** Look up by name; throws if missing. */
  get(name: string): Artifact {
    const a = this.artifacts.get(name);
    if (!a) throw new Error(`Registry: unknown artifact '${name}'`);
    return a;
  }

  has(name: string): boolean {
    return this.artifacts.has(name);
  }

  /** Return all artifacts in insertion order. */
  all(): readonly Artifact[] {
    return [...this.artifacts.values()];
  }

  /** Find the most recently registered artifact (used as default source). */
  latest(): Artifact | null {
    const v = [...this.artifacts.values()];
    return v.length > 0 ? v[v.length - 1] : null;
  }

  /** Find the most recent artifact matching a role tag in metadata. */
  findByRole(role: string): Artifact | null {
    for (const a of [...this.artifacts.values()].reverse()) {
      if (a.metadata.role === role) return a;
    }
    return null;
  }

  /** Generate a fresh auto name for an artifact of a given kind. */
  autoName(kind: string): string {
    let candidate: string;
    do {
      candidate = `${kind}_${this.autoCounter++}`;
    } while (this.artifacts.has(candidate));
    return candidate;
  }

  setPipeline(p: Pipeline): void {
    this.pipeline = p;
  }

  getPipeline(): Pipeline | null {
    return this.pipeline;
  }
}
