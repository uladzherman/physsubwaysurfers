import test from "node:test";
import assert from "node:assert/strict";
import { keyboardAction, swipeAction } from "../assets/js/input/controls.js";

test("swipe direction maps to the expected runner action", () => {
  assert.equal(swipeAction(-80, 4), "left");
  assert.equal(swipeAction(80, 4), "right");
  assert.equal(swipeAction(4, -80), "jump");
  assert.equal(swipeAction(4, 80), "roll");
});

test("short touch taps jump while short mouse drags are ignored", () => {
  assert.equal(swipeAction(8, -4), "jump");
  assert.equal(swipeAction(8, -4, 24, null), null);
  assert.equal(swipeAction(24, 0, 24, null), null);
  assert.equal(swipeAction(25, 0, 24, null), "right");
});

test("keyboard actions depend on the game screen", () => {
  assert.equal(keyboardAction("Enter", "menu"), "start");
  assert.equal(keyboardAction(" ", "gameover"), "start");
  assert.equal(keyboardAction("ArrowLeft", "playing"), "left");
  assert.equal(keyboardAction("w", "playing"), "jump");
  assert.equal(keyboardAction("ArrowDown", "playing"), "roll");
  assert.equal(keyboardAction("p", "paused"), "pause");
  assert.equal(keyboardAction("ArrowLeft", "menu"), null);
});
