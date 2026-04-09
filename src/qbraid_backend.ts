/**
 * `QBraidBackend` — qBraid cloud execution (Section 7 of the SDK
 * specification).
 *
 * Submission flow:
 *
 *   1. Build a `Target` from the qBraid backend configuration.
 *   2. Compile the circuit through the transpilation pipeline,
 *      respecting the device's basis gates and coupling map.
 *   3. Serialize the compiled circuit to OpenQASM 3.1 text.
 *   4. Wrap the program in a qBraid job request body with
 *      `program.format = "qasm3"`.
 *   5. POST the job, poll the status route until terminal, and
 *      parse the result envelope into a bitstring histogram.
 *
 * The transpile/payload path is fully testable without network
 * access. The runtime path (`execute`) requires real credentials
 * and is gated behind the `QBRAID_API_KEY` environment variable.
 */

import type { Backend, Executable } from "./backend.ts";
import { DEFAULT_SHOTS, makeBasicTarget } from "./backend.ts";
import { OpenQASMTranspiler, transpile } from "./transpiler.ts";
import { QuantumCircuit } from "./circuit.ts";
import { buildRequestUrl } from "./ibm_backend.ts";
import type {
  ClassicalRegister,
  CorsProxyConfig,
  ExecutionResult,
  QBraidBackendConfiguration,
  Target,
} from "./types.ts";

const DEFAULT_API_ENDPOINT = "https://api-v2.qbraid.com/api/v1";
const DEFAULT_CORS_PROXY: CorsProxyConfig = Object.freeze({
  enabled: false,
  mode: "browser-only",
  baseUrl: "https://proxy.corsfix.com/?",
});

// =============================================================================
// QBraidExecutable
// =============================================================================

export interface QBraidExecutable extends Executable {
  readonly payload: Record<string, unknown>;
  readonly apiConfig: QBraidApiConfig;
  readonly compiledCircuit: QuantumCircuit;
  readonly classicalRegisters: readonly ClassicalRegister[];
  readonly target: Target;
  readonly numClbits: number;
  readonly numShots: number;
}

export interface QBraidApiConfig {
  endpoint: string;
  apiKey: string;
  headers: Record<string, string>;
  routes: {
    device: string;
    submit: string;
    status: string;
    results: string;
  };
  corsProxy: CorsProxyConfig;
}

// =============================================================================
// QBraidBackend
// =============================================================================

export class QBraidBackend implements Backend {
  readonly name: string;
  readonly numQubits: number;
  readonly basisGates: readonly string[];
  readonly couplingMap: ReadonlyArray<readonly [number, number]> | null;
  readonly configuration: QBraidBackendConfiguration;
  private transpiler = new OpenQASMTranspiler();

  constructor(configuration: QBraidBackendConfiguration) {
    if (!configuration.apiKey) {
      throw new Error("QBraidBackend: apiKey is required");
    }
    if (!configuration.deviceQrn) {
      throw new Error("QBraidBackend: deviceQrn is required");
    }
    this.configuration = configuration;
    this.name = configuration.name;
    this.numQubits = configuration.numQubits;
    this.basisGates = configuration.basisGates;
    this.couplingMap = configuration.couplingMap;
  }

  /**
   * Compile a circuit for this qBraid device and produce a complete
   * qasm3 job submission payload.
   */
  transpileAndPackage(
    circuit: QuantumCircuit,
    shots: number = DEFAULT_SHOTS,
  ): QBraidExecutable {
    const target = makeBasicTarget(
      this.numQubits,
      this.basisGates,
      this.couplingMap,
    );

    const compiled = transpile(circuit, {
      numQubits: this.numQubits,
      basisGates: this.basisGates,
      couplingMap: this.couplingMap,
    });

    const serialized = this.transpiler.serialize(compiled);

    const payload: Record<string, unknown> = {
      shots,
      deviceQrn: this.configuration.deviceQrn,
      program: {
        format: "qasm3",
        data: serialized,
      },
      name: "js-quantum-job",
      tags: {},
      runtimeOptions: {},
    };

    const apiConfig: QBraidApiConfig = {
      endpoint: this.configuration.apiEndpoint ?? DEFAULT_API_ENDPOINT,
      apiKey: this.configuration.apiKey,
      headers: {
        "X-API-KEY": this.configuration.apiKey,
        "Content-Type": "application/json",
      },
      routes: {
        device: "/devices/{device_qrn}",
        submit: "/jobs",
        status: "/jobs/{job_qrn}",
        results: "/jobs/{job_qrn}/result",
      },
      corsProxy: this.configuration.corsProxy ?? DEFAULT_CORS_PROXY,
    };

    return {
      payload,
      apiConfig,
      compiledCircuit: compiled,
      classicalRegisters: compiled.classicalRegisters.map((r) => ({ ...r })),
      target,
      numClbits: compiled.numClbits,
      numShots: shots,
    };
  }

  /**
   * Submit the executable to qBraid, poll until completion, and
   * return the bitstring histogram. Handles the v2 envelope format
   * `{ success, data }` for every response.
   */
  async execute(
    executable: Executable,
    _shots?: number,
  ): Promise<ExecutionResult> {
    const ex = executable as QBraidExecutable;
    const headers = ex.apiConfig.headers;

    // Submit job.
    const submitUrl = buildRequestUrl(
      ex.apiConfig.endpoint + ex.apiConfig.routes.submit,
      ex.apiConfig.corsProxy,
    );
    const submitResp = await fetch(submitUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(ex.payload),
    });
    if (!submitResp.ok) {
      throw new Error(
        `QBraid submit failed: HTTP ${submitResp.status} ${await submitResp
          .text()}`,
      );
    }
    const submitJson = await submitResp.json() as {
      success: boolean;
      data?: { jobQrn?: string };
    };
    if (!submitJson.success || !submitJson.data?.jobQrn) {
      throw new Error("QBraid submit response missing jobQrn");
    }
    const jobQrn = submitJson.data.jobQrn;

    // Poll for completion.
    const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
    const TRANSIENT = new Set([
      "INITIALIZING",
      "QUEUED",
      "VALIDATING",
      "RUNNING",
      "CANCELLING",
    ]);
    while (true) {
      const statusUrl = buildRequestUrl(
        ex.apiConfig.endpoint +
          ex.apiConfig.routes.status.replace(
            "{job_qrn}",
            encodeURIComponent(jobQrn),
          ),
        ex.apiConfig.corsProxy,
      );
      const r = await fetch(statusUrl, { method: "GET", headers });
      if (!r.ok) {
        throw new Error(`QBraid status failed: HTTP ${r.status}`);
      }
      const j = await r.json() as {
        success: boolean;
        data?: { status?: string };
      };
      const s = j.data?.status ?? "UNKNOWN";
      if (TERMINAL.has(s)) {
        if (s !== "COMPLETED") {
          throw new Error(`QBraid job ${jobQrn} ended with status ${s}`);
        }
        break;
      }
      if (!TRANSIENT.has(s) && s !== "UNKNOWN" && s !== "HOLD") {
        throw new Error(`QBraid job ${jobQrn} returned unknown status '${s}'`);
      }
      await sleep(1000);
    }

    // Retrieve results.
    const resultsUrl = buildRequestUrl(
      ex.apiConfig.endpoint +
        ex.apiConfig.routes.results.replace(
          "{job_qrn}",
          encodeURIComponent(jobQrn),
        ),
      ex.apiConfig.corsProxy,
    );
    const resultsResp = await fetch(resultsUrl, { method: "GET", headers });
    if (!resultsResp.ok) {
      throw new Error(`QBraid results failed: HTTP ${resultsResp.status}`);
    }
    const resultsJson = await resultsResp.json();
    return parseQBraidResults(resultsJson, ex);
  }
}

// =============================================================================
// Helpers
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Parse a qBraid v2 results response into an `ExecutionResult`.
 *
 * The expected envelope is `{ success, data: { resultData: {
 * measurementCounts: { bitstring: count } } } }`. Counts are
 * normalized into percentages (0–100) summing to 100.
 *
 * When an executable is provided, flat bitstrings are split into
 * space-separated register segments (matching the `SimulatorBackend`
 * and `IBMBackend` formatting convention).
 */
export function parseQBraidResults(
  resultsJson: unknown,
  ex?: QBraidExecutable,
): ExecutionResult {
  const j = resultsJson as {
    success?: boolean;
    data?: { resultData?: { measurementCounts?: Record<string, number> } };
  };
  if (j.success === false) {
    throw new Error("parseQBraidResults: response success=false");
  }
  const counts = j.data?.resultData?.measurementCounts;
  if (!counts) {
    throw new Error(
      "parseQBraidResults: missing data.resultData.measurementCounts",
    );
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total <= 0) {
    throw new Error("parseQBraidResults: empty measurementCounts");
  }
  const out: Record<string, number> = {};
  for (const [bs, c] of Object.entries(counts)) {
    out[formatQBraidBitstring(bs, ex)] = (c / total) * 100;
  }
  return out;
}

/**
 * Split a flat bitstring into space-separated register segments using
 * the classical-register layout from the executable. If no executable
 * or registers are available, the bitstring is returned as-is.
 */
function formatQBraidBitstring(
  bs: string,
  ex?: QBraidExecutable,
): string {
  if (!ex || ex.classicalRegisters.length <= 1) return bs;
  const regs = ex.classicalRegisters;
  const expectedLen = regs.reduce((sum, r) => sum + r.size, 0);
  if (bs.length !== expectedLen) return bs;
  const parts: string[] = [];
  let offset = 0;
  for (const reg of regs) {
    parts.push(bs.slice(offset, offset + reg.size));
    offset += reg.size;
  }
  return parts.join(" ");
}

/**
 * The set of qBraid job statuses recognized by `execute`. Exposed
 * for callers building custom polling loops.
 */
export const QBRAID_TERMINAL_STATUSES: readonly string[] = Object.freeze([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const QBRAID_TRANSIENT_STATUSES: readonly string[] = Object.freeze([
  "INITIALIZING",
  "QUEUED",
  "VALIDATING",
  "RUNNING",
  "CANCELLING",
]);

export const QBRAID_OTHER_STATUSES: readonly string[] = Object.freeze([
  "UNKNOWN",
  "HOLD",
]);
