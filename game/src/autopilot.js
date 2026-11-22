// Solara Bay — autopilot. One job: play the game by itself for headless verification.
// Navigates the road grid with waypoints (roads run at multiples of 400), enters cars,
// presses E at objectives, and uses the Fixer to clear wanted stars.
// Enabled with ?autopilot=1. Never used by human players.
import { GRID } from './config.js';
import { nearestRoadPoint } from './city.js';

function angleDiff(a, b) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return d;
}
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export class Autopilot {
  constructor(game) {
    this.game = game;
    this.stuckTimer = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.waypoints = [];
    this.wpTarget = null;
    this.replanIn = 0;
  }

  // Road waypoints from (sx, sy) to (tx, ty): get onto a road, travel the grid
  // Manhattan-style to the target's road, then drive to the target itself.
  planRoute(sx, sy, tx, ty) {
    const roadX = Math.round(tx / GRID) * GRID;
    const roadY = Math.round(ty / GRID) * GRID;
    const start = nearestRoadPoint(sx, sy);
    const wps = [start];
    // Corner: the intersection of the target's road-x and the start's road-y.
    const corner = { x: roadX, y: Math.round(sy / GRID) * GRID };
    if (dist(start.x, start.y, corner.x, corner.y) > 80) wps.push(corner);
    const corner2 = { x: roadX, y: roadY };
    if (dist(corner.x, corner.y, corner2.x, corner2.y) > 80) wps.push(corner2);
    wps.push({ x: tx, y: ty });
    return wps;
  }

  // Returns a synthetic input object shaped like the real Input class.
  drive(input) {
    const game = this.game;
    const world = game.world;
    const p = world.player;
    const m = game.missions;
    const keys = new Set();
    const pressed = new Set();
    this.replanIn -= 1 / 60;

    // Decide the current target.
    let target = m.marker ? { x: m.marker.x, y: m.marker.y } : null;
    const needsCar = m.current && ['wheels', 'delivery', 'score'].includes(m.current.id);
    const escaping = (m.current && m.current.id === 'heat') || (m.current && m.current.id === 'score' && m.phase === 'escape');
    // To lose the cops, pay the Fixer first (he clears wanted for $200).
    if (escaping && world.wanted > 0 && p.money >= 200) {
      target = { x: 2000, y: 2000 }; // the Fixer
    }
    // On foot with driving to do: steal the nearest car first.
    if (p.onFoot && needsCar) {
      const car = world.nearestCar(400);
      if (car) target = { x: car.x, y: car.y };
    }
    // Bank holdout: don't stand still getting beaten — circle the bank,
    // in a car if one is close, to survive the 20 seconds.
    if (m.current && m.current.id === 'score' && m.phase === 'holdout') {
      // Step the circle point every 2s so the route planner isn't reset each frame.
      const a = Math.floor(world.time / 2) * 0.5;
      target = { x: 2000 + Math.cos(a) * 350, y: 1200 + Math.sin(a) * 350 };
      if (p.onFoot) {
        const car = world.nearestCar(120);
        if (car) target = { x: car.x, y: car.y };
      }
    }
    if (m.current && m.current.id === 'debt' && p.onFoot && m.marker) target = { x: m.marker.x, y: m.marker.y };
    if (!target) target = { x: 1600, y: 1200 };

    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const targetDist = Math.hypot(dx, dy);

    if (p.onFoot) {
      if (targetDist < 55) {
        pressed.add('e'); // enter car / collect / grab cash
        if (m.current && m.current.id === 'debt') pressed.add('f');
      } else {
        const ang = Math.atan2(dy, dx);
        if (Math.cos(ang) > 0.4) keys.add('d');
        if (Math.cos(ang) < -0.4) keys.add('a');
        if (Math.sin(ang) > 0.4) keys.add('s');
        if (Math.sin(ang) < -0.4) keys.add('w');
      }
      const car = world.nearestCar(80);
      if (car && needsCar) pressed.add('e');
    } else {
      // Driving: follow the planned road route, one cardinal leg at a time.
      // Roads are axis-aligned, so snap the desired heading to the nearest
      // cardinal direction — diagonal shortcuts cut through buildings.
      // Steering is proportional (not bang-bang) so the car tracks the road
      // instead of fishtailing: moveVector carries the fractional steer.
      const car = p.car;
      const key = `${target.x},${target.y}`;
      if (key !== this.wpTarget || this.replanIn <= 0 || !this.waypoints.length) {
        this.waypoints = this.planRoute(car.x, car.y, target.x, target.y);
        this.wpTarget = key;
        this.replanIn = 3;
      }
      let goal = this.waypoints[0];
      while (this.waypoints.length > 1 && dist(car.x, car.y, goal.x, goal.y) < 70) {
        this.waypoints.shift();
        goal = this.waypoints[0];
      }
      this._steer = 0;
      this._throttle = 0;
      if (this.waypoints.length === 1 && dist(car.x, car.y, goal.x, goal.y) < 70) {
        if (Math.abs(car.speed) < 40) pressed.add('e'); // arrived: get out
        else { this._throttle = 1; keys.add('s'); }
      } else {
        const wantAngle = Math.atan2(goal.y - car.y, goal.x - car.x);
        const snapped = Math.round(wantAngle / (Math.PI / 2)) * (Math.PI / 2);
        const diff = angleDiff(car.angle, snapped);
        // Proportional steering: full lock only for big errors, gentle near the line.
        this._steer = Math.max(-1, Math.min(1, diff * 2.2));
        if (Math.abs(diff) > 0.35) {
          // Sharp turn: lift off the gas so the car can actually make it.
          // (Braking means throttle 0 — reversing here just spins the car around.)
          this._throttle = Math.abs(car.speed) > 120 ? 0 : -1;
          if (Math.abs(car.speed) > 120) keys.add('s');
          else keys.add('w');
        } else {
          this._throttle = -1; // forward
          keys.add('w');
        }
        if (Math.abs(car.speed) > 430) { this._throttle = 0; keys.delete('w'); }
        if (this._steer > 0.1) keys.add('d');
        if (this._steer < -0.1) keys.add('a');
        // Blocked: pressing the gas but barely moving — reverse out and replan.
        this.blockedTimer = (keys.has('w') && Math.abs(car.speed) < 30) ? (this.blockedTimer || 0) + 1 / 60 : 0;
        if (this.blockedTimer > 1.5) {
          keys.clear();
          keys.add('s'); keys.add('a');
          this._throttle = 1; this._steer = -0.6;
          if (this.blockedTimer > 2.5) { this.blockedTimer = 0; this.waypoints = []; this.stuckTimer = 0; }
        }
      }
    }

    // Stuck detection: if barely moved in 3s, reverse out.
    if (Math.hypot(p.x - this.lastX, p.y - this.lastY) < 4) this.stuckTimer += 1 / 60;
    else this.stuckTimer = 0;
    this.lastX = p.x; this.lastY = p.y;
    if (this.stuckTimer > 3) {
      keys.clear();
      keys.add('s');
      if (!p.onFoot) { keys.add('a'); this._steer = -0.6; this._throttle = 1; }
      if (this.stuckTimer > 5) { this.stuckTimer = 0; this.waypoints = []; }
    }

    return {
      keys, pressed,
      down: (...names) => names.some((n) => keys.has(n)),
      hit: (...names) => names.some((n) => pressed.has(n)),
      moveVector: () => {
        if (!p.onFoot && (this._steer !== undefined)) {
          // Driving: fractional steer and throttle, not the on-foot direction pad.
          return { x: this._steer, y: this._throttle, active: this._steer !== 0 || this._throttle !== 0 };
        }
        let x = 0, y = 0;
        if (keys.has('a')) x -= 1;
        if (keys.has('d')) x += 1;
        if (keys.has('w')) y -= 1;
        if (keys.has('s')) y += 1;
        const len = Math.hypot(x, y) || 1;
        return { x: x / len, y: y / len, active: x !== 0 || y !== 0 };
      },
      endFrame: () => {},
    };
  }
}
