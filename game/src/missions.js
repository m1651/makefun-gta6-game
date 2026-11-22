// Solara Bay — story missions. One job: mission flow, objectives, timers and payouts.
import { MISSIONS, PLACES } from './config.js';

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export class MissionManager {
  constructor(world, sound) {
    this.world = world;
    this.sound = sound;
    this.index = 0; // 0-based mission; MISSIONS.length means story complete
    this.phase = 'drive'; // per-mission sub-state
    this.timer = 0;
    this.holdTimer = 0;
    this.collected = 0;
    this.debtors = [];
    this.marker = null; // {x, y, label}
    this.message = '';
    this.messageTimer = 0;
    this.complete = false;
    this.startMission(0);
  }

  get current() { return MISSIONS[this.index] || null; }
  get done() { return this.index >= MISSIONS.length; }

  startMission(i) {
    this.index = i;
    this.phase = 'drive';
    this.timer = 0;
    this.holdTimer = 0;
    this.collected = 0;
    this.debtors = [];
    if (this.done) { this.complete = true; this.marker = null; return; }
    const m = this.current;
    this.sound.missionStart();
    this.showMessage(`${m.title}: ${m.brief}`, 6);
    if (m.id === 'wheels') {
      this.marker = { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Garage' };
    } else if (m.id === 'delivery') {
      this.marker = { x: PLACES.marina.x, y: PLACES.marina.y, label: 'Marina' };
      this.timer = m.timeLimit;
    } else if (m.id === 'debt') {
      this.spawnDebtors();
      this.marker = this.nearestDebtorMarker();
    } else if (m.id === 'heat') {
      this.world.addHeat(55, 'THE COPS ARE ONTO YOU!');
      this.marker = { x: PLACES.safehouse.x, y: PLACES.safehouse.y, label: 'Safehouse' };
    } else if (m.id === 'score') {
      this.marker = { x: PLACES.bank.x, y: PLACES.bank.y, label: 'Bank' };
    }
  }

  spawnDebtors() {
    const spots = [
      { x: 800, y: 600 }, { x: 2400, y: 1600 }, { x: 2400, y: 1200 },
    ];
    this.debtors = [];
    const peds = this.world.peds;
    for (let i = 0; i < 3; i++) {
      // Pick the nearest pedestrian to each spot and mark them a debtor.
      let best = null, bestD = 1e9;
      for (const ped of peds) {
        if (ped.debtor) continue;
        const d = dist(ped.x, ped.y, spots[i].x, spots[i].y);
        if (d < bestD) { best = ped; bestD = d; }
      }
      if (best) {
        best.debtor = true; best.collected = false; best.cash = 150;
        best.x = spots[i].x; best.y = spots[i].y;
        this.debtors.push(best);
      }
    }
  }

  nearestDebtorMarker() {
    const left = this.debtors.filter((d) => !d.collected);
    if (!left.length) return null;
    const p = this.world.player;
    let best = left[0], bestD = 1e9;
    for (const d of left) {
      const dd = dist(p.x, p.y, d.x, d.y);
      if (dd < bestD) { best = d; bestD = dd; }
    }
    return { x: best.x, y: best.y, label: 'Debtor' };
  }

  showMessage(text, seconds = 4) {
    this.message = text;
    this.messageTimer = seconds;
  }

  payOut() {
    const m = this.current;
    if (!m) return;
    this.world.player.money += m.payout;
    this.world.addText(this.world.player.x, this.world.player.y - 50, `+$${m.payout}`, '#7dff6a');
    this.sound.cash();
    this.sound.missionDone();
    this.showMessage(`Mission complete: ${m.title} — +$${m.payout}`, 5);
  }

  failMission(reason) {
    this.showMessage(`Mission failed: ${reason}. Try again.`, 5);
    this.startMission(this.index); // restart the same mission
  }

  onEvent(event, world, ped) {
    const m = this.current;
    if (!m) return;
    const p = world.player;
    if (m.id === 'wheels' && event === 'enter-car') {
      this.phase = 'deliver';
      this.showMessage('Got wheels. Now drive to the garage.', 4);
    }
    if (m.id === 'debt' && event === 'punch-debtor' && ped && ped.debtor && !ped.collected) {
      this.collect(ped);
    }
    if (m.id === 'debt' && event === 'interact') {
      // Collect from a nearby debtor by pressing E.
      for (const d of this.debtors) {
        if (!d.collected && dist(p.x, p.y, d.x, d.y) < 70) { this.collect(d); break; }
      }
    }
    if (m.id === 'score' && event === 'interact' && this.phase === 'grab') {
      this.phase = 'holdout';
      this.holdTimer = 20;
      this.showMessage('Grabbing the cash — hold the lobby for 20 seconds!', 4);
      world.addHeat(40, 'ALARM TRIPPED!');
    }
  }

  collect(debtor) {
    debtor.collected = true;
    debtor.state = 'flee';
    debtor.fleeX = debtor.x - this.world.player.x;
    debtor.fleeY = debtor.y - this.world.player.y;
    this.collected++;
    this.world.player.money += 150;
    this.world.addText(debtor.x, debtor.y - 30, '+$150 collected', '#7dff6a');
    this.sound.cash();
    this.marker = this.nearestDebtorMarker();
    if (this.collected >= 3) {
      this.payOut();
      this.startMission(this.index + 1);
    }
  }

  update(dt) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    const m = this.current;
    if (!m) return;
    const p = this.world.player;
    const w = this.world;

    if (m.id === 'wheels' && this.phase === 'deliver' && !p.onFoot) {
      if (dist(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 90) {
        this.payOut();
        this.startMission(1);
      }
    }

    if (m.id === 'delivery') {
      this.timer -= dt;
      if (this.timer <= 0) { this.failMission('The buyer walked away.'); return; }
      if (dist(p.x, p.y, PLACES.marina.x, PLACES.marina.y) < 90) {
        this.payOut();
        this.startMission(2);
      }
    }

    if (m.id === 'debt') {
      if (this.marker && this.debtors.length) {
        const left = this.debtors.filter((d) => !d.collected);
        if (left.length) {
          const near = left[0];
          this.marker = { x: near.x, y: near.y, label: 'Debtor' };
        }
      }
    }

    if (m.id === 'heat') {
      if (w.wanted === 0 && dist(p.x, p.y, PLACES.safehouse.x, PLACES.safehouse.y) < 90) {
        this.payOut();
        this.startMission(4);
      }
    }

    if (m.id === 'score') {
      if (this.phase === 'drive' && dist(p.x, p.y, PLACES.bank.x, PLACES.bank.y) < 90) {
        this.phase = 'grab';
        this.showMessage('At the bank. Press E to grab the cash!', 4);
      }
      if (this.phase === 'holdout') {
        this.holdTimer -= dt;
        if (this.holdTimer <= 0) {
          this.phase = 'escape';
          this.marker = { x: PLACES.safehouse.x, y: PLACES.safehouse.y, label: 'Safehouse' };
          this.showMessage('Cash secured! Lose the cops and reach the safehouse.', 5);
        }
      }
      if (this.phase === 'escape' && w.wanted === 0 && dist(p.x, p.y, PLACES.safehouse.x, PLACES.safehouse.y) < 90) {
        this.payOut();
        this.startMission(5); // story complete
      }
    }

    // The Fixer clears wanted stars for $200, when the player stands near him.
    if (w.wanted > 0 && dist(p.x, p.y, PLACES.fixer.x, PLACES.fixer.y) < 80 && p.money >= 200) {
      p.money -= 200;
      w.clearWanted();
      this.showMessage('The Fixer cleared your wanted level. -$200', 4);
      this.sound.cash();
    }
  }
}
