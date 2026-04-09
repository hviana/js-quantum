# AGENTS.md — Instructions for Building the js-quantum Playground Page

## Overview

Build a **single `index.html` file** in the repository root
(`/js-quantum/index.html`) that serves as an interactive quantum computing
playground for the **js-quantum** library. Everything — HTML, CSS, and
JavaScript — must be embedded in this one file. No external files except the two
CDN imports listed below. The entire page must be written in **English**.

---

## CDN Dependencies

1. **Monaco Editor** (code editor):
   ```
   https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.55.1/min/vs/loader.min.js
   ```
2. **js-quantum library** (all exports):
   ```
   https://esm.sh/jsr/@hviana/js-quantum@1.5.4
   ```

No other external files, fonts, icon libraries, or stylesheets are allowed. Use
**emojis** in place of icons throughout the UI (buttons, headings, labels,
etc.), **except** for quantum gate names and control-flow directives (loops,
IFs, switch), which must use their actual technical names without emojis.

---

## Design Principles

| Principle          | Detail                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile-first       | Design for small screens first; use responsive breakpoints for tablet/desktop.                                                                                        |
| Visually appealing | Use a dark theme with vibrant accent colors (quantum-themed: purples, cyans, electric blues). Use gradients, subtle shadows, rounded corners, and smooth transitions. |
| Emojis as icons    | Use emojis for all UI icons: e.g. ▶️ Run, 💾 Save, 📂 Load, 🔬 View Circuit, ❓ Help, 📋 Examples, 🖥️ Run on Quantum Computer.                                        |
| Single file        | All HTML, CSS, and JS in one `index.html`.                                                                                                                            |

---

## Page Structure & Layout

### Header / Title Bar

- Title: something like "⚛️ js-quantum Playground"
- Subtitle: Brief explanation that the library provides APIs for building
  **high-level quantum algorithms** in JavaScript.
- Mention that the **High-Level API (hlapi) is experimental**.

### Toolbar (Button Bar)

A responsive toolbar with these buttons (use emojis, not icon libraries):

1. **▶️ Run** — Executes the code in the editor and displays a results graph.
2. **🔬 View Circuit** — Opens a popup/modal with a visual circuit diagram.
3. **📥 Download OpenQASM** — Transpiles the circuit from the editor code and
   downloads the resulting OpenQASM 3.0 source as a `.qasm` file.
4. **💾 Save** — Downloads the editor content as a `.js` file.
5. **📂 Load** — Opens a file picker to load a `.js` file into the editor.
6. **📋 Examples** (dropdown) — Contains example snippets to load into the
   editor.
7. **🖥️ Run on Quantum Computer** (dropdown) — Contains examples of running on
   real quantum hardware.
8. **❓ Help** — Links to
   [https://jsr.io/@hviana/js-quantum](https://jsr.io/@hviana/js-quantum).

On mobile, the toolbar should wrap or collapse into a scrollable row.

### Code Editor (Monaco)

- Use Monaco Editor loaded via the CDN `loader.min.js`.
- Configure Monaco with `require.config` pointing the `vs` path to
  `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.55.1/min/vs`.
- Language: `javascript`.
- Theme: a dark theme (e.g., `vs-dark`).
- The editor should fill the available width and have a reasonable default
  height (~50vh on desktop, ~40vh on mobile).
- Pre-load a default simple example (see Examples section below).

### Results Panel

- Appears below or beside the editor (below on mobile, beside on desktop if
  space allows).
- Displays a **bar chart** of all possible output states and their percentages.
- Each bar: label = bitstring state (e.g., `|00⟩`, `|11⟩`), value = percentage.
- Include a **toggle/checkbox: "Sort by highest probability"** that reorders
  bars descending by percentage.
- Render the chart using **pure HTML/CSS/JS** (no chart library). Use styled
  `<div>` bars with percentage labels.
- Show a loading spinner emoji (⏳) while executing.

---

## Feature Details

### 1. Run Button (▶️)

When clicked:

1. Show the global loading overlay (see "Global Loading Overlay" section).
2. Get the code from the Monaco editor.
3. Execute it inside a Web Worker (see "Web Worker Execution" section). The code
   in the editor should be able to use all exports from js-quantum. The
   execution environment must:
   - Import everything from `https://esm.sh/jsr/@hviana/js-quantum@1.5.4`.
   - Make all exports available as global variables to the user's code (e.g.,
     `QuantumCircuit`, `SimulatorBackend`, `hlapi`, `param`, `Complex`,
     `Matrix`, etc.).
   - The user's code must assign its result to a special variable called
     `result`. This `result` should be an `ExecutionResult` object (a
     `Record<string, number>` mapping bitstrings to percentages).
4. On success: dismiss the loading overlay and render the results as a bar chart
   in the Results Panel.
5. On error: dismiss the loading overlay and display the error in the results
   panel with a ❌ prefix.

### 2. View Circuit Button (🔬)

Opens a **modal/popup overlay** with a visual representation of the quantum
circuit.

#### Circuit Visualization Requirements

- Parse the `QuantumCircuit` from the user's code (the code should also expose
  the circuit via a variable called `circuit`).
- Draw the circuit diagram using an **HTML5 Canvas** or **SVG** (preferred:
  Canvas for zoom/scroll).
- **Visual elements**:
  - Horizontal lines for each qubit (labeled `q0`, `q1`, ...).
  - Horizontal lines for classical bits (labeled `c0`, `c1`, ..., drawn as
    double lines or dashed).
  - Gates drawn as boxes on the qubit lines:
    - Single-qubit gates: small rectangles with gate name text (e.g., `H`, `X`,
      `RX(θ)`).
    - Controlled gates: a filled circle (●) on control qubit, line down to
      target, target shows gate box or ⊕ for CX.
    - Multi-controlled gates: multiple ● connected by vertical line to target.
    - SWAP gates: two ✕ symbols connected by a vertical line.
    - Measurement: a box with `M` or 📏 connecting qubit line to classical bit
      line with an arrow.
    - Barrier: a dashed vertical line across affected qubits.
  - **Control-flow directives** (if, for_loop, while_loop, switch): draw as
    labeled grouped boxes spanning the affected qubits, with the directive name
    displayed (e.g., `if`, `for`, `while`, `switch`). Use the actual directive
    names, not emojis.
  - Gate names must use actual names: `H`, `X`, `Y`, `Z`, `CX`, `CZ`, `CCX`,
    `SWAP`, `RX`, `RY`, `RZ`, `S`, `T`, `U`, `P`, etc. No emojis for gate names.
- **Interactions**:
  - 🔍 **Zoom in** button.
  - 🔎 **Zoom out** button.
  - **Scroll**: both vertical and horizontal scrolling within the modal (for
    large circuits).
  - 📥 **Download as image** button: export the canvas/SVG to a PNG file for
    download.
- The modal should have a close button (✖️) and close on overlay click.
- The modal should be responsive: full screen on mobile, centered with max-width
  on desktop.

### 3. Download OpenQASM Button (📥)

When clicked:

1. Show the global loading overlay (see "Global Loading Overlay" section below).
2. Get the code from the Monaco editor.
3. Execute it inside a Web Worker (see "Web Worker Execution" section below) to
   obtain the `circuit` variable (a `QuantumCircuit` instance).
4. Use `OpenQASM3Serializer` to serialize the circuit to OpenQASM 3.0 source
   code.
5. Create a Blob with MIME type `text/plain` containing the OpenQASM source.
6. Trigger a download with filename `quantum-circuit.qasm`.
7. Dismiss the loading overlay on success, or display the error and dismiss the
   overlay on failure.

### 4. Save Button (💾)

- Get the content from the Monaco editor.
- Create a Blob with MIME type `application/javascript`.
- Trigger a download with filename `quantum-circuit.js`.

### 5. Load Button (📂)

- Open a file input dialog accepting `.js` files.
- Read the selected file's content.
- Set it as the Monaco editor's content.

### 6. Examples Dropdown (📋)

A dropdown/popover with these example entries. Each loads its code into the
editor.

#### Example A: "🟢 Simple — Bell State"

```js
// Simple Example: Bell State (2 qubits)
// Creates a maximally entangled pair |00⟩ + |11⟩

const qc = new QuantumCircuit();
qc.h(0); // Put qubit 0 in superposition
qc.cx(0, 1); // Entangle qubit 0 and qubit 1
qc.measure(0, 0);
qc.measure(1, 1);

const backend = new SimulatorBackend(1024);
const executable = backend.transpileAndPackage(qc);
const result = backend.execute(executable);
// Expected: ~50% |00⟩, ~50% |11⟩

const circuit = qc; // For circuit visualization
```

#### Example B: "🟡 Medium — GHZ State (3 qubits)"

```js
// Medium Example: GHZ State (3 qubits)
// Creates |000⟩ + |111⟩ — a 3-qubit entangled state

const qc = new QuantumCircuit();
qc.h(0);
qc.cx(0, 1);
qc.cx(0, 2);
qc.measure(0, 0);
qc.measure(1, 1);
qc.measure(2, 2);

const backend = new SimulatorBackend(2048);
const executable = backend.transpileAndPackage(qc);
const result = backend.execute(executable);
// Expected: ~50% |000⟩, ~50% |111⟩

const circuit = qc;
```

#### Example C: "🔴 Complex — Quantum Teleportation (3 qubits)"

```js
// Complex Example: Quantum Teleportation Protocol
// Teleport the state of qubit 0 to qubit 2 using entanglement

const qc = new QuantumCircuit();

// Step 1: Prepare the state to teleport on qubit 0
// (Applying H and T to create an interesting state)
qc.h(0);
qc.t(0);

// Step 2: Create Bell pair between qubit 1 and qubit 2
qc.h(1);
qc.cx(1, 2);

// Step 3: Alice's operations (Bell measurement on qubits 0,1)
qc.cx(0, 1);
qc.h(0);
qc.measure(0, 0);
qc.measure(1, 1);

// Step 4: Bob's corrections (classically controlled)
// Using if-test for conditional corrections
const xCorrection = new QuantumCircuit();
xCorrection.x(2);

const zCorrection = new QuantumCircuit();
zCorrection.z(2);

qc.ifTest({ register: 1, value: 1 }, xCorrection);
qc.ifTest({ register: 0, value: 1 }, zCorrection);

qc.measure(2, 2);

const backend = new SimulatorBackend(4096);
const executable = backend.transpileAndPackage(qc);
const result = backend.execute(executable);

const circuit = qc;
```

#### Example D: "📘 Didactic — High-Level API (Experimental)"

```js
// Didactic Example: Using the High-Level API (Experimental)
// This demonstrates the hlapi for building quantum algorithms declaratively.
//
// The High-Level API lets you describe WHAT you want to solve,
// not HOW to build the circuit. It is experimental.
//
// In this example, we use Grover's search to find a marked item
// in a small search space (2 qubits = 4 items).

// Step 1: Define the problem
const problem = hlapi.create_problem({
  class: "hidden_subgroup",
  task: "search",
  objective: "Find the marked item in an unstructured database",
  inputs: { num_items: 4, marked_item: 3 },
  outputs: { found_item: "integer" },
  promises: { unique_solution: true },
  constraints: {},
  success_criteria: { min_probability: 0.9 },
  symmetries: [],
});

// Step 2: Define the computational space
const space = hlapi.create_space({
  model: "gate",
  carriers: { type: "qubit", count: 2 },
  registers: [{ name: "search", role: "data", size: 2 }],
  topology: "all_to_all",
  noise: "ideal",
  resources: { max_depth: 50 },
});

// Step 3: Define the oracle (marks state |11⟩ = item 3)
const oracle = hlapi.define(space, {
  kind: "oracle",
  name: "search_oracle",
  spec: {
    type: "phase",
    marked_states: ["11"],
  },
});

// Step 4: Solve using Grover's algorithm family
const process = hlapi.solve(problem, {
  algorithm_family: "grover_search",
  preset: "textbook_grover",
  space,
  artifacts: [oracle],
  parameters: { iterations: 1 },
});

// Step 5: Run the process
const runResult = hlapi.run(process, {
  target: { backend: "simulator" },
  compilation: { optimization_level: 1 },
  sampling: { shots: 1024 },
});

// Step 6: Analyze results
const answer = hlapi.analyze(runResult, {
  method: "majority_vote",
  decode: "integer",
});

// For the playground, we extract the execution result:
// The hlapi.run returns a ResultRef with histogram data
const result = runResult.histogram || { "11": 97, "00": 1, "01": 1, "10": 1 };

// Build a circuit for visualization (manual equivalent)
const qc = new QuantumCircuit();
qc.h(0);
qc.h(1);
// Oracle: mark |11⟩ with phase flip
qc.cz(0, 1);
// Diffusion operator
qc.h(0);
qc.h(1);
qc.x(0);
qc.x(1);
qc.cz(0, 1);
qc.x(0);
qc.x(1);
qc.h(0);
qc.h(1);
qc.measure(0, 0);
qc.measure(1, 1);
const circuit = qc;
```

### 7. "Run on Quantum Computer" Dropdown (🖥️)

A dropdown with these examples:

#### Example: "🔗 IBM Quantum Backend"

```js
// Running on IBM Quantum Hardware
// This example shows how to submit a circuit to a real quantum computer
// via the IBM Quantum API.
//
// You need your IBM Cloud instance CRN and either an IBM Cloud API key
// or a short-lived IAM bearer token. Get them from:
// https://quantum.cloud.ibm.com/

const qc = new QuantumCircuit();
qc.h(0);
qc.cx(0, 1);
qc.measure(0, 0);
qc.measure(1, 1);

// Configure the IBM Backend
const ibmBackend = new IBMBackend({
  name: "ibm_brisbane",
  numQubits: 127,
  basisGates: ["ecr", "id", "rz", "sx", "x"],
  couplingMap: [[0, 1], [1, 0], [1, 2], [2, 1]], // Simplified; real device has more
  apiEndpoint: "https://quantum.cloud.ibm.com/api/v1",
  serviceCrn: "YOUR_IBM_SERVICE_CRN_HERE", // <-- Replace with your instance CRN
  apiKey: "YOUR_IBM_API_KEY_HERE", // <-- Library exchanges this for a bearer token
  // Or use bearerToken: "YOUR_IBM_BEARER_TOKEN_HERE",
});

// Transpile and execute
const executable = ibmBackend.transpileAndPackage(qc, 1024);
const result = await ibmBackend.execute(executable);
// Result will contain measurement outcomes from real quantum hardware

const circuit = qc;
```

Note: The default API URL `https://quantum.cloud.ibm.com/api/v1` must be shown
explicitly in the example code.

#### Example: "🔗 qBraid Quantum Backend"

```js
// Running on qBraid Quantum Hardware
// This example shows how to submit a circuit to a quantum device
// via the qBraid API.
//
// You need a qBraid API key. Get one at:
// https://account.qbraid.com/

const qc = new QuantumCircuit();
qc.h(0);
qc.cx(0, 1);
qc.measure(0, 0);
qc.measure(1, 1);

// Configure the qBraid Backend
const qbraidBackend = new QBraidBackend({
  name: "qbraid_simulator",
  numQubits: 5,
  basisGates: ["cx", "id", "rz", "sx", "x"],
  couplingMap: [[0, 1], [1, 0], [1, 2], [2, 1]], // Simplified; real device has more
  deviceQrn: "qbraid_qir_simulator",
  apiEndpoint: "https://api-v2.qbraid.com/api/v1",
  apiKey: "YOUR_QBRAID_API_KEY_HERE", // <-- Replace with your API key
});

// Transpile and execute
const executable = qbraidBackend.transpileAndPackage(qc, 1024);
const result = await qbraidBackend.execute(executable);
// Result will contain measurement outcomes from quantum hardware

const circuit = qc;
```

Note: The default API URL `https://api-v2.qbraid.com/api/v1` must be shown
explicitly in the example code.

### 8. Help Button (❓)

Simply opens a new tab to:

```
https://jsr.io/@hviana/js-quantum
```

Use `window.open('https://jsr.io/@hviana/js-quantum', '_blank')`.

---

## CSS / Styling Guidelines

### Color Palette (Quantum Theme)

```css
:root {
  --bg-primary: #0a0a1a; /* Deep dark blue-black */
  --bg-secondary: #12122a; /* Slightly lighter panel bg */
  --bg-card: #1a1a3e; /* Card/modal background */
  --accent-primary: #7c3aed; /* Electric purple */
  --accent-secondary: #06b6d4; /* Cyan */
  --accent-gradient: linear-gradient(135deg, #7c3aed, #06b6d4);
  --text-primary: #e2e8f0; /* Light gray text */
  --text-secondary: #94a3b8; /* Muted text */
  --success: #22c55e; /* Green for results */
  --error: #ef4444; /* Red for errors */
  --border: #2d2d5e; /* Subtle borders */
}
```

### General Styling

- `box-sizing: border-box` on everything.
- Body: `font-family: system-ui, -apple-system, sans-serif`.
- Smooth scrolling, no horizontal overflow.
- Buttons: rounded (8px+), with gradient or solid accent backgrounds, hover
  effects (brightness/scale transitions), and emoji before text.
- Dropdowns: styled custom dropdowns (not native `<select>`), using positioned
  absolute `<div>` panels that toggle on click.
- Toolbar: `display: flex; flex-wrap: wrap; gap: 8px;`, centered alignment.
- Results bars: animated width transitions (CSS `transition: width 0.5s ease`).
- Modal: backdrop blur, fade-in animation, responsive sizing.

### Responsive Breakpoints

```css
/* Mobile first (default) */
/* Tablet */
@media (min-width: 768px) { ... }
/* Desktop */
@media (min-width: 1024px) { ... }
```

---

## JavaScript Architecture

### Module Loading

```js
// 1. Load Monaco
require.config({
  paths: {
    vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.55.1/min/vs",
  },
});

// 2. Load js-quantum (dynamic import in module context)
// Since the page is a regular HTML file, use dynamic import:
const quantum = await import("https://esm.sh/jsr/@hviana/js-quantum@1.5.4");
```

### Web Worker Execution

**All code execution (Run, View Circuit, Download OpenQASM) MUST run inside a
Web Worker** so that heavy computation does not block the main thread or freeze
the UI. The main thread must remain responsive at all times.

**Implementation approach**:

1. When the user triggers execution (Run, View Circuit, or Download OpenQASM),
   create a Web Worker from an inline Blob.
2. The Worker script should:
   - Import js-quantum via `import()` from the CDN URL.
   - Destructure all exports and make them available to the user's code.
   - Execute the user's code.
   - Post back the result (`result`, `circuit`, and/or serialized OpenQASM) via
     `postMessage`.
3. The main thread listens for the Worker's `message` event (success) and
   `error` event (failure).
4. After receiving the response (or error), terminate the Worker.

```js
function executeInWorker(code) {
  return new Promise((resolve, reject) => {
    const workerCode = `
      self.onmessage = async function(e) {
        try {
          const Q = await import('https://esm.sh/jsr/@hviana/js-quantum@1.5.4');
          const { QuantumCircuit, SimulatorBackend, IBMBackend, QBraidBackend, hlapi, param,
                  Complex, Matrix, OpenQASM3Serializer, blochSphere,
                  transpile, optimize, layoutSABRE, routeSABRE, decomposeKAK,
                  decomposeToRzSx, decomposeZYZ, synthesizeHighLevel,
                  translateToBasis, unrollComposites } = Q;

          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          const fn = new AsyncFunction(
            'QuantumCircuit', 'SimulatorBackend', 'IBMBackend', 'QBraidBackend', 'hlapi', 'param',
            'Complex', 'Matrix', 'OpenQASM3Serializer', 'blochSphere',
            'transpile', 'optimize', 'layoutSABRE', 'routeSABRE', 'decomposeKAK',
            'decomposeToRzSx', 'decomposeZYZ', 'synthesizeHighLevel',
            'translateToBasis', 'unrollComposites',
            e.data.code + '\\nreturn { result: typeof result !== "undefined" ? result : null, circuit: typeof circuit !== "undefined" ? circuit : null };'
          );
          const output = await fn(QuantumCircuit, SimulatorBackend, IBMBackend, QBraidBackend, hlapi, param,
                                   Complex, Matrix, OpenQASM3Serializer, blochSphere,
                                   transpile, optimize, layoutSABRE, routeSABRE, decomposeKAK,
                                   decomposeToRzSx, decomposeZYZ, synthesizeHighLevel,
                                   translateToBasis, unrollComposites);
          self.postMessage({ success: true, data: output });
        } catch (err) {
          self.postMessage({ success: false, error: err.message });
        }
      };
    `;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const worker = new Worker(URL.createObjectURL(blob), { type: "module" });

    worker.onmessage = (e) => {
      worker.terminate();
      if (e.data.success) resolve(e.data.data);
      else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({ code });
  });
}
```

> **Note**: Because complex objects (like `QuantumCircuit` instances) cannot be
> transferred across Worker boundaries via structured cloning, the Worker must
> also perform any serialization needed (e.g., serialize the circuit to
> OpenQASM, extract `circuit.instructions` as plain JSON, compute the result
> histogram) and return only plain/serializable data to the main thread. The
> main thread then uses this serializable data for rendering (chart, circuit
> drawing, OpenQASM download).

### Global Loading Overlay

Whenever any execution is in progress (Run, View Circuit, Download OpenQASM, or
Run on Quantum Computer), a **full-screen loading overlay** must be displayed on
top of the entire page until execution finishes or an error occurs.

**Requirements**:

- The overlay covers the entire viewport
  (`position: fixed; inset: 0; z-index: 9999`).
- Semi-transparent dark background (e.g., `rgba(10, 10, 26, 0.85)`) with
  `backdrop-filter: blur(4px)`.
- Centered content showing:
  - A large animated spinner or pulsing atom emoji (⚛️).
  - Text: **"Executing…"** (or similar, e.g., "Running quantum circuit…").
- The overlay **blocks all user interaction** with the page beneath it
  (pointer-events on the overlay, none on content behind).
- The overlay is shown **immediately** when execution starts and dismissed
  **only** when:
  - Execution succeeds (then render results and dismiss), or
  - An error occurs (then show the error in the results panel and dismiss).
- Use a smooth fade-in / fade-out CSS transition for the overlay.

```css
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: rgba(10, 10, 26, 0.85);
  backdrop-filter: blur(4px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}
.loading-overlay.active {
  opacity: 1;
  pointer-events: all;
}
```

**Integration**: Every button/action that triggers code execution must follow
this pattern:

1. Show the global loading overlay.
2. Execute the user's code inside a Web Worker.
3. On success: dismiss overlay, render results.
4. On error: dismiss overlay, display error message in the results panel.

### Circuit Drawing (Canvas-based)

Use an HTML5 `<canvas>` element inside the modal.

**Drawing algorithm**:

1. Parse `circuit.instructions` array.
2. Assign each instruction to a "time slot" (column) based on qubit
   availability.
3. Draw qubit wire lines horizontally.
4. For each instruction, draw the appropriate symbol:
   - **Single-qubit gate**: Rectangle with gate name text at the intersection of
     qubit wire and time slot.
   - **Two-qubit controlled gate**: Filled circle on control qubit, line to
     target, gate box on target.
   - **CNOT (cx)**: Filled circle on control, ⊕ on target.
   - **SWAP**: ✕ on both qubits, connected by vertical line.
   - **CCX/Toffoli**: Two filled circles on controls, ⊕ on target.
   - **Measurement**: Box labeled `M` with arrow to classical bit line.
   - **Barrier**: Dashed vertical line.
   - **Control flow (if_test, for_loop, while_loop, switch)**: Draw a labeled
     bounding rectangle around the body instructions, with the directive name
     (e.g., `if`, `for`, `while`, `switch`) as a label. These use their real
     names — no emojis.
5. Support parameterized gates: show the parameter value in parentheses (e.g.,
   `RX(1.57)`).

**Zoom & Pan**:

- Track `scale` and `offset` variables.
- Zoom buttons adjust `scale` (e.g., ×1.5 in, ÷1.5 out).
- On redraw, apply `ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY)`.
- Allow mouse drag (desktop) and touch drag (mobile) for panning.
- Mouse wheel / pinch for zoom.

**Image Download**:

- Create a temporary canvas at full resolution.
- Call `canvas.toBlob()` and trigger download as `quantum-circuit.png`.

---

## Complete List of All js-quantum Exports to Expose

Make sure ALL of these are accessible in the user's code execution environment:

- `QuantumCircuit`
- `SimulatorBackend`
- `IBMBackend`
- `QBraidBackend`
- `OpenQASM3Serializer`
- `param`
- `Complex`
- `Matrix`
- `blochSphere`
- `transpile`
- `optimize`
- `layoutSABRE`
- `routeSABRE`
- `decomposeKAK`
- `decomposeToRzSx`
- `decomposeZYZ`
- `synthesizeHighLevel`
- `translateToBasis`
- `unrollComposites`
- `hlapi`

---

## Quantum Gate Names Reference (for Circuit Visualization)

Use these exact labels when drawing gates on the circuit. **Never** replace
these with emojis:

### Single-Qubit Gates

`ID`, `H`, `X`, `Y`, `Z`, `S`, `Sdg`, `T`, `Tdg`, `SX`, `SXdg`, `RX(θ)`,
`RY(θ)`, `RZ(θ)`, `R(θ,φ)`, `P(λ)`, `U(θ,φ,λ)`, `U1(λ)`, `U2(φ,λ)`, `U3(θ,φ,λ)`,
`RV(vx,vy,vz)`

### Two-Qubit Gates

`CX`, `CY`, `CZ`, `CH`, `CS`, `CSdg`, `CSX`, `CP(λ)`, `CRX(θ)`, `CRY(θ)`,
`CRZ(θ)`, `CU(θ,φ,λ,γ)`, `CU1(λ)`, `CU3(θ,φ,λ)`, `SWAP`, `iSWAP`, `DCX`, `ECR`,
`RXX(θ)`, `RYY(θ)`, `RZZ(θ)`, `RZX(θ)`, `XX-YY(θ,β)`, `XX+YY(θ,β)`

### Three-Qubit Gates

`CCX` (Toffoli), `CCZ`, `CSWAP` (Fredkin), `RCCX`

### Four-Qubit Gates

`MCX` (C3X), `C3SX`, `RCCCX`

### Multi-Controlled Gates

`MCX(n)`, `MCP(λ)`, `MCRX(θ)`, `MCRY(θ)`, `MCRZ(θ)`, `MS(θ)`

### Special

`Pauli(str)`, `Unitary`, `Prepare`, `Initialize`

### Non-Unitary

`Measure` (or `M`), `Reset`, `Barrier`, `Delay`

### Control Flow Directives (use real names, no emojis)

`if`, `for`, `while`, `switch`, `break`, `continue`, `box`

---

## Accessibility & UX Notes

- All buttons must have `title` attributes and `aria-label` for accessibility.
- The code editor should have a minimum height so it's usable on mobile.
- Error messages should be visible and clearly formatted.
- The results chart should handle edge cases: no measurements, single state,
  many states.
- Dropdown menus should close when clicking outside.
- The circuit modal should be dismissible via Escape key.
- Add a subtle pulsing animation to the Run button to draw attention.

---

## File Output

The resulting file should be saved as:

```
/js-quantum/index.html
```

It must be a single, self-contained HTML file that works by simply opening in a
browser (or serving via any static file server). No build step required.
