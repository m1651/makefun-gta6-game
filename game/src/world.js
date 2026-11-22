// The living city, one job: hold every moving thing and advance it one step at a time.
// Player on foot or in a car, traffic cars and pedestrians on the roads, police that
// chase a wanted player, and the five-mission story with Mara Voss. The renderer only
// reads state; this module owns all the rules.
import { AVENUES, CAR, CAR_MODELS, MISSIONS, PED_NAMES, PLAYER, STEP, STREETS, WANTED, WORLD } from './config.js';
import { createCity } from './city.js';

export const EVENT_OVER = 1;
export const EVENT_MISSION = 2;
export const EVENT_CRIME = 4;
export const EVENT_BUSTED = 8;

const TRAFFIC_COUNT = 12;
const PED_COUNT = 16;
const CRATE_SPOTS = [
  { x: 720, y: 640 },
  { x: 1680, y: 1040 },
  { x: 2160, y: 1840 },
  { x: 1200, y: 1840 },
];

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    time: 0,
    cash: 0,
    score: 0,
    wanted: 0,
    wantedSeenTimer: 0,
    health: PLAYER.health,
    carHealth: 100,
    missionIndex: 0,
    missionStep: 0,
    missionTimer: 0,
    missionDone: false,
    storyDone: false,
    busted: false,
    wasted: false,
    message: 'Welcome to Solara Bay.',
    messageTimer: 0,
    camera: { x: 0, y: 0 },
    player: { x: 2640, y: 320, angle: Math.PI / 2, speed: 0, inCar: null, punchTimer: 0 },
    cars: [],
    peds: [],
    police: [],
    crates: [],
    pickups: [],
    effects: [],
  };

  function say(text, seconds) {
    state.message = text;
    state.messageTimer = seconds || 4;
  }

  function spawnTrafficCar() {
    const point = city.randomRoadPoint();
    const model = random.pick(CAR_MODELS);
    const dir = random.next() < 0.5 ? 1 : -1;
    const lane = (random.next() < 0.5 ? -1 : 1) * (WORLD.laneWidth / 2);
    let x = point.x;
    let y = point.y;
    let angle = 0;
    if (point.vertical) {
      x += lane;
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y += lane;
      angle = dir > 0 ? 0 : Math.PI;
    }
    return {
      id: Math.floor(random.next() * 1e9),
      kind: 'traffic',
      model,
      x, y, angle,
      speed: random.range(120, 210) * model.speed,
      cruise: random.range(120, 210) * model.speed,
      vertical: point.vertical,
      dir,
      color: model.color,
      health: 100,
    };
  }

  function spawnPed() {
    const point = city.randomRoadPoint();
    const side = random.next() < 0.5 ? -1 : 1;
    const off = (WORLD.roadWidth / 2 + 16) * side;
    return {
      x: point.vertical ? point.x + off : point.x,
      y: point.vertical ? point.y : point.y + off,
      angle: random.range(0, Math.PI * 2),
      speed: random.range(40, 80),
      vertical: point.vertical,
      dir: random.next() < 0.5 ? 1 : -1,
      name: random.pick(PED_NAMES),
      color: ['#e86a6a', '#6a9fe8', '#e8c96a', '#7ae08a', '#c98ae8', '#e8a06a'][random.int(0, 5)],
      fleeTimer: 0,
    };
  }

  function currentMission() {
    return MISSIONS[state.missionIndex] || null;
  }

  function currentStep() {
    const mission = currentMission();
    if (!mission) return null;
    return mission.steps[state.missionStep] || null;
  }

  function stepText() {
    const step = currentStep();
    if (!step) return 'Free roam — explore Solara Bay.';
    if (step.kind === 'collect') {
      const got = state.crates.filter((c) => c.taken).length;
      return `Collect the tool crates (${got}/${step.count})`;
    }
    return step.text;
  }

  function addWanted(amount, reason) {
    const before = Math.floor(state.wanted);
    state.wanted = Math.min(WANTED.maxStars, state.wanted + amount);
    if (Math.floor(state.wanted) > before) {
      say(`Wanted level up! ${reason}`, 3);
      return EVENT_CRIME;
    }
    return 0;
  }

  function spawnPolice() {
    const cap = WANTED.policeCarCap[Math.floor(state.wanted)] || 0;
    while (state.police.length < cap) {
      const point = city.randomRoadPoint();
      const near = city.nearestRoadPoint(state.player.x, state.player.y);
      // Prefer spawning on the player's road, a few hundred pixels away.
      const px = near ? near.x + random.range(-300, 300) : point.x;
      const py = near ? near.y + random.range(-300, 300) : point.y;
      state.police.push({
        id: Math.floor(random.next() * 1e9),
        kind: 'police',
        model: { name: 'Interceptor', color: '#20242e', speed: 1.1 },
        x: Math.max(60, Math.min(WORLD.width - 60, px)),
        y: Math.max(60, Math.min(WORLD.height - 60, py)),
        angle: angleTo(px, py, state.player.x, state.player.y),
        speed: 0,
        cruise: CAR.policeMaxSpeed,
        color: '#20242e',
        health: 100,
        sirenTimer: random.range(0, 1),
      });
    }
  }

  function startMission(index) {
    const mission = MISSIONS[index];
    if (!mission) {
      state.storyDone = true;
      say('Story complete! Solara Bay is yours. Free roam.', 6);
      return;
    }
    state.missionIndex = index;
    state.missionStep = 0;
    state.missionTimer = mission.timeLimit || 0;
    if (mission.steps[0] && mission.steps[0].kind === 'survive') {
      state.missionTimer = mission.steps[0].duration;
    }
    state.crates = [];
    if (mission.id === 'tool-run') {
      state.crates = CRATE_SPOTS.map((spot) => ({ ...spot, taken: false }));
    }
    if (mission.id === 'hot-pursuit') {
      state.wanted = 3;
      spawnPolice();
    }
    say(`${mission.title} — ${mission.giver}: ${mission.briefing}`, 7);
  }

  function completeStep() {
    const mission = currentMission();
    state.missionStep += 1;
    if (state.missionStep >= mission.steps.length) {
      state.cash += mission.reward;
      state.score += mission.reward;
      state.missionDone = true;
      say(`${mission.title} complete! +$${mission.reward}`, 5);
      const next = state.missionIndex + 1;
      if (next >= MISSIONS.length) {
        state.storyDone = true;
        say('Story complete! Solara Bay is yours. Free roam.', 6);
        state.missionIndex = next;
      } else {
        startMission(next);
      }
      return EVENT_MISSION;
    }
    say(`Next: ${stepText()}`, 4);
    return 0;
  }

  function reset() {
    state.time = 0;
    state.cash = 0;
    state.score = 0;
    state.wanted = 0;
    state.wantedSeenTimer = 0;
    state.health = PLAYER.health;
    state.carHealth = 100;
    state.missionIndex = 0;
    state.missionStep = 0;
    state.missionTimer = 0;
    state.missionDone = false;
    state.storyDone = false;
    state.busted = false;
    state.wasted = false;
    state.player = { x: 2640, y: 320, angle: Math.PI / 2, speed: 0, inCar: null, punchTimer: 0 };
    state.cars = [];
    state.peds = [];
    state.police = [];
    state.crates = [];
    state.pickups = [];
    state.effects = [];
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) state.cars.push(spawnTrafficCar());
    // A few parked cars the player can steal right away.
    const parked = [
      { x: 2688, y: 420, angle: Math.PI / 2, model: CAR_MODELS[1] },
      { x: 2592, y: 700, angle: -Math.PI / 2, model: CAR_MODELS[0] },
      { x: 1248, y: 700, angle: 0, model: CAR_MODELS[3] },
    ];
    for (const spot of parked) {
      state.cars.push({
        id: Math.floor(random.next() * 1e9), kind: 'parked', model: spot.model,
        x: spot.x, y: spot.y, angle: spot.angle, speed: 0, cruise: 0,
        vertical: false, dir: 1, color: spot.model.color, health: 100,
      });
    }
    for (let i = 0; i < PED_COUNT; i += 1) state.peds.push(spawnPed());
    startMission(0);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }

  function driveCar(car, dt, steer, throttle, handbrake) {
    const maxSpeed = car.kind === 'police' ? CAR.policeMaxSpeed : CAR.maxSpeed * car.model.speed;
    if (throttle > 0) car.speed += CAR.accel * dt * throttle;
    else if (throttle < 0) {
      if (car.speed > 10) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= car.speed * 1.4 * dt;
    }
    if (handbrake) car.speed -= car.speed * 4 * dt;
    car.speed = Math.max(-CAR.maxReverse, Math.min(maxSpeed, car.speed));
    const turn = steer * CAR.steerRate * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.25) * (car.speed < 0 ? -1 : 1);
    car.angle += turn;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // A car is long: check the nose, the middle and the tail against buildings, so
    // no corner of it can sit visibly inside a building.
    let crashed = false;
    let px = nx;
    let py = ny;
    for (const along of [24, 0, -24]) {
      const probe = {
        x: px + Math.cos(car.angle) * along,
        y: py + Math.sin(car.angle) * along,
        r: 17,
      };
      const beforeX = probe.x;
      const beforeY = probe.y;
      if (city.resolveBuildingCollision(probe)) {
        px += probe.x - beforeX;
        py += probe.y - beforeY;
        crashed = true;
      }
    }
    car.x = Math.max(30, Math.min(WORLD.width - 30, px));
    car.y = Math.max(30, Math.min(WORLD.height - 30, py));
    if (crashed) {
      if (Math.abs(car.speed) > 240) state.effects.push({ kind: 'crash', x: car.x, y: car.y, timer: 0.4 });
      car.speed *= -0.25;
    }
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      // Slow down for the car ahead on the same road.
      let target = car.cruise;
      for (const other of state.cars) {
        if (other === car || other.kind !== 'traffic' || other.vertical !== car.vertical) continue;
        const along = car.vertical ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
        const across = car.vertical ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
        if (along > 0 && along < 90 && across < 60) target = Math.min(target, 30);
      }
      // Slow down for the player's car crossing ahead.
      const playerCar = state.player.inCar;
      if (playerCar) {
        const along = car.vertical ? (playerCar.y - car.y) * car.dir : (playerCar.x - car.x) * car.dir;
        const across = car.vertical ? Math.abs(playerCar.x - car.x) : Math.abs(playerCar.y - car.y);
        if (along > 0 && along < 110 && across < 70) target = Math.min(target, 40);
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (nx < 40 || nx > WORLD.width - 40 || ny < 40 || ny > WORLD.height - 40) {
        // Wrap to the far end of the same road.
        if (car.vertical) car.y = car.dir > 0 ? 50 : WORLD.height - 50;
        else car.x = car.dir > 0 ? 50 : WORLD.width - 50;
      } else {
        car.x = nx;
        car.y = ny;
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of state.peds) {
      if (ped.fleeTimer > 0) {
        ped.fleeTimer -= dt;
        ped.x += Math.cos(ped.angle) * ped.speed * 2.2 * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * 2.2 * dt;
      } else {
        const stepLen = ped.speed * dt;
        if (ped.vertical) ped.y += ped.dir * stepLen;
        else ped.x += ped.dir * stepLen;
        // Turn around at the city edge, or sometimes switch roads at an intersection.
        if (ped.x < 60 || ped.x > WORLD.width - 60 || ped.y < 60 || ped.y > WORLD.height - 60) {
          ped.dir *= -1;
          ped.angle = ped.vertical ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
        }
        ped.angle = ped.vertical ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
      }
      const probe = { x: ped.x, y: ped.y, r: 10 };
      city.resolveBuildingCollision(probe);
      ped.x = Math.max(20, Math.min(WORLD.width - 20, probe.x));
      ped.y = Math.max(20, Math.min(WORLD.height - 20, probe.y));
      // Flee from a fast car or a punching player nearby.
      const playerCar = state.player.inCar;
      const threatX = playerCar ? playerCar.x : state.player.x;
      const threatY = playerCar ? playerCar.y : state.player.y;
      const threatSpeed = playerCar ? Math.abs(playerCar.speed) : 0;
      if (distance(ped.x, ped.y, threatX, threatY) < 120 && (threatSpeed > 200 || state.player.punchTimer > 0)) {
        ped.fleeTimer = 2;
        ped.angle = angleTo(threatX, threatY, ped.x, ped.y);
      }
    }
  }

  function stepPolice(dt) {
    spawnPolice();
    const playerCar = state.player.inCar;
    const px = state.player.x;
    const py = state.player.y;
    for (let i = state.police.length - 1; i >= 0; i -= 1) {
      const cop = state.police[i];
      cop.sirenTimer -= dt;
      const dist = distance(cop.x, cop.y, px, py);
      // Chase along the roads like any driver; only cut straight at the player
      // when close enough that a building cannot be between them.
      const waypoint = dist < 220 ? { x: px, y: py } : city.routeWaypoint(cop.x, cop.y, px, py);
      const targetAngle = angleTo(cop.x, cop.y, waypoint.x, waypoint.y);
      const diff = angleDiff(targetAngle, cop.angle);
      const steer = Math.max(-1, Math.min(1, diff * 2.2));
      driveCar(cop, dt, steer, 1, false);
      // A police car touching the player on foot busts them; ramming a player's car damages it.
      if (dist < WANTED.bustRadius + 20) {
        if (playerCar) {
          state.carHealth -= 22 * dt;
          if (state.carHealth <= 0) {
            state.player.inCar = null;
            state.carHealth = 100;
            state.player.x = px + 40;
            state.player.y = py;
            say('Your car is wrecked! Run!', 4);
          }
        } else {
          state.wantedSeenTimer += dt;
          if (state.wantedSeenTimer > 1.2) {
            state.busted = true;
            return EVENT_BUSTED;
          }
        }
      }
      // Police that fall far behind give up and despawn when the heat is gone.
      if (state.wanted <= 0 && dist > 900) state.police.splice(i, 1);
    }
    return 0;
  }

  function stepMissions(dt, events) {
    const mission = currentMission();
    if (!mission) return events;
    if (mission.timeLimit) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        state.missionTimer = mission.timeLimit;
        state.missionStep = 0;
        state.crates = [];
        if (mission.id === 'tool-run') state.crates = CRATE_SPOTS.map((spot) => ({ ...spot, taken: false }));
        say('Too slow — the mission reset. Try again.', 4);
        return events;
      }
    }
    const step = currentStep();
    if (!step) return events;
    if (step.kind === 'survive') {
      // Outlast the chase: when the timer runs out the heat burns itself out.
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        state.wanted = 0;
        state.police = [];
        say('You lost them in the storm drains. The heat is off.', 5);
        return events | completeStep();
      }
      return events;
    }
    if (step.kind === 'reach') {
      if (distance(state.player.x, state.player.y, step.x, step.y) < step.radius) {
        return events | completeStep();
      }
    } else if (step.kind === 'enter-car') {
      if (state.player.inCar) return events | completeStep();
    } else if (step.kind === 'collect') {
      for (const crate of state.crates) {
        if (!crate.taken && distance(state.player.x, state.player.y, crate.x, crate.y) < 46) {
          crate.taken = true;
          state.score += 100;
          say(`Crate collected (${state.crates.filter((c) => c.taken).length}/${step.count})`, 2);
        }
      }
      if (state.crates.every((c) => c.taken)) return events | completeStep();
    } else if (step.kind === 'survive-heat') {
      if (state.wanted <= 0) return events | completeStep();
    } else if (step.kind === 'survive') {
      // Handled above, by the timer.
    }
    return events;
  }

  function stepPlayer(dt, move, actions) {
    const player = state.player;
    if (player.punchTimer > 0) player.punchTimer -= dt;
    const car = player.inCar;

    if (car) {
      // Driving: W/S throttle, A/D steer, Space handbrake, E exits, H horn.
      const throttle = move.y < 0 ? 1 : move.y > 0 ? -1 : 0;
      const steer = move.x;
      driveCar(car, dt, steer, throttle, move.handbrake);
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.speed = car.speed;
      if (actions & 4) {
        player.inCar = null;
        player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
        player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
        player.speed = 0;
        say('Out of the car.', 1.5);
      }
      return 0;
    }

    // On foot: WASD move, Shift run, F punch, E enter a nearby car.
    const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = player.x + move.x * speed * dt;
    const ny = player.y + move.y * speed * dt;
    if (move.x !== 0 || move.y !== 0) player.angle = Math.atan2(move.y, move.x);
    const probe = { x: nx, y: ny, r: PLAYER.radius };
    city.resolveBuildingCollision(probe);
    player.x = Math.max(20, Math.min(WORLD.width - 20, probe.x));
    player.y = Math.max(20, Math.min(WORLD.height - 20, probe.y));
    player.speed = Math.hypot(move.x, move.y) * speed;

    let events = 0;
    if (actions & 8) {
      player.punchTimer = 0.35;
      for (const ped of state.peds) {
        const d = distance(player.x, player.y, ped.x, ped.y);
        if (d < PLAYER.punchRange + 12) {
          ped.fleeTimer = 2.5;
          ped.angle = angleTo(player.x, player.y, ped.x, ped.y);
          events |= addWanted(1, 'Assaulting a pedestrian is a crime.');
        }
      }
    }
    if (actions & 4) {
      let bestCar = null;
      let bestDist = PLAYER.enterCarRange;
      for (const candidate of state.cars) {
        const d = distance(player.x, player.y, candidate.x, candidate.y);
        if (d < bestDist) { bestDist = d; bestCar = candidate; }
      }
      if (bestCar) {
        const wasParked = bestCar.kind !== 'traffic';
        player.inCar = bestCar;
        state.carHealth = 100;
        if (bestCar.kind === 'traffic') {
          bestCar.kind = 'stolen';
          events |= addWanted(1, 'You stole a car in broad daylight.');
        } else {
          bestCar.kind = 'stolen';
          events |= addWanted(1, 'You stole a parked car.');
        }
        if (wasParked) say(`You took the ${bestCar.model.name}.`, 2);
        else say(`You took the ${bestCar.model.name}.`, 2);
      }
    }
    // Walking into a parked car does nothing; driving over a pedestrian is a crime.
    return events;
  }

  function stepCarPedCollisions() {
    const car = state.player.inCar;
    if (!car) return 0;
    let events = 0;
    for (const ped of state.peds) {
      if (Math.abs(car.speed) < 120) continue;
      if (distance(car.x, car.y, ped.x, ped.y) < 40) {
        ped.fleeTimer = 3;
        ped.angle = angleTo(car.x, car.y, ped.x, ped.y);
        ped.x += Math.cos(ped.angle) * 60;
        ped.y += Math.sin(ped.angle) * 60;
        car.speed *= 0.6;
        events |= addWanted(1, 'You hit a pedestrian!');
      }
    }
    return events;
  }

  function stepWanted(dt) {
    if (state.wanted <= 0) {
      state.wantedSeenTimer = 0;
      return;
    }
    // Wanted fades only while no police can see the player: out of range, or
    // hidden behind a building. Break line of sight and keep it broken.
    let seen = false;
    for (const cop of state.police) {
      if (
        distance(cop.x, cop.y, state.player.x, state.player.y) < WANTED.sightRadius &&
        city.hasLineOfSight(cop.x, cop.y, state.player.x, state.player.y)
      ) { seen = true; break; }
    }
    if (!seen) {
      state.wantedSeenTimer += dt;
      if (state.wantedSeenTimer > WANTED.decayDelay) {
        state.wanted = Math.max(0, state.wanted - WANTED.decayRate * dt);
        if (state.wanted <= 0) {
          state.police = [];
          say('You lost them. The heat is off.', 4);
        }
      }
    } else {
      state.wantedSeenTimer = 0;
    }
  }

  /** Advance the world one fixed step. `move` is {x, y, run, handbrake}; `actions` is a bitmask. */
  function step(dt, move, actions) {
    if (state.busted || state.wasted) return EVENT_OVER;
    state.time += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    for (let i = state.effects.length - 1; i >= 0; i -= 1) {
      state.effects[i].timer -= dt;
      if (state.effects[i].timer <= 0) state.effects.splice(i, 1);
    }
    let events = stepPlayer(dt, move, actions);
    events |= stepCarPedCollisions();
    stepTraffic(dt);
    stepPeds(dt);
    const policeEvents = stepPolice(dt);
    events |= policeEvents;
    stepWanted(dt);
    events |= stepMissions(dt, 0);
    if (state.health <= 0) {
      state.wasted = true;
      return events | EVENT_OVER;
    }
    // Camera eases toward the player and stays inside the world.
    const targetX = state.player.x;
    const targetY = state.player.y;
    state.camera.x += (targetX - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (targetY - state.camera.y) * Math.min(1, dt * 5);
    return events;
  }

  // Helpers the screenshot stager and the autopilot use to set a scene up.
  function teleport(x, y) {
    state.player.x = x;
    state.player.y = y;
    state.camera.x = x;
    state.camera.y = y;
    if (state.player.inCar) {
      state.player.inCar.x = x;
      state.player.inCar.y = y;
    }
  }

  function putPlayerInCar(modelIndex) {
    const model = CAR_MODELS[modelIndex % CAR_MODELS.length];
    const car = {
      id: Math.floor(random.next() * 1e9), kind: 'stolen', model,
      x: state.player.x, y: state.player.y, angle: state.player.angle,
      speed: 0, cruise: 0, vertical: false, dir: 1, color: model.color, health: 100,
    };
    state.cars.push(car);
    state.player.inCar = car;
    state.carHealth = 100;
    return car;
  }

  function setWanted(stars) {
    state.wanted = stars;
    state.police = [];
    spawnPolice();
  }

  reset();

  return {
    state,
    city,
    step,
    reset,
    startMission,
    stepText,
    currentMission,
    currentStep,
    teleport,
    putPlayerInCar,
    setWanted,
    spawnPolice,
    say,
    STEP,
  };
}
