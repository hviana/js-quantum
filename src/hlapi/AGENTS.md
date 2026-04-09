# HLAPI conventions

## Qubit ordering: MSB-first

All code in this directory must use **MSB-first** qubit ordering. This means:

- For an `m`-qubit gate applied to qubits `[q0, q1, ..., q_{m-1}]`, qubit `q0`
  is the **most-significant bit** of the gate matrix index. This is enforced by
  the simulator's `applyGateInPlace`, which maps `targets[0]` to the MSB of the
  gate-local index.

### Integer-to-qubit encoding

When encoding an integer `x` across `n` qubits `[0, 1, ..., n-1]`:

```
qubit i carries bit (n - 1 - i) of x
```

Equivalently: `qubit_value[i] = (x >> (n - 1 - i)) & 1`.

Use `intToBits(x, n)` when you need the full bit array; it already follows this
convention.

### Measurement mapping

Measurements must map qubit `i` to classical bit `n - 1 - i`:

```ts
for (let i = 0; i < n; i++) {
  qc.measure(i, { registerName: "c", bitIndex: n - 1 - i });
}
```

This places qubit 0 (MSB) at the leftmost position of the bitstring, so
`parseInt(bitstring, 2)` directly recovers the encoded integer with no reversal
needed.

### Diagonal gates

When building a diagonal gate on qubits `[0, ..., n-1]`, gate-local index `k`
corresponds to the computational basis state where qubit `i` has value
`(k >> (n - 1 - i)) & 1`. Use `intToBits(k, n)` to get the bit array:

```ts
for (let k = 0; k < dim; k++) {
  phases[k] = -gamma * cost(intToBits(k, n));
}
```

### What to avoid

- **No LSB-first patterns.** Never use `(x >> i) & 1` to map bit `i` of integer
  `x` onto qubit `i`. That is LSB-first and will silently produce incorrect
  internal states even if the round-trip measurement happens to recover the
  right integer.
- **No `bitReverse`.** If you find yourself needing `bitReverse` to fix a
  diagonal gate or measurement, the qubit mapping is wrong.
- **No mixed conventions.** Classical evaluation functions (cost functions,
  expectation values) and circuit builders must use the same bit ordering. A
  mismatch means the circuit optimizes a different landscape than the evaluator
  scores.
