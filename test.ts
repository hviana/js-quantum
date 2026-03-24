import { Complex } from "./src/complex.ts";
import { Matrix } from "./src/matrix.ts";
import {
  cnotGate,
  hadamard,
  identity,
  pauliX,
  pauliY,
  pauliZ,
  phaseGate,
  rc3xGate,
  rccxGate,
  rxGate,
  rxxGate,
  rzGate,
  rzzGate,
  sGate,
  swapGate,
  sxdgGate,
  sxGate,
  tGate,
  toffoliGate,
  uGate,
} from "./src/gates.ts";
import { CircuitBuilder, quantum } from "./src/circuit.ts";
import { getStateVector, simulate } from "./src/simulator.ts";
import { deserialize, fromJSON, serialize, toJSON } from "./src/serializer.ts";
import {
  blochToSpherical,
  getBlochVector,
  getQubitState,
  reducedDensityMatrix,
} from "./src/bloch.ts";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

function approxEqual(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) < eps;
}

console.log("\n=== Complex Number Tests ===");
{
  const a = new Complex(3, 4);
  const b = new Complex(1, -2);

  const sum = a.add(b);
  assert(sum.re === 4 && sum.im === 2, "Addition: (3+4i)+(1-2i) = 4+2i");

  const prod = a.mul(b);
  assert(
    prod.re === 11 && prod.im === -2,
    "Multiplication: (3+4i)(1-2i) = 11-2i",
  );

  assert(a.conjugate().im === -4, "Conjugate of 3+4i = 3-4i");
  assert(a.magnitude() === 5, "Magnitude of 3+4i = 5");

  const euler = Complex.exp(Math.PI);
  assert(
    approxEqual(euler.re, -1, 1e-10) && approxEqual(euler.im, 0, 1e-10),
    "e^(iπ) ≈ -1",
  );

  assert(Complex.ZERO.isZero(), "ZERO is zero");
  assert(!Complex.ONE.isZero(), "ONE is not zero");
}

console.log("\n=== Matrix Tests ===");
{
  const I = Matrix.identity(2);
  const X = pauliX();
  const result = X.multiply(X);
  assert(
    result.get(0, 0).equals(Complex.ONE) &&
      result.get(1, 1).equals(Complex.ONE),
    "X² = I",
  );

  const H = hadamard();
  const H2 = H.multiply(H);
  assert(H2.get(0, 0).equals(Complex.ONE, 1e-10), "H² ≈ I");

  assert(H.isUnitary(), "H is unitary");
  assert(X.isUnitary(), "X is unitary");
  assert(pauliY().isUnitary(), "Y is unitary");
  assert(pauliZ().isUnitary(), "Z is unitary");
  assert(tGate().isUnitary(), "T is unitary");
  assert(sGate().isUnitary(), "S is unitary");
  assert(sxGate().isUnitary(), "SX is unitary");
  assert(sxdgGate().isUnitary(), "SXdg is unitary");
  assert(rxGate(Math.PI / 4).isUnitary(), "RX(π/4) is unitary");
  assert(rzGate(Math.PI / 4).isUnitary(), "RZ(π/4) is unitary");
  assert(
    uGate(Math.PI / 4, Math.PI / 3, Math.PI / 6).isUnitary(),
    "U(π/4,π/3,π/6) is unitary",
  );
  assert(phaseGate(0.5).isUnitary(), "P(0.5) is unitary");

  const tensor = I.tensor(X);
  assert(tensor.rows === 4 && tensor.cols === 4, "I⊗X is 4×4");

  // Apply X to |0⟩ should give |1⟩
  const ket0 = [Complex.ONE, Complex.ZERO];
  const ket1 = X.apply(ket0);
  assert(
    ket1[0]!.equals(Complex.ZERO) && ket1[1]!.equals(Complex.ONE),
    "X|0⟩ = |1⟩",
  );
}

console.log("\n=== Multi-qubit Gate Tests ===");
{
  assert(cnotGate().isUnitary(), "CNOT is unitary");
  assert(swapGate().isUnitary(), "SWAP is unitary");
  assert(toffoliGate().isUnitary(), "Toffoli is unitary");
  assert(rxxGate(Math.PI / 4).isUnitary(), "RXX is unitary");
  assert(rzzGate(Math.PI / 4).isUnitary(), "RZZ is unitary");
  assert(rccxGate().isUnitary(), "RCCX is unitary");
  assert(rc3xGate().isUnitary(), "RC3X is unitary");
}

console.log("\n=== Circuit Builder Tests ===");
{
  // Valid circuit
  const code = quantum(2, 2, (qc) => {
    qc.h(0);
    qc.cx(0, 1);
    qc.measure(0, 0);
    qc.measure(1, 1);
  });
  assert(code.numQubits === 2, "numQubits = 2");
  assert(code.numClassicalBits === 2, "numClassicalBits = 2");
  assert(code.instructions.length === 4, "4 instructions");

  // Invalid qubit
  let threw = false;
  try {
    quantum(1, 0, (qc) => {
      qc.h(5);
    });
  } catch {
    threw = true;
  }
  assert(threw, "Throws on invalid qubit index");

  // Duplicate qubits
  threw = false;
  try {
    quantum(2, 0, (qc) => {
      qc.cx(0, 0);
    });
  } catch {
    threw = true;
  }
  assert(threw, "Throws on duplicate qubit in CX");
}

console.log("\n=== Simulation Tests ===");
{
  // |0⟩ should always measure 0
  const zero = quantum(1, 1, (qc) => {
    qc.measure(0, 0);
  });
  const r0 = simulate(zero, {}, 100);
  assert(r0["0"] === 100, "|0⟩ measures 0 with 100%");

  // X|0⟩ = |1⟩ should always measure 1
  const one = quantum(1, 1, (qc) => {
    qc.x(0);
    qc.measure(0, 0);
  });
  const r1 = simulate(one, {}, 100);
  assert(r1["1"] === 100, "X|0⟩ measures 1 with 100%");

  // Bell state: should give ~50% |00⟩ and ~50% |11⟩
  const bell = quantum(2, 2, (qc) => {
    qc.h(0);
    qc.cx(0, 1);
    qc.measure(0, 0);
    qc.measure(1, 1);
  });
  const rBell = simulate(bell, {}, 10000);
  assert(
    rBell["00"] !== undefined && rBell["11"] !== undefined,
    "Bell state has 00 and 11",
  );
  assert(
    approxEqual(rBell["00"]!, 50, 5) && approxEqual(rBell["11"]!, 50, 5),
    `Bell state ~50/50 (got ${rBell["00"]?.toFixed(1)}/${
      rBell["11"]?.toFixed(1)
    })`,
  );
  assert(!rBell["01"] && !rBell["10"], "Bell state has no 01 or 10");

  // H twice = identity
  const hh = quantum(1, 1, (qc) => {
    qc.h(0);
    qc.h(0);
    qc.measure(0, 0);
  });
  const rHH = simulate(hh, {}, 100);
  assert(rHH["0"] === 100, "H·H = I: always measures 0");

  // State vector test: H|0⟩ = (|0⟩+|1⟩)/√2
  const sv = getStateVector(quantum(1, 0, (qc) => {
    qc.h(0);
  }));
  assert(
    approxEqual(sv[0]!.magnitudeSquared(), 0.5, 1e-10),
    "H|0⟩: P(0) = 0.5",
  );
  assert(
    approxEqual(sv[1]!.magnitudeSquared(), 0.5, 1e-10),
    "H|0⟩: P(1) = 0.5",
  );
}

console.log("\n=== Gate-Specific Simulation Tests ===");
{
  // Y|0⟩ = i|1⟩
  const svY = getStateVector(quantum(1, 0, (qc) => {
    qc.y(0);
  }));
  assert(
    svY[0]!.isZero() && approxEqual(svY[1]!.magnitudeSquared(), 1, 1e-10),
    "Y|0⟩ = i|1⟩",
  );

  // Z|0⟩ = |0⟩ (no effect on |0⟩)
  const svZ = getStateVector(quantum(1, 0, (qc) => {
    qc.z(0);
  }));
  assert(svZ[0]!.equals(Complex.ONE, 1e-10), "Z|0⟩ = |0⟩");

  // S gate
  const svS = getStateVector(quantum(1, 0, (qc) => {
    qc.x(0);
    qc.s(0);
  }));
  assert(svS[1]!.equals(Complex.I, 1e-10), "S|1⟩ = i|1⟩");

  // T gate
  const svT = getStateVector(quantum(1, 0, (qc) => {
    qc.x(0);
    qc.t(0);
  }));
  assert(
    approxEqual(svT[1]!.magnitudeSquared(), 1, 1e-10),
    "T|1⟩ has unit magnitude",
  );

  // SX·SX = X
  const svSX2 = getStateVector(quantum(1, 0, (qc) => {
    qc.sx(0);
    qc.sx(0);
  }));
  assert(
    svSX2[0]!.isZero(1e-10) &&
      approxEqual(svSX2[1]!.magnitudeSquared(), 1, 1e-10),
    "SX² = X",
  );

  // SWAP test
  const svSwap = getStateVector(quantum(2, 0, (qc) => {
    qc.x(0);
    qc.swap(0, 1);
  }));
  // |10⟩ → |01⟩
  assert(
    approxEqual(svSwap[1]!.magnitudeSquared(), 1, 1e-10),
    "SWAP|10⟩ = |01⟩",
  );

  // Identity
  const svId = getStateVector(quantum(1, 0, (qc) => {
    qc.id(0);
  }));
  assert(svId[0]!.equals(Complex.ONE, 1e-10), "I|0⟩ = |0⟩");

  // Toffoli: |11⟩|0⟩ → |11⟩|1⟩
  const svCCX = getStateVector(quantum(3, 0, (qc) => {
    qc.x(0);
    qc.x(1);
    qc.ccx(0, 1, 2);
  }));
  // State |111⟩ = index 7
  assert(
    approxEqual(svCCX[7]!.magnitudeSquared(), 1, 1e-10),
    "Toffoli |110⟩→|111⟩",
  );

  // RX(π)|0⟩ ≈ -i|1⟩
  const svRX = getStateVector(quantum(1, 0, (qc) => {
    qc.rx(Math.PI, 0);
  }));
  assert(
    svRX[0]!.isZero(1e-10) &&
      approxEqual(svRX[1]!.magnitudeSquared(), 1, 1e-10),
    "RX(π)|0⟩ = -i|1⟩",
  );

  // RZ test
  const svRZ = getStateVector(quantum(1, 0, (qc) => {
    qc.rz(Math.PI, 0);
  }));
  assert(
    approxEqual(svRZ[0]!.magnitudeSquared(), 1, 1e-10),
    "RZ(π)|0⟩ has unit probability",
  );
}

console.log("\n=== Controlled Gate Tests ===");
{
  // Controlled-X with control=|0⟩ → no flip
  const svCtrl0 = getStateVector(quantum(2, 0, (qc) => {
    qc.x(1, { ctrl: 0 });
  }));
  assert(
    approxEqual(svCtrl0[0]!.magnitudeSquared(), 1, 1e-10),
    "CX with ctrl=|0⟩: no flip",
  );

  // Controlled-X with control=|1⟩ → flip
  const svCtrl1 = getStateVector(quantum(2, 0, (qc) => {
    qc.x(0);
    qc.x(1, { ctrl: 0 });
  }));
  // |10⟩ → |11⟩ = index 3
  assert(
    approxEqual(svCtrl1[3]!.magnitudeSquared(), 1, 1e-10),
    "CX with ctrl=|1⟩: flips target",
  );
}

console.log("\n=== Classical Condition Tests ===");
{
  // X with cif=1 after measuring |1⟩
  const code = quantum(2, 1, (qc) => {
    qc.x(0); // Set qubit 0 to |1⟩
    qc.measure(0, 0); // Measure → classical bit 0 = 1 (register = 1)
    qc.x(1, { cif: 1 }); // Execute X on qubit 1 only if register == 1
    qc.measure(1, 0); // Overwrite classical bit
  });
  const r = simulate(code, {}, 100);
  // Qubit 1 should be flipped since condition was met
  assert(r["1"] === 100, "Classical condition met: X applied");

  // cif not met
  const code2 = quantum(2, 1, (qc) => {
    // qubit 0 stays |0⟩, measure → classical bit 0 = 0 (register = 0)
    qc.measure(0, 0);
    qc.x(1, { cif: 1 }); // register == 0, not 1 → skip
    qc.measure(1, 0);
  });
  const r2 = simulate(code2, {}, 100);
  assert(r2["0"] === 100, "Classical condition not met: X skipped");
}

console.log("\n=== Reset Tests ===");
{
  const code = quantum(1, 1, (qc) => {
    qc.x(0); // |0⟩ → |1⟩
    qc.reset(0); // |1⟩ → |0⟩
    qc.measure(0, 0);
  });
  const r = simulate(code, {}, 100);
  assert(r["0"] === 100, "Reset returns qubit to |0⟩");
}

console.log("\n=== Serialization Tests ===");
{
  const code = quantum(2, 2, (qc) => {
    qc.h(0);
    qc.cx(0, 1);
    qc.x(1, { ctrl: 0, cif: 1 });
    qc.measure(0, 0);
    qc.measure(1, 1);
  });

  const json = serialize(code);
  assert(
    json.meta.library === "jsQuantum",
    "Serialized has correct library name",
  );
  assert(json.numQubits === 2, "Serialized numQubits");
  assert(json.instructions.length === 5, "Serialized instruction count");
  assert(json.instructions[2]!.ctrl === 0, "Serialized ctrl preserved");
  assert(
    json.instructions[2]!.condition?.value === 1,
    "Serialized condition preserved",
  );

  // Round-trip
  const jsonStr = toJSON(code);
  const restored = fromJSON(jsonStr);
  assert(
    restored.numQubits === code.numQubits,
    "Round-trip: numQubits preserved",
  );
  assert(
    restored.instructions.length === code.instructions.length,
    "Round-trip: instruction count preserved",
  );

  // Simulate restored circuit
  const r1 = simulate(code, {}, 5000);
  const r2 = simulate(restored, {}, 5000);
  // Both should have similar results (stochastic, so just check keys)
  const keys1 = Object.keys(r1).sort();
  const keys2 = Object.keys(r2).sort();
  assert(
    keys1.length > 0 && keys2.length > 0,
    "Round-trip: both produce results",
  );
}

console.log("\n=== No-Measurement Probability Tests ===");
{
  // Without measure, should return theoretical probabilities
  const code = quantum(1, 0, (qc) => {
    qc.h(0);
  });
  const r = simulate(code, {}, 1000);
  assert(
    approxEqual(r["0"]!, 50, 1) && approxEqual(r["1"]!, 50, 1),
    "No-measure: theoretical 50/50",
  );
}

console.log("\n=== GHZ State Test ===");
{
  const ghz = quantum(3, 3, (qc) => {
    qc.h(0);
    qc.cx(0, 1);
    qc.cx(0, 2);
    qc.measure(0, 0);
    qc.measure(1, 1);
    qc.measure(2, 2);
  });
  const r = simulate(ghz, {}, 10000);
  assert(
    approxEqual(r["000"]!, 50, 5) && approxEqual(r["111"]!, 50, 5),
    `GHZ: ~50/50 (got ${r["000"]?.toFixed(1)}/${r["111"]?.toFixed(1)})`,
  );
}

console.log("\n=== Bloch Sphere Tests ===");
{
  // |0⟩ → north pole (0, 0, 1)
  const sv0 = getStateVector(quantum(1, 0, (_qc) => {}));
  const b0 = getBlochVector(sv0, 0, 1);
  assert(b0.x === 0 && b0.y === 0 && b0.z === 1, "|0⟩ → north pole (0, 0, 1)");

  // |1⟩ → south pole (0, 0, -1)
  const sv1 = getStateVector(quantum(1, 0, (qc) => {
    qc.x(0);
  }));
  const b1 = getBlochVector(sv1, 0, 1);
  assert(
    b1.x === 0 && b1.y === 0 && b1.z === -1,
    "|1⟩ → south pole (0, 0, -1)",
  );

  // H|0⟩ = |+⟩ → positive X-axis (1, 0, 0)
  const svH = getStateVector(quantum(1, 0, (qc) => {
    qc.h(0);
  }));
  const bH = getBlochVector(svH, 0, 1);
  assert(
    approxEqual(bH.x, 1, 1e-10) && approxEqual(bH.y, 0, 1e-10) &&
      approxEqual(bH.z, 0, 1e-10),
    "|+⟩ → (1, 0, 0)",
  );

  // S·H|0⟩ = |+i⟩ → positive Y-axis (0, 1, 0)
  const svSH = getStateVector(quantum(1, 0, (qc) => {
    qc.h(0);
    qc.s(0);
  }));
  const bSH = getBlochVector(svSH, 0, 1);
  assert(
    approxEqual(bSH.x, 0, 1e-10) && approxEqual(bSH.y, 1, 1e-10) &&
      approxEqual(bSH.z, 0, 1e-10),
    "|+i⟩ → (0, 1, 0)",
  );

  // Bell state: qubit 0 should be maximally mixed → center (0, 0, 0)
  const svBell = getStateVector(quantum(2, 0, (qc) => {
    qc.h(0);
    qc.cx(0, 1);
  }));
  const bBell = getQubitState(svBell, 0, 2);
  assert(
    approxEqual(bBell.bloch.x, 0, 1e-10) &&
      approxEqual(bBell.bloch.y, 0, 1e-10) &&
      approxEqual(bBell.bloch.z, 0, 1e-10),
    "Bell qubit 0 → maximally mixed (0, 0, 0)",
  );
  assert(
    approxEqual(bBell.purity, 0.5, 1e-10),
    "Bell qubit 0 purity = 0.5 (maximally mixed)",
  );
  assert(
    approxEqual(bBell.spherical.r, 0, 1e-10),
    "Bell qubit 0 radius = 0 (center)",
  );

  // Pure state purity should be 1
  const qPure = getQubitState(svH, 0, 1);
  assert(approxEqual(qPure.purity, 1, 1e-10), "|+⟩ purity = 1 (pure)");
  assert(approxEqual(qPure.prob0, 0.5, 1e-10), "|+⟩ P(0) = 0.5");
  assert(approxEqual(qPure.prob1, 0.5, 1e-10), "|+⟩ P(1) = 0.5");

  // Spherical coordinates: |0⟩ → θ=0 (north pole)
  const sph0 = blochToSpherical(b0);
  assert(
    approxEqual(sph0.theta, 0, 1e-10) && approxEqual(sph0.r, 1, 1e-10),
    "|0⟩ spherical: θ=0, r=1",
  );

  // Spherical coordinates: |1⟩ → θ=π (south pole)
  const sph1 = blochToSpherical(b1);
  assert(
    approxEqual(sph1.theta, Math.PI, 1e-10) && approxEqual(sph1.r, 1, 1e-10),
    "|1⟩ spherical: θ=π, r=1",
  );

  // Spherical coordinates: |+⟩ → θ=π/2, φ=0
  const sphH = blochToSpherical(bH);
  assert(
    approxEqual(sphH.theta, Math.PI / 2, 1e-10) &&
      approxEqual(sphH.phi, 0, 1e-10),
    "|+⟩ spherical: θ=π/2, φ=0",
  );
}

console.log("\n=== All Tests Passed! ===\n");
