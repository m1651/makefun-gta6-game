// Solara Bay — the living world. One job: entities and their physics/AI.
// Player on foot or in a car, traffic cars, pedestrians, police, wanted level, health.
import { WORLD_W, WORLD_H, GRID, ROAD_W, COLORS } from './config.js';
import { isOnRoad, pointInBuilding, nearestRoadPoint, makeRng } from './city.js';

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export class World {
  constructor(city, sound) {
    this.city = city;
    this.sound = sound;
    this.rng = makeRng(99);
    this.time = 0;
    this.dayTime = 0.55; // 0..1 across the day; starts late afternoon
    this.reset();
  }

  reset() {
    this.player = {
      x: 600, y: 500, angle: 0, speed: 0, health: 100, money: 250,
      onFoot: true, car: null, punchCooldown: 0, hurtFlash: 0, bustedTimer: 0,
    };
    this.wanted = 0;
    this.wantedHeat = 0; // 0..100, stars derive from it
    this.wasted = false;
    this.busted = false;
    this.cars = [];
    this.peds = [];
    this.police = [];
    this.particles = [];
    this.floatingTexts = [];
    this.spawnTraffic();
    this.spawnPeds();
    this.spawnParked();
  }

  spawnParked() {
    for (const p of this.city.parked) {
      this.cars.push({
        kind: 'parked', x: p.x, y: p.y, angle: p.angle, speed: 0,
        color: p.color, w: 44, h: 22, driver: null, stolen: false, hp: 100,
      });
    }
  }

  spawnTraffic() {
    for (let i = 0; i < 14; i++) {
      const gx = (1 + Math.floor(this.rng() * 7)) * GRID;
      const gy = (1 + Math.floor(this.rng() * 5)) * GRID;
      const horizontal = this.rng() < 0.5;
      this.cars.push({
        kind: 'traffic', x: gx + (this.rng() - 0.5) * 200, y: gy + (this.rng() - 0.5) * 200,
        angle: horizontal ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
        speed: 60 + this.rng() * 50, color: COLORS.car[Math.floor(this.rng() * COLORS.car.length)],
        w: 44, h: 22, driver: 'traffic', stolen: false, hp: 100,
        cruise: 60 + this.rng() * 50, lane: (this.rng() < 0.5 ? -1 : 1) * 22,
      });
    }
    // One taxi doing loops, for flavour.
    this.cars.push({
      kind: 'taxi', x: 800, y: 400, angle: 0, speed: 90, color: COLORS.taxi,
      w: 44, h: 22, driver: 'traffic', stolen: false, hp: 100, cruise: 90, lane: 22,
    });
  }

  spawnPeds() {
    for (let i = 0; i < 26; i++) {
      const x = 150 + this.rng() * (WORLD_W - 300);
      const y = 150 + this.rng() * (WORLD_H - 300);
      this.peds.push({
        x, y, angle: this.rng() * TAU, speed: 25 + this.rng() * 25,
        color: ['#e8b4b8', '#b4c9e8', '#c9e8b4', '#e8d9b4', '#d9b4e8'][Math.floor(this.rng() * 5)],
        state: 'walk', fleeX: 0, fleeY: 0, changeIn: 1 + this.rng() * 3, debtor: false, cash: 0,
      });
    }
  }

  // --- wanted level -------------------------------------------------------
  addHeat(amount, reason) {
    this.wantedHeat = clamp(this.wantedHeat + amount, 0, 100);
    const stars = this.wantedHeat <= 0 ? 0 : this.wantedHeat < 20 ? 1 : this.wantedHeat < 40 ? 2 : this.wantedHeat < 65 ? 3 : this.wantedHeat < 85 ? 4 : 5;
    if (stars > this.wanted) this.sound.setSiren(true);
    this.wanted = stars;
    if (reason) this.addText(this.player.x, this.player.y - 30, reason, '#ff5a4a');
  }
  clearWanted() { this.wantedHeat = 0; this.wanted = 0; this.sound.setSiren(false); this.police = []; }

  addText(x, y, text, color = '#ffffff') {
    this.floatingTexts.push({ x, y, text, color, life: 1.6 });
  }
  addParticles(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ x, y, vx: (this.rng() - 0.5) * 220, vy: (this.rng() - 0.5) * 220, life: 0.5 + this.rng() * 0.4, color });
    }
  }

  nearestCar(maxDist) {
    let best = null, bestD = maxDist;
    for (const c of this.cars) {
      if (c.kind === 'police') continue;
      if (c.hp <= 0) continue; // a wrecked car is not drivable — don't get back into it
      const d = dist(this.player.x, this.player.y, c.x, c.y);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  // --- main update --------------------------------------------------------
  update(dt, input, mission) {
    this.time += dt;
    this.dayTime = (this.dayTime + dt / 240) % 1; // a full day in 4 minutes
    const p = this.player;
    if (p.punchCooldown > 0) p.punchCooldown -= dt;
    if (p.hurtFlash > 0) p.hurtFlash -= dt;

    if (this.wasted || this.busted) {
      this.updatePeds(dt);
      this.updateTraffic(dt);
      this.updateParticles(dt);
      return;
    }

    if (p.onFoot) this.updateOnFoot(dt, input, mission);
    else this.updateDriving(dt, input, mission);

    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updatePolice(dt, input);
    this.updateParticles(dt);

    // Wanted decays when no police can see the player.
    if (this.wanted > 0) {
      const seen = this.police.some((c) => dist(c.x, c.y, p.x, p.y) < 500);
      if (!seen) this.wantedHeat = Math.max(0, this.wantedHeat - dt * 2.2);
      const stars = this.wantedHeat <= 0 ? 0 : this.wantedHeat < 20 ? 1 : this.wantedHeat < 40 ? 2 : this.wantedHeat < 65 ? 3 : this.wantedHeat < 85 ? 4 : 5;
      if (stars < this.wanted && stars === 0) this.clearWanted();
      else this.wanted = stars;
    }

    // Health regen slowly when not wanted.
    if (this.wanted === 0 && p.health < 100) p.health = Math.min(100, p.health + dt * 2);
    this.sound.setEngine(p.onFoot ? 0 : Math.abs(p.speed) / 520, !p.onFoot);
  }

  updateOnFoot(dt, input, mission) {
    const p = this.player;
    const mv = input.moveVector();
    const speed = 185;
    const nx = p.x + mv.x * speed * dt;
    const ny = p.y + mv.y * speed * dt;
    if (!pointInBuilding(this.city, nx, p.y, 12)) p.x = nx;
    if (!pointInBuilding(this.city, p.x, ny, 12)) p.y = ny;
    p.x = clamp(p.x, 20, WORLD_W - 20);
    p.y = clamp(p.y, 20, WORLD_H - 20);
    if (mv.active) p.angle = Math.atan2(mv.y, mv.x);

    if (input.hit('e')) {
      const car = this.nearestCar(70);
      if (car) {
        p.onFoot = false; p.car = car;
        car.driver = 'player'; car.kind = 'player';
        if (car.kind === 'parked' || !car.stolen) { /* first steal of this car */ }
        if (!car.stolen) { car.stolen = true; this.addHeat(12, 'CAR STOLEN!'); }
        this.sound.carDoor();
        if (mission) mission.onEvent('enter-car', this);
      } else if (mission) {
        mission.onEvent('interact', this);
      }
    }
    if (input.hit('f') && p.punchCooldown <= 0) {
      p.punchCooldown = 0.45;
      this.sound.punch();
      const reach = 46;
      const tx = p.x + Math.cos(p.angle) * reach;
      const ty = p.y + Math.sin(p.angle) * reach;
      for (const ped of this.peds) {
        if (dist(tx, ty, ped.x, ped.y) < 34) {
          ped.state = 'flee'; ped.fleeX = ped.x - p.x; ped.fleeY = ped.y - p.y;
          this.addHeat(10, 'ASSAULT!');
          if (mission) mission.onEvent('punch-debtor', this, ped);
          this.addParticles(ped.x, ped.y, '#ffd94a', 8);
          break;
        }
      }
      for (const cop of this.police) {
        if (dist(tx, ty, cop.x, cop.y) < 40) {
          this.addHeat(15, 'ATTACKED A COP!');
          cop.stun = 0.8;
          break;
        }
      }
    }
    // Busted check: a cop standing on the player for a moment.
    for (const cop of this.police) {
      if (dist(cop.x, cop.y, p.x, p.y) < 30) {
        p.bustedTimer += dt;
        if (p.bustedTimer > 1.2) { this.getBusted(); return; }
      }
    }
    p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
  }

  updateDriving(dt, input, mission) {
    const p = this.player;
    const car = p.car;
    if (!car) { p.onFoot = true; return; }
    const mv = input.moveVector();
    const forward = mv.y < 0 ? 1 : mv.y > 0 ? -0.6 : 0;
    const steering = mv.x;
    const maxSpeed = 520;
    car.speed += forward * 420 * dt;
    if (forward === 0) car.speed *= Math.max(0, 1 - dt * 1.2); // drag
    if (input.down(' ')) car.speed *= Math.max(0, 1 - dt * 3); // handbrake
    car.speed = clamp(car.speed, -180, maxSpeed);
    // Steering works best with speed, but a parked car can still ease into a turn.
    const turnGrip = 0.25 + 0.75 * (Math.abs(car.speed) / maxSpeed);
    car.angle += steering * turnGrip * 2.2 * dt * (car.speed >= 0 ? 1 : -1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = pointInBuilding(this.city, nx, ny, 16);
    if (hit) {
      if (Math.abs(car.speed) > 200) {
        this.sound.crash();
        this.addParticles(nx, ny, '#ffb14a', 14);
        car.hp -= Math.abs(car.speed) * 0.04;
        p.health -= Math.abs(car.speed) * 0.01;
        p.hurtFlash = 0.4;
        this.addHeat(1, '');
        if (car.hp <= 0) { this.carWrecked(); return; }
      }
      car.speed *= -0.25;
    } else {
      car.x = clamp(nx, 20, WORLD_W - 20);
      car.y = clamp(ny, 20, WORLD_H - 20);
    }
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;

    // Running over pedestrians is a crime.
    for (const ped of this.peds) {
      if (ped.state !== 'down' && dist(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(car.speed) > 60) {
        ped.state = 'down';
        this.addHeat(18, 'PEDESTRIAN HIT!');
        this.sound.crash();
        this.addParticles(ped.x, ped.y, '#ff5a4a', 12);
      }
    }
    // Speeding past a cop car adds heat — but at most once a second, not per frame.
    this.speedingHeatIn = (this.speedingHeatIn || 0) - dt;
    for (const cop of this.police) {
      if (cop.kind === 'police-car' && Math.abs(car.speed) > 380 && dist(car.x, car.y, cop.x, cop.y) < 260 && this.speedingHeatIn <= 0) {
        this.addHeat(3, '');
        this.speedingHeatIn = 1;
        break;
      }
    }
    if (input.hit('e')) {
      p.onFoot = true; p.car = null;
      car.driver = null; car.kind = car.stolen ? 'player' : 'parked';
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      p.speed = 0;
      this.sound.carDoor();
      if (mission) mission.onEvent('exit-car', this);
    }
    if (p.health <= 0) this.getWasted();
  }

  carWrecked() {
    const p = this.player;
    this.addParticles(p.x, p.y, '#ff8a3d', 24);
    this.sound.crash();
    p.onFoot = true; p.car = null;
    p.x += 50; p.y += 50;
  }

  getBusted() {
    const p = this.player;
    this.busted = true;
    const fine = Math.floor(p.money * 0.2);
    p.money -= fine;
    this.sound.busted();
    this.addText(p.x, p.y - 40, `BUSTED! Fine $${fine}`, '#ff5a4a');
  }

  getWasted() {
    const p = this.player;
    this.wasted = true;
    const lost = Math.floor(p.money * 0.1);
    p.money -= lost;
    this.addText(p.x, p.y - 40, `WASTED! Lost $${lost}`, '#ff5a4a');
  }

  respawn() {
    const p = this.player;
    p.x = 1600; p.y = 1200; p.health = 100; p.onFoot = true; p.car = null; p.speed = 0;
    this.wasted = false; this.busted = false;
    this.clearWanted();
  }

  updateTraffic(dt) {
    for (const c of this.cars) {
      if (c.driver !== 'traffic') continue;
      // Follow the road grid: steer toward the nearest road, then along it.
      const rp = nearestRoadPoint(c.x, c.y);
      const onRoad = isOnRoad(c.x, c.y);
      let targetAngle = c.angle;
      if (!onRoad) {
        targetAngle = Math.atan2(rp.y - c.y, rp.x - c.x);
      } else {
        // Keep going straight along the road; at an intersection, sometimes turn.
        const atX = Math.abs(((c.x % GRID) + GRID) % GRID) < 60;
        const atY = Math.abs(((c.y % GRID) + GRID) % GRID) < 60;
        if ((atX || atY) && this.rng() < dt * 0.25) {
          const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
          targetAngle = dirs[Math.floor(this.rng() * dirs.length)];
        }
        // Stay in lane: nudge toward the road centre line.
        const rx = ((c.x % GRID) + GRID) % GRID;
        const ry = ((c.y % GRID) + GRID) % GRID;
        const horizontal = Math.abs(Math.sin(c.angle)) < 0.5;
        if (horizontal) {
          const laneY = Math.round(c.y / GRID) * GRID + (c.lane || 22);
          targetAngle = Math.atan2(laneY - c.y, Math.cos(c.angle) * 100);
        } else {
          const laneX = Math.round(c.x / GRID) * GRID + (c.lane || 22);
          targetAngle = Math.atan2(Math.sin(c.angle) * 100, laneX - c.x);
        }
      }
      c.angle = angleLerp(c.angle, targetAngle, clamp(dt * 2.5, 0, 1));
      // Slow down for the car ahead.
      let slow = false;
      for (const o of this.cars) {
        if (o === c) continue;
        const ahead = Math.cos(c.angle) * (o.x - c.x) + Math.sin(c.angle) * (o.y - c.y);
        const side = Math.abs(-Math.sin(c.angle) * (o.x - c.x) + Math.cos(c.angle) * (o.y - c.y));
        if (ahead > 0 && ahead < 70 && side < 30) { slow = true; break; }
      }
      const targetSpeed = slow ? 0 : c.cruise;
      c.speed += (targetSpeed - c.speed) * clamp(dt * 1.5, 0, 1);
      const nx = c.x + Math.cos(c.angle) * c.speed * dt;
      const ny = c.y + Math.sin(c.angle) * c.speed * dt;
      if (!pointInBuilding(this.city, nx, ny, 16)) {
        c.x = clamp(nx, 20, WORLD_W - 20);
        c.y = clamp(ny, 20, WORLD_H - 20);
      } else {
        c.angle += Math.PI / 2;
      }
    }
  }

  updatePeds(dt) {
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      ped.changeIn -= dt;
      if (ped.state === 'flee') {
        const len = Math.hypot(ped.fleeX, ped.fleeY) || 1;
        ped.x += (ped.fleeX / len) * 160 * dt;
        ped.y += (ped.fleeY / len) * 160 * dt;
        ped.angle = Math.atan2(ped.fleeY, ped.fleeX);
        if (ped.changeIn <= 0) { ped.state = 'walk'; ped.changeIn = 2 + this.rng() * 3; }
      } else {
        if (ped.changeIn <= 0) {
          ped.angle = this.rng() * TAU;
          ped.changeIn = 2 + this.rng() * 4;
        }
        const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
        const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
        if (!pointInBuilding(this.city, nx, ny, 10) && nx > 20 && nx < WORLD_W - 20 && ny > 20 && ny < WORLD_H - 20) {
          ped.x = nx; ped.y = ny;
        } else {
          ped.angle += Math.PI / 2;
        }
      }
      // A debtor who was collected walks away calmly afterwards.
      if (ped.debtor && ped.collected) ped.state = 'walk';
    }
  }

  updatePolice(dt) {
    const p = this.player;
    const want = this.wanted;
    const targetCops = want === 0 ? 0 : want === 1 ? 1 : want === 2 ? 2 : want === 3 ? 3 : want === 4 ? 4 : 5;
    // Spawn police cars at road points away from the player.
    while (this.police.filter((c) => c.kind === 'police-car').length < Math.ceil(targetCops / 2)) {
      const a = this.rng() * TAU;
      const x = clamp(p.x + Math.cos(a) * 700, 100, WORLD_W - 100);
      const y = clamp(p.y + Math.sin(a) * 700, 100, WORLD_H - 100);
      const rp = nearestRoadPoint(x, y);
      this.police.push({ kind: 'police-car', x: rp.x, y: rp.y, angle: 0, speed: 0, color: COLORS.police, w: 44, h: 22, hp: 120, stun: 0 });
    }
    while (this.police.filter((c) => c.kind === 'police-foot').length < Math.floor(targetCops / 2) && !p.onFoot) {
      // Foot cops only matter when the player is on foot; spawn a couple anyway near roads.
      break;
    }
    // Foot cops spawn when the player is on foot and wanted.
    if (p.onFoot && want > 0) {
      while (this.police.filter((c) => c.kind === 'police-foot').length < Math.min(want, 3)) {
        const a = this.rng() * TAU;
        this.police.push({
          kind: 'police-foot', x: clamp(p.x + Math.cos(a) * 500, 40, WORLD_W - 40),
          y: clamp(p.y + Math.sin(a) * 500, 40, WORLD_H - 40),
          angle: 0, speed: 0, color: COLORS.police, w: 16, h: 16, hp: 60, stun: 0,
        });
      }
    }
    for (const cop of this.police) {
      if (cop.stun > 0) { cop.stun -= dt; continue; }
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (cop.kind === 'police-car') {
        const targetAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
        cop.angle = angleLerp(cop.angle, targetAngle, clamp(dt * 2.2, 0, 1));
        const targetSpeed = d > 60 ? 420 + want * 25 : 60;
        cop.speed += (targetSpeed - cop.speed) * clamp(dt * 1.2, 0, 1);
        const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
        const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
        if (!pointInBuilding(this.city, nx, ny, 16)) { cop.x = nx; cop.y = ny; }
        // Ram the player's car: a nudge, not a wrecking ball.
        if (!p.onFoot && p.car && d < 50) {
          p.car.hp -= 8 * dt;
          p.health -= 2 * dt;
          p.hurtFlash = 0.3;
          if (p.car.hp <= 0) this.carWrecked();
          if (p.health <= 0) this.getWasted();
        }
      } else {
        const targetAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
        cop.angle = targetAngle;
        const sp = 165; // a touch slower than the player's 185 sprint, so escape is possible
        cop.x += Math.cos(cop.angle) * sp * dt;
        cop.y += Math.sin(cop.angle) * sp * dt;
        if (d < 26) {
          p.health -= 10 * dt;
          p.hurtFlash = 0.3;
          if (p.health <= 0) this.getWasted();
        }
      }
    }
    // Remove cops far away when wanted is gone.
    if (want === 0) this.police = this.police.filter((c) => dist(c.x, c.y, p.x, p.y) < 900);
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const t of this.floatingTexts) { t.y -= 22 * dt; t.life -= dt; }
    this.floatingTexts = this.floatingTexts.filter((t) => t.life > 0);
  }
}
