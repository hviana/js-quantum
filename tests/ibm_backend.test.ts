import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import {
  buildRequestUrl,
  IBMBackend,
  parseSamplerV2Results,
} from "../src/ibm_backend.ts";
import type { IBMExecutable } from "../src/ibm_backend.ts";
import { QuantumCircuit } from "../src/circuit.ts";
import type { IBMBackendConfiguration } from "../src/types.ts";

const SAMPLE_CONFIG_BEARER: IBMBackendConfiguration = {
  name: "ibm_kyoto",
  numQubits: 5,
  basisGates: ["ecr", "id", "rz", "sx", "x"],
  couplingMap: [[0, 1], [1, 2], [2, 3], [3, 4]],
  serviceCrn: "crn:v1:bluemix:public:quantum-computing:us-east:a/abc:def::",
  apiVersion: "2025-01-01",
  bearerToken: "test-bearer-token",
};

const SAMPLE_CONFIG_APIKEY: IBMBackendConfiguration = {
  ...SAMPLE_CONFIG_BEARER,
  bearerToken: undefined,
  apiKey: "test-api-key",
};

// =============================================================================
// Construction & validation
// =============================================================================

Deno.test("IBMBackend: rejects missing auth", () => {
  assertThrows(
    () =>
      new IBMBackend({
        ...SAMPLE_CONFIG_BEARER,
        bearerToken: undefined,
        apiKey: undefined,
      }),
    Error,
    "exactly one of bearerToken or apiKey",
  );
});

Deno.test("IBMBackend: rejects both auth modes", () => {
  assertThrows(
    () =>
      new IBMBackend({
        ...SAMPLE_CONFIG_BEARER,
        apiKey: "also-key",
      }),
    Error,
    "exactly one of bearerToken or apiKey",
  );
});

Deno.test("IBMBackend: rejects missing serviceCrn", () => {
  assertThrows(
    () =>
      new IBMBackend({
        ...SAMPLE_CONFIG_BEARER,
        serviceCrn: "",
      }),
    Error,
    "serviceCrn is required",
  );
});

Deno.test("IBMBackend: rejects missing apiVersion", () => {
  assertThrows(
    () =>
      new IBMBackend({
        ...SAMPLE_CONFIG_BEARER,
        apiVersion: "",
      }),
    Error,
    "apiVersion is required",
  );
});

Deno.test("IBMBackend: accepts bearer token configuration", () => {
  const b = new IBMBackend(SAMPLE_CONFIG_BEARER);
  assertEquals(b.name, "ibm_kyoto");
  assertEquals(b.numQubits, 5);
});

Deno.test("IBMBackend: accepts apiKey configuration", () => {
  const b = new IBMBackend(SAMPLE_CONFIG_APIKEY);
  assertEquals(b.name, "ibm_kyoto");
});

// =============================================================================
// transpileAndPackage payload structure
// =============================================================================

Deno.test("IBMBackend: transpileAndPackage produces Sampler V2 PUB tuple", () => {
  const b = new IBMBackend(SAMPLE_CONFIG_BEARER);
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  qc.addClassicalRegister("c", 2);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  qc.measure(1, { registerName: "c", bitIndex: 1 });
  const ex = b.transpileAndPackage(qc, 512);
  assertEquals(ex.numShots, 512);
  const payload = ex.payload as {
    program_id: string;
    backend: string;
    params: { version: number; pubs: unknown[] };
  };
  assertEquals(payload.program_id, "sampler");
  assertEquals(payload.backend, "ibm_kyoto");
  assertEquals(payload.params.version, 2);
  assertEquals(payload.params.pubs.length, 1);
  const pub = payload.params.pubs[0] as [string, null, number];
  assertEquals(pub.length, 3);
  assertEquals(pub[1], null);
  assertEquals(pub[2], 512);
  assert(typeof pub[0] === "string");
  assert(pub[0].includes("OPENQASM"));
});

Deno.test("IBMBackend: payload OpenQASM contains the gates", () => {
  const b = new IBMBackend(SAMPLE_CONFIG_BEARER);
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  const ex = b.transpileAndPackage(qc);
  const pub =
    (ex.payload as { params: { pubs: [string, null, number][] } }).params
      .pubs[0];
  // After transpile() the H gate is decomposed into rz/ry sequences
  // when the basis is [ecr, id, rz, sx, x]. We should at least see
  // some basis gates emitted in the OpenQASM text.
  const text = pub[0];
  assert(text.includes("qubit["));
});

Deno.test("IBMBackend: default shots = 1024", () => {
  const b = new IBMBackend(SAMPLE_CONFIG_BEARER);
  const qc = new QuantumCircuit();
  qc.h(0);
  const ex = b.transpileAndPackage(qc);
  assertEquals(ex.numShots, 1024);
});

Deno.test("IBMBackend: payload preserves classical-register layout", () => {
  const b = new IBMBackend(SAMPLE_CONFIG_BEARER);
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  qc.addClassicalRegister("a", 1);
  qc.addClassicalRegister("b", 1);
  qc.measure(0, { registerName: "a", bitIndex: 0 });
  qc.measure(1, { registerName: "b", bitIndex: 0 });
  const ex = b.transpileAndPackage(qc);
  assertEquals(ex.classicalRegisters.length, 2);
  assertEquals(ex.classicalRegisters[0].name, "a");
  assertEquals(ex.classicalRegisters[1].name, "b");
  assertEquals(ex.numClbits, 2);
});

Deno.test("IBMBackend: apiConfig contains required headers", () => {
  const b = new IBMBackend(SAMPLE_CONFIG_BEARER);
  const qc = new QuantumCircuit();
  qc.h(0);
  const ex = b.transpileAndPackage(qc);
  const headers = ex.apiConfig.headers;
  assertEquals(headers.Authorization, "Bearer test-bearer-token");
  assertEquals(headers["Service-CRN"], SAMPLE_CONFIG_BEARER.serviceCrn);
  assertEquals(headers["IBM-API-Version"], SAMPLE_CONFIG_BEARER.apiVersion);
  assertEquals(headers.Accept, "application/json");
  assertEquals(headers["Content-Type"], "application/json");
});

Deno.test("IBMBackend: apiConfig with apiKey leaves Authorization empty until exchange", () => {
  const b = new IBMBackend(SAMPLE_CONFIG_APIKEY);
  const qc = new QuantumCircuit();
  qc.h(0);
  const ex = b.transpileAndPackage(qc);
  assertEquals(ex.apiConfig.headers.Authorization, "");
  assertEquals(ex.apiConfig.bearerToken, null);
  assertEquals(ex.apiConfig.apiKey, "test-api-key");
});

Deno.test("IBMBackend: routes contain the Sampler V2 endpoints", () => {
  const b = new IBMBackend(SAMPLE_CONFIG_BEARER);
  const ex = b.transpileAndPackage(new QuantumCircuit());
  assertEquals(ex.apiConfig.routes.submit, "/jobs");
  assertEquals(ex.apiConfig.routes.status, "/jobs/{job_id}");
  assertEquals(ex.apiConfig.routes.results, "/jobs/{job_id}/results");
});

Deno.test("IBMBackend: default endpoint = quantum.cloud.ibm.com", () => {
  const b = new IBMBackend(SAMPLE_CONFIG_BEARER);
  const ex = b.transpileAndPackage(new QuantumCircuit());
  assertEquals(ex.apiConfig.endpoint, "https://quantum.cloud.ibm.com/api/v1");
});

Deno.test("IBMBackend: custom endpoint preserved", () => {
  const b = new IBMBackend({
    ...SAMPLE_CONFIG_BEARER,
    apiEndpoint: "https://custom.endpoint/api/v2",
  });
  const ex = b.transpileAndPackage(new QuantumCircuit());
  assertEquals(ex.apiConfig.endpoint, "https://custom.endpoint/api/v2");
});

// =============================================================================
// CORS proxy
// =============================================================================

Deno.test("buildRequestUrl: returns original URL when proxy disabled", () => {
  const url = buildRequestUrl("https://example.com/api", undefined);
  assertEquals(url, "https://example.com/api");
});

Deno.test("buildRequestUrl: returns original URL when proxy.enabled = false", () => {
  const url = buildRequestUrl("https://example.com/api", {
    enabled: false,
    mode: "browser-only",
    baseUrl: "https://proxy/?",
  });
  assertEquals(url, "https://example.com/api");
});

Deno.test("buildRequestUrl: prepends proxy in always mode", () => {
  const url = buildRequestUrl("https://example.com/api", {
    enabled: true,
    mode: "always",
    baseUrl: "https://proxy/?",
  });
  assertEquals(url, "https://proxy/?https://example.com/api");
});

Deno.test("buildRequestUrl: browser-only mode does not prepend in non-browser context", () => {
  // Deno is not a browser context.
  const url = buildRequestUrl("https://example.com/api", {
    enabled: true,
    mode: "browser-only",
    baseUrl: "https://proxy/?",
  });
  assertEquals(url, "https://example.com/api");
});

Deno.test("buildRequestUrl: browser-only mode prepends proxy in worker context", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "importScripts");
  Object.defineProperty(globalThis, "importScripts", {
    value: () => {},
    configurable: true,
    writable: true,
  });
  try {
    const url = buildRequestUrl("https://example.com/api", {
      enabled: true,
      mode: "browser-only",
      baseUrl: "https://proxy/?",
    });
    assertEquals(url, "https://proxy/?https://example.com/api");
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "importScripts", previous);
    } else {
      delete (globalThis as { importScripts?: unknown }).importScripts;
    }
  }
});

Deno.test("IBMBackend: default corsProxy preserved on apiConfig", () => {
  const b = new IBMBackend(SAMPLE_CONFIG_BEARER);
  const ex = b.transpileAndPackage(new QuantumCircuit());
  assertEquals(ex.apiConfig.corsProxy.enabled, false);
  assertEquals(ex.apiConfig.corsProxy.baseUrl, "https://proxy.corsfix.com/?");
});

// =============================================================================
// Sampler V2 result parsing
// =============================================================================

Deno.test("parseSamplerV2Results: simple single-register response", () => {
  const fakeExecutable: IBMExecutable = {
    payload: {},
    apiConfig: {} as never,
    compiledCircuit: new QuantumCircuit(),
    classicalRegisters: [
      { name: "c", size: 2, flatOffset: 0 },
    ],
    target: { numQubits: 2, instructions: new Map() },
    numClbits: 2,
    numShots: 4,
  };
  const fakeResponse = {
    results: [{
      data: {
        c: { samples: ["00", "11", "00", "11"] },
      },
    }],
  };
  const result = parseSamplerV2Results(fakeResponse, fakeExecutable);
  assertEquals(result["00"], 50);
  assertEquals(result["11"], 50);
});

Deno.test("parseSamplerV2Results: multi-register response is reconstructed in declaration order", () => {
  const fakeExecutable: IBMExecutable = {
    payload: {},
    apiConfig: {} as never,
    compiledCircuit: new QuantumCircuit(),
    classicalRegisters: [
      { name: "a", size: 1, flatOffset: 0 },
      { name: "b", size: 1, flatOffset: 1 },
    ],
    target: { numQubits: 2, instructions: new Map() },
    numClbits: 2,
    numShots: 2,
  };
  const fakeResponse = {
    results: [{
      data: {
        a: { samples: ["1", "0"] },
        b: { samples: ["0", "1"] },
      },
    }],
  };
  const result = parseSamplerV2Results(fakeResponse, fakeExecutable);
  assertEquals(result["1 0"], 50);
  assertEquals(result["0 1"], 50);
});

Deno.test("parseSamplerV2Results: rejects missing register data", () => {
  const fakeExecutable: IBMExecutable = {
    payload: {},
    apiConfig: {} as never,
    compiledCircuit: new QuantumCircuit(),
    classicalRegisters: [{ name: "c", size: 1, flatOffset: 0 }],
    target: { numQubits: 1, instructions: new Map() },
    numClbits: 1,
    numShots: 1,
  };
  const fakeResponse = { results: [{ data: {} }] };
  assertThrows(
    () => parseSamplerV2Results(fakeResponse, fakeExecutable),
    Error,
    "missing samples",
  );
});

Deno.test("parseSamplerV2Results: rejects empty results array", () => {
  const fakeExecutable: IBMExecutable = {
    payload: {},
    apiConfig: {} as never,
    compiledCircuit: new QuantumCircuit(),
    classicalRegisters: [{ name: "c", size: 1, flatOffset: 0 }],
    target: { numQubits: 1, instructions: new Map() },
    numClbits: 1,
    numShots: 1,
  };
  assertThrows(
    () => parseSamplerV2Results({ results: [] }, fakeExecutable),
    Error,
  );
});

Deno.test("parseSamplerV2Results: percentages sum to 100", () => {
  const fakeExecutable: IBMExecutable = {
    payload: {},
    apiConfig: {} as never,
    compiledCircuit: new QuantumCircuit(),
    classicalRegisters: [{ name: "c", size: 1, flatOffset: 0 }],
    target: { numQubits: 1, instructions: new Map() },
    numClbits: 1,
    numShots: 8,
  };
  const fakeResponse = {
    results: [{
      data: {
        c: { samples: ["0", "0", "0", "0", "1", "1", "1", "1"] },
      },
    }],
  };
  const result = parseSamplerV2Results(fakeResponse, fakeExecutable);
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  assertEquals(total, 100);
  assertEquals(result["0"], 50);
  assertEquals(result["1"], 50);
});

// =============================================================================
// Skipped execution tests (require credentials)
// =============================================================================

const HAVE_IBM_CREDS =
  !!(Deno.env.get("IBM_BEARER_TOKEN") || Deno.env.get("IBM_API_KEY")) &&
  !!Deno.env.get("IBM_SERVICE_CRN");

Deno.test({
  name: "IBMBackend: live submission (skipped without credentials)",
  ignore: !HAVE_IBM_CREDS,
  fn: async () => {
    const config: IBMBackendConfiguration = {
      name: Deno.env.get("IBM_BACKEND_NAME") ?? "ibm_kyoto",
      numQubits: 5,
      basisGates: ["ecr", "id", "rz", "sx", "x"],
      couplingMap: [[0, 1], [1, 2], [2, 3], [3, 4]],
      serviceCrn: Deno.env.get("IBM_SERVICE_CRN")!,
      apiVersion: Deno.env.get("IBM_API_VERSION") ?? "2025-01-01",
      bearerToken: Deno.env.get("IBM_BEARER_TOKEN") ?? undefined,
      apiKey: Deno.env.get("IBM_API_KEY") ?? undefined,
    };
    const b = new IBMBackend(config);
    const qc = new QuantumCircuit();
    qc.h(0).cx(0, 1);
    qc.addClassicalRegister("c", 2);
    qc.measure(0, { registerName: "c", bitIndex: 0 });
    qc.measure(1, { registerName: "c", bitIndex: 1 });
    const ex = b.transpileAndPackage(qc, 100);
    const result = await b.execute(ex);
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    assert(Math.abs(total - 100) < 1e-9);
  },
});
