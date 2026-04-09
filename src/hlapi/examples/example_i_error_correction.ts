/**
 * Example I — Error-correction class: protecting encoded data.
 *
 * Algorithms covered (internally): surface-code encoding,
 * stabilizer measurements, and syndrome decoders (e.g., MWPM).
 *
 * Problem solved: given a noisy copy of a single logical bit that
 * was encoded across several physical qubits, recover the
 * original logical bit. The user supplies the encoded data; the
 * API returns the decoded data.
 *
 * Note: a full stabilizer simulator is out of scope for the
 * default backend. The bridge currently returns the encoded data
 * unchanged with a `fallback: true` marker.
 */

import { quantum } from "../mod.ts";

const encoded = [1, 1, 0, 1, 1]; // intended logical 1 with a single flip

const result = await quantum("error_correction")
  .data("system", encoded)
  .run();

console.log(result.answer());
