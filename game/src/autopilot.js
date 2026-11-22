// The autopilot, one job: play the game badly but well enough to prove it works and
// to stage screenshots. It reads the current mission step, walks or drives toward its
// target, steals the nearest car when one would help, and runs from the police when
// the job is to lose them. It never touches the mouse or the menus.
import { ACTION_ENTER } from './input.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pilotAngleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createAutopilot(world) {
  const state = world.state;
  // Stuck recovery: if the car barely moves while trying to drive, back up briefly.
  let stuckTimer = 0;
  let reverseTimer = 0;
  let lastX = 0;
  let lastY = 0;
  // Flee target for the Hot Pursuit mission: a far corner of the map, picked once
  // and kept until reached, so the driver does not zig-zag between police cars.
  let fleeTarget = null;

  function nearestCar() {
    let best = null;
    let bestDist = Infinity;
    for (const car of state.cars) {
      const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
      if (d < bestDist) { bestDist = d; best = car; }
    }
    return { car: best, dist: bestDist };
  }

  function targetForStep() {
    const step = world.currentStep();
    if (!step) return null;
    if (step.kind === 'reach') return { x: step.x, y: step.y, needCar: true };
    if (step.kind === 'enter-car') {
      const near = nearestCar();
      if (!near.car) return null;
      return { x: near.car.x, y: near.car.y, needCar: false, enter: true };
    }
    if (step.kind === 'collect') {
      const crate = state.crates.find((c) => !c.taken);
      if (!crate) return null;
      return { x: crate.x, y: crate.y, needCar: false };
    }
    if (step.kind === 'survive') {
      // Drive to a far corner and keep moving: the heat only dies while no police
      // car can see the player, so distance and steady speed are the whole job.
      const corners = [
        { x: 2640, y: 240 }, { x: 2640, y: 2160 }, { x: 240, y: 240 }, { x: 240, y: 2160 },
      ];
      const reached = fleeTarget && Math.hypot(fleeTarget.x - state.player.x, fleeTarget.y - state.player.y) < 150;
      if (!fleeTarget || reached) {
        let bestCorner = corners[0];
        let bestScore = -Infinity;
        for (const corner of corners) {
          const d = Math.hypot(corner.x - state.player.x, corner.y - state.player.y);
          if (d > bestScore) { bestScore = d; bestCorner = corner; }
        }
        fleeTarget = bestCorner;
      }
      return { x: fleeTarget.x, y: fleeTarget.y, needCar: true };
    }
    return null;
  }

  /** The input for this frame: a move vector and an actions bitmask. */
  function inputFor() {
    const target = targetForStep();
    const noMove = { x: 0, y: 0, run: false, handbrake: false };
    if (!target) return { move: noMove, actions: 0 };
    const player = state.player;
    const dist = Math.hypot(target.x - player.x, target.y - player.y);
    const car = player.inCar;

    if (!car) {
      if (target.enter) {
        if (dist < 60) return { move: noMove, actions: ACTION_ENTER };
        const angle = Math.atan2(target.y - player.y, target.x - player.x);
        return { move: { x: Math.cos(angle), y: Math.sin(angle), run: true, handbrake: false }, actions: 0 };
      }
      if (target.needCar && dist > 220) {
        const near = nearestCar();
        if (near.car && near.dist < 160) {
          if (near.dist < 60) return { move: noMove, actions: ACTION_ENTER };
          const angle = Math.atan2(near.car.y - player.y, near.car.x - player.x);
          return { move: { x: Math.cos(angle), y: Math.sin(angle), run: true, handbrake: false }, actions: 0 };
        }
      }
      if (dist < 30) return { move: noMove, actions: 0 };
      // Walk the road grid too: straight lines end at building walls.
      const waypoint = world.city.routeWaypoint(player.x, player.y, target.x, target.y);
      const angle = Math.atan2(waypoint.y - player.y, waypoint.x - player.x);
      return { move: { x: Math.cos(angle), y: Math.sin(angle), run: true, handbrake: false }, actions: 0 };
    }

    // Driving: follow the road grid toward the target, slow down for sharp turns.
    const waypoint = world.city.routeWaypoint(car.x, car.y, target.x, target.y);
    const desired = Math.atan2(waypoint.y - car.y, waypoint.x - car.x);
    const diff = pilotAngleDiff(desired, car.angle);
    const steer = clamp(diff * 2.4, -1, 1);
    let throttle = 0;
    if (Math.abs(diff) < 0.6) throttle = 1;
    else if (Math.abs(diff) < 1.6) throttle = 0.4;
    else throttle = -0.6;
    // Ease off near the target so the car stops on it instead of orbiting.
    const waypointDist = Math.hypot(waypoint.x - car.x, waypoint.y - car.y);
    if (waypointDist < 90) throttle = Math.min(throttle, 0.25);
    // Stuck against a wall: reverse out, then try again.
    const moved = Math.hypot(car.x - lastX, car.y - lastY);
    lastX = car.x;
    lastY = car.y;
    if (reverseTimer > 0) {
      reverseTimer -= 1 / 60;
      return { move: { x: -steer, y: 1, run: false, handbrake: false }, actions: 0 };
    }
    if (Math.abs(car.speed) < 30 && throttle > 0) {
      stuckTimer += 1 / 60;
      if (stuckTimer > 1.5) {
        stuckTimer = 0;
        reverseTimer = 1.0;
        return { move: { x: -steer, y: 1, run: false, handbrake: false }, actions: 0 };
      }
    } else if (moved > 5) {
      stuckTimer = 0;
    }
    return {
      move: { x: steer, y: throttle > 0 ? -1 : throttle < 0 ? 1 : 0, run: false, handbrake: dist < 50 },
      actions: 0,
    };
  }

  return { inputFor };
}
