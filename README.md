<div align="center">

# ⚛️ `js-quantum`

### _A complete, Quantum Computing SDK for TypeScript_

**Real state-vector simulator · OpenQASM 3.1 transpiler · IBM Quantum & qBraid
backends** _Built from scratch on Web Standards — zero native dependencies._

### 🎮 [**Try the interactive simulator in your browser →**](https://hviana.github.io/js-quantum/)

</div>

---

> [!TIP]
> **New to quantum computing?** Jump straight to the
> [**High-Level API**](#-high-level-api-the-didactic-tour) — you pass plain
> JavaScript arrays, numbers and functions, pick an English verb (`find`,
> `minimize`, `simulate`, …), and get the decoded answer back. No
> quantum-computing vocabulary required.

> [!NOTE]
> **Looking for fine control?** The
> [**Low-Level API**](#%EF%B8%8F-building-circuits-the-didactic-tour) gives you
> a full OpenQASM 3.1–compatible circuit builder with 80+ gates across 14 tiers,
> classical control flow, parameter binding, and a custom state-vector
> simulator.

---

## 📚 Table of Contents

| Section                                                                                  | Description                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [🚀 Installation](#-installation)                                                        | Get started in one line                          |
| [⚡ Quick Start](#-quick-start-your-first-bell-state)                                    | Your first Bell state                            |
| [🧱 Core Concepts](#-core-concepts)                                                      | Qubits, gates, measurement                       |
| [🛠️ Building Circuits — Didactic Tour](#%EF%B8%8F-building-circuits-the-didactic-tour)   | From superposition to Shor-style building blocks |
| [🔀 Classical Control Flow & Expansion API](#-classical-control-flow--the-expansion-api) | `if`, `for`, `while`, `switch`, assignments      |
| [🔬 Simulation & Inspection](#-simulation--inspection)                                   | State vectors, probabilities, Bloch              |
| [☁️ Backends](#%EF%B8%8F-backends--simulator-ibm-qbraid-openqasm)                        | Simulator · IBM · qBraid · OpenQASM              |
| [📖 API Reference](#-api-reference)                                                      | Every public symbol with a short explanation     |
| [✨ High-Level API — Didactic Tour](#-high-level-api-the-didactic-tour)                  | Plain-JS inputs, English verbs, decoded answers  |
| [🏗️ Architecture](#%EF%B8%8F-architecture)                                               | Internal layering                                |
| [📜 License](#-license)                                                                  | MIT                                              |

---

## 🚀 Installation

<table>
<tr>
<td width="50%">

**From JSR (recommended)**

```ts
import { QuantumCircuit, SimulatorBackend } from "jsr:@hviana/js-quantum";
```

</td>
<td width="50%">

**Local development**

```bash
git clone <repo>
cd js-quantum
deno test --allow-env
```

</td>
</tr>
</table>

> [!IMPORTANT]
> `js-quantum` is a **pure-TypeScript Deno module** using only Web Standards. It
> runs on Deno, in modern browsers, and is publishable on JSR. No `numpy`, no
> BLAS, no native bindings.

---

## ⚡ Quick Start: Your First Bell State

A Bell state is the simplest two-qubit entangled state — think of it as two
quantum coins that always land on the same face.

```ts
import { QuantumCircuit, SimulatorBackend } from "jsr:@hviana/js-quantum";

// 1️⃣  Build the circuit
const qc = new QuantumCircuit();
qc.h(0) // put qubit 0 into superposition
  .cx(0, 1); // entangle qubit 1 with qubit 0

// 2️⃣  Add a classical register to store measurement outcomes
qc.addClassicalRegister("c", 2);
qc.measure(0, { registerName: "c", bitIndex: 0 });
qc.measure(1, { registerName: "c", bitIndex: 1 });

// 3️⃣  Simulate with 1024 shots
const sim = new SimulatorBackend();
const result = sim.execute(sim.transpileAndPackage(qc, 1024));

console.log(result);
// → { "00": ~50, "11": ~50 }
//   Never "01" or "10" — the qubits are perfectly correlated. ✨
```

> [!TIP]
> **Reading results.** Every backend returns a plain object mapping **bitstrings
> → percentages (summing to 100)**. The bitstring reads **most-significant bit
> on the left**, so `"10"` means _"classical bit 1 is set, classical bit 0 is
> clear"_.

---

## 🧱 Core Concepts

<table>
<tr>
<th>Concept</th><th>In one sentence</th><th>In js-quantum</th>
</tr>
<tr>
<td>🔹 <b>Qubit</b></td>
<td>The quantum version of a bit — can be <code>0</code>, <code>1</code>, or a superposition of both.</td>
<td>Addressed by an integer index: <code>0, 1, 2, …</code></td>
</tr>
<tr>
<td>🔸 <b>Gate</b></td>
<td>A reversible operation that rotates qubits.</td>
<td><code>qc.h(0)</code>, <code>qc.cx(0, 1)</code>, <code>qc.rx(θ, 0)</code>, …</td>
</tr>
<tr>
<td>🧪 <b>Measurement</b></td>
<td>Collapses a qubit to <code>0</code> or <code>1</code> and writes it to a classical bit.</td>
<td><code>qc.measure(qubit, { registerName, bitIndex })</code></td>
</tr>
<tr>
<td>💾 <b>Classical register</b></td>
<td>A named array of classical bits that measurements are written into.</td>
<td><code>qc.addClassicalRegister("c", n)</code></td>
</tr>
<tr>
<td>🎲 <b>Shots</b></td>
<td>How many times the circuit is run end-to-end when sampling.</td>
<td>Second argument to <code>transpileAndPackage(qc, shots)</code></td>
</tr>
<tr>
<td>📐 <b>Parameter</b></td>
<td>A symbolic angle you bind to a number later.</td>
<td><code>AngleExpr.symbol("θ")</code> → <code>qc.run({ θ: Math.PI/3 })</code></td>
</tr>
</table>

> [!NOTE]
> **Qubit ordering.** For an `m`-qubit gate, the _first_ qubit argument
> corresponds to the **most-significant** local matrix bit. When comparing
> printed bitstrings against Qiskit, remember that Qiskit prints qubit `n − 1`
> on the **left** — so a state that reads `|10⟩` in `js-quantum` may print as
> `|01⟩` there. The **amplitudes, probabilities, and distributions are
> identical**; only the string rendering differs.

---

## 🛠️ Building Circuits — The Didactic Tour

Each example below is complete and runnable. They progress from "the smallest
possible quantum effect" to richer compositions using the Expansion API.

<details>
<summary><b>🟢 1 · Single qubit in superposition</b> — the Hello World of quantum</summary>

```ts
import { QuantumCircuit, SimulatorBackend } from "jsr:@hviana/js-quantum";

const qc = new QuantumCircuit();
qc.h(0); // 50/50 superposition
qc.addClassicalRegister("c", 1);
qc.measure(0, { registerName: "c", bitIndex: 0 });

const sim = new SimulatorBackend();
console.log(sim.execute(sim.transpileAndPackage(qc, 1024)));
// → { "0": ~50, "1": ~50 }
```

`h` (Hadamard) is _the_ gate that creates equal superpositions of `|0⟩` and
`|1⟩`.

</details>

<details>
<summary><b>🟢 2 · GHZ state</b> — three-qubit entanglement</summary>

```ts
const qc = new QuantumCircuit();
qc.h(0).cx(0, 1).cx(0, 2); // |000⟩ + |111⟩  (unnormalized)
qc.addClassicalRegister("c", 3);
qc.measure(0, { registerName: "c", bitIndex: 0 });
qc.measure(1, { registerName: "c", bitIndex: 1 });
qc.measure(2, { registerName: "c", bitIndex: 2 });

console.log(new SimulatorBackend().execute(sim.transpileAndPackage(qc, 1024)));
// → { "000": ~50, "111": ~50 }
```

</details>

<details>
<summary><b>🟡 3 · Parameterized circuit with symbolic binding</b></summary>

```ts
import {
  AngleExpr,
  QuantumCircuit,
  SimulatorBackend,
} from "jsr:@hviana/js-quantum";

const theta = AngleExpr.symbol("theta");
const qc = new QuantumCircuit();
qc.rx(theta, 0); // rotation around the X axis
qc.addClassicalRegister("c", 1);
qc.measure(0, { registerName: "c", bitIndex: 0 });

// Bind the symbol to a concrete angle at run time
const bound = qc.run({ theta: Math.PI / 3 });
console.log(new SimulatorBackend().execute(
  new SimulatorBackend().transpileAndPackage(bound, 1024),
));
```

> 💡 Use `AngleExpr` when you want to **build the circuit once and sweep
> parameters** — ideal for variational algorithms.

</details>

<details>
<summary><b>🟡 4 · Circuit composition, inverses, and reuse</b></summary>

```ts
// Build a reusable Bell-preparation block
const bell = new QuantumCircuit();
bell.h(0).cx(0, 1);

const unBell = bell.inverse(); // uncomputation

const qc = new QuantumCircuit();
qc.compose(bell); // prepare
// … do something with the entangled pair …
qc.compose(unBell); // undo (uncompute)
```

</details>

<details>
<summary><b>🟠 5 · Gate modifiers: inv · pow · ctrl · negctrl</b></summary>

```ts
const qc = new QuantumCircuit();
qc.ctrl(1, "x", [0, 1]); // 1-controlled X (== CX)
qc.inv("s", [0]); // S†
qc.pow(3, "x", [0]); // X³ = X
qc.negctrl(1, "h", [2, 3]); // H on qubit 3, triggered when qubit 2 = 0
```

</details>

<details>
<summary><b>🔴 6 · Custom gate definition</b></summary>

```ts
const body = new QuantumCircuit();
body.applyGate({ name: "h", qubits: [0] });
body.applyGate({ name: "z", qubits: [0] });
body.applyGate({ name: "h", qubits: [0] });

const qc = new QuantumCircuit();
qc.defineGate("hzh", /* params */ [], /* qubit args */ ["q"], body);
// "hzh" is now callable by name like any built-in gate.
```

</details>

<details>
<summary><b>🔴 7 · QFT and a modular adder</b></summary>

```ts
// Quantum Fourier Transform on three qubits
const qft = new QuantumCircuit();
qft.qft([0, 1, 2]);

// Modular adder: set a=1, b=2, then add in place
const add = new QuantumCircuit();
add.x(0); // a[0] = 1
add.x(3); // b[1] = 1
add.modularAdder([0, 1], [2, 3]); // b ← (a + b) mod 4
```

</details>

---

## 🔀 Classical Control Flow — The Expansion API

This is the single most powerful — and at first glance, most intimidating — part
of `js-quantum`. It lets a running circuit **branch, loop, and update classical
variables based on mid-circuit measurements**, exactly like OpenQASM 3.1.

Methods like `ifTest`, `forLoop`, `whileLoop`, and `switch` do **not** take
plain JavaScript conditions. They take **tagged-union IR nodes** — small plain
objects with a `kind` field that describes an OpenQASM-level classical
expression.

> [!TIP]
> **You have two equivalent options** for building these nodes:
>
> 1. **Write the object literal by hand** — explicit, verbose, copy-paste
>    friendly.
> 2. **Use the `Expr` factory** from `"jsr:@hviana/js-quantum"` — short, typed,
>    recommended for anything non-trivial.
>
> Both produce identical output.

### 🧩 The four expression literals you will see most

```ts
// Integer literal                           Identifier (variable reference)
{ kind: "int-literal", value: 0 }             { kind: "identifier", name: "c" }

// Boolean literal                           Binary operator
{ kind: "bool-literal", value: true }         { kind: "binary", op: "==",
                                                left:  { kind: "identifier", name: "c" },
                                                right: { kind: "int-literal", value: 1 } }

// Range  (used by `for`)                    Bitstring literal
{ kind: "range",
  start: { kind: "int-literal", value: 0 },
  end:   { kind: "int-literal", value: 3 } }  { kind: "bitstring-literal", value: "1010" }
```

The same tree written using `Expr`:

```ts
import { Expr } from "jsr:@hviana/js-quantum";

Expr.int(0); // int literal
Expr.ref("c"); // identifier
Expr.bool(true); // bool literal
Expr.binary("==", Expr.ref("c"), Expr.int(1)); // c == 1
Expr.range(Expr.int(0), undefined, Expr.int(3)); // 0..3
Expr.bitstring("1010"); // "1010"
```

### Example 1 — 🔁 `ifTest`: quantum error correction via feedback

Perform a correction gate on a target qubit _only if_ a measurement of the
control qubit returned `1`.

```ts
import { Expr, QuantumCircuit, SimulatorBackend } from "jsr:@hviana/js-quantum";

const qc = new QuantumCircuit();
qc.addClassicalRegister("c", 1);

// Prepare + measure qubit 0 into classical bit c[0]
qc.h(0);
qc.measure(0, { registerName: "c", bitIndex: 0 });

// The conditional body lives in its own sub-circuit
const correction = new QuantumCircuit();
correction.x(1); // flip qubit 1

// if (c == 1) { x(1); }
qc.ifTest(
  Expr.binary("==", Expr.ref("c"), Expr.int(1)),
  correction,
);
```

The exact same thing, written without the `Expr` helper — **functionally
identical**:

```ts
qc.ifTest(
  {
    kind: "binary",
    op: "==",
    left: { kind: "identifier", name: "c" },
    right: { kind: "int-literal", value: 1 },
  },
  correction,
);
```

### Example 2 — 🔁 `ifTest` with `else` branch

```ts
const ifTrue = new QuantumCircuit();
ifTrue.x(1);
const ifFalse = new QuantumCircuit();
ifFalse.z(1);

qc.ifTest(
  Expr.binary("!=", Expr.ref("c"), Expr.int(0)), // c != 0
  ifTrue,
  ifFalse,
);
```

### Example 3 — 🔁 Comparing a register against a bitstring

```ts
qc.ifTest(
  Expr.binary("==", Expr.ref("c"), Expr.bitstring("101")),
  correction,
);
```

### Example 4 — 🔄 `forLoop`: repeated Trotter layers

Apply the same entangling layer **three times** — useful for Trotterized
Hamiltonian evolution, QAOA layers, and variational ansätze.

```ts
const layer = new QuantumCircuit();
layer.h(0);
layer.cx(0, 1);
layer.rz(0.3, 1);

const qc = new QuantumCircuit();
qc.forLoop(
  "i", // loop variable name
  Expr.range(Expr.int(0), undefined, Expr.int(3)), // for i in 0..3
  layer, // body
);
```

Raw equivalent:

```ts
qc.forLoop("i", {
  kind: "range",
  start: { kind: "int-literal", value: 0 },
  end: { kind: "int-literal", value: 3 },
}, layer);
```

### Example 5 — 🔄 `forLoop` over an explicit set of indices

```ts
qc.forLoop(
  "j",
  Expr.set([Expr.int(0), Expr.int(2), Expr.int(4)]), // for j in {0, 2, 4}
  layer,
);
```

### Example 6 — ♾️ `whileLoop`: repeat until success

A classic "repeat-until-success" pattern used in magic state distillation: keep
running a Heralded procedure while a classical flag `ok` is still `0`.

```ts
const qc = new QuantumCircuit();
qc.addClassicalRegister("ok", 1);

const attempt = new QuantumCircuit();
attempt.h(0);
attempt.measure(0, { registerName: "ok", bitIndex: 0 });

// while (ok == 0) { attempt(); }
qc.whileLoop(
  Expr.binary("==", Expr.ref("ok"), Expr.int(0)),
  attempt,
);
```

### Example 7 — 🎛️ `switch`: dispatch on a syndrome

A three-qubit code measures a 2-bit syndrome and applies a different correction
for each possible value.

```ts
const corr00 = new QuantumCircuit(); /* no correction */
const corr01 = new QuantumCircuit();
corr01.x(0);
const corr10 = new QuantumCircuit();
corr10.x(1);
const corr11 = new QuantumCircuit();
corr11.x(2);

qc.switch(
  Expr.ref("syndrome"), // subject
  [
    { values: [Expr.int(0)], body: corr00 }, // case 0
    { values: [Expr.int(1)], body: corr01 }, // case 1
    { values: [Expr.int(2)], body: corr10 }, // case 2
    { values: [Expr.int(3)], body: corr11 }, // case 3
  ],
);
```

Note that each `values` entry is an **array** — a single case can cover multiple
values, exactly like OpenQASM 3.1.

### Example 8 — 🔢 Classical assignment and arithmetic

Declare a classical integer, initialize it, and mutate it inside a loop.

```ts
import { Expr, QuantumCircuit } from "jsr:@hviana/js-quantum";

const qc = new QuantumCircuit();

// int counter = 0;
qc.declareClassicalVar("counter", { kind: "int", width: 32 }, Expr.int(0));

const body = new QuantumCircuit();
// counter += 1;
body.classicalAssignOp(Expr.ref("counter"), "+=", Expr.int(1));

qc.forLoop("i", Expr.range(Expr.int(0), undefined, Expr.int(10)), body);
```

### Example 9 — 🧮 Nested: `for` inside `if`

A classical-conditional warm-up followed by a repeated entangling layer:

```ts
const innerLoop = new QuantumCircuit();
innerLoop.forLoop(
  "k",
  Expr.range(Expr.int(0), undefined, Expr.int(5)),
  layer,
);

qc.ifTest(
  Expr.binary(">", Expr.ref("counter"), Expr.int(0)), // counter > 0
  innerLoop,
);
```

### Example 10 — 🧠 Complex boolean expressions

```ts
// (c == 1) && (counter < 5)
const cond = Expr.binary(
  "&&",
  Expr.binary("==", Expr.ref("c"), Expr.int(1)),
  Expr.binary("<", Expr.ref("counter"), Expr.int(5)),
);

qc.ifTest(cond, correction);
```

> [!TIP]
> **Mental model.** Anywhere you'd write a classical expression in OpenQASM 3.1
> — whether it's a condition, a loop bound, a switch subject, an assignment
> target, or a function argument — you're building a tree of these small
> `{ kind: "..." }` nodes. The leaves are literals (`int-literal`,
> `float-literal`, `bool-literal`, `bitstring-literal`, `identifier`) and the
> interior nodes are operators (`unary`, `binary`, `range`, `call`, `cast`, …).
> The `Expr` factory just makes the trees shorter to write.

---

## 🔬 Simulation & Inspection

### Exact state vector (unitary-only circuits)

```ts
import { QuantumCircuit, SimulatorBackend } from "jsr:@hviana/js-quantum";

const qc = new QuantumCircuit();
qc.h(0).cx(0, 1);

const state = new SimulatorBackend().getStateVector(qc);
// state[0] = 1/√2, state[3] = 1/√2  →  the Bell state (|00⟩ + |11⟩)/√2
```

### Sampling the measurement distribution

```ts
const sim = new SimulatorBackend();
const hist = sim.execute(sim.transpileAndPackage(qc, 4096));
// → { "00": ~50, "11": ~50 }   bitstrings → percentages
```

### Bloch sphere visualization

```ts
import { blochOfCircuit } from "jsr:@hviana/js-quantum";

const qc = new QuantumCircuit();
qc.h(0);
console.log(blochOfCircuit(qc, 0));
// → { x: 1, y: 0, z: 0, theta: π/2, phi: 0, r: 1 }
```

---

## ☁️ Backends — Simulator, IBM, qBraid, OpenQASM

Every backend implements the same tiny interface:
`transpileAndPackage(circuit, shots?)` → `execute(...)` → `ExecutionResult` (a
`Record<string, number>` of bitstring → percentage).

### 🖥️ `SimulatorBackend` — local, noiseless, fast

```ts
const sim = new SimulatorBackend({ defaultShots: 2048 });
const result = sim.execute(sim.transpileAndPackage(qc));
```

Uses **subspace iteration** — never materializes the full `2ⁿ × 2ⁿ` matrix.

### 🛰️ `IBMBackend` — IBM Quantum hardware via Sampler V2

```ts
import { IBMBackend } from "jsr:@hviana/js-quantum";

const ibm = new IBMBackend({
  name: "ibm_brisbane",
  numQubits: 127,
  basisGates: ["id", "rz", "sx", "x", "ecr"],
  couplingMap: null, // or the device's coupling map
  serviceCrn: Deno.env.get("IBM_SERVICE_CRN")!,
  apiVersion: "2025-01-01",
  apiKey: Deno.env.get("IBM_API_KEY")!, // or { bearerToken }
});

const packaged = ibm.transpileAndPackage(qc, 4096);
const result = await ibm.execute(packaged);
```

### 🌐 `QBraidBackend` — qBraid cloud via v2 API

```ts
import { QBraidBackend } from "jsr:@hviana/js-quantum";

const qbraid = new QBraidBackend({
  name: "qbraid_sim",
  numQubits: 5,
  basisGates: ["h", "cx", "rz", "sx"],
  couplingMap: null,
  deviceQrn: Deno.env.get("QBRAID_DEVICE_QRN")!,
  apiKey: Deno.env.get("QBRAID_API_KEY")!,
  apiEndpoint: "https://api.qbraid.com/v2",
  corsProxy: undefined,
});

const result = await qbraid.execute(qbraid.transpileAndPackage(qc));
```

### 📄 `OpenQASMTranspiler` — round-trip to/from OpenQASM 3.1

```ts
import { OpenQASMTranspiler } from "jsr:@hviana/js-quantum";

const T = new OpenQASMTranspiler();
const qasmText = T.serialize(qc); // → string
const reparsed = T.deserialize(qasmText); // → QuantumCircuit
```

### 🧮 Hardware-aware transpilation pipeline

```ts
import { transpile } from "jsr:@hviana/js-quantum";

const compiled = transpile(qc, {
  numQubits: 5,
  basisGates: ["ecr", "id", "rz", "sx", "x"],
  couplingMap: [[0, 1], [1, 2], [2, 3], [3, 4]],
});
```

Includes KAK and ZYZ decomposition, gate-modifier expansion, composite
unrolling, SABRE layout & routing, basis translation, and peephole optimization.

---

## 📖 API Reference

All methods on `QuantumCircuit` return `this` for chaining.

### 🏗️ `QuantumCircuit` — the central builder

```ts
new QuantumCircuit(globalPhase?: number | AngleExpr)
```

#### Program metadata

| Method                             | Purpose                                            |
| ---------------------------------- | -------------------------------------------------- |
| `setProgramVersion(major, minor?)` | Set the emitted OpenQASM version header.           |
| `omitProgramVersion()`             | Suppress the version header entirely.              |
| `include(path)`                    | Emit an `include "path";` directive.               |
| `setCalibrationGrammar(name)`      | Emit `defcalgrammar "name";` (e.g. `"openpulse"`). |

#### Classical registers

| Method                             | Purpose                                                       |
| ---------------------------------- | ------------------------------------------------------------- |
| `addClassicalRegister(name, size)` | Declare a named `bit[size]` register for measurement results. |
| `getClassicalRegister(name)`       | Look up a declared register by name.                          |

#### 🎛️ Tier 0 — single-qubit primitives (hardcoded matrices)

| Gate           | Method                  | Meaning                                 |
| -------------- | ----------------------- | --------------------------------------- |
| `I`            | `qc.id(q)`              | Identity                                |
| `H`            | `qc.h(q)`               | Hadamard — creates equal superposition  |
| `X` `Y` `Z`    | `qc.x/y/z(q)`           | Pauli bit-flip / bit+phase / phase flip |
| `S`/`S†`       | `qc.s/sdg(q)`           | π/2 phase rotations                     |
| `T`/`T†`       | `qc.t/tdg(q)`           | π/4 phase rotations                     |
| `SX`/`SX†`     | `qc.sx/sxdg(q)`         | Square root of X                        |
| `P(λ)`         | `qc.p(λ, q)`            | Arbitrary phase                         |
| `R(θ,φ)`       | `qc.r(θ, φ, q)`         | Rotation in the X–Y plane               |
| `RX/RY/RZ(θ)`  | `qc.rx/ry/rz(θ, q)`     | Axis rotations                          |
| `U(θ,φ,λ)`     | `qc.u(θ, φ, λ, q)`      | Universal single-qubit                  |
| `RV(vx,vy,vz)` | `qc.rv(vx, vy, vz, q)`  | Rotation-vector form                    |
| `GPhase(θ)`    | `qc.globalPhaseGate(θ)` | Zero-qubit global phase                 |

#### 🎛️ Tier 1 — the seed two-qubit gate

| Gate | Method                                                             |
| ---- | ------------------------------------------------------------------ |
| `CX` | `qc.cx(control, target)` — the _only_ hardcoded multi-qubit matrix |

#### 🎛️ Tiers 2–14 — compositionally derived from Tier 0 + CX

<details>
<summary><b>Tier 2 · Controlled single-qubit gates</b></summary>

```ts
qc.cz(c, t) qc.cy(c, t) qc.ch(c, t)
qc.cp(λ, c, t)  qc.crx(θ, c, t)  qc.cry(θ, c, t)  qc.crz(θ, c, t)
qc.cs(c, t)  qc.csdg(c, t)  qc.csx(c, t)
qc.cu(θ, φ, λ, γ, c, t)
qc.dcx(q0, q1)
```

</details>

<details>
<summary><b>Tier 3 · Two-qubit interactions</b></summary>

```ts
qc.swap(q0, q1)   qc.iswap(q0, q1)   qc.ecr(q0, q1)
qc.rxx(θ, q0, q1) qc.ryy(θ, q0, q1) qc.rzz(θ, q0, q1) qc.rzx(θ, q0, q1)
qc.xxPlusYY(θ, β, q0, q1)  qc.xxMinusYY(θ, β, q0, q1)
```

</details>

<details>
<summary><b>Tier 4 · Three-qubit gates</b></summary>

```ts
qc.ccx(c1, c2, t); // Toffoli
qc.ccz(c1, c2, t);
qc.cswap(c, t1, t2); // Fredkin
qc.rccx(c1, c2, t); // relative-phase Toffoli
```

</details>

<details>
<summary><b>Tier 5 · Multi-controlled, phase-safe</b></summary>

```ts
qc.c3x(...)  qc.c3sx(...)  qc.c4x(...)  qc.rc3x(...)
qc.mcx(controls, target)         // MCX via H · MCPhase(π) · H
qc.mcp(λ, controls, target)      // multi-controlled phase
```

</details>

<details>
<summary><b>Tier 6 · N-qubit composites</b></summary>

```ts
qc.ms(θ, qubits); // Mølmer–Sørensen
qc.pauli(pauliString, qubits); // e.g. "XYZI"
qc.diagonal(phases, qubits);
qc.permutation(sigma, qubits);
qc.mcmt(gate, controls, targets); // multi-control multi-target
qc.pauliProductRotation(θ, paulis, qubits);
```

</details>

<details>
<summary><b>Tier 7 · Uniformly controlled + unitary synthesis</b></summary>

```ts
qc.ucrx(angles, controls, target)  qc.ucry(angles, controls, target)  qc.ucrz(angles, controls, target)
qc.ucPauliRot(angles, axis, controls, target)
qc.uc(unitaries, controls, target)   // Möttönen 4-layer UCGate
qc.unitary(matrix, qubits)           // arbitrary 2ⁿ×2ⁿ unitary
qc.linearFunction(matrix, qubits)    // GF(2) linear map
qc.isometry(matrix, qubits)
```

</details>

<details>
<summary><b>Tier 8 · Hamiltonian simulation</b></summary>

```ts
qc.pauliEvolution(terms, time, qubits); // Trotterized e^{-iHt}
qc.hamiltonianGate(matrix, time, qubits); // exact via Jacobi eigendecomposition
```

</details>

<details>
<summary><b>Tier 9 · Quantum Fourier Transform</b></summary>

```ts
qc.qft(qubits); // exact QFT (or its inverse via inv)
```

</details>

<details>
<summary><b>Tier 10 · Reversible classical logic</b></summary>

```ts
qc.andGate(inputs, output)   qc.orGate(inputs, output)
qc.bitwiseXor(a, b)          qc.innerProduct(a, b, output)
```

</details>

<details>
<summary><b>Tier 11 · Arithmetic</b></summary>

```ts
qc.halfAdder(a, b, sum, carry);
qc.fullAdder(a, b, cIn, sum, cOut);
qc.modularAdder(a, b);
qc.multiplier(a, b, product);
```

</details>

<details>
<summary><b>Tier 12 · Function loading (amplitude encoding of f(x))</b></summary>

```ts
qc.linearPauliRotations(slope, offset, stateQubits, target, axis?)
qc.polynomialPauliRotations(coeffs, stateQubits, target, axis?)
qc.piecewiseLinearPauliRotations(breakpoints, slopes, offsets, stateQubits, target, axis?)
qc.piecewisePolynomialPauliRotations(breakpoints, coeffsList, stateQubits, target, axis?)
qc.piecewiseChebyshev(fSamples, breakpoints, stateQubits, target, axis?)
qc.linearAmplitudeFunction(slope, offset, domain, image, stateQubits, target)
qc.exactReciprocal(scalingFactor, stateQubits, target)
```

</details>

<details>
<summary><b>Tier 13 · Oracles, comparators, aggregation</b></summary>

```ts
qc.integerComparator(value, stateQubits, result, work, geq?)
qc.quadraticForm(A, b, c, stateQubits, resultQubits)
qc.weightedSum(weights, stateQubits, sumQubits)
qc.phaseOracle(esop, qubits)      // phase-flip oracle
qc.bitFlipOracle(esop, qubits, output)
```

</details>

<details>
<summary><b>Tier 14 · State preparation</b></summary>

```ts
qc.graphState(adjacencyMatrix, qubits);
```

</details>

#### Non-unitary operations

| Method                                  | Purpose                                          |
| --------------------------------------- | ------------------------------------------------ |
| `qc.measure(qubit, clbit?)`             | Measure one qubit into a classical bit.          |
| `qc.measureRegister(qubits, clbitRefs)` | Measure many qubits at once.                     |
| `qc.reset(qubit)`                       | Reset a qubit to `                               |
| `qc.barrier(...qubits)`                 | Compiler barrier — forbids reordering across it. |
| `qc.delay(duration, qubits?)`           | Idle for a duration (scheduling).                |
| `qc.timed(operation, duration)`         | Bound a sub-operation's duration.                |

#### Gate modifiers & low-level application

| Method                                                                               | Purpose                                               |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `qc.inv(name, qubits, params?)`                                                      | Apply a gate's **inverse** by name.                   |
| `qc.pow(k, name, qubits, params?)`                                                   | Apply a gate raised to integer or symbolic power `k`. |
| `qc.ctrl(n, name, qubits, params?)`                                                  | Add `n` positive controls on the front.               |
| `qc.negctrl(n, name, qubits, params?)`                                               | Add `n` negative (zero-valued) controls.              |
| `qc.applyGate({ name, qubits, parameters?, modifiers?, localPhase?, surfaceName? })` | Low-level escape hatch.                               |

#### Definitions & declarations

| Method                                                               | Purpose                                  |
| -------------------------------------------------------------------- | ---------------------------------------- |
| `qc.defineGate(name, params, qubits, body)`                          | Define a user-level gate.                |
| `qc.defineSubroutine(name, params, returnType, body)`                | Define a classical/quantum subroutine.   |
| `qc.declareExtern(name, params, returnType)`                         | Declare an externally-provided callable. |
| `qc.declareClassicalVar(name, type, init?)`                          | Declare a classical variable.            |
| `qc.declareConst(name, type, value)`                                 | Compile-time constant.                   |
| `qc.declareInput(name, type, default?)`                              | Runtime input parameter.                 |
| `qc.declareOutput(name, type, init?)`                                | Runtime output variable.                 |
| `qc.alias(name, target)`                                             | `let name = target;` alias.              |
| `qc.declareLegacyQReg(name, size)` / `declareLegacyCReg(name, size)` | OpenQASM 2 compatibility.                |

#### Classical statements & control flow

| Method                                              | Purpose                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `qc.classicalAssign(target, value)`                 | `target = value;`                                                                         |
| `qc.classicalAssignOp(target, op, value)`           | Compound assignment (`+=`, `-=`, `*=`, `<<=`, …)                                          |
| `qc.exprStatement(expr)`                            | Bare expression statement.                                                                |
| `qc.returnValue(v)` / `qc.returnVoid()`             | Subroutine returns.                                                                       |
| `qc.ifTest(condition, trueBody, falseBody?)`        | Classical conditional — see [Expansion API](#-classical-control-flow--the-expansion-api). |
| `qc.forLoop(loopVar, iterable, body)`               | `for loopVar in iterable { body }`                                                        |
| `qc.whileLoop(condition, body)`                     | `while (condition) { body }`                                                              |
| `qc.switch(subject, cases, defaultBody?)`           | `switch (subject) { case … }`                                                             |
| `qc.breakLoop()` / `qc.continueLoop()` / `qc.end()` | Loop / program control.                                                                   |
| `qc.box(body, duration?)`                           | Timed `box[d] { … }` scope.                                                               |

#### Composition & inspection

| Method                                           | Purpose                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `qc.compose(other, qubitMap?)`                   | Append another circuit (optionally remapping qubits).                |
| `qc.toGate(label?)` / `qc.toInstruction(label?)` | Convert a sub-circuit into a reusable opaque gate/instruction.       |
| `qc.clone()`                                     | Deep copy.                                                           |
| `qc.inverse()`                                   | Dagger (reverse + inv each gate).                                    |
| `qc.run(bindings)`                               | Return a copy with all `AngleExpr` symbols bound to concrete values. |
| `qc.complexity()`                                | Gate-count summary (depth, width, per-tier counts).                  |
| `qc.toMatrix()`                                  | Build the full unitary (warning: `O(2^{2n})` memory).                |
| `qc.append(instruction)`                         | Append a raw `Instruction` IR node.                                  |

### 📐 `AngleExpr` — symbolic angles & parameters

Exact-rational-normalized symbolic angle system. Use it for parameterized
circuits, VQE ansätze, and any sweep.

```ts
AngleExpr.int(n)                        // integer literal
AngleExpr.float(x)                      // floating-point literal
AngleExpr.rational(num, den)            // exact p/q
AngleExpr.symbol("theta")               // unresolved symbol — bind later via qc.run({ theta: … })
AngleExpr.PI   AngleExpr.TAU   AngleExpr.EULER   // built-in constants

a.plus(b)   a.minus(b)   a.times(b)   a.dividedBy(b)   a.negated()
a.bind({ x: 0.5 })   a.isResolved()   a.evaluate()

// Exact proof helpers (for compiler passes)
provablyZero(e)    provablyTwoPiMultiple(e)   provablyInteger(e)
asExactInteger(e)  provablyEqual(a, b)        wrapPhase(angle, eps?)
```

### 🔌 `Backend` — the uniform execution interface

```ts
interface Backend {
  name: string;
  numQubits: number;
  basisGates: readonly string[];
  couplingMap: ReadonlyArray<readonly [number, number]> | null;
  transpileAndPackage(circuit, shots?): Executable;
  execute(executable, shots?): ExecutionResult | Promise<ExecutionResult>;
}

type ExecutionResult = Record<string, number>; // bitstring → percentage (sums to 100)
```

Every backend — including any you write yourself — just has to implement this
shape.

### 🖥️ `SimulatorBackend`

Noiseless local state-vector simulator. Never builds the full `2ⁿ × 2ⁿ` matrix.

```ts
new SimulatorBackend({ numQubits?: number, defaultShots?: number })
sim.transpileAndPackage(circuit, shots?)    // compile for local execution
sim.execute(executable, shots?)             // sample bitstrings
sim.getStateVector(circuit)                 // exact amplitudes (unitary-only)
```

### ☁️ `IBMBackend`

Submits circuits to IBM Quantum via the Sampler V2 REST API.

```ts
new IBMBackend({
  name, numQubits, basisGates, couplingMap,
  serviceCrn, apiVersion,
  bearerToken | apiKey,                      // either one
  apiEndpoint?, corsProxy?,
})
```

### ☁️ `QBraidBackend`

Submits circuits to qBraid via the v2 API.

```ts
new QBraidBackend({
  name,
  numQubits,
  basisGates,
  couplingMap,
  deviceQrn,
  apiKey,
  apiEndpoint,
  corsProxy,
});
```

### 📄 `OpenQASMTranspiler`

Round-trip serialization of `QuantumCircuit` ↔ OpenQASM 3.1 source text.

```ts
const T = new OpenQASMTranspiler();
T.serialize(circuit); // QuantumCircuit → string
T.deserialize(text); // string → QuantumCircuit
```

### 🧮 Compilation pipeline (individual passes)

```ts
import {
  decomposeKAK, // 2-qubit KAK decomposition
  decomposeToRzSx, // lower to {Rz, Sx, X} basis
  decomposeZYZ, // 1-qubit ZYZ decomposition
  expandGateModifiers, // flatten inv/pow/ctrl/negctrl
  layoutSABRE, // virtual → physical layout
  optimize, // peephole + commutation
  routeSABRE, // insert SWAPs for coupling
  translateToBasis, // rewrite into target basis
  transpile, // end-to-end driver
  unrollComposites, // inline defined gates
} from "jsr:@hviana/js-quantum";
```

### 🌐 Bloch sphere

```ts
import { blochFromStateVector, blochOfCircuit } from "jsr:@hviana/js-quantum";

const { x, y, z, theta, phi, r } = blochOfCircuit(circuit, qubitIndex);
```

Reduces the full state to a single-qubit density matrix and returns its
Bloch-sphere coordinates — perfect for visualization.

### 🧰 `Expr` · `Op` · `Dur` · `State` — expansion API factories

Tiny helper modules that build Expansion-API IR nodes with short, typed function
calls instead of object literals. See
[Classical Control Flow](#-classical-control-flow--the-expansion-api) for the
full tour.

```ts
Expr.int(0)   Expr.ref("c")   Expr.binary("==", Expr.ref("c"), Expr.int(1))
Expr.range(Expr.int(0), undefined, Expr.int(3))
Op.virtual(0)   Op.indexed(Op.identifier("q"), [Expr.int(2)])
Dur.literal(100, "ns")
State.bitstring("0101")
```

---

## ✨ High-Level API — The Didactic Tour

The **High-Level API** (`hlapi`) wraps `js-quantum` in a single chainable
pipeline built around one entry point — `quantum()` — that returns a
`QuantumTask`. You supply **classical data** (numbers, arrays, matrices,
callables, graphs) through `.data()` or one of its shorthands (`.search_in()`,
`.matrix()`, `.vector()`, `.cost_function()`, `.graph()`, `.function()`,
`.training_data()`, `.system()`), optionally pick a strategy via `.solve()`, and
call `.run()` to receive a `ResultHandle`. The `.answer()` method returns the
**classical result** you actually care about: the found item, the solution
vector, the optimal assignment, the list of prime factors. No qubits, gates,
oracles, Hamiltonians, or bitstrings ever appear in the user-facing code.

Advanced users can reach full control through optional parameters on the same
calls (explicit step sequences for `.solve()`, backend overrides on `.run()`,
direct quantum-native input via `.input()`, `.oracle()`, `.hamiltonian()`, ...).
`.circuit()` extracts the host-library `QuantumCircuit` for use with external
tools.

```ts
import { quantum } from "jsr:@hviana/js-quantum";
```

> 💡 **Reading the examples.** Every example below is framed around a
> **practical use case** — a problem where the underlying quantum algorithm has
> genuine structural value (verify-easy / search-hard, NP-hard cost landscapes,
> real physical Hamiltonians, real engineering linear systems). Instance sizes
> are kept small for simulator tractability, but the _shape_ of each problem is
> one a real practitioner would recognise. A short **Under the hood** note after
> each snippet names the algorithms and flags where the simulator falls back to
> a classical computation.

---

### 🔐 A. Breaking an RSA-style semiprime

> 🎯 **Use case:** recover the two prime factors of a semiprime modulus — the
> textbook Shor target and the reason quantum computing matters for
> cryptography.

| Classical in               | Classical out          |
| :------------------------- | :--------------------- |
| `target: 15` (the modulus) | `[3, 5]` (the factors) |

```ts
const result = await quantum("factoring")
  .data("target", 15)
  .run();

console.log(result.answer()); // → [3, 5]
```

> 🔬 **Under the hood.** Shor's algorithm: quantum order-finding via QFT +
> continued-fraction post-processing. On the default simulator the bridge falls
> back to classical trial division; the exponential speedup is realised only on
> real hardware with a modular-exponentiation oracle.

---

### 🧾 B. Reconciling a subset of invoices

> 🎯 **Use case:** given a list of invoice amounts and a target total, find a
> subset that reconciles exactly. **Subset-sum is NP-hard:** verifying a
> candidate is O(n) but searching is exponential — the canonical regime for
> amplitude amplification.

| Classical in                                       | Classical out                                  |
| :------------------------------------------------- | :--------------------------------------------- |
| `invoices: [7, 13, 11, 8, 3, 14, 5]`, `target: 42` | a reconciling subset, e.g. `[13, 11, 8, 3, 7]` |

```ts
const invoices = [7, 13, 11, 8, 3, 14, 5];
const target = 42;

// Search space: every subset encoded as a bitmask (2^7 = 128 candidates).
const candidates = Array.from({ length: 1 << invoices.length }, (_, m) => m);

const reconciles = (mask: unknown) => {
  let sum = 0;
  for (let i = 0; i < invoices.length; i++) {
    if (((mask as number) >> i) & 1) sum += invoices[i];
  }
  return sum === target;
};

const result = await quantum("search")
  .search_in(candidates, reconciles)
  .run();

const mask = result.answer() as number;
const subset = invoices.filter((_, i) => (mask >> i) & 1);
console.log(subset); // → e.g. [13, 11, 8, 3, 7]
```

> 🔬 **Under the hood.** Grover's algorithm / amplitude amplification. The
> bridge builds a phase oracle from the predicate and runs the optimal number of
> Grover iterations. On a classical simulator the predicate is evaluated across
> the candidate space to mark the oracle — the √N speedup is structural and is
> realised only on real hardware, where the predicate becomes a reversible
> oracle circuit.

---

### 🕸️ C. Locating a fault on a mesh network

> 🎯 **Use case:** a 3×3 mesh of routers has started dropping packets on exactly
> one device. Probing every router sequentially is O(N); a quantum walk on the
> topology locates the faulty node in O(√N) by exploiting the graph structure
> rather than any per-node label.

```ts
// Build a 3×3 mesh adjacency (9 routers, cardinal neighbours).
const n = 3;
const nodes = Array.from({ length: n * n }, (_, i) => i);
const adjacency: number[][] = nodes.map(() => nodes.map(() => 0));
for (let r = 0; r < n; r++) {
  for (let c = 0; c < n; c++) {
    const i = r * n + c;
    if (r + 1 < n) {
      adjacency[i][(r + 1) * n + c] = adjacency[(r + 1) * n + c][i] = 1;
    }
    if (c + 1 < n) {
      adjacency[i][r * n + (c + 1)] = adjacency[r * n + (c + 1)][i] = 1;
    }
  }
}

// One router has a degraded health counter (SNMP-style probe).
const isFaulty = (node: unknown) => (node as number) === 5;

const result = await quantum("search")
  .graph(adjacency)
  .search_in(nodes, isFaulty)
  .run();

console.log("faulty router:", result.answer()); // → 5
```

> 🔬 **Under the hood.** Szegedy / continuous-time quantum walk for spatial
> search. The walk operator is marked by the predicate and mixes along the graph
> structure; on real hardware the √N advantage is structural.

---

### ⚛️ D. Simulating a transverse-field Ising chain

> 🎯 **Use case:** evolve a small magnetic spin chain under a transverse-field
> Ising Hamiltonian and read back the measurement distribution — a standard
> benchmark Hamiltonian from condensed-matter physics.

```ts
// 2-qubit transverse-field Ising Hamiltonian.
const H = [
  [1, 1, 1, 0],
  [1, -1, 0, 1],
  [1, 0, -1, 1],
  [0, 1, 1, 1],
];

const result = await quantum("simulation")
  .system(H)
  .run();

console.log(result.answer()); // → distribution over basis states
```

> 🔬 **Under the hood.** Trotter-Suzuki product formulas, LCU, and
> interaction-picture simulation. Exponential speedups over classical simulation
> are expected for physically-motivated Hamiltonians with many spins; this
> 2-qubit instance is just for the API shape.

---

### ⚡ E. Loop currents in a DC resistor mesh

> 🎯 **Use case:** a three-mesh DC circuit driven by a 10 V source. Kirchhoff's
> voltage law around each independent loop yields a 3×3 linear system whose
> solution is the loop currents `I₁, I₂, I₃`. The same shape scales to thousands
> of meshes in power-grid analysis — the target regime for HHL-class solvers on
> sparse, well-conditioned systems.

```ts
// (R1 + R2) I1  − R2 I2                     = V
//       − R2 I1 + (R2 + R3 + R4) I2 − R4 I3 = 0
//                     − R4 I2 + (R4 + R5) I3 = 0
// R1=2, R2=4, R3=6, R4=3, R5=5 Ω;  V=10 V
const A = [
  [6, -4, 0],
  [-4, 13, -3],
  [0, -3, 8],
];
const b = [10, 0, 0];

const result = await quantum("linear_system")
  .matrix(A)
  .vector(b)
  .run();

console.log(result.answer()); // → loop currents [I1, I2, I3]
```

> 🔬 **Under the hood.** HHL / QSVT-based linear algebra. On the default
> simulator the bridge falls back to Gaussian elimination; the exponential
> advantage applies to sparse, well-conditioned, block-encoded systems on real
> hardware.

---

### 🧩 F. Combinatorial optimisation — Max-Cut

> 🎯 **Use case:** partition the nodes of a graph into two groups so that the
> number of edges crossing the partition is maximised. **Max-Cut is NP-hard**
> and appears in load balancing, VLSI layout, and statistical physics.

```ts
const edges: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 0],
  [0, 2],
];

const cost = (bits: number[]) => {
  let cut = 0;
  for (const [i, j] of edges) if (bits[i] !== bits[j]) cut++;
  return -cut; // minimisation ↔ maximum cut
};

const result = await quantum("optimization")
  .cost_function(cost, { metadata: { numBits: 5 } })
  .run();

console.log(result.answer()); // → { assignment: [...], cost: -5 }
```

> 🔬 **Under the hood.** QAOA, VQE, and adiabatic optimisation. The cost
> function is encoded as a problem Hamiltonian; variational angles are optimised
> in a classical loop.

---

### 🎲 G. Sampling from a classically hard distribution

> 🎯 **Use case:** draw bitstring samples from a distribution that is `#P`-hard
> to simulate classically — the benchmark used for quantum supremacy / advantage
> claims and a candidate source of certified randomness.

```ts
const result = await quantum("sampling")
  .data("custom", null, { metadata: { n: 4 } })
  .run();

console.log(result.answer()); // → ["0000", "0101", ...]
```

> 🔬 **Under the hood.** IQP sampling on the gate-model simulator produces a
> uniform distribution over the specified number of qubits.

---

### 🌸 H. Classification with a quantum kernel

> 🎯 **Use case:** classify iris flowers by two numeric features (petal length
> and width) using a quantum kernel. Quantum kernels embed data into a
> high-dimensional Hilbert space that can be provably hard to evaluate
> classically.

```ts
const training = [
  { features: [1.4, 0.2], label: "setosa" },
  { features: [1.3, 0.2], label: "setosa" },
  { features: [4.7, 1.4], label: "versicolor" },
  { features: [4.5, 1.5], label: "versicolor" },
];

const result = await quantum("classification")
  .training_data(training)
  .data("custom", [4.6, 1.4])
  .run();

console.log(result.answer()); // → ["versicolor"]
```

> 🔬 **Under the hood.** Quantum kernel estimation / variational quantum
> classifier. The simulator computes the kernel matrix classically; the
> potential speedup is in the feature-map evaluation on real hardware.

---

### 🛡️ I. Error correction on encoded data

> 🎯 **Use case:** recover a logical bit from an encoded representation — the
> basic building block of fault-tolerant quantum computing (and, by analogy, of
> classical ECC on storage media).

```ts
const encoded = [1, 1, 0, 1, 1]; // intended logical 1 with a single flip

const result = await quantum("error_correction")
  .data("system", encoded)
  .run();

console.log(result.answer()); // → corrected logical bit
```

> 🔬 **Under the hood.** Surface-code encoding, stabiliser measurements, and
> MWPM-style syndrome decoding. Full stabiliser simulation is out of scope for
> the default backend; the bridge currently returns a fallback.

---

### 📡 J. Heisenberg-limited phase estimation

> 🎯 **Use case:** estimate a weak unknown phase (e.g., from an NV-centre
> magnetometer or an interferometer) with **Heisenberg-limited** precision — a
> quadratic improvement over the standard quantum limit, used in atomic clocks,
> gravimetry, and magnetic sensing.

```ts
const unknownPhase = 0.3183; // ≈ 1/π — pretend it is unknown
const signal = (_x: number) => unknownPhase;

const result = await quantum("phase_estimation")
  .function(signal)
  .run();

console.log(result.answer()); // → { phase: 0.3183, confidence: 0.95 }
```

> 🔬 **Under the hood.** Quantum phase estimation, GHZ-state sensing, and
> Heisenberg-limited estimation. The 1/N scaling in the number of probes beats
> the 1/√N shot-noise limit on real hardware.

---

### 🎛️ Advanced control — all knobs exposed

Everything above uses defaults. When you do need control, the API accepts
options at three levels: **problem construction**, **solve**, and **run**. The
examples below exercise every configurable knob.

#### 1. Problem form, resource limits, algorithm family, and shots

```ts
import { quantum } from "jsr:@hviana/js-quantum";

const invoices = [7, 13, 11, 8, 3, 14, 5];
const target = 42;
const candidates = Array.from({ length: 1 << invoices.length }, (_, m) => m);

const reconciles = (mask: unknown): boolean => {
  let sum = 0;
  for (let i = 0; i < invoices.length; i++) {
    if (((mask as number) >> i) & 1) sum += invoices[i];
  }
  return sum === target;
};

const result = await quantum(
  // Object form — explicitly set problem_class and task
  // (instead of the shorthand string "search").
  { problem_class: "amplitude_amplification", task: "search" },
  // Resource limits — .run() throws if the circuit exceeds these caps.
  { resources: { maxDepth: 500, maxGates: 2000 } },
)
  .search_in(candidates, reconciles)
  // Explicit algorithm family (default is inferred from the task).
  .solve("amplitude_amplification")
  // shots: number of measurement repetitions (default 1024).
  .run({ shots: 4096 });

console.log(result.answer()); // → reconciling mask
console.log(result.confidence()); // → [0, 1]
console.log(result.inspect("resources")); // → { gates, depth, tCount, qubits }
```

#### 2. Task-specific metadata

Some tasks read metadata fields from `.data()` / `.system()` /
`.cost_function()`:

```ts
import { quantum } from "jsr:@hviana/js-quantum";

// Hamiltonian simulation: metadata.time and metadata.steps control
// the evolution time and Trotter decomposition steps.
const H = [
  [1, 1, 1, 0],
  [1, -1, 0, 1],
  [1, 0, -1, 1],
  [0, 1, 1, 1],
];

const result = await quantum("simulation")
  .system(H, { metadata: { time: 2.0, steps: 4 } })
  .run();

console.log(result.answer()); // → distribution of basis states
```

Other metadata consumed by the bridge:

| Task             | Method             | Metadata field  | Default | Effect                          |
| :--------------- | :----------------- | :-------------- | :------ | :------------------------------ |
| `simulation`     | `.system(H, opts)` | `time`          | `1.0`   | Evolution time for exp(−iHt)    |
| `simulation`     | `.system(H, opts)` | `steps`         | `1`     | Trotter decomposition steps     |
| `optimize`       | `.cost_function()` | `numBits` / `n` | `6`     | Number of qubits for QAOA       |
| `period_finding` | `.function()`      | `maxN`          | `128`   | Upper bound on the search range |

#### 3. Pipeline step overrides

Override specific steps in a preset pipeline without rewriting the whole thing:

```ts
import { quantum } from "jsr:@hviana/js-quantum";

const edges: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]];
const cost = (bits: number[]): number => {
  let cut = 0;
  for (const [i, j] of edges) if (bits[i] !== bits[j]) cut++;
  return -cut;
};

const result = await quantum("optimization")
  .cost_function(cost, { metadata: { numBits: 4 } })
  // Use the "variational" preset, but override the measure step
  // to repeat 3 times.
  .solve("variational", {
    override: [{ action: "measure", repeat: 3, params: {} }],
  })
  .run({ shots: 2048 });

console.log(result.answer()); // → { assignment: [...], cost: -4 }
```

#### 4. Fully custom pipeline

Replace the preset entirely with your own step sequence:

```ts
import { quantum } from "jsr:@hviana/js-quantum";

const result = await quantum({
  problem_class: "hidden_subgroup",
  task: "search",
})
  .search_in([0, 1, 2, 3, 4, 5, 6, 7], (x: unknown) => x === 5)
  .solve([
    { action: "prepare", input: "initial_state", repeat: 1, params: {} },
    { action: "apply", input: "oracle", repeat: 2, params: {} },
    { action: "apply", input: "diffuser", repeat: 2, params: {} },
    { action: "measure", repeat: 1, params: {} },
  ])
  .run({ shots: 1024 });

console.log(result.answer()); // → 5
```

#### 5. Real hardware backend

```ts
import { IBMBackend, quantum } from "jsr:@hviana/js-quantum";

const ibm = new IBMBackend({
  apiConfig: { bearerToken: "TOKEN", serviceCrn: "CRN" },
  backendName: "ibm_kyoto",
});

// Any example from above runs on real hardware — just pass the backend.
const result = await quantum("search", { backend: ibm })
  .search_in([0, 1, 2, 3], (x: unknown) => x === 3)
  .run({ shots: 4096 });
// Or pass the backend at .run() time: .run({ shots: 4096, backend: ibm })
```

#### Summary of all configurable knobs

| Knob                    | Method / Option                                    | Example value             | Effect                                            |
| :---------------------- | :------------------------------------------------- | :------------------------ | :------------------------------------------------ |
| Problem (object form)   | `quantum({ problem_class, task })`                 | `{ task: "search" }`      | Explicit class + task instead of a string         |
| Resource limits         | `quantum(..., { resources })`                      | `{ maxDepth: 500 }`       | Rejects circuit if depth or gate count exceed cap |
| Algorithm family        | `.solve(family)`                                   | `"variational"`           | Selects the pipeline preset                       |
| Custom pipeline         | `.solve([steps])`                                  | `[{ action: "apply" }]`   | User-defined step sequence                        |
| Pipeline step overrides | `.solve(family, { override })`                     | `[{ action: "measure" }]` | Replaces matching steps in the preset             |
| Task-specific metadata  | `.data(role, value, { metadata })`                 | `{ time: 2.0, steps: 4 }` | Consumed by the bridge for specific tasks         |
| Shots                   | `.run({ shots })`                                  | `4096`                    | Measurement repetitions (default 1024)            |
| Backend                 | `.run({ backend })` or `quantum(..., { backend })` | `IBMBackend` instance     | Simulator (default) or real hardware              |

> 🔁 Swap `IBMBackend` for a `QBraidBackend` instance (or any custom `Backend`)
> to run the exact same pipeline on a different device — no other code change is
> required.

> **⚠️ Experimental API**
>
> The High-Level API (`hlapi`) is experimental. Its interfaces, entity schemas,
> enum values, and behavioral contracts are subject to breaking changes in any
> release. Do not depend on it in production workflows. Feedback and
> contributions are welcome.

---

## 🏗️ Architecture

```text
┌─────────────────┐    ┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  QuantumCircuit │───▶│  Transpiler │───▶│     Backend     │───▶│ExecutionResult   │
└─────────────────┘    └─────────────┘    └─────────────────┘    └──────────────────┘
                             │                    │
                  OpenQASM 3.1 serializer    SimulatorBackend
                     + parser + passes        IBMBackend
                                              QBraidBackend
```

The SDK is organized as a strict layered build:

1. 🧮 **Foundation** — `complex.ts`, `matrix.ts`, `parameter.ts`, `types.ts`
2. 🎛️ **Gates** — `gates.ts` — all 80+ gates across 14 tiers, compositionally
   derived from the 19 Tier 0 single-qubit primitives plus the single Tier 1
   `CX`.
3. 🧩 **Expansion API** — `expansion.ts` — pure factory module for classical
   expressions, quantum operands, durations, and state specs.
4. 🏗️ **`QuantumCircuit`** — `circuit.ts` — the central builder + the
   `materializeGate` dispatcher that bridges the IR to concrete gate matrices.
5. ☁️ **Backends** — `backend.ts`, `simulator.ts`, `ibm_backend.ts`,
   `qbraid_backend.ts`
6. 🧮 **Transpiler** — `transpiler.ts` — OpenQASM 3.1 serializer +
   recursive-descent parser + compilation passes.
7. 🌐 **Bloch sphere** — `bloch.ts` — reduced density matrix → Bloch vector.
8. 📦 **Public API** — `mod.ts` — the single entry point.

### ✅ Specification highlights

- **Phase-safe** multi-controlled X via mutual recursion
  `MCX(N) = H(t) → MCPhase(π, N) → H(t)` (no X-root ladder).
- **Möttönen 4-layer** `UCGate` synthesis with exact ZYZ decomposition.
- **Complex Jacobi eigendecomposition** for `HamiltonianGate`.
- **Phase Convention 1** minimum exact-expression conformance profile in
  `parameter.ts` with `wrapPhase` branch-cut snap.
- **Subspace iteration** in the simulator — never constructs the full `2ⁿ × 2ⁿ`
  matrix.
- **974 tests passing** (excluding the live cloud-execution tests gated behind
  environment variables).

---

## 🧪 Running Tests

```bash
deno test --allow-env
```

The IBM and qBraid live execution tests are skipped by default. Enable them via
environment variables:

```bash
# IBM
export IBM_BEARER_TOKEN=...   # OR IBM_API_KEY=...
export IBM_SERVICE_CRN=...
export IBM_BACKEND_NAME=ibm_kyoto
deno test --allow-env --allow-net

# qBraid
export QBRAID_API_KEY=...
export QBRAID_DEVICE_QRN=...
deno test --allow-env --allow-net
```

---

## 📜 License

**MIT** © Henrique Emanoel Viana

Built with
[`agents.md-for-quantum-simulation`](https://github.com/hviana/agents.md-for-quantum-simulation).

<div align="center">

---

### ⭐ If you find `js-quantum` useful, consider starring the repo!

**[🎮 Try the interactive simulator](https://hviana.github.io/js-quantum/)** ·
**[📦 JSR package](https://jsr.io/@hviana/js-quantum)** ·
**[💬 Report an issue](../../issues)**

</div>
