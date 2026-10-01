export function swipeAction(dx, dy, threshold = 20, tapAction = "jump") {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const distance = Math.max(absX, absY);
  if (tapAction === null ? distance <= threshold : distance < threshold) return tapAction;
  if (absX > absY) return dx > 0 ? "right" : "left";
  return dy < 0 ? "jump" : "roll";
}

export function keyboardAction(key, mode) {
  if (mode === "menu" || mode === "gameover") {
    return key === "Enter" || key === " " ? "start" : null;
  }
  if (["ArrowLeft", "a", "A"].includes(key)) return "left";
  if (["ArrowRight", "d", "D"].includes(key)) return "right";
  if (["ArrowUp", "w", "W", " "].includes(key)) return "jump";
  if (["ArrowDown", "s", "S"].includes(key)) return "roll";
  if (["Escape", "p", "P"].includes(key)) return "pause";
  return null;
}

export function bindControls({ state, renderer, moveLane, jump, roll, togglePause, startGame }) {
  let touchStart = null;
  let mouseStart = null;

  function perform(action) {
    if (action === "left") moveLane(-1);
    else if (action === "right") moveLane(1);
    else if (action === "jump") jump();
    else if (action === "roll") roll();
    else if (action === "pause") togglePause();
    else if (action === "start") startGame();
  }

  function swipeTargetOk(target) {
    return !(target instanceof Element) || !target.closest(".btn, .pause-btn, .panel, .overlay");
  }

  function onKeyDown(event) {
    const action = keyboardAction(event.key, state.mode);
    if (!action) return;
    perform(action);
    event.preventDefault();
  }

  function onTouchStart(event) {
    if (state.mode !== "playing" || !swipeTargetOk(event.target)) {
      touchStart = null;
      return;
    }
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchMove(event) {
    if (state.mode === "playing" && touchStart && swipeTargetOk(event.target)) event.preventDefault();
  }

  function onTouchEnd(event) {
    if (!touchStart || state.mode !== "playing") {
      touchStart = null;
      return;
    }
    const touch = event.changedTouches[0];
    perform(swipeAction(touch.clientX - touchStart.x, touch.clientY - touchStart.y));
    touchStart = null;
  }

  function onTouchCancel() {
    touchStart = null;
  }

  function onMouseDown(event) {
    if (state.mode === "playing") mouseStart = { x: event.clientX, y: event.clientY };
  }

  function onMouseUp(event) {
    if (!mouseStart || state.mode !== "playing") {
      mouseStart = null;
      return;
    }
    const action = swipeAction(event.clientX - mouseStart.x, event.clientY - mouseStart.y, 24, null);
    if (action) perform(action);
    mouseStart = null;
  }

  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchmove", onTouchMove, { passive: false });
  document.addEventListener("touchend", onTouchEnd, { passive: true });
  document.addEventListener("touchcancel", onTouchCancel, { passive: true });
  renderer.domElement.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("touchcancel", onTouchCancel);
    renderer.domElement.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
  };
}
