/**
 * `IBMBackend` — IBM Quantum cloud execution via the Sampler V2 REST
 * API (Section 6 of the SDK specification).
 *
 * Submission flow:
 *
 *   1. Build a `Target` from the IBM backend configuration.
 *   2. Compile the circuit through the transpilation pipeline,
 *      respecting the device's basis gates and coupling map.
 *   3. Serialize the compiled circuit to OpenQASM 3.1 text.
 *   4. Wrap the program in a Sampler V2 PUB tuple
 *      `[circuit_text, parameter_values, shots]` and assemble the
 *      job request payload.
 *   5. Authenticate via an IAM-exchanged bearer token or a
 *      pre-supplied bearer token.
 *   6. POST the job, poll for completion, and parse the per-PUB
 *      `data` object back into a bitstring histogram by
 *      reconstructing every classical register in declaration order.
 *
 * The transpile/payload path is fully testable without network
 * access. The runtime path (`execute`) requires real credentials
 * and is gated behind `IBM_BEARER_TOKEN`/`IBM_API_KEY` +
 * `IBM_SERVICE_CRN` environment variables.
 */

import type { Backend, Executable } from "./backend.ts";
import { DEFAULT_SHOTS, makeBasicTarget } from "./backend.ts";
import { OpenQASMTranspiler, transpile } from "./transpiler.ts";
import { QuantumCircuit } from "./circuit.ts";
import type {
  ClassicalRegister,
  CorsProxyConfig,
  ExecutionResult,
  IBMBackendConfiguration,
  Target,
} from "./types.ts";

const DEFAULT_API_ENDPOINT = "https://quantum.cloud.ibm.com/api/v1";
const IAM_TOKEN_ENDPOINT = "https://iam.cloud.ibm.com/identity/token";
const DEFAULT_CORS_PROXY: CorsProxyConfig = Object.freeze({
  enabled: false,
  mode: "browser-only",
  baseUrl: "https://proxy.corsfix.com/?",
});

// =============================================================================
// IBMExecutable
// =============================================================================

/**
 * Compiled payload for `IBMBackend.execute`. Carries the full
 * Sampler V2 job request body, the API configuration (auth headers
 * and route templates), the compiled circuit (for inspection), the
 * target description, and the ordered classical-register layout
 * needed to reconstruct result bitstrings.
 */
export interface IBMExecutable extends Executable {
  /** JSON-serializable Sampler V2 job submission body. */
  readonly payload: Record<string, unknown>;
  /** Endpoint, headers, route templates. */
  readonly apiConfig: IBMApiConfig;
  /** The transpiled circuit. */
  readonly compiledCircuit: QuantumCircuit;
  /** Ordered named classical registers used for reconstructing results. */
  readonly classicalRegisters: readonly ClassicalRegister[];
  /** Target description used during compilation. */
  readonly target: Target;
  /** Total number of classical bits across all registers. */
  readonly numClbits: number;
  /** Shot count for this submission. */
  readonly numShots: number;
}

/**
 * Resolved API configuration: endpoint URL, auth headers, route
 * templates. Built once during `transpileAndPackage`.
 */
export interface IBMApiConfig {
  endpoint: string;
  iamTokenEndpoint: string;
  bearerToken: string | null;
  apiKey: string | null;
  serviceCrn: string;
  apiVersion: string;
  headers: Record<string, string>;
  routes: {
    submit: string;
    status: string;
    results: string;
  };
  corsProxy: CorsProxyConfig;
}

// =============================================================================
// IBMBackend
// =============================================================================

export class IBMBackend implements Backend {
  readonly name: string;
  readonly numQubits: number;
  readonly basisGates: readonly string[];
  readonly couplingMap: ReadonlyArray<readonly [number, number]> | null;
  readonly configuration: IBMBackendConfiguration;
  private cachedToken: { token: string; expiresAt: number } | null = null;
  private transpiler = new OpenQASMTranspiler();

  constructor(configuration: IBMBackendConfiguration) {
    // Validate exactly one auth mode is provided.
    const hasBearer = !!configuration.bearerToken;
    const hasKey = !!configuration.apiKey;
    if (hasBearer === hasKey) {
      throw new Error(
        "IBMBackend: exactly one of bearerToken or apiKey must be supplied",
      );
    }
    if (!configuration.serviceCrn) {
      throw new Error("IBMBackend: serviceCrn is required");
    }
    if (!configuration.apiVersion) {
      throw new Error("IBMBackend: apiVersion is required");
    }
    this.configuration = configuration;
    this.name = configuration.name;
    this.numQubits = configuration.numQubits;
    this.basisGates = configuration.basisGates;
    this.couplingMap = configuration.couplingMap;
  }

  /**
   * Compile a circuit for this IBM backend and produce a complete
   * Sampler V2 job submission payload.
   */
  transpileAndPackage(
    circuit: QuantumCircuit,
    shots: number = DEFAULT_SHOTS,
  ): IBMExecutable {
    // Phase 1: Target description.
    const target = makeBasicTarget(
      this.numQubits,
      this.basisGates,
      this.couplingMap,
    );

    // Phase 2: Compile.
    const compiled = transpile(circuit, {
      numQubits: this.numQubits,
      basisGates: this.basisGates,
      couplingMap: this.couplingMap,
    });

    // Phase 3: Serialize.
    const serialized = this.transpiler.serialize(compiled);

    // Phase 4: Build Sampler V2 PUB tuple.
    const payload: Record<string, unknown> = {
      program_id: "sampler",
      backend: this.name,
      params: {
        version: 2,
        pubs: [
          [serialized, null, shots],
        ],
      },
    };

    // Phase 5: API config + headers.
    const bearer = this.configuration.bearerToken ?? null;
    const apiConfig: IBMApiConfig = {
      endpoint: this.configuration.apiEndpoint ?? DEFAULT_API_ENDPOINT,
      iamTokenEndpoint: IAM_TOKEN_ENDPOINT,
      bearerToken: bearer,
      apiKey: this.configuration.apiKey ?? null,
      serviceCrn: this.configuration.serviceCrn,
      apiVersion: this.configuration.apiVersion,
      headers: {
        // Authorization is filled in just before request time when
        // resolving from `apiKey`. With a pre-supplied bearer token
        // we can include it now.
        Authorization: bearer ? `Bearer ${bearer}` : "",
        "Service-CRN": this.configuration.serviceCrn,
        Accept: "application/json",
        "Content-Type": "application/json",
        "IBM-API-Version": this.configuration.apiVersion,
      },
      routes: {
        submit: "/jobs",
        status: "/jobs/{job_id}",
        results: "/jobs/{job_id}/results",
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
   * Submit the executable to the IBM Quantum cloud, poll until
   * completion, and return the bitstring histogram.
   */
  async execute(
    executable: Executable,
    _shots?: number,
  ): Promise<ExecutionResult> {
    const ex = executable as IBMExecutable;
    // Resolve auth.
    const bearer = await this.resolveBearerToken(ex.apiConfig);
    const headers: Record<string, string> = {
      ...ex.apiConfig.headers,
      Authorization: `Bearer ${bearer}`,
    };

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
        `IBM submit failed: HTTP ${submitResp.status} ${await submitResp
          .text()}`,
      );
    }
    const submitJson = await submitResp.json() as { id?: string };
    const jobId = submitJson.id;
    if (!jobId) {
      throw new Error("IBM submit response missing job id");
    }

    // Poll for completion.
    const statusUrl = buildRequestUrl(
      ex.apiConfig.endpoint +
        ex.apiConfig.routes.status.replace(
          "{job_id}",
          encodeURIComponent(jobId),
        ),
      ex.apiConfig.corsProxy,
    );
    const TERMINAL = new Set(["Completed", "Failed", "Cancelled"]);
    while (true) {
      const r = await fetch(statusUrl, { method: "GET", headers });
      if (!r.ok) {
        throw new Error(`IBM status failed: HTTP ${r.status}`);
      }
      const j = await r.json() as {
        status?: string;
        state?: { status?: string };
      };
      const s = j.status ?? j.state?.status ?? "Unknown";
      if (TERMINAL.has(s)) {
        if (s !== "Completed") {
          throw new Error(`IBM job ${jobId} ended with status ${s}`);
        }
        break;
      }
      // Transient states (Queued, Running, etc.): wait and retry.
      await sleep(1000);
    }

    // Retrieve results.
    const resultsUrl = buildRequestUrl(
      ex.apiConfig.endpoint +
        ex.apiConfig.routes.results.replace(
          "{job_id}",
          encodeURIComponent(jobId),
        ),
      ex.apiConfig.corsProxy,
    );
    const resultsResp = await fetch(resultsUrl, { method: "GET", headers });
    if (!resultsResp.ok) {
      throw new Error(`IBM results failed: HTTP ${resultsResp.status}`);
    }
    const resultsJson = await resultsResp.json();
    return parseSamplerV2Results(resultsJson, ex);
  }

  /**
   * Resolve a usable bearer token. If the configuration provides a
   * bearer token directly, use it; otherwise exchange the API key
   * for an IAM token (cached until expiry).
   */
  private async resolveBearerToken(api: IBMApiConfig): Promise<string> {
    if (api.bearerToken) return api.bearerToken;
    if (!api.apiKey) {
      throw new Error("IBMBackend: no auth credentials available");
    }
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30000) {
      return this.cachedToken.token;
    }
    const body = new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: api.apiKey,
    });
    const url = buildRequestUrl(api.iamTokenEndpoint, api.corsProxy);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
    if (!resp.ok) {
      throw new Error(`IBM IAM token exchange failed: HTTP ${resp.status}`);
    }
    const json = await resp.json() as {
      access_token: string;
      expires_in: number;
    };
    this.cachedToken = {
      token: json.access_token,
      expiresAt: Date.now() + (json.expires_in * 1000),
    };
    return json.access_token;
  }
}

// =============================================================================
// Helpers
// =============================================================================

/** Wait for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Optional CORS proxy URL builder. Browsers running this SDK from
 * a non-HTTPS / different-origin context can prepend a proxy URL
 * to outbound fetches when `corsProxy.enabled` is true. Browser
 * workers count as browser contexts too, because the playground
 * executes user code inside a Web Worker rather than on `window`.
 */
export function buildRequestUrl(
  originalUrl: string,
  proxy: CorsProxyConfig | undefined,
): string {
  if (!proxy || !proxy.enabled) return originalUrl;
  if (proxy.mode === "browser-only") {
    const runtime = globalThis as {
      window?: unknown;
      document?: unknown;
      importScripts?: unknown;
    };
    const isBrowser = (
      typeof runtime.window !== "undefined" &&
      typeof runtime.document !== "undefined"
    ) || typeof runtime.importScripts === "function";
    if (!isBrowser) return originalUrl;
  }
  return proxy.baseUrl + originalUrl;
}

/**
 * Parse a Sampler V2 results payload into an `ExecutionResult`.
 *
 * The payload's `results` array contains one entry per submitted
 * PUB. Each PUB result has a `data` object whose keys are the
 * names of the classical registers used in the program. Each
 * register entry has a `samples` array (one entry per shot)
 * containing per-shot bit values for that register.
 *
 * To reconstruct each shot's full bitstring we iterate every
 * classical register in the compiled circuit's declaration order
 * and join their per-shot samples with a space separator (matching
 * the `SimulatorBackend` formatting convention).
 */
export function parseSamplerV2Results(
  resultsJson: unknown,
  ex: IBMExecutable,
): ExecutionResult {
  const root = resultsJson as {
    results?: Array<{ data?: Record<string, { samples?: string[] }> }>;
  };
  const pubResults = root.results ?? [];
  const counts: Record<string, number> = {};
  if (pubResults.length === 0) {
    throw new Error("parseSamplerV2Results: no PUB results in response");
  }
  for (const pub of pubResults) {
    const data = pub.data ?? {};
    const orderedRegisters = ex.classicalRegisters;
    if (orderedRegisters.length === 0) {
      // No registered classical bits: nothing to count.
      continue;
    }
    const registerSamples: { name: string; samples: string[] }[] = [];
    for (const reg of orderedRegisters) {
      const regData = data[reg.name];
      if (!regData || !Array.isArray(regData.samples)) {
        throw new Error(
          `parseSamplerV2Results: register '${reg.name}' missing samples in response`,
        );
      }
      registerSamples.push({ name: reg.name, samples: regData.samples });
    }
    if (registerSamples.length === 0) continue;
    const shotCount = registerSamples[0].samples.length;
    for (const r of registerSamples) {
      if (r.samples.length !== shotCount) {
        throw new Error(
          `parseSamplerV2Results: register '${r.name}' has ${r.samples.length} samples but expected ${shotCount}`,
        );
      }
    }
    for (let s = 0; s < shotCount; s++) {
      const parts = registerSamples.map((r) => r.samples[s]);
      const bitstring = parts.join(" ");
      counts[bitstring] = (counts[bitstring] ?? 0) + 1;
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    out[k] = (v / total) * 100;
  }
  return out;
}
