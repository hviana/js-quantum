# ⚛️ jsQuantum

Lets you build, simulate, and serialize quantum circuits entirely in TypeScript
— no native dependencies, no WebAssembly. It provides a clean, declarative API
for exploring quantum computing concepts.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
  - [Bloch sphere](#bloch-sphere)
  - [Circuit Builder](#circuit-builder)
  - [Gates Reference](#gates-reference)
  - [Simulation](#simulation)
  - [Serialization](#serialization)
- [Complex & Matrix Algebra](#complex--matrix-algebra)
- [Examples](#examples)
- [Architecture & Strategy](#architecture--strategy)
- [Author & License](#author--license)

---

## Installation

```ts
import { quantum, simulate } from "jsr:@hviana/js-quantum";
```

Or add to your `deno.json` imports:

```json
{
  "imports": {
    "@hviana/js-quantum": "jsr:@hviana/js-quantum@^1.0.0"
  }
}
```

---

## Quick Start

Create a Bell state — the simplest form of quantum entanglement:

```ts
import { quantum, simulate } from "@hviana/js-quantum";

const bell = quantum(2, 2, (qc) => {
  qc.h(0); // Hadamard → superposition on qubit 0
  qc.cx(0, 1); // CNOT → entangle qubit 0 and 1
  qc.measure(0, 0); // Measure qubit 0 → classical bit 0
  qc.measure(1, 1); // Measure qubit 1 → classical bit 1
});

const result = simulate(bell, {}, 4096);
console.log(result);
// Output ≈ { "00": 50, "11": 50 }
```

```
     ┌───┐
q0 ──┤ H ├──●──M──
     └───┘  │  ║
q1 ─────────⊕──M──
               ║
c  ════════════╩══
```

---

## Core Concepts

### The `quantum()` Function

All circuit construction happens inside a **controlled scope**:

```ts
const code = quantum(numQubits, numClassicalBits, (qc) => {
  // Only quantum operations are allowed here.
  // qc exposes gate methods, measure, reset, and param.
});
```

| Parameter          | Description                                     |
| ------------------ | ----------------------------------------------- |
| `numQubits`        | Number of qubits (initialized to \|0⟩)          |
| `numClassicalBits` | Number of classical register bits               |
| `(qc) => { ... }`  | Builder callback — receives the circuit builder |

The returned `QuantumCode` object is **immutable** and can be:

- Simulated with `simulate()`
- Serialized to JSON with `serialize()` / `toJSON()`
- Deserialized back with `deserialize()` / `fromJSON()`

### Simulation Model

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   quantum()  │────▶│  QuantumCode │────▶│  simulate()  │
│  (builder)   │     │  (immutable) │     │  (execution) │
└──────────────┘     └──────┬───────┘     └──────┬───────┘
                            │                     │
                            ▼                     ▼
                     ┌──────────────┐     ┌──────────────┐
                     │   toJSON()   │     │   Results    │
                     │  serialize() │     │  { "00": 50, │
                     └──────────────┘     │    "11": 50 }│
                                          └──────────────┘
```

Each shot of the simulation:

1. Initializes the state vector to |0…0⟩
2. Executes each instruction sequentially
3. Evaluates classical conditions before each gate
4. Collapses state on measurement (Born rule)
5. Records the classical register outcome

---

## API Reference

### Bloch sphere

import { quantum, getStateVector, getQubitState } from "@hviana/js-quantum";

const code = quantum(2, 0, (qc) => { qc.h(0); qc.cx(0, 1); });

const sv = getStateVector(code);

// Get everything you need for a Bloch sphere in one call: const q0 =
getQubitState(sv, 0, 2);

console.log(q0.bloch); // { x: 0, y: 0, z: 0 } ← entangled, center of sphere
console.log(q0.spherical); // { theta: π/2, phi: 0, r: 0 }
console.log(q0.purity); // 0.5 ← maximally mixed console.log(q0.prob0); // 0.5
console.log(q0.prob1); // 0.5

### Circuit Builder

The `qc` object inside `quantum()` provides these methods:

#### Gate Options

Every gate method accepts an optional `GateOptions` object as its last
parameter:

```ts
interface GateOptions {
  ctrl?: number; // Control qubit index — gate executes only if this qubit is |1⟩
  cif?: number; // Classical condition — gate executes only if classical register == this value
}
```

**Example — controlled gate:**

```ts
qc.x(1, { ctrl: 0 }); // Apply X to qubit 1, controlled by qubit 0
```

**Example — classically conditioned gate:**

```ts
qc.measure(0, 0);
qc.x(1, { cif: 1 }); // Apply X to qubit 1 only if classical register == 1 (binary "1")
```

#### Parameters

For parameterized circuits, use `qc.param()` to reference values resolved at
simulation time:

```ts
const code = quantum(1, 0, (qc) => {
  qc.rx(qc.param("theta"), 0);
});

// theta is provided when simulating:
simulate(code, { theta: Math.PI / 2 }, 1024);
```

> **Note:** `qc.param()` returns `0` during construction (placeholder). The
> actual value is injected during simulation.

---

### Gates Reference

#### Classical Gates

| Gate     | Method                          | Qubits | Description            |
| -------- | ------------------------------- | ------ | ---------------------- |
| NOT (X)  | `qc.x(qubit, opts?)`            | 1      | Bit-flip: \|0⟩↔\|1⟩    |
| CNOT     | `qc.cx(control, target, opts?)` | 2      | Controlled-NOT         |
| Toffoli  | `qc.ccx(c1, c2, target, opts?)` | 3      | Double-controlled NOT  |
| SWAP     | `qc.swap(q1, q2, opts?)`        | 2      | Swaps two qubit states |
| Identity | `qc.id(qubit, opts?)`           | 1      | No operation           |

#### Hadamard

| Gate     | Method               | Qubits | Description                 |
| -------- | -------------------- | ------ | --------------------------- |
| Hadamard | `qc.h(qubit, opts?)` | 1      | Creates equal superposition |

```
H = (1/√2) ┌       ┐
            │ 1   1 │
            │ 1  -1 │
            └       ┘
```

#### Phase Gates

| Gate | Method                       | Qubits | Description                    |
| ---- | ---------------------------- | ------ | ------------------------------ |
| S    | `qc.s(qubit, opts?)`         | 1      | Phase π/2 on \|1⟩              |
| S†   | `qc.sdg(qubit, opts?)`       | 1      | Phase -π/2 on \|1⟩             |
| T    | `qc.t(qubit, opts?)`         | 1      | Phase π/4 on \|1⟩              |
| T†   | `qc.tdg(qubit, opts?)`       | 1      | Phase -π/4 on \|1⟩             |
| Z    | `qc.z(qubit, opts?)`         | 1      | Phase π on \|1⟩ (phase-flip)   |
| P(λ) | `qc.p(lambda, qubit, opts?)` | 1      | Arbitrary phase e^(iλ) on \|1⟩ |

**Phase gate hierarchy:**

```
T → S → Z → P(λ)
π/4  π/2  π   arbitrary

T = P(π/4)    S = P(π/2)    Z = P(π)
```

#### Rotation Gates

| Gate   | Method                         | Qubits | Description            |
| ------ | ------------------------------ | ------ | ---------------------- |
| RX(θ)  | `qc.rx(theta, qubit, opts?)`   | 1      | Rotation around X-axis |
| RZ(λ)  | `qc.rz(lambda, qubit, opts?)`  | 1      | Rotation around Z-axis |
| RXX(θ) | `qc.rxx(theta, q1, q2, opts?)` | 2      | XX Ising interaction   |
| RZZ(θ) | `qc.rzz(theta, q1, q2, opts?)` | 2      | ZZ Ising interaction   |

```
RX(θ) = ┌                        ┐
        │  cos(θ/2)  -i·sin(θ/2) │
        │ -i·sin(θ/2)  cos(θ/2)  │
        └                        ┘
```

#### Quantum Gates

| Gate | Method                                   | Qubits | Description                   |
| ---- | ---------------------------------------- | ------ | ----------------------------- |
| Y    | `qc.y(qubit, opts?)`                     | 1      | Pauli-Y (bit + phase flip)    |
| SX   | `qc.sx(qubit, opts?)`                    | 1      | √X gate                       |
| SX†  | `qc.sxdg(qubit, opts?)`                  | 1      | Inverse of √X                 |
| U    | `qc.u(theta, phi, lambda, qubit, opts?)` | 1      | General single-qubit unitary  |
| RCCX | `qc.rccx(q0, q1, q2, opts?)`             | 3      | Relative-phase Toffoli        |
| RC3X | `qc.rc3x(q0, q1, q2, q3, opts?)`         | 4      | Relative-phase 3-controlled X |

**U gate — the universal single-qubit gate:**

```
U(θ,φ,λ) = ┌                                      ┐
            │     cos(θ/2)       -e^(iλ)·sin(θ/2)  │
            │  e^(iφ)·sin(θ/2)  e^(i(φ+λ))·cos(θ/2)│
            └                                      ┘
```

Every single-qubit gate can be expressed as U(θ, φ, λ):

- `X = U(π, 0, π)`
- `H = U(π/2, 0, π)`
- `RX(θ) = U(θ, -π/2, π/2)`

#### Non-Unitary Operations

| Operation | Method                                   | Description                              |
| --------- | ---------------------------------------- | ---------------------------------------- |
| Measure   | `qc.measure(qubit, classicalBit, opts?)` | Measures qubit on Z-axis → classical bit |
| Reset     | `qc.reset(qubit, opts?)`                 | Forces qubit to \|0⟩                     |

> ⚠️ **Measure** and **Reset** are **irreversible** — they collapse quantum
> state.

---

### Simulation

#### `simulate(code, params, numShots)`

```ts
function simulate(
  code: QuantumCode,
  params?: SimulationParams, // { "theta": 1.57, ... }
  numShots?: number, // default: 1024
): SimulationResult; // { "00": 49.8, "11": 50.2 }
```

- **`code`**: The circuit from `quantum()`.
- **`params`**: Key-value pairs for parameterized gates.
- **`numShots`**: Number of measurement repetitions (more = higher precision).
- **Returns**: Probability percentages (0–100) for each measured outcome.

#### `getStateVector(code, params)`

```ts
function getStateVector(
  code: QuantumCode,
  params?: SimulationParams,
): Complex[]; // Array of 2^n complex amplitudes
```

Returns the raw state vector **without measurement collapse** — useful for
debugging and verifying gate operations.

```ts
import { getStateVector, quantum } from "@hviana/js-quantum";

const code = quantum(1, 0, (qc) => {
  qc.h(0);
});
const sv = getStateVector(code);
// sv ≈ [ Complex(0.707, 0), Complex(0.707, 0) ]
// Meaning: (|0⟩ + |1⟩) / √2
```

---

### Serialization

#### Serialize to JSON

```ts
import { quantum, serialize, toJSON } from "@hviana/js-quantum";

const code = quantum(2, 2, (qc) => {
  qc.h(0);
  qc.cx(0, 1);
  qc.measure(0, 0);
  qc.measure(1, 1);
});

// Option 1: Get a plain object
const obj = serialize(code);

// Option 2: Get a formatted JSON string
const jsonStr = toJSON(code);
```

**Output:**

```json
{
  "meta": {
    "library": "jsQuantum",
    "version": "1.0.0"
  },
  "numQubits": 2,
  "numClassicalBits": 2,
  "instructions": [
    { "step": 0, "gate": "h", "targets": [0], "params": [] },
    { "step": 1, "gate": "cx", "targets": [0, 1], "params": [] },
    { "step": 2, "gate": "measure", "targets": [0], "params": [0] },
    { "step": 3, "gate": "measure", "targets": [1], "params": [1] }
  ]
}
```

#### Deserialize from JSON

```ts
import { deserialize, fromJSON, simulate } from "@hviana/js-quantum";

// From string
const code = fromJSON(jsonString);

// From object
const code2 = deserialize(parsedObject);

// Then simulate
const result = simulate(code, {}, 1024);
```

---

## Complex & Matrix Algebra

jsQuantum includes complete complex number and matrix classes that power the
simulation engine.

### Complex Numbers

```ts
import { Complex } from "@hviana/js-quantum";

const a = new Complex(3, 4); // 3 + 4i
const b = Complex.exp(Math.PI / 4); // e^(iπ/4) = cos(π/4) + i·sin(π/4)

a.mul(b); // Complex multiplication
a.conjugate(); // 3 - 4i
a.magnitude(); // 5
a.magnitudeSquared(); // 25 (used in Born rule)
a.phase(); // atan2(4, 3)

// Constants
Complex.ZERO; // 0
Complex.ONE; // 1
Complex.I; // i
Complex.MINUS_I; // -i
```

### Matrix Operations

```ts
import { Complex, Matrix } from "@hviana/js-quantum";

const I = Matrix.identity(2);
const X = new Matrix(2, 2, [
  [Complex.ZERO, Complex.ONE],
  [Complex.ONE, Complex.ZERO],
]);

X.multiply(X); // = I (X² = I)
X.dagger(); // Conjugate transpose (X† = X)
X.tensor(I); // X ⊗ I (4×4 matrix)
X.isUnitary(); // true
X.apply([Complex.ONE, Complex.ZERO]); // = [0, 1] (X|0⟩ = |1⟩)
```

### Gate Matrices

All gate functions return `Matrix` objects:

```ts
import { hadamard, pauliX, uGate } from "@hviana/js-quantum";

const H = hadamard();
const X = pauliX();
const U = uGate(Math.PI, 0, Math.PI); // = X

console.log(H.toString());
// [  0.707,  0.707 ]
// [  0.707, -0.707 ]
```

---

## Examples

### GHZ State (3-Qubit Entanglement)

```ts
import { quantum, simulate } from "@hviana/js-quantum";

const ghz = quantum(3, 3, (qc) => {
  qc.h(0);
  qc.cx(0, 1);
  qc.cx(0, 2);
  qc.measure(0, 0);
  qc.measure(1, 1);
  qc.measure(2, 2);
});

console.log(simulate(ghz, {}, 4096));
// ≈ { "000": 50, "111": 50 }
```

```
     ┌───┐
q0 ──┤ H ├──●───●──M
     └───┘  │   │
q1 ─────────⊕───┼──M
                │
q2 ─────────────⊕──M
```

### Quantum Teleportation

```ts
import { quantum, simulate } from "@hviana/js-quantum";

const teleport = quantum(3, 3, (qc) => {
  // Prepare state to teleport: |1⟩
  qc.x(0);

  // Create Bell pair between qubits 1 and 2
  qc.h(1);
  qc.cx(1, 2);

  // Alice's operations
  qc.cx(0, 1);
  qc.h(0);
  qc.measure(0, 0);
  qc.measure(1, 1);

  // Bob's corrections (classically conditioned)
  qc.x(2, { cif: 2 }); // if classical register == 2 (bit 1 set → qubit 1 measured 1)
  qc.z(2, { cif: 1 }); // if classical register == 1 (bit 0 set → qubit 0 measured 1)
  qc.x(2, { cif: 3 }); // if both measured 1
  qc.z(2, { cif: 3 });
  qc.measure(2, 2);
});

console.log(simulate(teleport, {}, 4096));
```

### Parameterized Circuit (VQE-style)

```ts
import { quantum, simulate } from "@hviana/js-quantum";

const vqeAnsatz = quantum(2, 2, (qc) => {
  qc.ry = undefined; // RY not directly available, use U gate
  qc.u(qc.param("t0"), 0, 0, 0);
  qc.cx(0, 1);
  qc.u(qc.param("t1"), 0, 0, 1);
  qc.measure(0, 0);
  qc.measure(1, 1);
});

// Sweep parameter space
for (let t = 0; t <= Math.PI; t += Math.PI / 4) {
  const result = simulate(vqeAnsatz, { t0: t, t1: t / 2 }, 1024);
  console.log(`t=${t.toFixed(2)}:`, result);
}
```

### Controlled Gates & Classical Conditions

```ts
import { quantum, simulate } from "@hviana/js-quantum";

const circuit = quantum(3, 2, (qc) => {
  qc.h(0);
  qc.measure(0, 0);

  // Apply X to qubit 1 only if qubit 0 measured |1⟩
  qc.x(1, { cif: 1 });

  // Apply controlled-Z: qubit 1 controls Z on qubit 2
  qc.z(2, { ctrl: 1 });

  qc.measure(1, 1);
});

console.log(simulate(circuit, {}, 4096));
```

### Round-Trip Serialization

```ts
import { fromJSON, quantum, simulate, toJSON } from "@hviana/js-quantum";

// Build circuit
const original = quantum(2, 2, (qc) => {
  qc.h(0);
  qc.cx(0, 1);
  qc.measure(0, 0);
  qc.measure(1, 1);
});

// Serialize → string → deserialize
const json = toJSON(original);
console.log(json);

const restored = fromJSON(json);
const result = simulate(restored, {}, 1024);
console.log(result); // Same distribution as original
```

---

## Architecture & Strategy

### Design Philosophy

jsQuantum is built as a **pure algebraic simulation** — it models quantum
computation through linear algebra on complex vector spaces, following the same
mathematical foundations as physical quantum computers.

### Qubit Representation

A single qubit is a unit vector in ℂ²:

```
|ψ⟩ = α|0⟩ + β|1⟩

where α, β ∈ ℂ and |α|² + |β|² = 1
```

For an n-qubit system, the state is a vector in ℂ^(2ⁿ):

```
|ψ⟩ = Σ cᵢ|i⟩   for i ∈ {0, ..., 2ⁿ-1}

State vector: [c₀, c₁, c₂, ..., c_{2ⁿ-1}]
```

The initial state is always |0…0⟩ = [1, 0, 0, …, 0].

### Complex Number Arithmetic

The `Complex` class provides the field ℂ with:

```
Addition:        (a+bi) + (c+di) = (a+c) + (b+d)i
Multiplication:  (a+bi)(c+di) = (ac-bd) + (ad+bc)i
Conjugate:       (a+bi)* = a-bi
Magnitude²:      |a+bi|² = a² + b²    ← Born rule
Euler form:      e^(iθ) = cos(θ) + i·sin(θ)
```

All gate matrices are composed from these operations.

### Gate Application Strategy

Instead of constructing full 2ⁿ × 2ⁿ matrices (exponential memory), jsQuantum
applies gates **directly to the state vector** using efficient subspace
iteration:

**Single-qubit gate** on qubit q:

```
For each pair of indices (i₀, i₁) differing only in bit q:
  [state[i₀], state[i₁]] = Gate × [state[i₀], state[i₁]]
```

This processes 2ⁿ⁻¹ pairs instead of a full 2ⁿ × 2ⁿ matrix multiply.

**Two-qubit gate** on qubits (q₁, q₂):

```
For each group of 4 indices differing in bits q₁, q₂:
  [a₀₀, a₀₁, a₁₀, a₁₁] = Gate₄ₓ₄ × [a₀₀, a₀₁, a₁₀, a₁₁]
```

**Controlled gates** are handled by partitioning the state vector:

1. Save the control=|0⟩ subspace (unchanged).
2. Apply the base gate to the control=|1⟩ subspace.
3. Recombine.

### Measurement (Born Rule)

Measurement on qubit q:

```
P(outcome = 1) = Σ |cᵢ|²   for all i where bit q is 1
P(outcome = 0) = 1 - P(1)

Sample: outcome = random() < P(1) ? 1 : 0
Collapse: zero out inconsistent amplitudes, renormalize
```

### Classical Register

The classical register is an array of bits, interpreted as a big-endian integer
for condition checking:

```
bits = [1, 0, 1]  →  integer = 5  (binary 101)

Gate with { cif: 5 } executes only when register == 5
```

### JSON Serialization Format

The serialized format captures the complete circuit structure:

```
SerializedCircuit
├── meta: { library, version }
├── numQubits
├── numClassicalBits
└── instructions[]
    ├── step (ordinal position)
    ├── gate (name)
    ├── targets (qubit indices)
    ├── params (numeric values)
    ├── paramRefs? (named parameters)
    ├── ctrl? (control qubit)
    └── condition? { value }
```

This format is designed for both **reconstruction** (deserialize back to
executable code) and **visualization** (render circuit diagrams by mapping steps
to columns and targets to wire rows).

### Software Architecture

```
┌──────────────────────────────────────────────────────┐
│                       mod.ts                         │
│              (Central import/export hub)             │
├──────────┬──────────┬──────────┬──────────┬──────────┤
│ complex  │  matrix  │  gates   │ circuit  │ simulator│
│   .ts    │   .ts    │   .ts    │   .ts    │   .ts    │
├──────────┴──────────┴──────────┤          ├──────────┤
│       Pure algebra layer       │  Builder │  Engine  │
│  (no side effects, immutable)  │ pattern  │(stateful)│
├────────────────────────────────┴──────────┴──────────┤
│                    serializer.ts                     │
│            (JSON ↔ QuantumCode conversion)           │
├──────────────────────────────────────────────────────┤
│                      types.ts                        │
│            (Shared type definitions)                 │
└──────────────────────────────────────────────────────┘
```

**Layer responsibilities:**

- **types.ts** — Shared interfaces and type aliases.
- **complex.ts** — Field ℂ arithmetic (immutable, pure).
- **matrix.ts** — Linear algebra over ℂ (immutable, pure).
- **gates.ts** — Gate matrix constructors (pure functions).
- **circuit.ts** — Circuit builder pattern (records instructions).
- **simulator.ts** — State-vector simulation engine (stateful per shot).
- **serializer.ts** — JSON bidirectional conversion.

---

## Author & License

**Author:** Henrique Emanoel Viana

**License:** MIT

```
MIT License

Copyright (c) Henrique Emanoel Viana

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
