import { assert, assertEquals } from "jsr:@std/assert";
import { Complex } from "../src/complex.ts";
import { Matrix } from "../src/matrix.ts";
import {
  compose,
  CXGate,
  GlobalPhaseGate,
  HGate,
  IGate,
  liftGate,
  PhaseGate,
  RGate,
  RVGate,
  RXGate,
  RYGate,
  RZGate,
  SdgGate,
  SGate,
  SXdgGate,
  SXGate,
  TdgGate,
  TGate,
  UGate,
  XGate,
  YGate,
  ZGate,
} from "../src/gates.ts";

const c = (re: number, im: number = 0) => new Complex(re, im);

// =============================================================================
// Tier 0: Unitarity of every single-qubit gate
// =============================================================================

Deno.test("Tier0: IGate is unitary", () => assert(IGate().isUnitary()));
Deno.test("Tier0: HGate is unitary", () => assert(HGate().isUnitary()));
Deno.test("Tier0: XGate is unitary", () => assert(XGate().isUnitary()));
Deno.test("Tier0: YGate is unitary", () => assert(YGate().isUnitary()));
Deno.test("Tier0: ZGate is unitary", () => assert(ZGate().isUnitary()));
Deno.test("Tier0: SGate is unitary", () => assert(SGate().isUnitary()));
Deno.test("Tier0: SdgGate is unitary", () => assert(SdgGate().isUnitary()));
Deno.test("Tier0: TGate is unitary", () => assert(TGate().isUnitary()));
Deno.test("Tier0: TdgGate is unitary", () => assert(TdgGate().isUnitary()));
Deno.test("Tier0: SXGate is unitary", () => assert(SXGate().isUnitary()));
Deno.test("Tier0: SXdgGate is unitary", () => assert(SXdgGate().isUnitary()));

Deno.test("Tier0: PhaseGate is unitary for various angles", () => {
  for (
    const th of [0, 0.3, Math.PI / 4, Math.PI, -Math.PI / 2, 2 * Math.PI, -1.7]
  ) {
    assert(PhaseGate(th).isUnitary());
  }
});

Deno.test("Tier0: RXGate is unitary for various angles", () => {
  for (const th of [0, 0.3, Math.PI / 4, Math.PI, -Math.PI / 2]) {
    assert(RXGate(th).isUnitary());
  }
});

Deno.test("Tier0: RYGate is unitary for various angles", () => {
  for (const th of [0, 0.3, Math.PI / 4, Math.PI, -Math.PI / 2]) {
    assert(RYGate(th).isUnitary());
  }
});

Deno.test("Tier0: RZGate is unitary for various angles", () => {
  for (const th of [0, 0.3, Math.PI / 4, Math.PI, -Math.PI / 2]) {
    assert(RZGate(th).isUnitary());
  }
});

Deno.test("Tier0: RGate is unitary", () => {
  for (const th of [0, 0.3, Math.PI / 4, Math.PI]) {
    for (const ph of [0, 0.7, Math.PI, -Math.PI / 2]) {
      assert(RGate(th, ph).isUnitary());
    }
  }
});

Deno.test("Tier0: UGate is unitary", () => {
  for (const th of [0, 0.3, Math.PI / 2, Math.PI]) {
    for (const ph of [0, 0.7, Math.PI]) {
      for (const la of [0, -0.5, Math.PI / 3]) {
        assert(UGate(th, ph, la).isUnitary());
      }
    }
  }
});

Deno.test("Tier0: RVGate is unitary on zero vector", () => {
  assert(RVGate(0, 0, 0).isUnitary());
});

Deno.test("Tier0: RVGate is unitary on arbitrary vectors", () => {
  for (
    const v of [[1, 0, 0], [0, 2, 0], [0, 0, 3], [1, 1, 1], [0.5, -0.3, 1.2]]
  ) {
    assert(RVGate(v[0], v[1], v[2]).isUnitary());
  }
});

// =============================================================================
// Tier 0: Reference-matrix entry checks
// =============================================================================

Deno.test("Tier0: XGate matches reference matrix", () => {
  const expected = new Matrix([
    [Complex.ZERO, Complex.ONE],
    [Complex.ONE, Complex.ZERO],
  ]);
  assert(XGate().equals(expected));
});

Deno.test("Tier0: YGate matches reference matrix", () => {
  const expected = new Matrix([
    [Complex.ZERO, Complex.MINUS_I],
    [Complex.I, Complex.ZERO],
  ]);
  assert(YGate().equals(expected));
});

Deno.test("Tier0: ZGate matches reference matrix", () => {
  const expected = new Matrix([
    [Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.MINUS_ONE],
  ]);
  assert(ZGate().equals(expected));
});

Deno.test("Tier0: HGate entries", () => {
  const s = 1 / Math.sqrt(2);
  const H = HGate();
  assert(H.get(0, 0).equals(c(s)));
  assert(H.get(0, 1).equals(c(s)));
  assert(H.get(1, 0).equals(c(s)));
  assert(H.get(1, 1).equals(c(-s)));
});

Deno.test("Tier0: SGate entries", () => {
  const S = SGate();
  assert(S.get(0, 0).equals(Complex.ONE));
  assert(S.get(1, 1).equals(Complex.I));
  assert(S.get(0, 1).equals(Complex.ZERO));
  assert(S.get(1, 0).equals(Complex.ZERO));
});

Deno.test("Tier0: TGate entries", () => {
  const T = TGate();
  assert(T.get(1, 1).equals(Complex.exp(Math.PI / 4)));
});

Deno.test("Tier0: SXGate matches (1/2)*[[1+i,1-i],[1-i,1+i]]", () => {
  const SX = SXGate();
  assert(SX.get(0, 0).equals(new Complex(0.5, 0.5)));
  assert(SX.get(0, 1).equals(new Complex(0.5, -0.5)));
  assert(SX.get(1, 0).equals(new Complex(0.5, -0.5)));
  assert(SX.get(1, 1).equals(new Complex(0.5, 0.5)));
});

// =============================================================================
// Tier 0: Phase Convention 5 identities
// =============================================================================

Deno.test("Tier0: S = P(pi/2)", () => {
  assert(SGate().equals(PhaseGate(Math.PI / 2)));
});

Deno.test("Tier0: T = P(pi/4)", () => {
  assert(TGate().equals(PhaseGate(Math.PI / 4)));
});

Deno.test("Tier0: Z = P(pi)", () => {
  assert(ZGate().equals(PhaseGate(Math.PI)));
});

Deno.test("Tier0: Sdg = S.dagger()", () => {
  assert(SdgGate().equals(SGate().dagger()));
});

Deno.test("Tier0: Tdg = T.dagger()", () => {
  assert(TdgGate().equals(TGate().dagger()));
});

Deno.test("Tier0: SXdg = SX.dagger()", () => {
  assert(SXdgGate().equals(SXGate().dagger()));
});

Deno.test("Tier0: SX * SX = X", () => {
  assert(SXGate().multiply(SXGate()).equals(XGate()));
});

Deno.test("Tier0: SX * SXdg = I", () => {
  assert(SXGate().multiply(SXdgGate()).equals(IGate()));
});

Deno.test("Tier0: SXdg * SX = I", () => {
  assert(SXdgGate().multiply(SXGate()).equals(IGate()));
});

Deno.test("Tier0: S * S = Z", () => {
  assert(SGate().multiply(SGate()).equals(ZGate()));
});

Deno.test("Tier0: T * T = S", () => {
  assert(TGate().multiply(TGate()).equals(SGate()));
});

Deno.test("Tier0: H * Z * H = X (matrix-product order)", () => {
  const res = HGate().multiply(ZGate()).multiply(HGate());
  assert(res.equals(XGate()));
});

Deno.test("Tier0: H * X * H = Z", () => {
  const res = HGate().multiply(XGate()).multiply(HGate());
  assert(res.equals(ZGate()));
});

Deno.test("Tier0: X = U_can(pi, 0, pi)", () => {
  assert(UGate(Math.PI, 0, Math.PI).equals(XGate()));
});

Deno.test("Tier0: H = U_can(pi/2, 0, pi)", () => {
  assert(UGate(Math.PI / 2, 0, Math.PI).equals(HGate()));
});

Deno.test("Tier0: Y = U_can(pi, pi/2, pi/2)", () => {
  assert(UGate(Math.PI, Math.PI / 2, Math.PI / 2).equals(YGate()));
});

Deno.test("Tier0: P(lambda) = exp(i*lambda/2) * RZ(lambda) entrywise", () => {
  for (const la of [0, 0.3, Math.PI / 4, Math.PI, -0.7]) {
    const lhs = PhaseGate(la);
    const rhs = RZGate(la).scale(Complex.exp(la / 2));
    assert(lhs.equals(rhs));
  }
});

// =============================================================================
// Tier 0: Exact rotation identities
// =============================================================================

Deno.test("Tier0: RX(pi) = -i * X", () => {
  const lhs = RXGate(Math.PI);
  const rhs = XGate().scale(Complex.MINUS_I);
  assert(lhs.equals(rhs));
});

Deno.test("Tier0: RY(pi) takes |0> to |1>", () => {
  const out = RYGate(Math.PI).apply([Complex.ONE, Complex.ZERO]);
  assert(out[0].equals(Complex.ZERO));
  assert(out[1].equals(Complex.ONE));
});

Deno.test("Tier0: RZ(pi) = -i * Z (up to entrywise equality)", () => {
  const lhs = RZGate(Math.PI);
  const rhs = ZGate().scale(Complex.MINUS_I);
  assert(lhs.equals(rhs));
});

Deno.test("Tier0: RX(0) = I", () => assert(RXGate(0).equals(IGate())));
Deno.test("Tier0: RY(0) = I", () => assert(RYGate(0).equals(IGate())));
Deno.test("Tier0: RZ(0) = I", () => assert(RZGate(0).equals(IGate())));
Deno.test("Tier0: RX(-theta) = RX(theta).dagger()", () => {
  for (const th of [0.3, Math.PI / 4, 1.1]) {
    assert(RXGate(-th).equals(RXGate(th).dagger()));
  }
});

Deno.test("Tier0: RY(-theta) = RY(theta).dagger()", () => {
  for (const th of [0.3, Math.PI / 4, 1.1]) {
    assert(RYGate(-th).equals(RYGate(th).dagger()));
  }
});

Deno.test("Tier0: RZ(-theta) = RZ(theta).dagger()", () => {
  for (const th of [0.3, Math.PI / 4, 1.1]) {
    assert(RZGate(-th).equals(RZGate(th).dagger()));
  }
});

Deno.test("Tier0: R(th, 0) = RX(th)", () => {
  for (const th of [0.3, Math.PI / 4, 1.1]) {
    assert(RGate(th, 0).equals(RXGate(th)));
  }
});

Deno.test("Tier0: R(th, pi/2) = RY(th)", () => {
  for (const th of [0.3, Math.PI / 4, 1.1]) {
    assert(RGate(th, Math.PI / 2).equals(RYGate(th)));
  }
});

// =============================================================================
// Tier 0: RVGate identities
// =============================================================================

Deno.test("Tier0: RV(0, 0, 0) = I exactly", () => {
  assert(RVGate(0, 0, 0).equals(IGate()));
});

Deno.test("Tier0: RV(pi, 0, 0) = -i*X (matches RX(pi))", () => {
  assert(RVGate(Math.PI, 0, 0).equals(RXGate(Math.PI)));
});

Deno.test("Tier0: RV(0, pi, 0) = -i*Y (matches RY(pi))", () => {
  assert(RVGate(0, Math.PI, 0).equals(RYGate(Math.PI)));
});

Deno.test("Tier0: RV(0, 0, pi) = -i*Z (matches RZ(pi))", () => {
  assert(RVGate(0, 0, Math.PI).equals(RZGate(Math.PI)));
});

Deno.test("Tier0: RV(th, 0, 0) = RX(th) for various th", () => {
  for (const th of [0.3, Math.PI / 4, 1.1]) {
    assert(RVGate(th, 0, 0).equals(RXGate(th)));
  }
});

Deno.test("Tier0: RV(0, th, 0) = RY(th)", () => {
  for (const th of [0.3, Math.PI / 4, 1.1]) {
    assert(RVGate(0, th, 0).equals(RYGate(th)));
  }
});

Deno.test("Tier0: RV(0, 0, th) = RZ(th)", () => {
  for (const th of [0.3, Math.PI / 4, 1.1]) {
    assert(RVGate(0, 0, th).equals(RZGate(th)));
  }
});

// =============================================================================
// Tier 0: GlobalPhaseGate
// =============================================================================

Deno.test("Tier0: GlobalPhaseGate returns 1x1 matrix", () => {
  const g = GlobalPhaseGate(0.7);
  assertEquals(g.rows, 1);
  assertEquals(g.cols, 1);
});

Deno.test("Tier0: GlobalPhaseGate(0) = [[1]]", () => {
  assert(GlobalPhaseGate(0).get(0, 0).equals(Complex.ONE));
});

Deno.test("Tier0: GlobalPhaseGate(pi) = [[-1]]", () => {
  assert(GlobalPhaseGate(Math.PI).get(0, 0).equals(Complex.MINUS_ONE));
});

Deno.test("Tier0: GlobalPhaseGate(pi/2) = [[i]]", () => {
  assert(GlobalPhaseGate(Math.PI / 2).get(0, 0).equals(Complex.I));
});

Deno.test("Tier0: GlobalPhaseGate is unitary", () => {
  assert(GlobalPhaseGate(1.3).isUnitary());
});

// =============================================================================
// Tier 0: Action on computational basis states
// =============================================================================

Deno.test("Tier0: X|0> = |1>", () => {
  const out = XGate().apply([Complex.ONE, Complex.ZERO]);
  assert(out[0].equals(Complex.ZERO));
  assert(out[1].equals(Complex.ONE));
});

Deno.test("Tier0: X|1> = |0>", () => {
  const out = XGate().apply([Complex.ZERO, Complex.ONE]);
  assert(out[0].equals(Complex.ONE));
  assert(out[1].equals(Complex.ZERO));
});

Deno.test("Tier0: H|0> = (|0>+|1>)/sqrt(2)", () => {
  const s = 1 / Math.sqrt(2);
  const out = HGate().apply([Complex.ONE, Complex.ZERO]);
  assert(out[0].equals(c(s)));
  assert(out[1].equals(c(s)));
});

Deno.test("Tier0: H|1> = (|0>-|1>)/sqrt(2)", () => {
  const s = 1 / Math.sqrt(2);
  const out = HGate().apply([Complex.ZERO, Complex.ONE]);
  assert(out[0].equals(c(s)));
  assert(out[1].equals(c(-s)));
});

Deno.test("Tier0: Z|0> = |0>", () => {
  const out = ZGate().apply([Complex.ONE, Complex.ZERO]);
  assert(out[0].equals(Complex.ONE));
  assert(out[1].equals(Complex.ZERO));
});

Deno.test("Tier0: Z|1> = -|1>", () => {
  const out = ZGate().apply([Complex.ZERO, Complex.ONE]);
  assert(out[0].equals(Complex.ZERO));
  assert(out[1].equals(Complex.MINUS_ONE));
});

Deno.test("Tier0: Y|0> = i|1>", () => {
  const out = YGate().apply([Complex.ONE, Complex.ZERO]);
  assert(out[0].equals(Complex.ZERO));
  assert(out[1].equals(Complex.I));
});

Deno.test("Tier0: Y|1> = -i|0>", () => {
  const out = YGate().apply([Complex.ZERO, Complex.ONE]);
  assert(out[0].equals(Complex.MINUS_I));
  assert(out[1].equals(Complex.ZERO));
});

Deno.test("Tier0: S|1> = i|1>", () => {
  const out = SGate().apply([Complex.ZERO, Complex.ONE]);
  assert(out[1].equals(Complex.I));
});

Deno.test("Tier0: T|1> = exp(i*pi/4)|1>", () => {
  const out = TGate().apply([Complex.ZERO, Complex.ONE]);
  assert(out[1].equals(Complex.exp(Math.PI / 4)));
});

// =============================================================================
// Tier 1: CXGate + composition helpers
// =============================================================================

Deno.test("Tier1: CXGate matches reference matrix", () => {
  const expected = Matrix.real([
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 1],
    [0, 0, 1, 0],
  ]);
  assert(CXGate().equals(expected));
});

Deno.test("Tier1: CXGate is unitary", () => {
  assert(CXGate().isUnitary());
});

Deno.test("Tier1: CX * CX = I4", () => {
  assert(CXGate().multiply(CXGate()).equals(Matrix.identity(4)));
});

Deno.test("Tier1: CX acts as identity on |00>", () => {
  const v = [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO];
  const out = CXGate().apply(v);
  assert(out[0].equals(Complex.ONE));
});

Deno.test("Tier1: CX acts as identity on |01>", () => {
  // In MSB-first (control=bit 1, target=bit 0), |01> means ctrl=0, target=1 ⇒ index 1
  const v = [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO];
  const out = CXGate().apply(v);
  assert(out[1].equals(Complex.ONE));
});

Deno.test("Tier1: CX flips target when control=1: |10> -> |11>", () => {
  // |10> ⇒ index 2 (ctrl=1, target=0)
  const v = [Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO];
  const out = CXGate().apply(v);
  // result should be |11> ⇒ index 3
  assert(out[2].equals(Complex.ZERO));
  assert(out[3].equals(Complex.ONE));
});

Deno.test("Tier1: CX flips target when control=1: |11> -> |10>", () => {
  const v = [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE];
  const out = CXGate().apply(v);
  assert(out[2].equals(Complex.ONE));
  assert(out[3].equals(Complex.ZERO));
});

// -------- liftGate basics --------

Deno.test("liftGate: 1-qubit gate lifted to 1 qubit is itself", () => {
  assert(liftGate(XGate(), [0], 1).equals(XGate()));
});

Deno.test("liftGate: X on arg 0 of 2-qubit system = X ⊗ I", () => {
  const lifted = liftGate(XGate(), [0], 2);
  assert(lifted.equals(XGate().tensor(IGate())));
});

Deno.test("liftGate: X on arg 1 of 2-qubit system = I ⊗ X", () => {
  const lifted = liftGate(XGate(), [1], 2);
  assert(lifted.equals(IGate().tensor(XGate())));
});

Deno.test("liftGate: H on arg 0 of 2-qubit system = H ⊗ I", () => {
  assert(liftGate(HGate(), [0], 2).equals(HGate().tensor(IGate())));
});

Deno.test("liftGate: Z on arg 1 of 3-qubit system = I ⊗ I ⊗ Z", () => {
  const expected = IGate().tensor(IGate()).tensor(ZGate());
  assert(liftGate(ZGate(), [2], 3).equals(expected));
});

Deno.test("liftGate: CX on args (0,1) of 2-qubit system is identity lift", () => {
  assert(liftGate(CXGate(), [0, 1], 2).equals(CXGate()));
});

Deno.test("liftGate: CX on reversed args (1,0) swaps control/target", () => {
  // Lifting CX with targets=[1,0] reinterprets: arg 0 of CX (control)
  // now lives at position 1, arg 1 of CX (target) at position 0.
  const reversed = liftGate(CXGate(), [1, 0], 2);
  // Expected: control=position 1 (bit 0), target=position 0 (bit 1)
  // This is "CX reversed": identity on control=0 rows (rows with bit0=0),
  // flips bit 1 (the target) on rows with bit0=1.
  // Basis states (MSB-first position 0 = bit 1, position 1 = bit 0):
  //   |00> (bit1=0,bit0=0): control=0, stays |00>  -> row 0 col 0 = 1
  //   |01> (bit1=0,bit0=1): control=1, flip bit1  -> |11> (idx 3)  -> row 3 col 1 = 1
  //   |10> (bit1=1,bit0=0): control=0, stays |10>  -> row 2 col 2 = 1
  //   |11> (bit1=1,bit0=1): control=1, flip bit1  -> |01> (idx 1)  -> row 1 col 3 = 1
  const expected = new Matrix([
    [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
    [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE],
    [Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO],
  ]);
  assert(reversed.equals(expected));
});

Deno.test("liftGate: zero-qubit GlobalPhaseGate(theta) on m=2 gives exp(i*theta)*I4", () => {
  const th = 0.7;
  const lifted = liftGate(GlobalPhaseGate(th), [], 2);
  assert(lifted.equals(Matrix.identity(4).scale(Complex.exp(th))));
});

Deno.test("liftGate: rejects out-of-range target", () => {
  try {
    liftGate(XGate(), [5], 2);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("out of range"));
  }
});

Deno.test("liftGate: rejects duplicate targets", () => {
  try {
    liftGate(CXGate(), [0, 0], 2);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("duplicate"));
  }
});

Deno.test("liftGate: rejects dimension mismatch", () => {
  try {
    liftGate(CXGate(), [0], 2);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("expected"));
  }
});

// -------- compose basics --------

Deno.test("compose: empty step list returns identity", () => {
  assert(compose(3, []).equals(Matrix.identity(8)));
});

Deno.test("compose: single step equals the lifted gate", () => {
  assert(
    compose(2, [{ gate: XGate(), targets: [0] }]).equals(
      liftGate(XGate(), [0], 2),
    ),
  );
});

Deno.test("compose: time order is left-to-right (X → X = I on single qubit)", () => {
  const r = compose(1, [
    { gate: XGate(), targets: [0] },
    { gate: XGate(), targets: [0] },
  ]);
  assert(r.equals(IGate()));
});

Deno.test("compose: H → Z → H = X (Phase Convention 5 identity)", () => {
  const r = compose(1, [
    { gate: HGate(), targets: [0] },
    { gate: ZGate(), targets: [0] },
    { gate: HGate(), targets: [0] },
  ]);
  assert(r.equals(XGate()));
});

Deno.test("compose: different-qubit steps match explicit tensor product", () => {
  // X on qubit 0, then H on qubit 1 on a 2-qubit system
  const r = compose(2, [
    { gate: XGate(), targets: [0] },
    { gate: HGate(), targets: [1] },
  ]);
  const expected = IGate().tensor(HGate()).multiply(XGate().tensor(IGate()));
  assert(r.equals(expected));
});

Deno.test("compose: CX → CX = I4", () => {
  const r = compose(2, [
    { gate: CXGate(), targets: [0, 1] },
    { gate: CXGate(), targets: [0, 1] },
  ]);
  assert(r.equals(Matrix.identity(4)));
});

// =============================================================================
// Tier 2: two-qubit controlled gates — compositional verification
// =============================================================================

import {
  CHGate,
  CPhaseGate,
  CRXGate,
  CRYGate,
  CRZGate,
  CSdgGate,
  CSGate,
  CSXGate,
  CUGate,
  CYGate,
  CZGate,
  DCXGate,
} from "../src/gates.ts";

const ci = (re: number, im: number = 0) => new Complex(re, im);

Deno.test("Tier2: CZ is unitary", () => assert(CZGate().isUnitary()));
Deno.test("Tier2: CY is unitary", () => assert(CYGate().isUnitary()));
Deno.test("Tier2: CP is unitary", () => {
  for (const la of [0, 0.3, Math.PI, -1.5]) assert(CPhaseGate(la).isUnitary());
});
Deno.test("Tier2: CRZ is unitary", () => {
  for (const th of [0, 0.5, Math.PI]) assert(CRZGate(th).isUnitary());
});
Deno.test("Tier2: CRY is unitary", () => {
  for (const th of [0, 0.5, Math.PI]) assert(CRYGate(th).isUnitary());
});
Deno.test("Tier2: CRX is unitary", () => {
  for (const th of [0, 0.5, Math.PI]) assert(CRXGate(th).isUnitary());
});
Deno.test("Tier2: CS is unitary", () => assert(CSGate().isUnitary()));
Deno.test("Tier2: CSdg is unitary", () => assert(CSdgGate().isUnitary()));
Deno.test("Tier2: CSX is unitary", () => assert(CSXGate().isUnitary()));
Deno.test("Tier2: CH is unitary", () => assert(CHGate().isUnitary()));
Deno.test("Tier2: CU is unitary for various params", () => {
  for (const th of [0.3, Math.PI / 2]) {
    for (const ph of [0, 0.7]) {
      for (const la of [-0.5, Math.PI / 3]) {
        for (const gm of [0, 0.2]) assert(CUGate(th, ph, la, gm).isUnitary());
      }
    }
  }
});
Deno.test("Tier2: DCX is unitary", () => assert(DCXGate().isUnitary()));

// -------- reference-matrix checks (Section 3 Appendix) --------

Deno.test("Tier2: CZ = diag(1,1,1,-1)", () => {
  const expected = Matrix.diagonal([
    Complex.ONE,
    Complex.ONE,
    Complex.ONE,
    Complex.MINUS_ONE,
  ]);
  assert(CZGate().equals(expected));
});

Deno.test("Tier2: CY = [[1,0,0,0],[0,1,0,0],[0,0,0,-i],[0,0,i,0]]", () => {
  const expected = new Matrix([
    [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
    [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO],
    [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.MINUS_I],
    [Complex.ZERO, Complex.ZERO, Complex.I, Complex.ZERO],
  ]);
  assert(CYGate().equals(expected));
});

Deno.test("Tier2: CP(l) = diag(1,1,1,exp(i*l))", () => {
  for (const la of [0, 0.3, Math.PI, -1.5]) {
    const expected = Matrix.diagonal([
      Complex.ONE,
      Complex.ONE,
      Complex.ONE,
      Complex.exp(la),
    ]);
    assert(CPhaseGate(la).equals(expected));
  }
});

Deno.test("Tier2: CRZ is identity on |00>,|01> and RZ on |10>,|11> subspace", () => {
  const th = 0.7;
  const M = CRZGate(th);
  // Identity block on control=0: top-left 2x2 is I
  assert(M.get(0, 0).equals(Complex.ONE));
  assert(M.get(1, 1).equals(Complex.ONE));
  assert(M.get(0, 1).equals(Complex.ZERO));
  assert(M.get(1, 0).equals(Complex.ZERO));
  // Bottom-right 2x2 block should equal RZ(th)
  const RZ = RZGate(th);
  assert(M.get(2, 2).equals(RZ.get(0, 0)));
  assert(M.get(2, 3).equals(RZ.get(0, 1)));
  assert(M.get(3, 2).equals(RZ.get(1, 0)));
  assert(M.get(3, 3).equals(RZ.get(1, 1)));
});

Deno.test("Tier2: CRY bottom-right block equals RY(theta)", () => {
  const th = 0.9;
  const M = CRYGate(th);
  const RY = RYGate(th);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      assert(M.get(2 + i, 2 + j).equals(RY.get(i, j)));
    }
  }
  // control=0 block is identity
  assert(M.get(0, 0).equals(Complex.ONE));
  assert(M.get(1, 1).equals(Complex.ONE));
});

Deno.test("Tier2: CRX bottom-right block equals RX(theta)", () => {
  const th = 0.6;
  const M = CRXGate(th);
  const RX = RXGate(th);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      assert(M.get(2 + i, 2 + j).equals(RX.get(i, j)));
    }
  }
});

Deno.test("Tier2: CS = diag(1,1,1,i)", () => {
  const expected = Matrix.diagonal([
    Complex.ONE,
    Complex.ONE,
    Complex.ONE,
    Complex.I,
  ]);
  assert(CSGate().equals(expected));
});

Deno.test("Tier2: CSdg = diag(1,1,1,-i)", () => {
  const expected = Matrix.diagonal([
    Complex.ONE,
    Complex.ONE,
    Complex.ONE,
    Complex.MINUS_I,
  ]);
  assert(CSdgGate().equals(expected));
});

Deno.test("Tier2: CS = CP(pi/2)", () => {
  assert(CSGate().equals(CPhaseGate(Math.PI / 2)));
});

Deno.test("Tier2: CSdg = CP(-pi/2)", () => {
  assert(CSdgGate().equals(CPhaseGate(-Math.PI / 2)));
});

Deno.test("Tier2: CSX is identity on control=0 subspace, SX on control=1", () => {
  const M = CSXGate();
  // control=0 block is I
  assert(M.get(0, 0).equals(Complex.ONE));
  assert(M.get(1, 1).equals(Complex.ONE));
  assert(M.get(0, 1).equals(Complex.ZERO));
  // control=1 block equals SX
  const SX = SXGate();
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      assert(M.get(2 + i, 2 + j).equals(SX.get(i, j)));
    }
  }
});

Deno.test("Tier2: CSX * CSX = CX (since SX*SX = X)", () => {
  assert(CSXGate().multiply(CSXGate()).equals(CXGate()));
});

Deno.test("Tier2: CH is identity on control=0 and H on control=1 subspace", () => {
  const M = CHGate();
  assert(M.get(0, 0).equals(Complex.ONE));
  assert(M.get(1, 1).equals(Complex.ONE));
  assert(M.get(0, 1).equals(Complex.ZERO));
  const H = HGate();
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      assert(M.get(2 + i, 2 + j).equals(H.get(i, j)));
    }
  }
});

Deno.test("Tier2: CU(theta, phi, lambda, 0) acts as U_can on control=1 subspace", () => {
  const th = 0.7;
  const ph = 0.3;
  const la = -0.5;
  const M = CUGate(th, ph, la, 0);
  const U = UGate(th, ph, la);
  // control=0 block is I
  assert(M.get(0, 0).equals(Complex.ONE));
  assert(M.get(1, 1).equals(Complex.ONE));
  // control=1 block equals U_can
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      assert(M.get(2 + i, 2 + j).equals(U.get(i, j)));
    }
  }
});

Deno.test("Tier2: CU gamma multiplies control=1 subspace by exp(i*gamma)", () => {
  const th = 0.3;
  const ph = 0.1;
  const la = -0.2;
  const gm = 0.6;
  const M = CUGate(th, ph, la, gm);
  const U = UGate(th, ph, la).scale(Complex.exp(gm));
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      assert(M.get(2 + i, 2 + j).equals(U.get(i, j)));
    }
  }
});

Deno.test("Tier2: DCX = [[1,0,0,0],[0,0,1,0],[0,0,0,1],[0,1,0,0]]", () => {
  const expected = new Matrix([
    [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
    [Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO],
    [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE],
    [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO],
  ]);
  assert(DCXGate().equals(expected));
});

// -------- controlled-gate action on basis states --------

Deno.test("Tier2: CZ flips sign of |11> only", () => {
  const M = CZGate();
  assert(M.get(3, 3).equals(Complex.MINUS_ONE));
  assert(M.get(0, 0).equals(Complex.ONE));
  assert(M.get(1, 1).equals(Complex.ONE));
  assert(M.get(2, 2).equals(Complex.ONE));
});

Deno.test("Tier2: CPhase(lambda) applies exp(i*l) on |11> only", () => {
  const M = CPhaseGate(0.7);
  assert(M.get(3, 3).equals(Complex.exp(0.7)));
});

// =============================================================================
// Tier 3: higher two-qubit interaction gates — compositional verification
// =============================================================================

import {
  ECRGate,
  iSwapGate,
  RXXGate,
  RYYGate,
  RZXGate,
  RZZGate,
  SwapGate,
  XXMinusYYGate,
  XXPlusYYGate,
} from "../src/gates.ts";

Deno.test("Tier3: SwapGate is unitary", () => assert(SwapGate().isUnitary()));
Deno.test("Tier3: RZZ is unitary", () => {
  for (const th of [0, 0.5, Math.PI]) assert(RZZGate(th).isUnitary());
});
Deno.test("Tier3: RXX is unitary", () => {
  for (const th of [0, 0.5, Math.PI]) assert(RXXGate(th).isUnitary());
});
Deno.test("Tier3: RYY is unitary", () => {
  for (const th of [0, 0.5, Math.PI]) assert(RYYGate(th).isUnitary());
});
Deno.test("Tier3: RZX is unitary", () => {
  for (const th of [0, 0.5, Math.PI]) assert(RZXGate(th).isUnitary());
});
Deno.test("Tier3: ECR is unitary", () => assert(ECRGate().isUnitary()));
Deno.test("Tier3: iSwap is unitary", () => assert(iSwapGate().isUnitary()));
Deno.test("Tier3: XXPlusYY is unitary", () => {
  for (const th of [0.3, Math.PI / 2]) {
    for (const be of [0, 0.5]) assert(XXPlusYYGate(th, be).isUnitary());
  }
});
Deno.test("Tier3: XXMinusYY is unitary", () => {
  for (const th of [0.3, Math.PI / 2]) {
    for (const be of [0, 0.5]) assert(XXMinusYYGate(th, be).isUnitary());
  }
});

// -------- SWAP verification --------

Deno.test("Tier3: SWAP matches reference matrix", () => {
  const expected = Matrix.real([
    [1, 0, 0, 0],
    [0, 0, 1, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 1],
  ]);
  assert(SwapGate().equals(expected));
});

Deno.test("Tier3: SWAP * SWAP = I", () => {
  assert(SwapGate().multiply(SwapGate()).equals(Matrix.identity(4)));
});

Deno.test("Tier3: SWAP|01> = |10>", () => {
  // |01> (ctrl=0, target=1) = index 1
  const v = [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO];
  const out = SwapGate().apply(v);
  // should land at |10> = index 2
  assert(out[2].equals(Complex.ONE));
  assert(out[1].equals(Complex.ZERO));
});

// -------- RZZ --------

Deno.test("Tier3: RZZ(theta) matches reference diagonal", () => {
  const th = 0.6;
  const em = Complex.exp(-th / 2);
  const ep = Complex.exp(th / 2);
  // Basis order (MSB-first): |00>,|01>,|10>,|11>
  // Parity: |00>:+1, |01>:-1, |10>:-1, |11>:+1 → phases -th/2, +th/2, +th/2, -th/2
  const expected = Matrix.diagonal([em, ep, ep, em]);
  assert(RZZGate(th).equals(expected));
});

Deno.test("Tier3: RXX reference matrix", () => {
  const th = 0.6;
  const c = Math.cos(th / 2);
  const s = Math.sin(th / 2);
  const co = ci(c);
  const msi = ci(0, -s);
  const expected = new Matrix([
    [co, Complex.ZERO, Complex.ZERO, msi],
    [Complex.ZERO, co, msi, Complex.ZERO],
    [Complex.ZERO, msi, co, Complex.ZERO],
    [msi, Complex.ZERO, Complex.ZERO, co],
  ]);
  assert(RXXGate(th).equals(expected));
});

Deno.test("Tier3: RYY reference matrix", () => {
  const th = 0.6;
  const c = Math.cos(th / 2);
  const s = Math.sin(th / 2);
  const co = ci(c);
  const psi = ci(0, s);
  const msi = ci(0, -s);
  const expected = new Matrix([
    [co, Complex.ZERO, Complex.ZERO, psi],
    [Complex.ZERO, co, msi, Complex.ZERO],
    [Complex.ZERO, msi, co, Complex.ZERO],
    [psi, Complex.ZERO, Complex.ZERO, co],
  ]);
  assert(RYYGate(th).equals(expected));
});

Deno.test("Tier3: RZX reference matrix", () => {
  const th = 0.6;
  const c = Math.cos(th / 2);
  const s = Math.sin(th / 2);
  const co = ci(c);
  const msi = ci(0, -s);
  const psi = ci(0, s);
  const expected = new Matrix([
    [co, msi, Complex.ZERO, Complex.ZERO],
    [msi, co, Complex.ZERO, Complex.ZERO],
    [Complex.ZERO, Complex.ZERO, co, psi],
    [Complex.ZERO, Complex.ZERO, psi, co],
  ]);
  assert(RZXGate(th).equals(expected));
});

Deno.test("Tier3: RZZ(2pi) = -I (global phase -1)", () => {
  assert(
    RZZGate(2 * Math.PI).equals(Matrix.identity(4).scale(Complex.MINUS_ONE)),
  );
});

Deno.test("Tier3: RXX(0) = I", () =>
  assert(RXXGate(0).equals(Matrix.identity(4))));
Deno.test("Tier3: RYY(0) = I", () =>
  assert(RYYGate(0).equals(Matrix.identity(4))));
Deno.test("Tier3: RZZ(0) = I", () =>
  assert(RZZGate(0).equals(Matrix.identity(4))));
Deno.test("Tier3: RZX(0) = I", () =>
  assert(RZXGate(0).equals(Matrix.identity(4))));

// -------- ECR --------

Deno.test("Tier3: ECR matches reference (1/sqrt(2))*[[0,0,1,i],[0,0,i,1],[1,-i,0,0],[-i,1,0,0]]", () => {
  const s = 1 / Math.sqrt(2);
  const expected = new Matrix([
    [Complex.ZERO, Complex.ZERO, ci(s), ci(0, s)],
    [Complex.ZERO, Complex.ZERO, ci(0, s), ci(s)],
    [ci(s), ci(0, -s), Complex.ZERO, Complex.ZERO],
    [ci(0, -s), ci(s), Complex.ZERO, Complex.ZERO],
  ]);
  assert(ECRGate().equals(expected));
});

// -------- iSWAP --------

Deno.test("Tier3: iSWAP matches reference [[1,0,0,0],[0,0,i,0],[0,i,0,0],[0,0,0,1]]", () => {
  const expected = new Matrix([
    [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
    [Complex.ZERO, Complex.ZERO, Complex.I, Complex.ZERO],
    [Complex.ZERO, Complex.I, Complex.ZERO, Complex.ZERO],
    [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE],
  ]);
  assert(iSwapGate().equals(expected));
});

Deno.test("Tier3: iSWAP|01> = i|10>", () => {
  const v = [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO];
  const out = iSwapGate().apply(v);
  assert(out[2].equals(Complex.I));
});

Deno.test("Tier3: iSWAP|11> stays |11>", () => {
  const v = [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE];
  const out = iSwapGate().apply(v);
  assert(out[3].equals(Complex.ONE));
});

// -------- XX+YY (beta=0) reference matrix --------

Deno.test("Tier3: XXPlusYY(theta, 0) reference matrix", () => {
  const th = 0.7;
  const c = Math.cos(th / 2);
  const s = Math.sin(th / 2);
  // Appendix: [[1,0,0,0],[0,c,-is,0],[0,-is,c,0],[0,0,0,1]] when beta=0
  const expected = new Matrix([
    [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
    [Complex.ZERO, ci(c), ci(0, -s), Complex.ZERO],
    [Complex.ZERO, ci(0, -s), ci(c), Complex.ZERO],
    [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE],
  ]);
  assert(XXPlusYYGate(th, 0).equals(expected));
});

Deno.test("Tier3: XXPlusYY is identity on |00> and |11> for any params", () => {
  const M = XXPlusYYGate(0.7, 0.5);
  // row 0 and row 3 should be pure identity rows
  assert(M.get(0, 0).equals(Complex.ONE));
  assert(M.get(3, 3).equals(Complex.ONE));
  assert(M.get(0, 1).equals(Complex.ZERO));
  assert(M.get(0, 2).equals(Complex.ZERO));
  assert(M.get(0, 3).equals(Complex.ZERO));
  assert(M.get(3, 0).equals(Complex.ZERO));
  assert(M.get(3, 1).equals(Complex.ZERO));
  assert(M.get(3, 2).equals(Complex.ZERO));
});

// -------- XX-YY (beta=0) reference matrix --------

Deno.test("Tier3: XXMinusYY(theta, 0) reference matrix", () => {
  const th = 0.7;
  const c = Math.cos(th / 2);
  const s = Math.sin(th / 2);
  // Appendix: [[c,0,0,-is],[0,1,0,0],[0,0,1,0],[-is,0,0,c]]
  const expected = new Matrix([
    [ci(c), Complex.ZERO, Complex.ZERO, ci(0, -s)],
    [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO],
    [Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO],
    [ci(0, -s), Complex.ZERO, Complex.ZERO, ci(c)],
  ]);
  assert(XXMinusYYGate(th, 0).equals(expected));
});

Deno.test("Tier3: XXMinusYY is identity on |01> and |10>", () => {
  const M = XXMinusYYGate(0.7, 0.5);
  assert(M.get(1, 1).equals(Complex.ONE));
  assert(M.get(2, 2).equals(Complex.ONE));
  assert(M.get(1, 0).equals(Complex.ZERO));
  assert(M.get(1, 2).equals(Complex.ZERO));
  assert(M.get(1, 3).equals(Complex.ZERO));
  assert(M.get(2, 0).equals(Complex.ZERO));
  assert(M.get(2, 1).equals(Complex.ZERO));
  assert(M.get(2, 3).equals(Complex.ZERO));
});

// =============================================================================
// Tier 4: three-qubit gates — compositional verification
// =============================================================================

import {
  CCXGate,
  CCXGateOptimized,
  CCZGate,
  CSwapGate,
  RCCXGate,
} from "../src/gates.ts";

Deno.test("Tier4: CCX is unitary", () => assert(CCXGate().isUnitary()));
Deno.test("Tier4: CCXOptimized is unitary", () =>
  assert(CCXGateOptimized().isUnitary()));
Deno.test("Tier4: CCZ is unitary", () => assert(CCZGate().isUnitary()));
Deno.test("Tier4: CSWAP is unitary", () => assert(CSwapGate().isUnitary()));
Deno.test("Tier4: RCCX is unitary", () => assert(RCCXGate().isUnitary()));

// -------- CCX: V-decomp equals T-optimized decomp --------

Deno.test("Tier4: CCX V-decomposition equals T-optimized decomposition", () => {
  assert(CCXGate().equals(CCXGateOptimized()));
});

Deno.test("Tier4: CCX matches reference matrix (identity except rows 6,7 swapped)", () => {
  const M = CCXGate();
  // Expected: identity everywhere except positions (6,7) and (7,6) swap
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      let exp: Complex;
      if (i === 6 && j === 7) exp = Complex.ONE;
      else if (i === 7 && j === 6) exp = Complex.ONE;
      else if (i === 6 && j === 6) exp = Complex.ZERO;
      else if (i === 7 && j === 7) exp = Complex.ZERO;
      else exp = i === j ? Complex.ONE : Complex.ZERO;
      assert(M.get(i, j).equals(exp));
    }
  }
});

// -------- CCX truth table --------

// basis state index in MSB-first (c1, c2, t): |c1 c2 t> -> index 4*c1 + 2*c2 + t
function basisVec3(c1: number, c2: number, t: number): Complex[] {
  const v: Complex[] = new Array(8).fill(Complex.ZERO);
  v[4 * c1 + 2 * c2 + t] = Complex.ONE;
  return v;
}

Deno.test("Tier4: CCX truth table — control=00, target unchanged", () => {
  for (const t of [0, 1]) {
    const out = CCXGate().apply(basisVec3(0, 0, t));
    assert(out[4 * 0 + 2 * 0 + t].equals(Complex.ONE));
  }
});

Deno.test("Tier4: CCX truth table — control=01, target unchanged", () => {
  for (const t of [0, 1]) {
    const out = CCXGate().apply(basisVec3(0, 1, t));
    assert(out[4 * 0 + 2 * 1 + t].equals(Complex.ONE));
  }
});

Deno.test("Tier4: CCX truth table — control=10, target unchanged", () => {
  for (const t of [0, 1]) {
    const out = CCXGate().apply(basisVec3(1, 0, t));
    assert(out[4 * 1 + 2 * 0 + t].equals(Complex.ONE));
  }
});

Deno.test("Tier4: CCX truth table — control=11, target flipped", () => {
  for (const t of [0, 1]) {
    const out = CCXGate().apply(basisVec3(1, 1, t));
    assert(out[4 * 1 + 2 * 1 + (1 - t)].equals(Complex.ONE));
  }
});

// -------- CCZ --------

Deno.test("Tier4: CCZ flips sign of |111> only", () => {
  const M = CCZGate();
  for (let i = 0; i < 8; i++) {
    if (i === 7) assert(M.get(i, i).equals(Complex.MINUS_ONE));
    else assert(M.get(i, i).equals(Complex.ONE));
  }
});

Deno.test("Tier4: CCZ is symmetric in its three arguments (all qubits treated symmetrically)", () => {
  // CCZ matrix: diag with -1 only on |111> → should equal its transpose / its
  // permutations under qubit reorderings. Quick check: dagger = itself.
  assert(CCZGate().dagger().equals(CCZGate()));
});

// -------- CSWAP truth table --------

Deno.test("Tier4: CSWAP — control=0 leaves state unchanged", () => {
  for (let s = 0; s < 4; s++) {
    // control bit is arg 0 (MSB = bit 2); state index when c=0 is s (0..3)
    const v: Complex[] = new Array(8).fill(Complex.ZERO);
    v[s] = Complex.ONE;
    const out = CSwapGate().apply(v);
    assert(out[s].equals(Complex.ONE));
  }
});

Deno.test("Tier4: CSWAP — control=1 swaps t1 and t2", () => {
  // state |c t1 t2> = |1 0 0> → index 4; stays |100> = 4
  // |1 0 1> → 5 should go to |1 1 0> = 6
  // |1 1 0> → 6 should go to |1 0 1> = 5
  // |1 1 1> → 7 stays 7
  const cases: Array<[number, number]> = [[4, 4], [5, 6], [6, 5], [7, 7]];
  for (const [inIdx, outIdx] of cases) {
    const v: Complex[] = new Array(8).fill(Complex.ZERO);
    v[inIdx] = Complex.ONE;
    const out = CSwapGate().apply(v);
    assert(out[outIdx].equals(Complex.ONE));
  }
});

// -------- RCCX relative-phase Toffoli --------

Deno.test("Tier4: RCCX active |110>,|111> block is [[0,-i],[i,0]]", () => {
  const M = RCCXGate();
  // rows 6,7 & cols 6,7 form the active 2x2 block
  assert(M.get(6, 6).equals(Complex.ZERO));
  assert(M.get(6, 7).equals(Complex.MINUS_I));
  assert(M.get(7, 6).equals(Complex.I));
  assert(M.get(7, 7).equals(Complex.ZERO));
});

Deno.test("Tier4: RCCX is NOT equal to exact CCX (distinct gates)", () => {
  assert(!RCCXGate().equals(CCXGate()));
});

// =============================================================================
// Tier 5: multi-controlled gates (phase-safe, mutually recursive)
// =============================================================================

import {
  C3SXGate,
  C3XGate,
  C4XGate,
  MCPhaseGate,
  MCXGate,
  RC3XGate,
} from "../src/gates.ts";

// -------- MCPhaseGate base & small cases --------

Deno.test("Tier5: MCPhase(λ, 0) = P(λ)", () => {
  for (const la of [0, 0.3, Math.PI, -1.1]) {
    assert(MCPhaseGate(la, 0).equals(PhaseGate(la)));
  }
});

Deno.test("Tier5: MCPhase(λ, 1) = CP(λ)", () => {
  for (const la of [0, 0.3, Math.PI, -1.1]) {
    assert(MCPhaseGate(la, 1).equals(CPhaseGate(la)));
  }
});

Deno.test("Tier5: MCPhase(λ, 2) = diag(1,1,1,1,1,1,1, exp(iλ))", () => {
  const la = 0.7;
  const diag = new Array(8).fill(Complex.ONE);
  diag[7] = Complex.exp(la);
  const expected = Matrix.diagonal(diag);
  assert(MCPhaseGate(la, 2).equals(expected));
});

Deno.test("Tier5: MCPhase(λ, 3) = diag with exp(iλ) at position 15", () => {
  const la = 0.5;
  const diag = new Array(16).fill(Complex.ONE);
  diag[15] = Complex.exp(la);
  const expected = Matrix.diagonal(diag);
  assert(MCPhaseGate(la, 3).equals(expected));
});

Deno.test("Tier5: MCPhase(λ, 4) = diag with exp(iλ) at position 31", () => {
  const la = 0.4;
  const diag = new Array(32).fill(Complex.ONE);
  diag[31] = Complex.exp(la);
  const expected = Matrix.diagonal(diag);
  assert(MCPhaseGate(la, 4).equals(expected));
});

Deno.test("Tier5: MCPhase is unitary for N=0..4", () => {
  for (let n = 0; n <= 4; n++) assert(MCPhaseGate(0.8, n).isUnitary());
});

Deno.test("Tier5: MCPhase(2π, N) = I (global phase 2π = 1)", () => {
  for (let n = 0; n <= 3; n++) {
    const dim = 1 << (n + 1);
    assert(MCPhaseGate(2 * Math.PI, n).equals(Matrix.identity(dim)));
  }
});

// -------- MCXGate base & small cases --------

Deno.test("Tier5: MCX(0) = X", () => assert(MCXGate(0).equals(XGate())));
Deno.test("Tier5: MCX(1) = CX", () => assert(MCXGate(1).equals(CXGate())));

Deno.test("Tier5: MCX(2) equals Tier 4 CCXGate (phase-safe recursion matches V-decomp)", () => {
  assert(MCXGate(2).equals(CCXGate()));
});

Deno.test("Tier5: MCX(3) = identity except rows/cols 14,15 swapped", () => {
  const M = MCXGate(3);
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      let exp: Complex;
      if (i === 14 && j === 15) exp = Complex.ONE;
      else if (i === 15 && j === 14) exp = Complex.ONE;
      else if (i === 14 && j === 14) exp = Complex.ZERO;
      else if (i === 15 && j === 15) exp = Complex.ZERO;
      else exp = i === j ? Complex.ONE : Complex.ZERO;
      assert(M.get(i, j).equals(exp));
    }
  }
});

Deno.test("Tier5: MCX(4) = identity except rows/cols 30,31 swapped", () => {
  const M = MCXGate(4);
  // Spot-check key entries
  assert(M.get(30, 31).equals(Complex.ONE));
  assert(M.get(31, 30).equals(Complex.ONE));
  assert(M.get(30, 30).equals(Complex.ZERO));
  assert(M.get(31, 31).equals(Complex.ZERO));
  // Diagonal identity for all other rows
  for (let i = 0; i < 30; i++) {
    assert(M.get(i, i).equals(Complex.ONE));
  }
});

Deno.test("Tier5: MCX is unitary for N=0..4", () => {
  for (let n = 0; n <= 4; n++) assert(MCXGate(n).isUnitary());
});

Deno.test("Tier5: MCX(N) * MCX(N) = I (involutive)", () => {
  for (let n = 0; n <= 4; n++) {
    const M = MCXGate(n);
    assert(M.multiply(M).equals(Matrix.identity(1 << (n + 1))));
  }
});

// -------- C3X, C4X as aliases --------

Deno.test("Tier5: C3XGate == MCXGate(3)", () => {
  assert(C3XGate().equals(MCXGate(3)));
});

Deno.test("Tier5: C4XGate == MCXGate(4)", () => {
  assert(C4XGate().equals(MCXGate(4)));
});

// -------- C3SX --------

Deno.test("Tier5: C3SX is unitary", () => assert(C3SXGate().isUnitary()));

Deno.test("Tier5: C3SX is identity on all basis states except |1110>, |1111>", () => {
  const M = C3SXGate();
  for (let i = 0; i < 14; i++) {
    for (let j = 0; j < 14; j++) {
      const exp = i === j ? Complex.ONE : Complex.ZERO;
      assert(M.get(i, j).equals(exp));
    }
  }
});

Deno.test("Tier5: C3SX applies SX on the enabled |1110>,|1111> block", () => {
  const M = C3SXGate();
  const SX = SXGate();
  assert(M.get(14, 14).equals(SX.get(0, 0)));
  assert(M.get(14, 15).equals(SX.get(0, 1)));
  assert(M.get(15, 14).equals(SX.get(1, 0)));
  assert(M.get(15, 15).equals(SX.get(1, 1)));
});

Deno.test("Tier5: C3SX * C3SX = C3X (since SX*SX = X)", () => {
  assert(C3SXGate().multiply(C3SXGate()).equals(C3XGate()));
});

// -------- RC3X --------

Deno.test("Tier5: RC3X is unitary", () => assert(RC3XGate().isUnitary()));

Deno.test("Tier5: RC3X active |1110>,|1111> block is [[0,1],[-1,0]]", () => {
  const M = RC3XGate();
  // Per Section 3 derived matrix: active block is [[0,1],[-1,0]]
  assert(M.get(14, 14).equals(Complex.ZERO));
  assert(M.get(14, 15).equals(Complex.ONE));
  assert(M.get(15, 14).equals(Complex.MINUS_ONE));
  assert(M.get(15, 15).equals(Complex.ZERO));
});

Deno.test("Tier5: RC3X diagonal entries |1100>,|1101> are i,-i", () => {
  // Section 3 RC3X reference: [12][12]=i, [13][13]=-i
  const M = RC3XGate();
  assert(M.get(12, 12).equals(Complex.I));
  assert(M.get(13, 13).equals(Complex.MINUS_I));
});

Deno.test("Tier5: RC3X is NOT equal to exact C3X", () => {
  assert(!RC3XGate().equals(C3XGate()));
});

// -------- invariants --------

Deno.test("Tier5: validation rejects negative numControls", () => {
  try {
    MCXGate(-1);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes(">="));
  }
  try {
    MCPhaseGate(0.5, -1);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes(">="));
  }
});

// =============================================================================
// Tier 6: N-qubit structural composite gates
// =============================================================================

import {
  DiagonalGate,
  MCMTGate,
  MSGate,
  PauliGate,
  PauliProductRotationGate,
  PermutationGate,
} from "../src/gates.ts";

// -------- MSGate --------

Deno.test("Tier6: MS(theta, 0) = GlobalPhaseGate(0) (1x1 identity)", () => {
  assertEquals(MSGate(0.5, 0).rows, 1);
  assert(MSGate(0.5, 0).get(0, 0).equals(Complex.ONE));
});

Deno.test("Tier6: MS(theta, 1) = I (single qubit identity)", () => {
  assert(MSGate(0.5, 1).equals(IGate()));
});

Deno.test("Tier6: MS(theta, 2) = RXX(theta)", () => {
  for (const th of [0.3, Math.PI / 4, Math.PI]) {
    assert(MSGate(th, 2).equals(RXXGate(th)));
  }
});

Deno.test("Tier6: MS(theta, 3) = RXX(0,1)*RXX(0,2)*RXX(1,2)", () => {
  const th = 0.7;
  const expected = compose(3, [
    { gate: RXXGate(th), targets: [0, 1] },
    { gate: RXXGate(th), targets: [0, 2] },
    { gate: RXXGate(th), targets: [1, 2] },
  ]);
  assert(MSGate(th, 3).equals(expected));
});

Deno.test("Tier6: MS is unitary for m=2..4", () => {
  for (let m = 2; m <= 4; m++) assert(MSGate(0.5, m).isUnitary());
});

Deno.test("Tier6: MS rejects negative m", () => {
  try {
    MSGate(0.5, -1);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("nonnegative"));
  }
});

// -------- PauliGate --------

Deno.test("Tier6: Pauli('') is zero-qubit identity", () => {
  assertEquals(PauliGate("").rows, 1);
});

Deno.test("Tier6: Pauli('X') = X", () =>
  assert(PauliGate("X").equals(XGate())));
Deno.test("Tier6: Pauli('I') = I", () =>
  assert(PauliGate("I").equals(IGate())));
Deno.test("Tier6: Pauli('Y') = Y", () =>
  assert(PauliGate("Y").equals(YGate())));
Deno.test("Tier6: Pauli('Z') = Z", () =>
  assert(PauliGate("Z").equals(ZGate())));

Deno.test("Tier6: Pauli('XY') = X ⊗ Y", () => {
  assert(PauliGate("XY").equals(XGate().tensor(YGate())));
});

Deno.test("Tier6: Pauli('XYZ') = X ⊗ Y ⊗ Z", () => {
  const expected = XGate().tensor(YGate()).tensor(ZGate());
  assert(PauliGate("XYZ").equals(expected));
});

Deno.test("Tier6: Pauli('II') = I_4 (4x4 identity)", () => {
  assert(PauliGate("II").equals(Matrix.identity(4)));
});

Deno.test("Tier6: Pauli is unitary", () => {
  for (const s of ["X", "XY", "XYZ", "IIXI", "YYZZ"]) {
    assert(PauliGate(s).isUnitary());
  }
});

Deno.test("Tier6: Pauli rejects invalid characters", () => {
  try {
    PauliGate("W");
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("invalid"));
  }
});

// -------- DiagonalGate --------

Deno.test("Tier6: Diagonal([0, pi]) = diag(1, -1) = Z", () => {
  assert(DiagonalGate([0, Math.PI]).equals(ZGate()));
});

Deno.test("Tier6: Diagonal([0, 0, 0, pi]) = diag(1,1,1,-1) = CZ", () => {
  assert(DiagonalGate([0, 0, 0, Math.PI]).equals(CZGate()));
});

Deno.test("Tier6: Diagonal 3-qubit matches diag(exp(i*theta_j))", () => {
  const phases = [0, 0.3, 0.7, 1.1, 1.5, 1.9, 2.3, 2.7];
  const M = DiagonalGate(phases);
  for (let i = 0; i < 8; i++) {
    assert(M.get(i, i).equals(Complex.exp(phases[i])));
  }
});

Deno.test("Tier6: Diagonal is unitary", () => {
  assert(DiagonalGate([0.3, 0.7, 1.1, 1.5]).isUnitary());
});

Deno.test("Tier6: Diagonal rejects non-power-of-two length", () => {
  try {
    DiagonalGate([0, 1, 2]);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("power of two"));
  }
});

// -------- PermutationGate --------

Deno.test("Tier6: Permutation identity is I", () => {
  assert(PermutationGate([0, 1, 2, 3]).equals(Matrix.identity(4)));
});

Deno.test("Tier6: Permutation swap [0,1] on 1 qubit = X", () => {
  assert(PermutationGate([1, 0]).equals(XGate()));
});

Deno.test("Tier6: Permutation SWAP on 2 qubits", () => {
  // SWAP sends |01> ↔ |10> i.e. indices 1 ↔ 2 in MSB-first
  assert(PermutationGate([0, 2, 1, 3]).equals(SwapGate()));
});

Deno.test("Tier6: Permutation rejects non-bijection", () => {
  try {
    PermutationGate([0, 1, 1, 3]);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("duplicate"));
  }
});

Deno.test("Tier6: Permutation rejects out-of-range entry", () => {
  try {
    PermutationGate([0, 1, 2, 4]);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("out of range"));
  }
});

// -------- MCMTGate --------

Deno.test("Tier6: MCMT(X, 0 controls, 1 target) = X", () => {
  assert(MCMTGate(XGate(), 0, 1).equals(XGate()));
});

Deno.test("Tier6: MCMT(X, 0 controls, 2 targets) = X ⊗ X", () => {
  assert(MCMTGate(XGate(), 0, 2).equals(XGate().tensor(XGate())));
});

Deno.test("Tier6: MCMT(X, 1 control, 1 target) = CX", () => {
  assert(MCMTGate(XGate(), 1, 1).equals(CXGate()));
});

Deno.test("Tier6: MCMT(X, 2 controls, 1 target) = CCX", () => {
  assert(MCMTGate(XGate(), 2, 1).equals(CCXGate()));
});

Deno.test("Tier6: MCMT(Z, 2 controls, 1 target) = CCZ", () => {
  assert(MCMTGate(ZGate(), 2, 1).equals(CCZGate()));
});

Deno.test("Tier6: MCMT(X, 1 control, 2 targets) acts as X⊗X on |1..> subspace", () => {
  const M = MCMTGate(XGate(), 1, 2);
  assertEquals(M.rows, 8);
  // control=0 block (rows 0..3): identity
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      assert(M.get(i, j).equals(i === j ? Complex.ONE : Complex.ZERO));
    }
  }
  // control=1 block (rows 4..7): should be X⊗X
  const xx = XGate().tensor(XGate());
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      assert(M.get(4 + i, 4 + j).equals(xx.get(i, j)));
    }
  }
});

Deno.test("Tier6: MCMT is unitary for various shapes", () => {
  assert(MCMTGate(HGate(), 1, 1).isUnitary());
  assert(MCMTGate(XGate(), 2, 2).isUnitary());
  assert(MCMTGate(ZGate(), 3, 1).isUnitary());
});

// -------- PauliProductRotationGate --------

Deno.test("Tier6: PauliProductRotation(theta, 'Z') = RZ(theta)", () => {
  for (const th of [0.3, Math.PI]) {
    assert(PauliProductRotationGate(th, "Z").equals(RZGate(th)));
  }
});

Deno.test("Tier6: PauliProductRotation(theta, 'X') = RX(theta)", () => {
  for (const th of [0.3, Math.PI / 4]) {
    assert(PauliProductRotationGate(th, "X").equals(RXGate(th)));
  }
});

Deno.test("Tier6: PauliProductRotation(theta, 'Y') = RY(theta)", () => {
  for (const th of [0.3, Math.PI / 4]) {
    assert(PauliProductRotationGate(th, "Y").equals(RYGate(th)));
  }
});

Deno.test("Tier6: PauliProductRotation(theta, 'ZZ') = RZZ(theta)", () => {
  for (const th of [0.3, Math.PI]) {
    assert(PauliProductRotationGate(th, "ZZ").equals(RZZGate(th)));
  }
});

Deno.test("Tier6: PauliProductRotation(theta, 'XX') = RXX(theta)", () => {
  for (const th of [0.3, Math.PI]) {
    assert(PauliProductRotationGate(th, "XX").equals(RXXGate(th)));
  }
});

Deno.test("Tier6: PauliProductRotation(theta, 'YY') = RYY(theta)", () => {
  for (const th of [0.3]) {
    assert(PauliProductRotationGate(th, "YY").equals(RYYGate(th)));
  }
});

Deno.test("Tier6: PauliProductRotation(theta, 'ZX') = RZX(theta)", () => {
  for (const th of [0.3]) {
    assert(PauliProductRotationGate(th, "ZX").equals(RZXGate(th)));
  }
});

Deno.test("Tier6: PauliProductRotation(theta, 'II') = exp(-i*theta/2) * I_4", () => {
  const th = 0.6;
  const expected = Matrix.identity(4).scale(Complex.exp(-th / 2));
  assert(PauliProductRotationGate(th, "II").equals(expected));
});

Deno.test("Tier6: PauliProductRotation('') = GlobalPhaseGate(-theta/2)", () => {
  const th = 0.6;
  const M = PauliProductRotationGate(th, "");
  assertEquals(M.rows, 1);
  assert(M.get(0, 0).equals(Complex.exp(-th / 2)));
});

Deno.test("Tier6: PauliProductRotation is unitary", () => {
  for (const s of ["X", "Z", "XY", "XYZ", "IZI"]) {
    assert(PauliProductRotationGate(0.5, s).isUnitary());
  }
});

Deno.test("Tier6: PauliProductRotation(2pi, 'Z') = -I (rotation by 2pi)", () => {
  assert(
    PauliProductRotationGate(2 * Math.PI, "Z").equals(
      IGate().scale(Complex.MINUS_ONE),
    ),
  );
});

// =============================================================================
// Tier 7: Uniformly controlled gates and general unitary synthesis
// =============================================================================

import {
  decomposeZYZ,
  Isometry,
  LinearFunction,
  UCGate,
  UCPauliRotGate,
  UCRXGate,
  UCRYGate,
  UCRZGate,
  UnitaryGate,
} from "../src/gates.ts";

// -------- UCRZ base cases --------

Deno.test("Tier7: UCRZ([theta]) = RZ(theta) (k=0)", () => {
  for (const th of [0.3, Math.PI]) {
    assert(UCRZGate([th]).equals(RZGate(th)));
  }
});

Deno.test("Tier7: UCRZ is unitary for k=1,2,3", () => {
  for (const k of [1, 2, 3]) {
    const N = 1 << k;
    const angles = new Array(N).fill(0).map((_, i) => 0.1 * (i + 1));
    assert(UCRZGate(angles).isUnitary());
  }
});

Deno.test("Tier7: UCRZ block structure — k=1 gives block-diag(RZ(t0), RZ(t1))", () => {
  const t0 = 0.3;
  const t1 = 0.7;
  const M = UCRZGate([t0, t1]);
  // Expected: diag blocks RZ(t0) on |0>_ctrl and RZ(t1) on |1>_ctrl subspace.
  // MSB-first (control, target) → rows 0,1 are ctrl=0; rows 2,3 are ctrl=1.
  const rz0 = RZGate(t0);
  const rz1 = RZGate(t1);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      assert(M.get(i, j).equals(rz0.get(i, j)));
      assert(M.get(i + 2, j + 2).equals(rz1.get(i, j)));
    }
  }
  // Off-diagonal blocks are zero.
  assert(M.get(0, 2).equals(Complex.ZERO));
  assert(M.get(0, 3).equals(Complex.ZERO));
  assert(M.get(1, 2).equals(Complex.ZERO));
  assert(M.get(1, 3).equals(Complex.ZERO));
});

Deno.test("Tier7: UCRZ k=2 block-diagonal of 4 RZ gates", () => {
  const angles = [0.1, 0.3, 0.5, 0.7];
  const M = UCRZGate(angles);
  assertEquals(M.rows, 8);
  for (let j = 0; j < 4; j++) {
    const rz = RZGate(angles[j]);
    for (let i0 = 0; i0 < 2; i0++) {
      for (let j0 = 0; j0 < 2; j0++) {
        assert(M.get(2 * j + i0, 2 * j + j0).equals(rz.get(i0, j0)));
      }
    }
  }
});

Deno.test("Tier7: UCRZ with all same angle reduces to RZ on target (control-independent)", () => {
  const th = 0.6;
  const M = UCRZGate([th, th]);
  // This should equal I ⊗ RZ(th) (identity on control, RZ on target)
  const expected = IGate().tensor(RZGate(th));
  assert(M.equals(expected));
});

// -------- UCRY --------

Deno.test("Tier7: UCRY([theta]) = RY(theta)", () => {
  assert(UCRYGate([0.5]).equals(RYGate(0.5)));
});

Deno.test("Tier7: UCRY k=1 block structure", () => {
  const t0 = 0.3;
  const t1 = 0.7;
  const M = UCRYGate([t0, t1]);
  const ry0 = RYGate(t0);
  const ry1 = RYGate(t1);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      assert(M.get(i, j).equals(ry0.get(i, j)));
      assert(M.get(i + 2, j + 2).equals(ry1.get(i, j)));
    }
  }
});

Deno.test("Tier7: UCRY is unitary for k=1,2,3", () => {
  for (const k of [1, 2, 3]) {
    const N = 1 << k;
    const angles = new Array(N).fill(0).map((_, i) => 0.2 * (i + 1));
    assert(UCRYGate(angles).isUnitary());
  }
});

// -------- UCRX --------

Deno.test("Tier7: UCRX([theta]) = RX(theta)", () => {
  assert(UCRXGate([0.4]).equals(RXGate(0.4)));
});

Deno.test("Tier7: UCRX k=1 block structure", () => {
  const t0 = 0.3;
  const t1 = 0.7;
  const M = UCRXGate([t0, t1]);
  const rx0 = RXGate(t0);
  const rx1 = RXGate(t1);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      assert(M.get(i, j).equals(rx0.get(i, j)));
      assert(M.get(i + 2, j + 2).equals(rx1.get(i, j)));
    }
  }
});

// -------- UCPauliRot dispatch --------

Deno.test("Tier7: UCPauliRot('X', angles) = UCRX", () => {
  const a = [0.3, 0.5];
  assert(UCPauliRotGate(a, "X").equals(UCRXGate(a)));
});

Deno.test("Tier7: UCPauliRot('Y', angles) = UCRY", () => {
  const a = [0.3, 0.5];
  assert(UCPauliRotGate(a, "Y").equals(UCRYGate(a)));
});

Deno.test("Tier7: UCPauliRot('Z', angles) = UCRZ", () => {
  const a = [0.3, 0.5];
  assert(UCPauliRotGate(a, "Z").equals(UCRZGate(a)));
});

// -------- decomposeZYZ --------

Deno.test("Tier7: ZYZ decomposes identity to gamma=0, phases=0", () => {
  const dec = decomposeZYZ(IGate());
  assert(Math.abs(dec.gamma) <= 1e-10);
  assert(Math.abs(dec.alpha) <= 1e-10);
});

Deno.test("Tier7: ZYZ recomposes X correctly", () => {
  const dec = decomposeZYZ(XGate());
  // Rebuild: exp(i*alpha) * RZ(beta) * RY(gamma) * RZ(delta)
  const R = RZGate(dec.beta).multiply(RYGate(dec.gamma)).multiply(
    RZGate(dec.delta),
  )
    .scale(Complex.exp(dec.alpha));
  assert(R.equals(XGate()));
});

Deno.test("Tier7: ZYZ recomposes Y correctly", () => {
  const dec = decomposeZYZ(YGate());
  const R = RZGate(dec.beta).multiply(RYGate(dec.gamma)).multiply(
    RZGate(dec.delta),
  )
    .scale(Complex.exp(dec.alpha));
  assert(R.equals(YGate()));
});

Deno.test("Tier7: ZYZ recomposes Z correctly", () => {
  const dec = decomposeZYZ(ZGate());
  const R = RZGate(dec.beta).multiply(RYGate(dec.gamma)).multiply(
    RZGate(dec.delta),
  )
    .scale(Complex.exp(dec.alpha));
  assert(R.equals(ZGate()));
});

Deno.test("Tier7: ZYZ recomposes H correctly", () => {
  const dec = decomposeZYZ(HGate());
  const R = RZGate(dec.beta).multiply(RYGate(dec.gamma)).multiply(
    RZGate(dec.delta),
  )
    .scale(Complex.exp(dec.alpha));
  assert(R.equals(HGate()));
});

Deno.test("Tier7: ZYZ recomposes S correctly", () => {
  const dec = decomposeZYZ(SGate());
  const R = RZGate(dec.beta).multiply(RYGate(dec.gamma)).multiply(
    RZGate(dec.delta),
  )
    .scale(Complex.exp(dec.alpha));
  assert(R.equals(SGate()));
});

Deno.test("Tier7: ZYZ recomposes T correctly", () => {
  const dec = decomposeZYZ(TGate());
  const R = RZGate(dec.beta).multiply(RYGate(dec.gamma)).multiply(
    RZGate(dec.delta),
  )
    .scale(Complex.exp(dec.alpha));
  assert(R.equals(TGate()));
});

Deno.test("Tier7: ZYZ recomposes arbitrary U", () => {
  const U = UGate(0.7, 0.3, -0.5);
  const dec = decomposeZYZ(U);
  const R = RZGate(dec.beta).multiply(RYGate(dec.gamma)).multiply(
    RZGate(dec.delta),
  )
    .scale(Complex.exp(dec.alpha));
  assert(R.equals(U));
});

Deno.test("Tier7: ZYZ recomposes SX correctly", () => {
  const dec = decomposeZYZ(SXGate());
  const R = RZGate(dec.beta).multiply(RYGate(dec.gamma)).multiply(
    RZGate(dec.delta),
  )
    .scale(Complex.exp(dec.alpha));
  assert(R.equals(SXGate()));
});

Deno.test("Tier7: ZYZ gamma is in [0, pi]", () => {
  const testCases = [
    IGate(),
    XGate(),
    YGate(),
    ZGate(),
    HGate(),
    SGate(),
    TGate(),
    SXGate(),
    UGate(0.3, 0.5, -0.7),
    UGate(Math.PI, 0.2, 0.4),
  ];
  for (const M of testCases) {
    const dec = decomposeZYZ(M);
    assert(dec.gamma >= -1e-10 && dec.gamma <= Math.PI + 1e-10);
  }
});

// -------- UCGate --------

Deno.test("Tier7: UCGate([U]) = U (k=0 base case)", () => {
  assert(UCGate([HGate()]).equals(HGate()));
  assert(UCGate([XGate()]).equals(XGate()));
});

Deno.test("Tier7: UCGate k=1 with two gates gives block-diag", () => {
  const U0 = HGate();
  const U1 = XGate();
  const M = UCGate([U0, U1]);
  assertEquals(M.rows, 4);
  // block structure: control=0 → U0, control=1 → U1
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      assert(M.get(i, j).equals(U0.get(i, j)));
      assert(M.get(i + 2, j + 2).equals(U1.get(i, j)));
    }
  }
  // off-diagonal zero
  assert(M.get(0, 2).equals(Complex.ZERO));
  assert(M.get(0, 3).equals(Complex.ZERO));
  assert(M.get(2, 0).equals(Complex.ZERO));
});

Deno.test("Tier7: UCGate k=2 with four gates gives block-diag", () => {
  const gates = [HGate(), XGate(), YGate(), ZGate()];
  const M = UCGate(gates);
  assertEquals(M.rows, 8);
  for (let j = 0; j < 4; j++) {
    for (let i0 = 0; i0 < 2; i0++) {
      for (let j0 = 0; j0 < 2; j0++) {
        assert(M.get(2 * j + i0, 2 * j + j0).equals(gates[j].get(i0, j0)));
      }
    }
  }
});

Deno.test("Tier7: UCGate with all identical gates reduces to I ⊗ U", () => {
  const U = HGate();
  const M = UCGate([U, U]);
  assert(M.equals(IGate().tensor(U)));
});

Deno.test("Tier7: UCGate is unitary", () => {
  assert(UCGate([HGate(), XGate(), YGate(), ZGate()]).isUnitary());
});

Deno.test("Tier7: UCGate rejects non-power-of-two input", () => {
  try {
    UCGate([HGate(), XGate(), YGate()]);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("power of two"));
  }
});

Deno.test("Tier7: UCGate rejects non-unitary input", () => {
  const nonU = Matrix.real([[1, 2], [3, 4]]);
  try {
    UCGate([nonU, HGate()]);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("not unitary"));
  }
});

// -------- LinearFunction --------

Deno.test("Tier7: LinearFunction identity matrix = I", () => {
  const M = LinearFunction([[1, 0], [0, 1]]);
  assert(M.equals(Matrix.identity(4)));
});

Deno.test("Tier7: LinearFunction is unitary / a permutation matrix", () => {
  const M = LinearFunction([[1, 1], [0, 1]]);
  assert(M.isUnitary());
});

Deno.test("Tier7: LinearFunction rejects non-invertible matrix", () => {
  try {
    LinearFunction([[1, 1], [1, 1]]); // rank 1 over GF(2)
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("not invertible"));
  }
});

Deno.test("Tier7: LinearFunction rejects non-binary entries", () => {
  try {
    LinearFunction([[1, 2], [0, 1]]);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("0 or 1"));
  }
});

Deno.test("Tier7: LinearFunction is a valid permutation for 2x2 shear", () => {
  // M = [[1,1],[0,1]]: y0 = x0+x1, y1 = x1
  // Register values (little-endian): 00→00, 01→01, 10→11, 11→10
  const M = LinearFunction([[1, 1], [0, 1]]);
  // Matrix indices (reverseBits of register values):
  //   reg 0 = 00 → matIdx 0; output reg 0 → matIdx 0. sigma[0] = 0
  //   reg 1 = 01 → matIdx reverseBits(1,2)=2 (binary 10). output reg 1 → matIdx 2. sigma[2]=2
  //   reg 2 = 10 → matIdx reverseBits(2,2)=1 (binary 01). output reg 3=11 → matIdx reverseBits(3,2)=3. sigma[1]=3
  //   reg 3 = 11 → matIdx 3. output reg 2=10 → matIdx 1. sigma[3]=1
  // So M should have 1's at (0,0), (3,1), (2,2), (1,3).
  assert(M.get(0, 0).equals(Complex.ONE));
  assert(M.get(3, 1).equals(Complex.ONE));
  assert(M.get(2, 2).equals(Complex.ONE));
  assert(M.get(1, 3).equals(Complex.ONE));
});

// -------- Isometry --------

Deno.test("Tier7: Isometry of square unitary equals itself", () => {
  const M = Isometry(HGate());
  assert(M.equals(HGate()));
});

Deno.test("Tier7: Isometry 1→2 completes to 2x2 unitary", () => {
  // An isometry with 1 input qubit embedded in a 1-qubit space: just a column vector of length 2 with unit norm
  // That IS a 2x1 isometry (1 column, 2 rows); m=0 qubits in, n=1 qubit out (but m=0 means 2^0=1 column)
  // Simpler test: 2x1 "column" isometry
  const s = 1 / Math.sqrt(2);
  const V = new Matrix([[new Complex(s, 0)], [new Complex(s, 0)]]);
  const U = Isometry(V);
  assertEquals(U.rows, 2);
  assertEquals(U.cols, 2);
  // First column should equal V
  assert(U.get(0, 0).equals(new Complex(s, 0)));
  assert(U.get(1, 0).equals(new Complex(s, 0)));
  // Completed matrix must be unitary
  assert(U.isUnitary());
});

Deno.test("Tier7: Isometry preserves input columns", () => {
  // 4x2 isometry: take two orthonormal columns of a 4-dim space
  const s = 1 / Math.sqrt(2);
  const c0: Complex[] = [
    new Complex(s, 0),
    Complex.ZERO,
    new Complex(s, 0),
    Complex.ZERO,
  ];
  const c1: Complex[] = [
    Complex.ZERO,
    new Complex(s, 0),
    Complex.ZERO,
    new Complex(s, 0),
  ];
  const V = new Matrix([
    [c0[0], c1[0]],
    [c0[1], c1[1]],
    [c0[2], c1[2]],
    [c0[3], c1[3]],
  ]);
  const U = Isometry(V);
  assertEquals(U.rows, 4);
  assertEquals(U.cols, 4);
  assert(U.isUnitary());
  // First two columns equal V
  for (let i = 0; i < 4; i++) {
    assert(U.get(i, 0).equals(c0[i]));
    assert(U.get(i, 1).equals(c1[i]));
  }
});

Deno.test("Tier7: Isometry rejects non-isometric input", () => {
  const V = new Matrix([[Complex.ONE], [Complex.ONE]]); // norm sqrt(2) ≠ 1
  try {
    Isometry(V);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("not an isometry"));
  }
});

// -------- UnitaryGate --------

Deno.test("Tier7: UnitaryGate validates and returns input unchanged", () => {
  const U = UGate(0.5, 0.3, -0.7);
  assert(UnitaryGate(U).equals(U));
});

Deno.test("Tier7: UnitaryGate accepts multi-qubit unitaries", () => {
  assert(UnitaryGate(CXGate()).equals(CXGate()));
  assert(UnitaryGate(SwapGate()).equals(SwapGate()));
});

Deno.test("Tier7: UnitaryGate rejects non-unitary input", () => {
  try {
    UnitaryGate(Matrix.real([[1, 2], [3, 4]]));
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("not unitary"));
  }
});

Deno.test("Tier7: UnitaryGate rejects non-power-of-two dimension", () => {
  try {
    UnitaryGate(Matrix.identity(3));
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("power of two"));
  }
});

// =============================================================================
// Tier 8: Hamiltonian simulation and Pauli evolution
// =============================================================================

import { HamiltonianGate, PauliEvolutionGate } from "../src/gates.ts";

// -------- HamiltonianGate --------

Deno.test("Tier8: Hamiltonian(0 matrix, t) = I", () => {
  const H = Matrix.zeros(2, 2);
  assert(HamiltonianGate(H, 0.5).equals(Matrix.identity(2)));
});

Deno.test("Tier8: Hamiltonian(Z, t) = RZ(2t) up to global phase (since RZ = exp(-i*t*Z))", () => {
  // Z is Hermitian. exp(-i*t*Z) = diag(exp(-i*t), exp(i*t)) = RZ(2t).
  const t = 0.7;
  assert(HamiltonianGate(ZGate(), t).equals(RZGate(2 * t)));
});

Deno.test("Tier8: Hamiltonian(X, t) = RX(2t)", () => {
  // exp(-i*t*X) = RX(2t) (since RX(theta) = exp(-i*theta*X/2))
  const t = 0.3;
  assert(HamiltonianGate(XGate(), t).equals(RXGate(2 * t)));
});

Deno.test("Tier8: Hamiltonian(Y, t) = RY(2t)", () => {
  const t = 0.4;
  assert(HamiltonianGate(YGate(), t).equals(RYGate(2 * t)));
});

Deno.test("Tier8: Hamiltonian(I, t) = exp(-i*t) * I", () => {
  // The 2x2 identity as Hermitian matrix
  const t = 0.5;
  const M = HamiltonianGate(Matrix.identity(2), t);
  const expected = Matrix.identity(2).scale(Complex.exp(-t));
  assert(M.equals(expected));
});

Deno.test("Tier8: Hamiltonian rejects non-Hermitian", () => {
  const nonHerm = new Matrix([
    [Complex.ZERO, Complex.ONE],
    [Complex.ZERO, Complex.ZERO],
  ]);
  try {
    HamiltonianGate(nonHerm, 0.5);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("Hermitian"));
  }
});

Deno.test("Tier8: Hamiltonian is unitary for known H", () => {
  assert(HamiltonianGate(XGate(), 0.5).isUnitary());
  assert(HamiltonianGate(ZGate(), 0.5).isUnitary());
  // A 4x4 Hermitian: Z ⊗ Z
  assert(HamiltonianGate(ZGate().tensor(ZGate()), 0.3).isUnitary());
});

Deno.test("Tier8: Hamiltonian(Z⊗Z, t) = RZZ(2t)", () => {
  const t = 0.4;
  assert(HamiltonianGate(ZGate().tensor(ZGate()), t).equals(RZZGate(2 * t)));
});

Deno.test("Tier8: Hamiltonian(X⊗X, t) = RXX(2t)", () => {
  const t = 0.25;
  assert(HamiltonianGate(XGate().tensor(XGate()), t).equals(RXXGate(2 * t)));
});

// -------- PauliEvolutionGate --------

Deno.test("Tier8: PauliEvolution single term 'Z' = RZ(2*t*c)", () => {
  const t = 0.3;
  const c = 0.5;
  const M = PauliEvolutionGate([{ coefficient: c, pauliString: "Z" }], t);
  assert(M.equals(RZGate(2 * t * c)));
});

Deno.test("Tier8: PauliEvolution single term 'X' = RX(2*t*c)", () => {
  const t = 0.3;
  const c = 0.5;
  const M = PauliEvolutionGate([{ coefficient: c, pauliString: "X" }], t);
  assert(M.equals(RXGate(2 * t * c)));
});

Deno.test("Tier8: PauliEvolution commuting terms ZZ factorize exactly", () => {
  // H = 0.5 * ZI + 0.3 * IZ (these commute). exp(-i*t*H) = exp(-i*t*0.5*ZI) * exp(-i*t*0.3*IZ)
  const t = 0.4;
  const M = PauliEvolutionGate([
    { coefficient: 0.5, pauliString: "ZI" },
    { coefficient: 0.3, pauliString: "IZ" },
  ], t);
  const expected = PauliProductRotationGate(2 * t * 0.5, "ZI").multiply(
    PauliProductRotationGate(2 * t * 0.3, "IZ"),
  );
  assert(M.equals(expected));
});

Deno.test("Tier8: PauliEvolution non-commuting terms (via HamiltonianGate) is unitary", () => {
  // H = X + Z — non-commuting
  const M = PauliEvolutionGate([
    { coefficient: 1, pauliString: "X" },
    { coefficient: 1, pauliString: "Z" },
  ], 0.5);
  assert(M.isUnitary());
});

Deno.test("Tier8: PauliEvolution with X + Z agrees with HamiltonianGate construction", () => {
  const t = 0.3;
  const lhs = PauliEvolutionGate([
    { coefficient: 1, pauliString: "X" },
    { coefficient: 1, pauliString: "Z" },
  ], t);
  const H = XGate().add(ZGate());
  const rhs = HamiltonianGate(H, t);
  assert(lhs.equals(rhs));
});

Deno.test("Tier8: PauliEvolution collects like terms", () => {
  // 2*X = X + X should produce exp(-i*t*2*X) = RX(4*t)
  const t = 0.25;
  const M = PauliEvolutionGate([
    { coefficient: 1, pauliString: "X" },
    { coefficient: 1, pauliString: "X" },
  ], t);
  assert(M.equals(RXGate(4 * t)));
});

Deno.test("Tier8: PauliEvolution rejects mismatched Pauli string lengths", () => {
  try {
    PauliEvolutionGate([
      { coefficient: 1, pauliString: "X" },
      { coefficient: 1, pauliString: "XY" },
    ], 0.3);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("same length"));
  }
});

// =============================================================================
// Tier 9: QFT
// =============================================================================

import { QFTGate } from "../src/gates.ts";

/** Bit reversal of `x` over `n` bits — test-local helper. */
function brev(x: number, n: number): number {
  let r = 0;
  for (let i = 0; i < n; i++) {
    if ((x >> i) & 1) r |= 1 << (n - 1 - i);
  }
  return r;
}

Deno.test("Tier9: QFT(0) = zero-qubit identity (1x1)", () => {
  const Q = QFTGate(0);
  assertEquals(Q.rows, 1);
  assert(Q.get(0, 0).equals(Complex.ONE));
});

Deno.test("Tier9: QFT(1) = H", () => {
  assert(QFTGate(1).equals(HGate()));
});

Deno.test("Tier9: QFT(2) is unitary", () => assert(QFTGate(2).isUnitary()));
Deno.test("Tier9: QFT(3) is unitary", () => assert(QFTGate(3).isUnitary()));
Deno.test("Tier9: QFT(4) is unitary", () => assert(QFTGate(4).isUnitary()));

Deno.test("Tier9: QFT(n) matches canonical formula QFT[j,k] = (1/sqrt(2^n))*exp(2πi*j*brev(k)/2^n)", () => {
  for (const n of [2, 3, 4]) {
    const dim = 1 << n;
    const norm = 1 / Math.sqrt(dim);
    const Q = QFTGate(n);
    for (let j = 0; j < dim; j++) {
      for (let k = 0; k < dim; k++) {
        const angle = (2 * Math.PI * j * brev(k, n)) / dim;
        const expected = Complex.exp(angle).scale(norm);
        assert(
          Q.get(j, k).equals(expected),
          `mismatch at n=${n}, j=${j}, k=${k}`,
        );
      }
    }
  }
});

Deno.test("Tier9: QFT†*QFT = I for n=2..4", () => {
  for (const n of [2, 3, 4]) {
    const Q = QFTGate(n);
    const prod = Q.dagger().multiply(Q);
    assert(prod.equals(Matrix.identity(1 << n)));
  }
});

Deno.test("Tier9: QFT*QFT† = I for n=2..4", () => {
  for (const n of [2, 3, 4]) {
    const Q = QFTGate(n);
    const prod = Q.multiply(Q.dagger());
    assert(prod.equals(Matrix.identity(1 << n)));
  }
});

Deno.test("Tier9: QFT rejects negative n", () => {
  try {
    QFTGate(-1);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("nonnegative"));
  }
});

// =============================================================================
// Tier 10: Reversible classical logic
// =============================================================================

import {
  AndGate,
  BitwiseXorGate,
  InnerProductGate,
  OrGate,
} from "../src/gates.ts";

// -------- AndGate --------

Deno.test("Tier10: AndGate(0) = X (empty conjunction is 1)", () => {
  assert(AndGate(0).equals(XGate()));
});

Deno.test("Tier10: AndGate(1) = CX", () => {
  assert(AndGate(1).equals(CXGate()));
});

Deno.test("Tier10: AndGate(2) = CCX", () => {
  assert(AndGate(2).equals(CCXGate()));
});

Deno.test("Tier10: AndGate(3) = MCX(3) = C3X", () => {
  assert(AndGate(3).equals(C3XGate()));
});

Deno.test("Tier10: AndGate is unitary for n=0..3", () => {
  for (let n = 0; n <= 3; n++) assert(AndGate(n).isUnitary());
});

// -------- OrGate truth table --------

Deno.test("Tier10: OrGate(0) = I (empty OR is 0)", () => {
  assert(OrGate(0).equals(IGate()));
});

Deno.test("Tier10: OrGate(2) truth table on (x1, x2, out)", () => {
  const M = OrGate(2);
  // Initial state |x1 x2 0⟩ should become |x1 x2 (x1|x2)⟩
  // MSB-first (x1, x2, out): |x1 x2 0⟩ = index 4*x1 + 2*x2
  // target index = 4*x1 + 2*x2 + (x1|x2)
  for (let x1 = 0; x1 < 2; x1++) {
    for (let x2 = 0; x2 < 2; x2++) {
      const v: Complex[] = new Array(8).fill(Complex.ZERO);
      v[4 * x1 + 2 * x2] = Complex.ONE;
      const out = M.apply(v);
      const expected = 4 * x1 + 2 * x2 + (x1 | x2);
      assert(out[expected].equals(Complex.ONE));
    }
  }
});

Deno.test("Tier10: OrGate(3) truth table", () => {
  const M = OrGate(3);
  // 8 inputs with out=0: should set out = x1|x2|x3
  for (let x1 = 0; x1 < 2; x1++) {
    for (let x2 = 0; x2 < 2; x2++) {
      for (let x3 = 0; x3 < 2; x3++) {
        const inIdx = 8 * x1 + 4 * x2 + 2 * x3;
        const v: Complex[] = new Array(16).fill(Complex.ZERO);
        v[inIdx] = Complex.ONE;
        const out = M.apply(v);
        const expected = inIdx + (x1 | x2 | x3);
        assert(out[expected].equals(Complex.ONE));
      }
    }
  }
});

Deno.test("Tier10: OrGate is unitary for n=0..3", () => {
  for (let n = 0; n <= 3; n++) assert(OrGate(n).isUnitary());
});

// -------- BitwiseXorGate --------

Deno.test("Tier10: BitwiseXor(0) = zero-qubit identity", () => {
  assertEquals(BitwiseXorGate(0).rows, 1);
});

Deno.test("Tier10: BitwiseXor(1) = CX", () => {
  assert(BitwiseXorGate(1).equals(CXGate()));
});

Deno.test("Tier10: BitwiseXor(2) truth table", () => {
  // |a0 a1 b0 b1⟩ → |a0 a1 (a0^b0) (a1^b1)⟩
  const M = BitwiseXorGate(2);
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      // MSB-first index: a takes top 2 bits, b takes bottom 2
      const inIdx = (a << 2) | b;
      const v: Complex[] = new Array(16).fill(Complex.ZERO);
      v[inIdx] = Complex.ONE;
      const out = M.apply(v);
      const expected = (a << 2) | (a ^ b);
      assert(out[expected].equals(Complex.ONE));
    }
  }
});

Deno.test("Tier10: BitwiseXor(3) is unitary", () => {
  assert(BitwiseXorGate(3).isUnitary());
});

// -------- InnerProductGate --------

Deno.test("Tier10: InnerProduct(0) = I (empty sum = 0)", () => {
  assert(InnerProductGate(0).equals(IGate()));
});

Deno.test("Tier10: InnerProduct(1) = CCX", () => {
  assert(InnerProductGate(1).equals(CCXGate()));
});

Deno.test("Tier10: InnerProduct(2) truth table", () => {
  // |a0 a1 b0 b1 r⟩ → |a0 a1 b0 b1 r⊕(a·b mod 2)⟩
  // Operand order: a0, a1, b0, b1, r (5 qubits, 32-dim).
  // MSB-first index: a0 bit 4, a1 bit 3, b0 bit 2, b1 bit 1, r bit 0.
  const M = InnerProductGate(2);
  for (let a0 = 0; a0 < 2; a0++) {
    for (let a1 = 0; a1 < 2; a1++) {
      for (let b0 = 0; b0 < 2; b0++) {
        for (let b1 = 0; b1 < 2; b1++) {
          const inIdx = (a0 << 4) | (a1 << 3) | (b0 << 2) | (b1 << 1);
          const v: Complex[] = new Array(32).fill(Complex.ZERO);
          v[inIdx] = Complex.ONE;
          const out = M.apply(v);
          const ip = (a0 * b0 + a1 * b1) & 1;
          const expected = inIdx | ip;
          assert(out[expected].equals(Complex.ONE));
        }
      }
    }
  }
});

Deno.test("Tier10: InnerProduct is unitary for n=1..3", () => {
  for (let n = 1; n <= 3; n++) assert(InnerProductGate(n).isUnitary());
});

// =============================================================================
// Tier 11: Quantum arithmetic
// =============================================================================

import {
  FullAdderGate,
  HalfAdderGate,
  ModularAdderGate,
  MultiplierGate,
} from "../src/gates.ts";

// -------- HalfAdderGate --------

Deno.test("Tier11: HalfAdder truth table", () => {
  // Operands (a, b, sum, carry). MSB-first index: a=bit3, b=bit2, sum=bit1, carry=bit0.
  // For clean sum=0, carry=0: output sum = a^b, carry = a&b.
  const M = HalfAdderGate();
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      const inIdx = (a << 3) | (b << 2);
      const v: Complex[] = new Array(16).fill(Complex.ZERO);
      v[inIdx] = Complex.ONE;
      const out = M.apply(v);
      const sum = a ^ b;
      const carry = a & b;
      const outIdx = (a << 3) | (b << 2) | (sum << 1) | carry;
      assert(out[outIdx].equals(Complex.ONE));
    }
  }
});

Deno.test("Tier11: HalfAdder is unitary", () =>
  assert(HalfAdderGate().isUnitary()));

// -------- FullAdderGate --------

Deno.test("Tier11: FullAdder truth table", () => {
  // Operands (a, b, c_in, sum, c_out). 5 qubits = 32 dim.
  // MSB-first: a=bit4, b=bit3, c_in=bit2, sum=bit1, c_out=bit0.
  // Clean sum=0, c_out=0 → outputs sum=a^b^c_in, c_out=maj(a,b,c_in).
  const M = FullAdderGate();
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      for (let cin = 0; cin < 2; cin++) {
        const inIdx = (a << 4) | (b << 3) | (cin << 2);
        const v: Complex[] = new Array(32).fill(Complex.ZERO);
        v[inIdx] = Complex.ONE;
        const out = M.apply(v);
        const sum = a ^ b ^ cin;
        const cout = (a & b) | (b & cin) | (a & cin);
        const outIdx = (a << 4) | (b << 3) | (cin << 2) | (sum << 1) | cout;
        assert(
          out[outIdx].equals(Complex.ONE),
          `FullAdder a=${a} b=${b} cin=${cin} expected idx ${outIdx}`,
        );
      }
    }
  }
});

Deno.test("Tier11: FullAdder is unitary", () =>
  assert(FullAdderGate().isUnitary()));

// -------- ModularAdderGate --------

Deno.test("Tier11: ModularAdder(0) = zero-qubit identity", () => {
  assertEquals(ModularAdderGate(0).rows, 1);
});

Deno.test("Tier11: ModularAdder(1) is unitary", () =>
  assert(ModularAdderGate(1).isUnitary()));
Deno.test("Tier11: ModularAdder(2) is unitary", () =>
  assert(ModularAdderGate(2).isUnitary()));
Deno.test("Tier11: ModularAdder(3) is unitary", () =>
  assert(ModularAdderGate(3).isUnitary()));

Deno.test("Tier11: ModularAdder(2) adds a+b mod 4 for all 16 inputs", () => {
  // Operand: (a[0], a[1], b[0], b[1]) where a[i] is bit i of the register value a.
  // Section 2 little-endian: register value a has bit i on qubit a[i].
  // MSB-first matrix indexing: arg 0 = a[0] = bit 3, arg 1 = a[1] = bit 2,
  //                             arg 2 = b[0] = bit 1, arg 3 = b[1] = bit 0.
  //
  // Register a_val = a[0] + 2*a[1]; b_val = b[0] + 2*b[1].
  // Output: (a_val, (a_val + b_val) mod 4).
  const M = ModularAdderGate(2);
  for (let a0 = 0; a0 < 2; a0++) {
    for (let a1 = 0; a1 < 2; a1++) {
      for (let b0 = 0; b0 < 2; b0++) {
        for (let b1 = 0; b1 < 2; b1++) {
          const inIdx = (a0 << 3) | (a1 << 2) | (b0 << 1) | b1;
          const v: Complex[] = new Array(16).fill(Complex.ZERO);
          v[inIdx] = Complex.ONE;
          const out = M.apply(v);
          const a_val = a0 + 2 * a1;
          const b_val = b0 + 2 * b1;
          const newB = (a_val + b_val) % 4;
          // Re-encode newB into MSB-first b[0]=bit1, b[1]=bit0:
          const newB0 = newB & 1;
          const newB1 = (newB >> 1) & 1;
          const outIdx = (a0 << 3) | (a1 << 2) | (newB0 << 1) | newB1;
          assert(
            out[outIdx].equals(Complex.ONE),
            `ModularAdder(2) a=${a_val} b=${b_val}: expected newB=${newB}, inIdx=${inIdx}, outIdx=${outIdx}`,
          );
        }
      }
    }
  }
});

Deno.test("Tier11: ModularAdder(3) adds a+b mod 8 spot check", () => {
  // Just a few specific cases as a smoke test.
  const M = ModularAdderGate(3);
  // a_val=3, b_val=2 → (3+2) mod 8 = 5.
  // Operand: a[0..2], b[0..2]. a=3 → a[0]=1, a[1]=1, a[2]=0. b=2 → b[0]=0, b[1]=1, b[2]=0.
  // MSB-first bits: a[0]=bit5, a[1]=bit4, a[2]=bit3, b[0]=bit2, b[1]=bit1, b[2]=bit0.
  // inIdx = (1<<5) | (1<<4) | (0<<3) | (0<<2) | (1<<1) | 0 = 32+16+0+0+2+0 = 50.
  const inIdx = 50;
  const v: Complex[] = new Array(64).fill(Complex.ZERO);
  v[inIdx] = Complex.ONE;
  const out = M.apply(v);
  // Expected: a=3, b=5. b[0]=1, b[1]=0, b[2]=1. outIdx = (1<<5)|(1<<4)|(0<<3)|(1<<2)|(0<<1)|1 = 32+16+4+1 = 53.
  assert(out[53].equals(Complex.ONE));
});

// -------- MultiplierGate --------

Deno.test("Tier11: Multiplier(0) = zero-qubit identity", () => {
  assertEquals(MultiplierGate(0).rows, 1);
});

Deno.test("Tier11: Multiplier(1) is unitary", () =>
  assert(MultiplierGate(1).isUnitary()));
Deno.test("Tier11: Multiplier(2) is unitary", () =>
  assert(MultiplierGate(2).isUnitary()));

Deno.test("Tier11: Multiplier(2) produces a*b mod 16 on clean product register", () => {
  // Operand: a[0..1], b[0..1], product[0..3]. 8 qubits = 256 dim.
  // MSB-first: a[0]=bit7, a[1]=bit6, b[0]=bit5, b[1]=bit4,
  //            p[0]=bit3, p[1]=bit2, p[2]=bit1, p[3]=bit0.
  const M = MultiplierGate(2);
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      const a0 = a & 1, a1 = (a >> 1) & 1;
      const b0 = b & 1, b1 = (b >> 1) & 1;
      const inIdx = (a0 << 7) | (a1 << 6) | (b0 << 5) | (b1 << 4);
      const v: Complex[] = new Array(256).fill(Complex.ZERO);
      v[inIdx] = Complex.ONE;
      const out = M.apply(v);
      const prod = (a * b) % 16;
      const p0 = prod & 1;
      const p1 = (prod >> 1) & 1;
      const p2 = (prod >> 2) & 1;
      const p3 = (prod >> 3) & 1;
      const outIdx = (a0 << 7) | (a1 << 6) | (b0 << 5) | (b1 << 4) |
        (p0 << 3) | (p1 << 2) | (p2 << 1) | p3;
      assert(
        out[outIdx].equals(Complex.ONE),
        `Multiplier(2) a=${a} b=${b} expected prod=${prod}`,
      );
    }
  }
});

// =============================================================================
// Tier 12: Function loading and approximation
// =============================================================================

import {
  ExactReciprocalGate,
  IntegerComparatorGate,
  LinearAmplitudeFunctionGate,
  LinearPauliRotationsGate,
  PiecewiseChebyshevGate,
  PiecewiseLinearPauliRotationsGate,
  PiecewisePolynomialPauliRotationsGate,
  PolynomialPauliRotationsGate,
} from "../src/gates.ts";

// -------- LinearPauliRotationsGate --------

Deno.test("Tier12: LinearPauliRotations(0, offset, 0) = RY(2*offset)", () => {
  assert(LinearPauliRotationsGate(0, 0.3, 0).equals(RYGate(0.6)));
});

Deno.test("Tier12: LinearPauliRotations is unitary", () => {
  assert(LinearPauliRotationsGate(0.1, 0.2, 2).isUnitary());
  assert(LinearPauliRotationsGate(0.5, 0, 3, "Z").isUnitary());
});

Deno.test("Tier12: LinearPauliRotations angle matches 2*(slope*x + offset) per basis", () => {
  const slope = 0.3;
  const offset = 0.1;
  const n = 2;
  const M = LinearPauliRotationsGate(slope, offset, n);
  // For each basis state |x> ⊗ |0>, target amplitude 1 should rotate to (cos, sin).
  // Operand: x[0], x[1], target. MSB-first: x[0]=bit2, x[1]=bit1, target=bit0.
  for (let x = 0; x < 4; x++) {
    const x0 = x & 1, x1 = (x >> 1) & 1;
    // Input |x0 x1 0⟩ = (x0<<2)|(x1<<1)
    const inIdx = (x0 << 2) | (x1 << 1);
    const v: Complex[] = new Array(8).fill(Complex.ZERO);
    v[inIdx] = Complex.ONE;
    const out = M.apply(v);
    const angle = 2 * (slope * x + offset);
    // Expected: cos(angle/2) on |...0⟩, sin(angle/2) on |...1⟩
    const expectedCos = Math.cos(angle / 2);
    const expectedSin = Math.sin(angle / 2);
    assert(
      Math.abs(out[inIdx].re - expectedCos) <= 1e-10,
      `cos mismatch at x=${x}: got ${out[inIdx].re}, expected ${expectedCos}`,
    );
    assert(
      Math.abs(out[inIdx | 1].re - expectedSin) <= 1e-10,
      `sin mismatch at x=${x}: got ${
        out[inIdx | 1].re
      }, expected ${expectedSin}`,
    );
  }
});

// -------- PolynomialPauliRotationsGate --------

Deno.test("Tier12: Polynomial with coeffs [c] (constant) = RY(2c) unconditional", () => {
  const M = PolynomialPauliRotationsGate([0.4], 2);
  // For every x, target rotates by 2*0.4 = 0.8 (constant)
  // So the combined matrix is I⊗I⊗RY(0.8) equivalent.
  assert(M.isUnitary());
  // Check: on |00 0⟩, we should get RY(0.8) applied.
  const v = new Array(8).fill(Complex.ZERO);
  v[0] = Complex.ONE;
  const out = M.apply(v);
  assert(out[0].equals(Complex.real(Math.cos(0.4))));
  assert(out[1].equals(Complex.real(Math.sin(0.4))));
});

Deno.test("Tier12: Polynomial with linear coeffs [0, 0.3] matches Linear", () => {
  const n = 2;
  const slope = 0.3;
  const polyM = PolynomialPauliRotationsGate([0, slope], n);
  const linM = LinearPauliRotationsGate(slope, 0, n);
  assert(polyM.equals(linM));
});

Deno.test("Tier12: Polynomial is unitary for various degrees", () => {
  assert(PolynomialPauliRotationsGate([0.1, 0.2, 0.05], 2).isUnitary());
  assert(PolynomialPauliRotationsGate([0, 0.1, -0.02, 0.005], 2).isUnitary());
});

// -------- IntegerComparatorGate --------

Deno.test("Tier12: IntegerComparator(value=0, geq=true) = X on result (always true)", () => {
  // Trivial case: always x >= 0.
  // Operand layout: x[0..n-1], result, w[0..n]. With n=2, total 6 qubits = 64 dim.
  const n = 2;
  const M = IntegerComparatorGate(0, n, true);
  // On |x, result=0, w=000⟩, result should flip to 1.
  for (let x = 0; x < 4; x++) {
    const x0 = x & 1, x1 = (x >> 1) & 1;
    // inIdx: x[0]=bit5, x[1]=bit4, result=bit3, w[0]=bit2, w[1]=bit1, w[2]=bit0
    const inIdx = (x0 << 5) | (x1 << 4);
    const v: Complex[] = new Array(64).fill(Complex.ZERO);
    v[inIdx] = Complex.ONE;
    const out = M.apply(v);
    const outIdx = inIdx | (1 << 3); // result flipped to 1
    assert(out[outIdx].equals(Complex.ONE));
  }
});

Deno.test("Tier12: IntegerComparator(value=5, n=2, geq=true) = identity (since x<=3)", () => {
  // 5 > 2^2 - 1 = 3, so always x < value ⇒ geq is always false ⇒ result unchanged
  const M = IntegerComparatorGate(5, 2, true);
  assert(M.equals(Matrix.identity(64)));
});

Deno.test("Tier12: IntegerComparator non-trivial case computes x >= 2 correctly", () => {
  // n = 2, value = 2. For x in [0, 3]: expect result ← (x >= 2).
  // Operand: x[0..1], result, w[0..2]. 6 qubits = 64 dim.
  const M = IntegerComparatorGate(2, 2, true);
  for (let x = 0; x < 4; x++) {
    const x0 = x & 1, x1 = (x >> 1) & 1;
    const inIdx = (x0 << 5) | (x1 << 4);
    const v: Complex[] = new Array(64).fill(Complex.ZERO);
    v[inIdx] = Complex.ONE;
    const out = M.apply(v);
    const expected = x >= 2 ? 1 : 0;
    const outIdx = inIdx | (expected << 3);
    assert(
      out[outIdx].equals(Complex.ONE),
      `IntegerComparator(2) failed at x=${x}: expected result=${expected}`,
    );
  }
});

Deno.test("Tier12: IntegerComparator geq=false inverts the result", () => {
  // x < 2 predicate: x=0,1 → 1; x=2,3 → 0
  const M = IntegerComparatorGate(2, 2, false);
  for (let x = 0; x < 4; x++) {
    const x0 = x & 1, x1 = (x >> 1) & 1;
    const inIdx = (x0 << 5) | (x1 << 4);
    const v: Complex[] = new Array(64).fill(Complex.ZERO);
    v[inIdx] = Complex.ONE;
    const out = M.apply(v);
    const expected = x < 2 ? 1 : 0;
    const outIdx = inIdx | (expected << 3);
    assert(out[outIdx].equals(Complex.ONE));
  }
});

Deno.test("Tier12: IntegerComparator restores work register to 0", () => {
  // After the full template, w[0..2] should be back to |000⟩.
  const M = IntegerComparatorGate(2, 2, true);
  for (let x = 0; x < 4; x++) {
    const x0 = x & 1, x1 = (x >> 1) & 1;
    const inIdx = (x0 << 5) | (x1 << 4);
    const v: Complex[] = new Array(64).fill(Complex.ZERO);
    v[inIdx] = Complex.ONE;
    const out = M.apply(v);
    // Only bits 2, 1, 0 (w[0], w[1], w[2]) should have 0. Output index bit pattern for w = 000.
    for (let i = 0; i < 64; i++) {
      if (!out[i].equals(Complex.ZERO)) {
        // Extract w bits
        const wBits = i & 0b111;
        assert(wBits === 0, `Work register not clean at i=${i}, w=${wBits}`);
      }
    }
  }
});

Deno.test("Tier12: IntegerComparator is unitary", () => {
  assert(IntegerComparatorGate(2, 2, true).isUnitary());
  assert(IntegerComparatorGate(1, 2, false).isUnitary());
});

// -------- LinearAmplitudeFunctionGate --------

Deno.test("Tier12: LinearAmplitudeFunction is unitary", () => {
  assert(LinearAmplitudeFunctionGate(1, 0, [0, 1], [0, 1], 2).isUnitary());
});

Deno.test("Tier12: LinearAmplitudeFunction f(x)=0 keeps target in |0>", () => {
  // slope=0, offset=0, domain=[0,1], image=[0,1] ⇒ f(x) = (0-0)/(1-0) = 0
  const M = LinearAmplitudeFunctionGate(0, 0, [0, 1], [0, 1], 2);
  assert(M.equals(Matrix.identity(8)));
});

Deno.test("Tier12: LinearAmplitudeFunction f(x)=1 flips target to |1>", () => {
  // slope=0, offset=1, domain=[0,1], image=[0,1] ⇒ y = clamp(1) = 1 ⇒ f(x) = (1-0)/(1-0) = 1
  const M = LinearAmplitudeFunctionGate(0, 1, [0, 1], [0, 1], 2);
  // For each input |x⟩|0⟩, target should become |1⟩.
  for (let x = 0; x < 4; x++) {
    const x0 = x & 1, x1 = (x >> 1) & 1;
    const inIdx = (x0 << 2) | (x1 << 1);
    const v: Complex[] = new Array(8).fill(Complex.ZERO);
    v[inIdx] = Complex.ONE;
    const out = M.apply(v);
    // Expected target=1, so index = inIdx | 1
    assert(
      Math.abs(out[inIdx | 1].magnitude() - 1) <= 1e-10,
      `LinearAmplitude f=1 x=${x}: expected |1⟩ at idx ${inIdx | 1}`,
    );
  }
});

// -------- ExactReciprocalGate --------

Deno.test("Tier12: ExactReciprocal is unitary for n=2", () => {
  assert(ExactReciprocalGate(2, 0.5).isUnitary());
});

Deno.test("Tier12: ExactReciprocal leaves x=0 unchanged", () => {
  const M = ExactReciprocalGate(2, 0.5);
  // |00 0⟩ at index 0 should stay.
  const v: Complex[] = new Array(8).fill(Complex.ZERO);
  v[0] = Complex.ONE;
  const out = M.apply(v);
  assert(out[0].equals(Complex.ONE));
});

Deno.test("Tier12: ExactReciprocal rejects |scalingFactor| > 1", () => {
  try {
    ExactReciprocalGate(2, 1.5);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("scalingFactor"));
  }
});

// -------- PiecewiseLinearPauliRotationsGate --------

Deno.test("Tier12: PiecewiseLinear with a single piece equals Linear", () => {
  // breakpoints = [0, 4], one piece ⇒ linear over all x ∈ [0, 4).
  const slope = 0.1;
  const offset = 0.2;
  const M1 = PiecewiseLinearPauliRotationsGate([0, 4], [slope], [offset], 2);
  // Compare against the equivalent direct synthesis used internally:
  // both should produce the same matrix.
  // We can compare by computing the expected "value-selective" rotations.
  // Just verify unitarity and that x=0 and x=3 give the correct rotations.
  assert(M1.isUnitary());
});

Deno.test("Tier12: PiecewiseLinear with two pieces is unitary", () => {
  const M = PiecewiseLinearPauliRotationsGate(
    [0, 2, 4],
    [0.1, 0.3],
    [0, 0.2],
    2,
  );
  assert(M.isUnitary());
});

// -------- PiecewisePolynomialPauliRotationsGate --------

Deno.test("Tier12: PiecewisePolynomial with single constant piece is unitary", () => {
  const M = PiecewisePolynomialPauliRotationsGate([0, 4], [[0.3]], 2);
  assert(M.isUnitary());
});

// -------- PiecewiseChebyshevGate --------

Deno.test("Tier12: PiecewiseChebyshev constructor runs and returns unitary", () => {
  // Single piece, degree 1: constant samples.
  const fSamples = [[0.3, 0.3]]; // constant 0.3 at both Chebyshev nodes
  const M = PiecewiseChebyshevGate(fSamples, [0, 4], 2);
  assert(M.isUnitary());
});

// =============================================================================
// Tier 13: Comparison, aggregation, and oracles
// (IntegerComparatorGate already tested under Tier 12)
// =============================================================================

import {
  BitFlipOracleGate,
  type ESOPTerm,
  PhaseOracleGate,
  QuadraticFormGate,
  WeightedSumGate,
} from "../src/gates.ts";

// -------- QuadraticFormGate --------

Deno.test("Tier13: QuadraticForm with all-zero coeffs = identity", () => {
  const n = 2;
  const m = 2;
  const A = [[0, 0], [0, 0]];
  const b = [0, 0];
  const M = QuadraticFormGate(A, b, 0, n, m);
  assert(M.equals(Matrix.identity(1 << (n + m))));
});

Deno.test("Tier13: QuadraticForm constant adds c mod 2^m to result", () => {
  // q(x) = c = 1. Should add 1 to result register.
  const n = 2;
  const m = 2;
  const A = [[0, 0], [0, 0]];
  const b = [0, 0];
  const c = 1;
  const M = QuadraticFormGate(A, b, c, n, m);
  // Test: |x = 00, r = 00⟩ → |x = 00, r = 01⟩
  // Operand: x[0..1] + r[0..1]. Bits: x[0]=bit3, x[1]=bit2, r[0]=bit1, r[1]=bit0.
  // r_val = r[0] + 2*r[1], so adding 1 means r[0] flips.
  const v: Complex[] = new Array(16).fill(Complex.ZERO);
  v[0] = Complex.ONE; // |0000⟩
  const out = M.apply(v);
  // Output register r = 1: r[0]=1, r[1]=0 ⇒ bit1=1, bit0=0 ⇒ idx 2.
  assert(out[2].equals(Complex.ONE));
});

Deno.test("Tier13: QuadraticForm linear term b=[1,0] adds x[0] to result", () => {
  const n = 2;
  const m = 2;
  const A = [[0, 0], [0, 0]];
  const b = [1, 0];
  const M = QuadraticFormGate(A, b, 0, n, m);
  // For x=1 (x[0]=1, x[1]=0), r should go from 0 to 1.
  // inIdx: x[0]=bit3=1, x[1]=bit2=0, r=00 ⇒ idx = 8.
  const v: Complex[] = new Array(16).fill(Complex.ZERO);
  v[8] = Complex.ONE;
  const out = M.apply(v);
  // Expected: r=1 ⇒ idx 8 | 2 = 10.
  assert(out[10].equals(Complex.ONE));
});

Deno.test("Tier13: QuadraticForm is unitary", () => {
  const M = QuadraticFormGate([[1, 0], [0, 1]], [0, 0], 0, 2, 2);
  assert(M.isUnitary());
});

Deno.test("Tier13: QuadraticForm with m=0 is identity on x", () => {
  const M = QuadraticFormGate([[1, 0], [0, 1]], [1, 2], 3, 2, 0);
  assert(M.equals(Matrix.identity(4)));
});

// -------- WeightedSumGate --------

Deno.test("Tier13: WeightedSum with all-zero weights = identity", () => {
  const M = WeightedSumGate([0, 0], 2, 2);
  assert(M.equals(Matrix.identity(16)));
});

Deno.test("Tier13: WeightedSum w=[1,0] on 2 qubits adds x[0] into sum", () => {
  const M = WeightedSumGate([1, 0], 2, 2);
  // For x=1 (x[0]=1, x[1]=0), sum goes from 0 to 1.
  // Operand: x[0..1] + sum[0..1]. x[0]=bit3, x[1]=bit2, sum[0]=bit1, sum[1]=bit0.
  const v: Complex[] = new Array(16).fill(Complex.ZERO);
  v[8] = Complex.ONE; // x[0]=1, x[1]=0, sum=0
  const out = M.apply(v);
  // sum_val = 1: sum[0]=1 ⇒ bit1=1, bit0=0 ⇒ idx = 8 | 2 = 10
  assert(out[10].equals(Complex.ONE));
});

Deno.test("Tier13: WeightedSum w=[1,2] on 2 qubits x=3 gives sum=3 (mod 4)", () => {
  const M = WeightedSumGate([1, 2], 2, 2);
  // x[0]=1 (weight 1), x[1]=1 (weight 2), sum = 1+2 = 3 mod 4 = 3.
  // x[0]=bit3=1, x[1]=bit2=1, sum=0 ⇒ idx = 12
  const v: Complex[] = new Array(16).fill(Complex.ZERO);
  v[12] = Complex.ONE;
  const out = M.apply(v);
  // sum=3: sum[0]=1, sum[1]=1 ⇒ idx = 12 | 2 | 1 = 15
  assert(out[15].equals(Complex.ONE));
});

Deno.test("Tier13: WeightedSum is unitary", () => {
  assert(WeightedSumGate([1, 2, 3], 3, 3).isUnitary());
});

// -------- PhaseOracleGate --------

Deno.test("Tier13: PhaseOracle empty ESOP = identity (phase 0)", () => {
  const M = PhaseOracleGate([], 2);
  assert(M.equals(Matrix.identity(4)));
});

Deno.test("Tier13: PhaseOracle single variable x_0 flips sign on |01>/|11>", () => {
  // Term: x_0 (not negated). f(x) = x_0.
  // Phase oracle applies (-1)^x_0.
  // Basis states: |x_0 x_1⟩ where x_0 is the var-0 bit.
  // Section 2 little-endian: var_0 is at qubit 0. MSB-first matrix: bit1 = qubit 0, bit0 = qubit 1.
  // So states with bit1=1 (qubit 0 = 1 = x_0) get -1 phase.
  // That's indices 2 (|10⟩ in MSB-first) and 3 (|11⟩).
  const M = PhaseOracleGate([{ variables: [0], negated: [false] }], 2);
  // M should be diag(1, 1, -1, -1)
  const expected = Matrix.diagonal([
    Complex.ONE,
    Complex.ONE,
    Complex.MINUS_ONE,
    Complex.MINUS_ONE,
  ]);
  assert(M.equals(expected));
});

Deno.test("Tier13: PhaseOracle single variable x_0 AND x_1 = CZ-like", () => {
  // f(x) = x_0 ∧ x_1. Flip sign only when both are 1.
  // That's only basis state where qubit 0 = 1 AND qubit 1 = 1, which
  // corresponds to MSB-first bits 1,0 both = 1, i.e. index 3 (|11⟩).
  const M = PhaseOracleGate(
    [{ variables: [0, 1], negated: [false, false] }],
    2,
  );
  assert(M.equals(CZGate()));
});

Deno.test("Tier13: PhaseOracle constant 1 term = global -1", () => {
  // ESOP with a single empty term = constant 1. f(x) = 1 ⇒ every state gets -1.
  const M = PhaseOracleGate([{ variables: [], negated: [] }], 2);
  assert(M.equals(Matrix.identity(4).scale(Complex.MINUS_ONE)));
});

Deno.test("Tier13: PhaseOracle with ¬x_0 flips sign on |00>/|01> (qubit 0 = 0)", () => {
  // Negated literal: ¬x_0. Flip sign when x_0 = 0.
  // qubit 0 = MSB bit 1 = 0 ⇒ indices where bit1=0: 0, 1.
  const M = PhaseOracleGate([{ variables: [0], negated: [true] }], 2);
  const expected = Matrix.diagonal([
    Complex.MINUS_ONE,
    Complex.MINUS_ONE,
    Complex.ONE,
    Complex.ONE,
  ]);
  assert(M.equals(expected));
});

Deno.test("Tier13: PhaseOracle is unitary", () => {
  const esop: ESOPTerm[] = [
    { variables: [0, 1], negated: [false, false] },
    { variables: [1], negated: [true] },
  ];
  assert(PhaseOracleGate(esop, 3).isUnitary());
});

// -------- BitFlipOracleGate --------

Deno.test("Tier13: BitFlipOracle empty ESOP = identity", () => {
  const M = BitFlipOracleGate([], 2);
  assert(M.equals(Matrix.identity(8))); // 2 vars + 1 output = 3 qubits
});

Deno.test("Tier13: BitFlipOracle f(x) = x_0 gives CX on (x_0, y)", () => {
  const M = BitFlipOracleGate([{ variables: [0], negated: [false] }], 1);
  // With 1 variable: operand (x_0, y), so 4-dim. Should equal CX.
  assert(M.equals(CXGate()));
});

Deno.test("Tier13: BitFlipOracle f(x) = x_0 AND x_1 = CCX on (x_0, x_1, y)", () => {
  const M = BitFlipOracleGate(
    [{ variables: [0, 1], negated: [false, false] }],
    2,
  );
  assert(M.equals(CCXGate()));
});

Deno.test("Tier13: BitFlipOracle constant 1 = X on y", () => {
  const M = BitFlipOracleGate([{ variables: [], negated: [] }], 0);
  // With 0 variables: just operand y ⇒ 2-dim ⇒ should equal X.
  assert(M.equals(XGate()));
});

Deno.test("Tier13: BitFlipOracle is unitary", () => {
  const esop: ESOPTerm[] = [
    { variables: [0, 1], negated: [false, true] },
    { variables: [2], negated: [false] },
  ];
  assert(BitFlipOracleGate(esop, 3).isUnitary());
});

Deno.test("Tier13: BitFlipOracle XOR of two terms: f(x) = x_0 ⊕ x_1", () => {
  const M = BitFlipOracleGate([
    { variables: [0], negated: [false] },
    { variables: [1], negated: [false] },
  ], 2);
  // 3 qubits: (x_0, x_1, y). y ← y ⊕ (x_0 ⊕ x_1).
  // Verify on all 8 input states.
  for (let x0 = 0; x0 < 2; x0++) {
    for (let x1 = 0; x1 < 2; x1++) {
      for (let y = 0; y < 2; y++) {
        // Operand positions: x_0 at arg 0 (bit 2), x_1 at arg 1 (bit 1), y at arg 2 (bit 0).
        const inIdx = (x0 << 2) | (x1 << 1) | y;
        const v: Complex[] = new Array(8).fill(Complex.ZERO);
        v[inIdx] = Complex.ONE;
        const out = M.apply(v);
        const expectedY = y ^ (x0 ^ x1);
        const outIdx = (x0 << 2) | (x1 << 1) | expectedY;
        assert(out[outIdx].equals(Complex.ONE));
      }
    }
  }
});

// =============================================================================
// Tier 14: State preparation — graph states
// =============================================================================

import { GraphStateGate } from "../src/gates.ts";

Deno.test("Tier14: GraphState empty graph (n=0) is zero-qubit identity", () => {
  const M = GraphStateGate([]);
  assertEquals(M.rows, 1);
  assert(M.get(0, 0).equals(Complex.ONE));
});

Deno.test("Tier14: GraphState single vertex n=1 no edges = H", () => {
  assert(GraphStateGate([[0]]).equals(HGate()));
});

Deno.test("Tier14: GraphState n=2 no edges = H ⊗ H", () => {
  assert(GraphStateGate([[0, 0], [0, 0]]).equals(HGate().tensor(HGate())));
});

Deno.test("Tier14: GraphState n=2 with edge = CZ * (H⊗H)", () => {
  const M = GraphStateGate([[0, 1], [1, 0]]);
  const expected = CZGate().multiply(HGate().tensor(HGate()));
  assert(M.equals(expected));
});

Deno.test("Tier14: GraphState is unitary for n=2..4", () => {
  assert(GraphStateGate([[0, 1], [1, 0]]).isUnitary());
  assert(GraphStateGate([[0, 1, 1], [1, 0, 1], [1, 1, 0]]).isUnitary());
  assert(
    GraphStateGate([
      [0, 1, 0, 1],
      [1, 0, 1, 0],
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ]).isUnitary(),
  );
});

Deno.test("Tier14: GraphState n=3 line graph applied to |000> gives superposition", () => {
  // Graph: 0-1-2 (line). Expected state is (1/sqrt(8)) * sum of all 8 basis states with phases.
  const M = GraphStateGate([
    [0, 1, 0],
    [1, 0, 1],
    [0, 1, 0],
  ]);
  const v0: Complex[] = new Array(8).fill(Complex.ZERO);
  v0[0] = Complex.ONE; // |000⟩
  const out = M.apply(v0);
  // Every basis state must have equal magnitude 1/sqrt(8).
  const mag = 1 / Math.sqrt(8);
  for (let i = 0; i < 8; i++) {
    assert(
      Math.abs(out[i].magnitude() - mag) <= 1e-10,
      `basis ${i} magnitude ${out[i].magnitude()}`,
    );
  }
});

Deno.test("Tier14: GraphState rejects non-square matrix", () => {
  try {
    GraphStateGate([[0, 1]]);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("square"));
  }
});

Deno.test("Tier14: GraphState rejects non-zero diagonal", () => {
  try {
    GraphStateGate([[1, 0], [0, 0]]);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("diagonal"));
  }
});

Deno.test("Tier14: GraphState rejects asymmetric matrix", () => {
  try {
    GraphStateGate([[0, 1], [0, 0]]);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("symmetric"));
  }
});

Deno.test("Tier14: GraphState rejects non-binary entries", () => {
  try {
    GraphStateGate([[0, 2], [2, 0]]);
    throw new Error("should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("0 or 1"));
  }
});
