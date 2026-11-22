// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, game over and win.
//
// ?shot=start|drive|mission|chase (with &seed=N) stages that scene instead of running
// the loop, paints it twice and sets window.__shotReady for a screenshot.
// ?autopilot=1 plays the whole story with the autopilot and reports the result in
// window.__testDone, so a headless run can prove the missions are completable.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION, EVENT_OVER } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { createAutopilot } from './autopilot.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const autopilotMode = params.get('autopilot') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best cash then lasts this visit only.
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.state.cash,
      missionIndex: world.state.missionIndex,
      best: readBest(),
    }));
  } catch {
    // Storage can be off; the game still plays.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, world.city, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runAutopilotTest() {
  const pilot = createAutopilot(world);
  const result = {
    missionsCompleted: 0,
    cash: 0,
    storyDone: false,
    busted: false,
    steps: 0,
    errors: [],
    trace: [],
  };
  window.addEventListener('error', (event) => result.errors.push(String(event.message)));
  const maxSteps = Math.floor(900 / STEP);
  let lastMission = 0;
  for (let i = 0; i < maxSteps; i += 1) {
    const input = pilot.inputFor();
    const events = world.step(STEP, input.move, input.actions);
    result.steps = i + 1;
    if (i % 600 === 0) {
      result.trace.push({
        t: Math.round(i * STEP),
        m: world.state.missionIndex,
        s: world.state.missionStep,
        cash: world.state.cash,
        x: Math.round(world.state.player.x),
        y: Math.round(world.state.player.y),
        wanted: Math.round(world.state.wanted * 10) / 10,
        inCar: !!world.state.player.inCar,
        speed: Math.round(Math.abs(world.state.player.speed || 0)),
      });
    }
    if (events & EVENT_MISSION) {
      result.missionsCompleted += 1;
      lastMission = world.state.missionIndex;
    }
    if (world.state.storyDone) {
      result.storyDone = true;
      break;
    }
    if (events & EVENT_BUSTED || world.state.busted) {
      result.busted = true;
      break;
    }
    if (events & EVENT_OVER) break;
    if (world.state.missionIndex > lastMission) lastMission = world.state.missionIndex;
  }
  result.cash = world.state.cash;
  result.missionIndex = world.state.missionIndex;
  renderer.draw(world, world.city, SCREEN_PLAY, world.state.cash);
  window.__testDone = result;
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let sirenTimer = 0;
  let pendingActions = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. First job: steal a car for Mara Voss.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
    saveGame();
    audio.engine(0);
    announce(won ? 'Story complete.' : 'Caught. Game over.');
  }

  // Actions are read once per frame here; the menu takes confirm/pause/mute and the
  // rest (enter, punch, horn) is kept for the next world step.
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.engine(0);
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    pendingActions |= actions & ~(ACTION_CONFIRM | ACTION_PAUSE | ACTION_MUTE);
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, run: false, handbrake: false }, 0);
      return;
    }
    const move = input.move();
    const actions = pendingActions;
    pendingActions = 0;
    const events = world.step(STEP, move, actions);
    if (actions & 16) audio.horn();
    if (events & EVENT_MISSION) audio.missionDone();
    if (events & 4) audio.wantedUp();
    if (events & EVENT_BUSTED) {
      audio.busted();
      endGame(false);
      return;
    }
    if (events & EVENT_OVER) {
      endGame(false);
      return;
    }
    if (world.state.storyDone && screen === SCREEN_PLAY) {
      audio.missionDone();
      endGame(true);
    }
    // Engine hum and sirens follow the game state.
    const car = world.state.player.inCar;
    audio.engine(car ? Math.abs(car.speed) / 560 : 0);
    if (world.state.wanted > 0) {
      sirenTimer -= STEP;
      if (sirenTimer <= 0) {
        audio.siren();
        sirenTimer = 2.2;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(input.takeActions());
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, world.city, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.engine(0);
      announce('Paused.');
    }
  });

  announce('Solara Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else if (autopilotMode) runAutopilotTest();
else runGame();
