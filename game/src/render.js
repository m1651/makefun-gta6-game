// Solara Bay — rendering. One job: draw the city, entities, HUD, minimap and menus.
import { WORLD_W, WORLD_H, GRID, ROAD_W, COLORS } from './config.js';
import { isOnRoad } from './city.js';

const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camX = 0;
    this.camY = 0;
  }

  draw(game) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const world = game.world;
    const p = world.player;
    // Camera follows the player, clamped to the world.
    this.camX = Math.max(0, Math.min(WORLD_W - W, p.x - W / 2));
    this.camY = Math.max(0, Math.min(WORLD_H - H, p.y - H / 2));
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    this.drawGround(ctx);
    this.drawCity(ctx, game);
    this.drawEntities(ctx, game);
    this.drawParticles(ctx, world);
    ctx.restore();
    this.drawDayTint(ctx, world, W, H);
    this.drawHud(ctx, game, W, H);
    this.drawMinimap(ctx, game, W, H);
    if (game.state === 'title') this.drawTitle(ctx, game, W, H);
    if (game.state === 'paused') this.drawPaused(ctx, W, H);
    if (game.state === 'win') this.drawWin(ctx, game, W, H);
    if (game.state === 'over') this.drawOver(ctx, game, W, H);
    if (p.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,40,30,${p.hurtFlash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  drawGround(ctx) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, W, H);
    // Sea along the south edge, sand beach above it.
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(-this.camX, WORLD_H - 130 - this.camY, WORLD_W, 60);
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(-this.camX, WORLD_H - 70 - this.camY, WORLD_W, 70);
    ctx.fillStyle = COLORS.seaDeep;
    for (let x = 0; x < WORLD_W; x += 140) {
      ctx.fillRect(x - this.camX + 40, WORLD_H - 40 - this.camY, 60, 4);
    }
  }

  drawCity(ctx, game) {
    const city = game.world.city;
    const camX = this.camX, camY = this.camY;
    // Roads.
    ctx.fillStyle = COLORS.road;
    for (const x of city.roadsX) ctx.fillRect(x - ROAD_W / 2 - camX, -camY, ROAD_W, WORLD_H);
    for (const y of city.roadsY) ctx.fillRect(-camX, y - ROAD_W / 2 - camY, WORLD_W, ROAD_W);
    // Sidewalks.
    ctx.fillStyle = COLORS.sidewalk;
    for (const x of city.roadsX) {
      ctx.fillRect(x - ROAD_W / 2 - 8 - camX, -camY, 8, WORLD_H);
      ctx.fillRect(x + ROAD_W / 2 - camX, -camY, 8, WORLD_H);
    }
    for (const y of city.roadsY) {
      ctx.fillRect(-camX, y - ROAD_W / 2 - 8 - camY, WORLD_W, 8);
      ctx.fillRect(-camX, y + ROAD_W / 2 - camY, WORLD_W, 8);
    }
    // Dashed centre lines.
    ctx.fillStyle = COLORS.roadLine;
    for (const x of city.roadsX) {
      for (let y = 0; y < WORLD_H; y += 60) ctx.fillRect(x - 2 - camX, y - camY, 4, 30);
    }
    for (const y of city.roadsY) {
      for (let x = 0; x < WORLD_W; x += 60) ctx.fillRect(x - camX, y - 2 - camY, 30, 4);
    }
    // Park.
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(city.park.x - 190 - camX, city.park.y - 190 - camY, 380, 380);
    ctx.fillStyle = '#7a9a4a';
    ctx.beginPath(); ctx.arc(city.park.x - camX, city.park.y - camY, 60, 0, TAU); ctx.fill();
    // Port: containers.
    ctx.fillStyle = '#8a7a5a';
    ctx.fillRect(city.port.x - 140 - camX, city.port.y - 350 - camY, 280, 700);
    const contColors = ['#c95a3d', '#3d7ac9', '#e8c832', '#3dc97a'];
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = contColors[i % 4];
      ctx.fillRect(city.port.x - 120 + (i % 2) * 130 - camX, city.port.y - 320 + Math.floor(i / 2) * 130 - camY, 110, 50);
    }
    // Buildings.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6 - camX, b.y + 8 - camY, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - camX, b.y - camY, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6 - camX, b.y + 6 - camY, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(255,255,200,0.75)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i + j) % 2 === 0) ctx.fillRect(b.x + 10 + i * 26 - camX, b.y + 10 + j * 26 - camY, 12, 14);
        }
      }
    }
    // Palms.
    for (const palm of city.palms) {
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(palm.x - 2 - camX, palm.y - 2 - camY, 4, 4);
      ctx.fillStyle = '#3f8a3a';
      ctx.beginPath(); ctx.arc(palm.x - camX, palm.y - camY, 9, 0, TAU); ctx.fill();
    }
    // Place markers: garage, bank, marina, safehouse, hospital, fixer.
    this.drawPlaceMarkers(ctx, game);
  }

  drawPlaceMarkers(ctx, game) {
    const places = [
      { x: 400, y: 600, label: 'GARAGE', color: '#e8c832' },
      { x: 2000, y: 1200, label: 'BANK', color: '#7dff6a' },
      { x: 2900, y: 2000, label: 'MARINA', color: '#6ad9ff' },
      { x: 1200, y: 2000, label: 'SAFEHOUSE', color: '#ff9ad9' },
      { x: 1600, y: 1200, label: 'HOSPITAL', color: '#ffffff' },
      { x: 2000, y: 2000, label: 'FIXER', color: '#c9a0ff' },
    ];
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (const pl of places) {
      ctx.fillStyle = pl.color;
      ctx.beginPath(); ctx.arc(pl.x - this.camX, pl.y - this.camY, 16, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillText('◆', pl.x - this.camX, pl.y - this.camY + 4);
      ctx.fillStyle = pl.color;
      ctx.fillText(pl.label, pl.x - this.camX, pl.y - 26 - this.camY);
    }
    // Mission marker: pulsing beacon.
    const m = game.missions.marker;
    if (m && game.state === 'playing') {
      const pulse = 18 + Math.sin(game.world.time * 5) * 5;
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(m.x - this.camX, m.y - this.camY, pulse, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath(); ctx.arc(m.x - this.camX, m.y - this.camY, 6, 0, TAU); ctx.fill();
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(m.label.toUpperCase(), m.x - this.camX, m.y - 30 - this.camY);
    }
  }

  drawEntities(ctx, game) {
    const world = game.world;
    const camX = this.camX, camY = this.camY;
    // Pedestrians.
    for (const ped of world.peds) {
      if (ped.state === 'down') {
        ctx.fillStyle = '#5a3a3a';
        ctx.beginPath(); ctx.ellipse(ped.x - camX, ped.y - camY, 14, 7, ped.angle, 0, TAU); ctx.fill();
        continue;
      }
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.arc(ped.x - camX, ped.y - camY, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(ped.x - camX, ped.y - camY, 4, 0, TAU); ctx.fill();
      if (ped.debtor && !ped.collected) {
        ctx.fillStyle = '#ffd94a';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', ped.x - camX, ped.y - 16 - camY);
      }
    }
    // Cars.
    for (const car of [...world.cars, ...world.police]) {
      this.drawCar(ctx, car, camX, camY);
    }
    // Player.
    const p = world.player;
    if (p.onFoot) {
      ctx.save();
      ctx.translate(p.x - camX, p.y - camY);
      ctx.rotate(p.angle);
      ctx.fillStyle = COLORS.player;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c94f3d';
      ctx.fillRect(4, -6, 10, 12); // jacket direction
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LUCIA', p.x - camX, p.y - 20 - camY);
    }
  }

  drawCar(ctx, car, camX, camY) {
    ctx.save();
    ctx.translate(car.x - camX, car.y - camY);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-22, -11, 46, 26);
    ctx.fillStyle = car.color;
    ctx.fillRect(-22, -12, 44, 24);
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(-6, -10, 14, 20); // windshield / cabin
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(18, -10, 3, 6); ctx.fillRect(18, 4, 3, 6); // headlights
    ctx.fillStyle = '#ff3d2a';
    ctx.fillRect(-22, -10, 3, 6); ctx.fillRect(-22, 4, 3, 6); // taillights
    if (car.kind === 'police-car') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-2, -12, 10, 24);
      ctx.fillStyle = '#ff3d2a';
      ctx.fillRect(-2, -12, 10, 4);
      ctx.fillStyle = '#3d7ad9';
      ctx.fillRect(-2, 8, 10, 4);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 2, 3);
    }
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    ctx.restore();
  }

  drawParticles(ctx, world) {
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - this.camX - 3, pt.y - this.camY - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    for (const t of world.floatingTexts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x - this.camX, t.y - this.camY);
    }
    ctx.globalAlpha = 1;
  }

  drawDayTint(ctx, world, W, H) {
    // Late-afternoon sun: warm tint that deepens toward "night" as the day cycles.
    const t = world.dayTime;
    const night = t > 0.75 ? (t - 0.75) * 2.4 : 0;
    if (night > 0.02) {
      ctx.fillStyle = `rgba(10,20,60,${Math.min(0.35, night)})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = 'rgba(255,180,80,0.05)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  drawHud(ctx, game, W, H) {
    const world = game.world;
    const p = world.player;
    const m = game.missions;
    ctx.textAlign = 'left';
    // Top-left: money, health, wanted stars.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(12, 12, 250, 96);
    ctx.fillStyle = '#7dff6a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`$${p.money}`, 24, 44);
    ctx.fillStyle = '#ff5a4a';
    ctx.fillRect(24, 56, 120, 12);
    ctx.fillStyle = '#7dff6a';
    ctx.fillRect(24, 56, 120 * (p.health / 100), 12);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText('HEALTH', 150, 67);
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#ffd94a';
    ctx.fillText('★'.repeat(world.wanted) + '☆'.repeat(5 - world.wanted), 24, 96);
    // Mission objective bar.
    if (m.current && game.state === 'playing') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(W / 2 - 330, 12, 660, 52);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 17px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${m.current.title} — ${m.current.objective}`, W / 2, 34);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      const extra = m.current.id === 'delivery' ? `  Time left: ${Math.max(0, Math.ceil(m.timer))}s`
        : m.current.id === 'score' && m.phase === 'holdout' ? `  Hold: ${Math.max(0, Math.ceil(m.holdTimer))}s`
        : m.current.id === 'debt' ? `  Collected: ${m.collected}/3` : '';
      ctx.fillText(`Payout $${m.current.payout}${extra}`, W / 2, 54);
      ctx.textAlign = 'left';
    }
    // Speed when driving.
    if (!p.onFoot) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(W - 200, H - 70, 180, 52);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(p.speed) * 0.22)} mph`, W - 32, H - 32);
      ctx.textAlign = 'left';
    }
    // Controls hint.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(12, H - 34, 560, 22);
    ctx.fillStyle = '#ddd';
    ctx.font = '13px sans-serif';
    ctx.fillText('WASD move/drive · E enter car / interact · F punch · Space handbrake · P pause · M mute', 20, H - 18);
    // Mission message.
    if (m.messageTimer > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      const tw = ctx.measureText(m.message).width;
      ctx.fillRect(W / 2 - tw / 2 - 16, 76, tw + 32, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.message, W / 2, 96);
      ctx.textAlign = 'left';
    }
    // Busted / wasted banner.
    if (world.busted) {
      ctx.fillStyle = 'rgba(120,0,0,0.8)';
      ctx.fillRect(0, H / 2 - 50, W, 100);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BUSTED!', W / 2, H / 2 + 8);
      ctx.font = '18px sans-serif';
      ctx.fillText('Press R to respawn at the hospital', W / 2, H / 2 + 40);
      ctx.textAlign = 'left';
    }
    if (world.wasted) {
      ctx.fillStyle = 'rgba(60,0,0,0.8)';
      ctx.fillRect(0, H / 2 - 50, W, 100);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WASTED', W / 2, H / 2 + 8);
      ctx.font = '18px sans-serif';
      ctx.fillText('Press R to respawn at the hospital', W / 2, H / 2 + 40);
      ctx.textAlign = 'left';
    }
    // Off-screen mission marker arrow.
    if (m.marker && game.state === 'playing') {
      const mx = m.marker.x - this.camX;
      const my = m.marker.y - this.camY;
      if (mx < 40 || mx > W - 40 || my < 40 || my > H - 40) {
        const cx = W / 2, cy = H / 2;
        const ang = Math.atan2(my - cy, mx - cx);
        const ax = cx + Math.cos(ang) * 220;
        const ay = cy + Math.sin(ang) * 160;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.fillStyle = '#ffd94a';
        ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffd94a';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(Math.hypot(m.marker.x - p.x, m.marker.y - p.y))}m`, ax, ay + 30);
        ctx.textAlign = 'left';
      }
    }
  }

  drawMinimap(ctx, game, W, H) {
    const mw = 190, mh = 142;
    const x0 = W - mw - 14, y0 = 14;
    const sx = mw / WORLD_W, sy = mh / WORLD_H;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#2a4a2a';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.fillStyle = '#3a3f46';
    const city = game.world.city;
    for (const rx of city.roadsX) ctx.fillRect(x0 + rx * sx - 2, y0, 4, mh);
    for (const ry of city.roadsY) ctx.fillRect(x0, y0 + ry * sy, mw, 4);
    ctx.fillStyle = '#1f7fa8';
    ctx.fillRect(x0, y0 + (WORLD_H - 70) * sy, mw, 70 * sy);
    const m = game.missions.marker;
    if (m) {
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath(); ctx.arc(x0 + m.x * sx, y0 + m.y * sy, 5, 0, TAU); ctx.fill();
    }
    for (const cop of game.world.police) {
      ctx.fillStyle = '#3d7ad9';
      ctx.fillRect(x0 + cop.x * sx - 2, y0 + cop.y * sy - 2, 4, 4);
    }
    const p = game.world.player;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd94a';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOLARA BAY', x0 + mw / 2, y0 + mh + 16);
    ctx.textAlign = 'left';
  }

  drawTitle(ctx, game, W, H) {
    ctx.fillStyle = 'rgba(5,15,25,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('SOLARA BAY', W / 2, H / 2 - 120);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText('An open-world crime story — Lucia Vega comes home', W / 2, H / 2 - 70);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#cfe8ff';
    const lines = [
      'Drive the city. Steal cars. Outrun the police. Finish all five missions.',
      'WASD move / drive · E enter car or interact · F punch · Space handbrake',
      'P pause · M mute · Your money and mission progress save automatically.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 - 20 + i * 28));
    ctx.fillStyle = '#7dff6a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(game.saveExists ? 'Press ENTER — Continue story' : 'Press ENTER — Start story', W / 2, H / 2 + 110);
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('A wholly original game. Not affiliated with Rockstar Games or Grand Theft Auto.', W / 2, H - 30);
    ctx.textAlign = 'left';
  }

  drawPaused(ctx, W, H) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '18px sans-serif';
    ctx.fillText('Press P to resume', W / 2, H / 2 + 40);
    ctx.textAlign = 'left';
  }

  drawWin(ctx, game, W, H) {
    ctx.fillStyle = 'rgba(5,25,10,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 60px sans-serif';
    ctx.fillText('THE BIG SCORE!', W / 2, H / 2 - 60);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText('Lucia Vega owns Solara Bay now.', W / 2, H / 2 - 10);
    ctx.font = '20px sans-serif';
    ctx.fillText(`Final cash: $${game.world.player.money} · Missions: 5/5`, W / 2, H / 2 + 34);
    ctx.fillStyle = '#7dff6a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Press ENTER to play again', W / 2, H / 2 + 90);
    ctx.textAlign = 'left';
  }

  drawOver(ctx, game, W, H) {
    ctx.fillStyle = 'rgba(20,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('The crew never forgets a debt. Press ENTER to try again.', W / 2, H / 2 + 24);
    ctx.textAlign = 'left';
  }
}
