/**
 * @module serializer
 * JSON serialization and deserialization for quantum circuits.
 *
 * Converts between {@link QuantumCode} objects and structured JSON.
 * The JSON format is designed to be:
 * - **Human-readable**: Well-structured with clear field names.
 * - **Complete**: Contains all information to reconstruct the circuit.
 * - **Visualization-ready**: Includes step ordering, qubit targets, and
 *   parameters needed to render a visual circuit diagram.
 *
 * @example
 * ```ts
 * import { quantum } from "./circuit.ts";
 * import { serialize, deserialize } from "./serializer.ts";
 *
 * const code = quantum(2, 2, (qc) => {
 *   qc.h(0);
 *   qc.cx(0, 1);
 *   qc.measure(0, 0);
 *   qc.measure(1, 1);
 * });
 *
 * // Serialize to JSON
 * const json = serialize(code);
 * const jsonString = JSON.stringify(json, null, 2);
 *
 * // Deserialize back to QuantumCode
 * const restored = deserialize(json);
 * ```
 *
 * @author Henrique Emanoel Viana
 * @license MIT
 */

import type {
  CircuitInstruction,
  GateName,
  QuantumCode,
  SerializedCircuit,
  SerializedInstruction,
} from "./types.ts";

/** Library version for metadata. */
const LIB_VERSION = "1.0.0";

/**
 * Serializes a {@link QuantumCode} into a structured JSON-serializable object.
 *
 * The output contains full circuit metadata, ordered instructions with step
 * indices, gate parameters, control qubits, and classical conditions.
 *
 * @param code - The quantum circuit to serialize.
 * @returns A plain object suitable for `JSON.stringify()`.
 *
 * @example
 * ```ts
 * const json = serialize(code);
 * console.log(JSON.stringify(json, null, 2));
 * // {
 * //   "meta": { "library": "jsQuantum", "version": "1.0.0" },
 * //   "numQubits": 2,
 * //   "numClassicalBits": 2,
 * //   "instructions": [
 * //     { "step": 0, "gate": "h", "targets": [0], "params": [] },
 * //     { "step": 1, "gate": "cx", "targets": [0, 1], "params": [] },
 * //     ...
 * //   ]
 * // }
 * ```
 */
export function serialize(code: QuantumCode): SerializedCircuit {
  const instructions: SerializedInstruction[] = code.instructions.map(
    (instr, index) => {
      const serialized: SerializedInstruction = {
        step: index,
        gate: instr.gate,
        targets: [...instr.targets],
        params: [...instr.params],
      };

      if (instr.paramRefs && instr.paramRefs.length > 0) {
        serialized.paramRefs = [...instr.paramRefs];
      }
      if (instr.ctrl !== undefined) {
        serialized.ctrl = instr.ctrl;
      }
      if (instr.condition !== undefined) {
        serialized.condition = { ...instr.condition };
      }

      return serialized;
    },
  );

  return {
    meta: {
      library: "jsQuantum",
      version: LIB_VERSION,
    },
    numQubits: code.numQubits,
    numClassicalBits: code.numClassicalBits,
    instructions,
  };
}

/**
 * Deserializes a JSON object back into a {@link QuantumCode}.
 *
 * Validates the structure and produces an immutable QuantumCode
 * that can be passed to `simulate()`.
 *
 * @param json - A {@link SerializedCircuit} (e.g., from `JSON.parse()`).
 * @returns A {@link QuantumCode} ready for simulation.
 *
 * @example
 * ```ts
 * const jsonString = '{"meta":{"library":"jsQuantum","version":"1.0.0"},...}';
 * const parsed = JSON.parse(jsonString);
 * const code = deserialize(parsed);
 * const result = simulate(code, {}, 1024);
 * ```
 *
 * @throws {Error} If the JSON structure is invalid or missing required fields.
 */
export function deserialize(json: SerializedCircuit): QuantumCode {
  // Validate top-level structure
  if (!json || typeof json !== "object") {
    throw new Error("Invalid JSON: expected an object");
  }
  if (!json.meta || json.meta.library !== "jsQuantum") {
    throw new Error("Invalid JSON: not a jsQuantum circuit");
  }
  if (!Number.isInteger(json.numQubits) || json.numQubits < 1) {
    throw new Error("Invalid JSON: numQubits must be a positive integer");
  }
  if (!Number.isInteger(json.numClassicalBits) || json.numClassicalBits < 0) {
    throw new Error(
      "Invalid JSON: numClassicalBits must be a non-negative integer",
    );
  }
  if (!Array.isArray(json.instructions)) {
    throw new Error("Invalid JSON: instructions must be an array");
  }

  const validGates = new Set<string>([
    "h",
    "x",
    "y",
    "z",
    "s",
    "sdg",
    "t",
    "tdg",
    "sx",
    "sxdg",
    "id",
    "p",
    "rz",
    "rx",
    "u",
    "cx",
    "swap",
    "rxx",
    "rzz",
    "ccx",
    "rccx",
    "rc3x",
    "measure",
    "reset",
  ]);

  const paramNames = new Set<string>();
  const instructions: CircuitInstruction[] = [];

  for (const serialized of json.instructions) {
    if (!validGates.has(serialized.gate)) {
      throw new Error(`Invalid gate: "${serialized.gate}"`);
    }

    const instr: CircuitInstruction = {
      gate: serialized.gate as GateName,
      targets: [...serialized.targets],
      params: [...serialized.params],
    };

    if (serialized.paramRefs) {
      instr.paramRefs = [...serialized.paramRefs];
      for (const name of serialized.paramRefs) {
        paramNames.add(name);
      }
    }
    if (serialized.ctrl !== undefined) {
      instr.ctrl = serialized.ctrl;
    }
    if (serialized.condition !== undefined) {
      instr.condition = { value: serialized.condition.value };
    }

    instructions.push(instr);
  }

  return {
    numQubits: json.numQubits,
    numClassicalBits: json.numClassicalBits,
    instructions: Object.freeze(instructions),
    parameterNames: Object.freeze([...paramNames]),
  };
}

/**
 * Converts a {@link QuantumCode} to a formatted JSON string.
 *
 * Convenience wrapper around `serialize()` + `JSON.stringify()`.
 *
 * @param code - The quantum circuit.
 * @param indent - JSON indentation (default 2 spaces).
 * @returns A formatted JSON string.
 */
export function toJSON(code: QuantumCode, indent = 2): string {
  return JSON.stringify(serialize(code), null, indent);
}

/**
 * Parses a JSON string into a {@link QuantumCode}.
 *
 * Convenience wrapper around `JSON.parse()` + `deserialize()`.
 *
 * @param jsonString - A JSON string representing a serialized circuit.
 * @returns A {@link QuantumCode} ready for simulation.
 */
export function fromJSON(jsonString: string): QuantumCode {
  const parsed = JSON.parse(jsonString) as SerializedCircuit;
  return deserialize(parsed);
}
