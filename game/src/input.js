// Keyboard and mouse input, one job: turn raw events into a clean per-frame state.
// Movement keys give a unit direction vector; action keys are edge-triggered so a
// held key does not repeat an action every frame.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_HORN = 16;
export const ACTION_MUTE = 32;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  p: ACTION_PAUSE,
  P: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  e: ACTION_ENTER,
  E: ACTION_ENTER,
  f: ACTION_PUNCH,
  F: ACTION_PUNCH,
  h: ACTION_HORN,
  H: ACTION_HORN,
  m: ACTION_MUTE,
  M: ACTION_MUTE,
};

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let mouseDown = false;

  function onKeyDown(event) {
    const key = event.key;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) event.preventDefault();
    if (!event.repeat) {
      const action = KEY_ACTIONS[key];
      if (action) queued |= action;
    }
    held.add(key.length === 1 ? key.toLowerCase() : key);
  }

  function onKeyUp(event) {
    held.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  }

  function onMouseDown() {
    mouseDown = true;
    queued |= ACTION_CONFIRM;
  }

  function onMouseUp() {
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  function down(...keys) {
    return keys.some((key) => held.has(key));
  }

  return {
    /** Unit movement vector from WASD / arrows, plus whether the run key is held. */
    move() {
      let x = 0;
      let y = 0;
      if (down('a', 'ArrowLeft')) x -= 1;
      if (down('d', 'ArrowRight')) x += 1;
      if (down('w', 'ArrowUp')) y -= 1;
      if (down('s', 'ArrowDown')) y += 1;
      const length = Math.hypot(x, y);
      if (length > 0) {
        x /= length;
        y /= length;
      }
      return { x, y, run: down('Shift'), handbrake: down(' ') };
    },
    /** Edge-triggered actions since the last call; also true while the mouse is held. */
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
    get mouseDown() {
      return mouseDown;
    },
  };
}
