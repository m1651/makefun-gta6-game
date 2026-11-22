// The screenshot scenes behind ?shot=start|drive|mission|chase. Each one plays the
// real rules forward from a fresh world for a fixed number of seconds, steered by the
// autopilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame.
import { STEP } from './config.js';
import { createAutopilot } from './autopilot.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const DRIVE_SECONDS = 18;
const MISSION_SECONDS = 24;
const CHASE_SECONDS = 14;

/** Drive the world forward with the autopilot for `seconds`, then return the screen. */
function playForward(world, seconds) {
  const pilot = createAutopilot(world);
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = pilot.inputFor();
    const events = world.step(STEP, input.move, input.actions);
    if (events & 8) break; // Busted mid-shot: stop staging and show what happened.
  }
  return SCREEN_PLAY;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best
 * cash to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'drive') {
    world.teleport(1200, 640);
    world.putPlayerInCar(1);
    state.player.inCar.angle = 0;
    state.player.inCar.speed = 320;
    world.setWanted(2);
    playForward(world, DRIVE_SECONDS);
    return { screen: SCREEN_PLAY, best: 400 };
  }
  if (name === 'mission') {
    world.startMission(1);
    world.teleport(720, 1100);
    world.putPlayerInCar(3);
    state.player.inCar.angle = Math.PI / 2;
    state.player.inCar.speed = 200;
    state.cash = 900;
    playForward(world, MISSION_SECONDS);
    return { screen: SCREEN_PLAY, best: 900 };
  }
  if (name === 'chase') {
    world.startMission(2);
    world.teleport(1680, 1440);
    world.putPlayerInCar(5);
    state.player.inCar.angle = -Math.PI / 2;
    state.player.inCar.speed = 480;
    state.cash = 2100;
    playForward(world, CHASE_SECONDS);
    return { screen: SCREEN_PLAY, best: 2100 };
  }
  // Default: the title over the marina, with the city idling behind it.
  for (let i = 0; i < Math.floor(START_SECONDS / STEP); i += 1) {
    world.step(STEP, { x: 0, y: 0, run: false, handbrake: false }, 0);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
