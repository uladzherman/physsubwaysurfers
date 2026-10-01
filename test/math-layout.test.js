import test from "node:test";
import assert from "node:assert/strict";
import { formulaLabelRows } from "../assets/js/quiz/math-layout.js";

test("narrow layouts put the equation and expression on separate rows", () => {
  assert.deepEqual(formulaLabelRows("S = v_0 t + \\dfrac{a t^2}{2}", true), [
    "S",
    "= v_0 t + \\dfrac{a t^2}{2}"
  ]);
});

test("equation signs inside TeX groups do not split the formula", () => {
  assert.deepEqual(formulaLabelRows("F = \\text{if } x = 0", true), [
    "F",
    "= \\text{if } x = 0"
  ]);
  assert.deepEqual(formulaLabelRows("\\text{a = b}", true), ["\\text{a = b}"]);
});

test("wide layouts keep short formulas on one row", () => {
  assert.deepEqual(formulaLabelRows("F = ma", false), ["F = ma"]);
  assert.deepEqual(formulaLabelRows("v", true), ["v"]);
});
