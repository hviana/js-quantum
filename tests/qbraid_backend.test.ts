import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import {
  parseQBraidResults,
  QBRAID_OTHER_STATUSES,
  QBRAID_TERMINAL_STATUSES,
  QBRAID_TRANSIENT_STATUSES,
  QBraidBackend,
} from "../src/qbraid_backend.ts";
import { QuantumCircuit } from "../src/circuit.ts";
import type { QBraidBackendConfiguration } from "../src/types.ts";

const SAMPLE_CONFIG: QBraidBackendConfiguration = {
  name: "qbraid-sim",
  numQubits: 5,
  basisGates: ["h", "cx", "rz", "ry", "x"],
  couplingMap: null,
  deviceQrn: "qbraid:device:test",
  apiKey: "test-api-key",
};

// =============================================================================
// Construction & validation
// =============================================================================

Deno.test("QBraidBackend: rejects missing apiKey", () => {
  assertThrows(
    () => new QBraidBackend({ ...SAMPLE_CONFIG, apiKey: "" }),
    Error,
    "apiKey is required",
  );
});

Deno.test("QBraidBackend: rejects missing deviceQrn", () => {
  assertThrows(
    () => new QBraidBackend({ ...SAMPLE_CONFIG, deviceQrn: "" }),
    Error,
    "deviceQrn is required",
  );
});

Deno.test("QBraidBackend: stores configuration", () => {
  const b = new QBraidBackend(SAMPLE_CONFIG);
  assertEquals(b.name, "qbraid-sim");
  assertEquals(b.numQubits, 5);
  assertEquals(b.couplingMap, null);
});

// =============================================================================
// transpileAndPackage payload structure
// =============================================================================

Deno.test("QBraidBackend: transpileAndPackage produces qasm3 payload", () => {
  const b = new QBraidBackend(SAMPLE_CONFIG);
  const qc = new QuantumCircuit();
  qc.h(0).cx(0, 1);
  qc.addClassicalRegister("c", 2);
  qc.measure(0, { registerName: "c", bitIndex: 0 });
  qc.measure(1, { registerName: "c", bitIndex: 1 });
  const ex = b.transpileAndPackage(qc, 256);
  const payload = ex.payload as {
    shots: number;
    deviceQrn: string;
    program: { format: string; data: string };
  };
  assertEquals(payload.shots, 256);
  assertEquals(payload.deviceQrn, "qbraid:device:test");
  assertEquals(payload.program.format, "qasm3");
  assert(payload.program.data.includes("OPENQASM"));
});

Deno.test("QBraidBackend: default shots = 1024", () => {
  const b = new QBraidBackend(SAMPLE_CONFIG);
  const ex = b.transpileAndPackage(new QuantumCircuit());
  assertEquals(ex.numShots, 1024);
});

Deno.test("QBraidBackend: payload includes name, tags, runtimeOptions fields", () => {
  const b = new QBraidBackend(SAMPLE_CONFIG);
  const ex = b.transpileAndPackage(new QuantumCircuit());
  const payload = ex.payload as Record<string, unknown>;
  assertEquals(payload.name, "js-quantum-job");
  assertEquals(typeof payload.tags, "object");
  assertEquals(typeof payload.runtimeOptions, "object");
});

Deno.test("QBraidBackend: classicalRegisters preserved", () => {
  const b = new QBraidBackend(SAMPLE_CONFIG);
  const qc = new QuantumCircuit();
  qc.h(0);
  qc.addClassicalRegister("a", 2);
  qc.measure(0, { registerName: "a", bitIndex: 0 });
  const ex = b.transpileAndPackage(qc);
  assertEquals(ex.classicalRegisters[0].name, "a");
  assertEquals(ex.classicalRegisters[0].size, 2);
});

Deno.test("QBraidBackend: apiConfig contains correct headers", () => {
  const b = new QBraidBackend(SAMPLE_CONFIG);
  const ex = b.transpileAndPackage(new QuantumCircuit());
  assertEquals(ex.apiConfig.headers["X-API-KEY"], "test-api-key");
  assertEquals(ex.apiConfig.headers["Content-Type"], "application/json");
});

Deno.test("QBraidBackend: routes set to v2 endpoints", () => {
  const b = new QBraidBackend(SAMPLE_CONFIG);
  const ex = b.transpileAndPackage(new QuantumCircuit());
  assertEquals(ex.apiConfig.routes.device, "/devices/{device_qrn}");
  assertEquals(ex.apiConfig.routes.submit, "/jobs");
  assertEquals(ex.apiConfig.routes.status, "/jobs/{job_qrn}");
  assertEquals(ex.apiConfig.routes.results, "/jobs/{job_qrn}/result");
});

Deno.test("QBraidBackend: default endpoint = api-v2.qbraid.com", () => {
  const b = new QBraidBackend(SAMPLE_CONFIG);
  const ex = b.transpileAndPackage(new QuantumCircuit());
  assertEquals(ex.apiConfig.endpoint, "https://api-v2.qbraid.com/api/v1");
});

Deno.test("QBraidBackend: custom endpoint preserved", () => {
  const b = new QBraidBackend({
    ...SAMPLE_CONFIG,
    apiEndpoint: "https://my.custom.endpoint",
  });
  const ex = b.transpileAndPackage(new QuantumCircuit());
  assertEquals(ex.apiConfig.endpoint, "https://my.custom.endpoint");
});

Deno.test("QBraidBackend: corsProxy default preserved", () => {
  const b = new QBraidBackend(SAMPLE_CONFIG);
  const ex = b.transpileAndPackage(new QuantumCircuit());
  assertEquals(ex.apiConfig.corsProxy.enabled, false);
  assertEquals(ex.apiConfig.corsProxy.baseUrl, "https://proxy.corsfix.com/?");
});

Deno.test("QBraidBackend: execute uses proxy URLs in worker-like browser context", async () => {
  const b = new QBraidBackend({
    ...SAMPLE_CONFIG,
    corsProxy: {
      enabled: true,
      mode: "browser-only",
      baseUrl: "https://proxy/?",
    },
  });
  const ex = b.transpileAndPackage(new QuantumCircuit());

  const requestedUrls: string[] = [];
  const previousFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  const previousImportScripts = Object.getOwnPropertyDescriptor(
    globalThis,
    "importScripts",
  );
  let callCount = 0;

  Object.defineProperty(globalThis, "importScripts", {
    value: () => {},
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "fetch", {
    value: async (input: string | URL | Request) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
      requestedUrls.push(url);
      callCount++;

      if (callCount === 1) {
        return new Response(
          JSON.stringify({ success: true, data: { jobQrn: "job-123" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (callCount === 2) {
        return new Response(
          JSON.stringify({ success: true, data: { status: "COMPLETED" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: { resultData: { measurementCounts: { "00": 1 } } },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
    configurable: true,
    writable: true,
  });

  try {
    const result = await b.execute(ex);
    assertEquals(result["00"], 100);
    assertEquals(requestedUrls.length, 3);
    assert(requestedUrls.every((url) => url.startsWith("https://proxy/?")));
  } finally {
    if (previousFetch) {
      Object.defineProperty(globalThis, "fetch", previousFetch);
    }
    if (previousImportScripts) {
      Object.defineProperty(globalThis, "importScripts", previousImportScripts);
    } else {
      delete (globalThis as { importScripts?: unknown }).importScripts;
    }
  }
});

// =============================================================================
// Result parsing
// =============================================================================

Deno.test("parseQBraidResults: simple counts response", () => {
  const fake = {
    success: true,
    data: {
      resultData: {
        measurementCounts: { "00": 50, "11": 50 },
      },
    },
  };
  const r = parseQBraidResults(fake);
  assertEquals(r["00"], 50);
  assertEquals(r["11"], 50);
});

Deno.test("parseQBraidResults: percentages sum to 100", () => {
  const fake = {
    success: true,
    data: {
      resultData: {
        measurementCounts: { "0": 256, "1": 256, "10": 256, "11": 256 },
      },
    },
  };
  const r = parseQBraidResults(fake);
  const total = Object.values(r).reduce((a, b) => a + b, 0);
  assertEquals(total, 100);
});

Deno.test("parseQBraidResults: rejects success=false", () => {
  assertThrows(
    () => parseQBraidResults({ success: false, data: {} }),
    Error,
    "success=false",
  );
});

Deno.test("parseQBraidResults: rejects missing measurementCounts", () => {
  assertThrows(
    () => parseQBraidResults({ success: true, data: {} }),
    Error,
    "missing",
  );
});

Deno.test("parseQBraidResults: rejects empty counts", () => {
  assertThrows(
    () =>
      parseQBraidResults({
        success: true,
        data: { resultData: { measurementCounts: {} } },
      }),
    Error,
    "empty",
  );
});

Deno.test("parseQBraidResults: multi-register bitstrings split with spaces", () => {
  const fakeExecutable = {
    payload: {},
    apiConfig: {} as never,
    compiledCircuit: new QuantumCircuit(),
    classicalRegisters: [
      { name: "a", size: 1, flatOffset: 0 },
      { name: "b", size: 1, flatOffset: 1 },
    ],
    target: { numQubits: 2, instructions: new Map() },
    numClbits: 2,
    numShots: 4,
  } as import("../src/qbraid_backend.ts").QBraidExecutable;
  const fake = {
    success: true,
    data: {
      resultData: {
        measurementCounts: { "10": 2, "01": 2 },
      },
    },
  };
  const r = parseQBraidResults(fake, fakeExecutable);
  assertEquals(r["1 0"], 50);
  assertEquals(r["0 1"], 50);
});

// =============================================================================
// Status enumerations
// =============================================================================

Deno.test("QBraid status enums cover all v2 states", () => {
  assertEquals(QBRAID_TERMINAL_STATUSES.length, 3);
  assertEquals(QBRAID_TRANSIENT_STATUSES.length, 5);
  assertEquals(QBRAID_OTHER_STATUSES.length, 2);
  assert(QBRAID_TERMINAL_STATUSES.includes("COMPLETED"));
  assert(QBRAID_TRANSIENT_STATUSES.includes("RUNNING"));
  assert(QBRAID_OTHER_STATUSES.includes("HOLD"));
});

// =============================================================================
// Live execution (skipped without credentials)
// =============================================================================

const HAVE_QBRAID_CREDS = !!Deno.env.get("QBRAID_API_KEY");

Deno.test({
  name: "QBraidBackend: live submission (skipped without credentials)",
  ignore: !HAVE_QBRAID_CREDS,
  fn: async () => {
    const config: QBraidBackendConfiguration = {
      name: "qbraid",
      numQubits: 5,
      basisGates: ["h", "cx", "rz", "ry"],
      couplingMap: null,
      deviceQrn: Deno.env.get("QBRAID_DEVICE_QRN") ?? "qbraid:device:simulator",
      apiKey: Deno.env.get("QBRAID_API_KEY")!,
    };
    const b = new QBraidBackend(config);
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
