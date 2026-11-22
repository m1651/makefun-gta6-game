// The painter, one job: draw the world, the HUD and the menus on the canvas.
// Everything is flat vector art in a warm sun-soaked palette, so the game needs no
// image files. The camera follows the player; the minimap shows the whole city.
import { AVENUES, CAR, MISSIONS, PLACES, PLAYER, STREETS, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const ROAD_COLOR = '#3a3f4a';
const ROAD_EDGE = '#2c3038';
const SIDEWALK = '#b8ad96';
const GRASS = '#7fae62';
const SAND = '#e8d5a0';
const WATER = '#3f8fb8';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;

  function drawRoads(camera) {
    // Ground: grass everywhere, then the beach and water on the west edge.
    ctx.fillStyle = GRASS;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const beachX = AVENUES[0] - WORLD.roadWidth / 2 - camera.x;
    if (beachX > -200 && beachX < VIEW.width + 200) {
      ctx.fillStyle = SAND;
      ctx.fillRect(0, 0, beachX, VIEW.height);
      ctx.fillStyle = WATER;
      const waterW = Math.max(0, beachX - 90);
      ctx.fillRect(0, 0, waterW, VIEW.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let y = 0; y < VIEW.height; y += 46) {
        ctx.beginPath();
        ctx.moveTo(Math.max(0, waterW - 24), y);
        ctx.lineTo(Math.max(0, waterW - 4), y + 12);
        ctx.stroke();
      }
    }
    // Roads: dark asphalt with a pale centre line and sidewalk edges.
    for (const ax of AVENUES) {
      const x = ax - camera.x;
      if (x < -WORLD.roadWidth || x > VIEW.width + WORLD.roadWidth) continue;
      ctx.fillStyle = SIDEWALK;
      ctx.fillRect(x - WORLD.roadWidth / 2 - 8, 0, WORLD.roadWidth + 16, VIEW.height);
      ctx.fillStyle = ROAD_COLOR;
      ctx.fillRect(x - WORLD.roadWidth / 2, 0, WORLD.roadWidth, VIEW.height);
      ctx.strokeStyle = '#d8c96a';
      ctx.lineWidth = 3;
      ctx.setLineDash([26, 22]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const sy of STREETS) {
      const y = sy - camera.y;
      if (y < -WORLD.roadWidth || y > VIEW.height + WORLD.roadWidth) continue;
      ctx.fillStyle = SIDEWALK;
      ctx.fillRect(0, y - WORLD.roadWidth / 2 - 8, VIEW.width, WORLD.roadWidth + 16);
      ctx.fillStyle = ROAD_COLOR;
      ctx.fillRect(0, y - WORLD.roadWidth / 2, VIEW.width, WORLD.roadWidth);
      ctx.strokeStyle = '#d8c96a';
      ctx.lineWidth = 3;
      ctx.setLineDash([26, 22]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW.width, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Intersection dots where avenues meet streets.
    ctx.fillStyle = ROAD_EDGE;
    for (const ax of AVENUES) {
      for (const sy of STREETS) {
        const x = ax - camera.x;
        const y = sy - camera.y;
        if (x < -60 || x > VIEW.width + 60 || y < -60 || y > VIEW.height + 60) continue;
        ctx.fillRect(x - 4, y - 4, 8, 8);
      }
    }
  }

  function drawCity(city, camera) {
    for (const park of city.parks) {
      const x = park.x - camera.x;
      const y = park.y - camera.y;
      if (x > VIEW.width || y > VIEW.height || x + park.w < 0 || y + park.h < 0) continue;
      ctx.fillStyle = '#6a9e52';
      ctx.fillRect(x, y, park.w, park.h);
      ctx.fillStyle = '#5a9ec4';
      ctx.beginPath();
      ctx.ellipse(x + park.w / 2, y + park.h / 2, park.w / 5, park.h / 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const lot of city.lots) {
      const x = lot.x - camera.x;
      const y = lot.y - camera.y;
      if (x > VIEW.width || y > VIEW.height || x + lot.w < 0 || y + lot.h < 0) continue;
      ctx.fillStyle = '#8a8f96';
      ctx.fillRect(x, y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      for (let px = x + 20; px < x + lot.w - 10; px += 44) {
        ctx.beginPath();
        ctx.moveTo(px, y + 8);
        ctx.lineTo(px, y + 26);
        ctx.stroke();
      }
    }
    for (const b of city.buildings) {
      const x = b.x - camera.x;
      const y = b.y - camera.y;
      if (x > VIEW.width || y > VIEW.height || x + b.w < 0 || y + b.h < 0) continue;
      // A soft shadow offset to the south-east sells the height.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + 6 + b.height * 2, y + 6 + b.height * 2, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(x + 6, y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 30));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(x + 12 + cx * 34, y + 12 + cy * 30, 14, 12);
        }
      }
      if (b.landmark) {
        ctx.fillStyle = '#20242e';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.landmark, x + b.w / 2, y + b.h / 2 + 5);
      }
    }
    for (const tree of city.trees) {
      const x = tree.x - camera.x;
      const y = tree.y - camera.y;
      if (x < -20 || x > VIEW.width + 20 || y < -20 || y > VIEW.height + 20) continue;
      ctx.fillStyle = '#4a7a3a';
      ctx.beginPath();
      ctx.arc(x, y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6ab04a';
      ctx.beginPath();
      ctx.arc(x - 3, y - 3, tree.r - 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCarShape(x, y, angle, color, isPolice, speed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 4, CAR.length, CAR.width);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.fillRect(-CAR.length / 2 + 12, -CAR.width / 2 + 5, 16, CAR.width - 10);
    ctx.fillStyle = '#9fc4d8';
    ctx.fillRect(-6, -CAR.width / 2 + 5, 18, CAR.width - 10);
    if (isPolice) {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-CAR.length / 2 + 28, -CAR.width / 2, 10, CAR.width);
      ctx.fillStyle = '#e83a3a';
      ctx.fillRect(-2, -CAR.width / 2 - 3, 8, 6);
      ctx.fillStyle = '#3a6ae8';
      ctx.fillRect(-2, CAR.width / 2 - 3, 8, 6);
    }
    // Headlight cones when moving fast.
    if (Math.abs(speed) > 300) {
      ctx.fillStyle = 'rgba(255,240,180,0.25)';
      ctx.beginPath();
      ctx.moveTo(CAR.length / 2, -8);
      ctx.lineTo(CAR.length / 2 + 70, -26);
      ctx.lineTo(CAR.length / 2 + 70, 26);
      ctx.lineTo(CAR.length / 2, 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, label) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 4, Math.sin(angle) * 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (label) {
      ctx.fillStyle = 'rgba(20,24,32,0.75)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 18);
    }
  }

  function drawMarker(x, y, camera, pulse) {
    const sx = x - camera.x;
    const sy = y - camera.y;
    const bob = Math.sin(pulse * 4) * 6;
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.fillStyle = '#ffcf3a';
    ctx.strokeStyle = '#20242e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-12, -26);
    ctx.lineTo(0, -18);
    ctx.lineTo(12, -26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // A pulsing ring on the ground marks the exact spot.
    ctx.strokeStyle = 'rgba(255,207,58,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 34 + Math.sin(pulse * 4) * 6, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawMinimap(state, city) {
    const mapW = 210;
    const mapH = 158;
    const mx = VIEW.width - mapW - 14;
    const my = 14;
    const sx = mapW / WORLD.width;
    const sy = mapH / WORLD.height;
    ctx.fillStyle = 'rgba(16,20,28,0.82)';
    ctx.beginPath();
    ctx.roundRect(mx - 6, my - 6, mapW + 12, mapH + 12, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mapW, mapH);
    ctx.clip();
    ctx.fillStyle = '#5a7a4a';
    ctx.fillRect(mx, my, mapW, mapH);
    ctx.fillStyle = '#e8d5a0';
    ctx.fillRect(mx, my, (AVENUES[0] - WORLD.roadWidth / 2) * sx, mapH);
    ctx.fillStyle = '#3f8fb8';
    ctx.fillRect(mx, my, 8, mapH);
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = 3;
    for (const ax of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(mx + ax * sx, my);
      ctx.lineTo(mx + ax * sx, my + mapH);
      ctx.stroke();
    }
    for (const sy2 of STREETS) {
      ctx.beginPath();
      ctx.moveTo(mx, my + sy2 * sy);
      ctx.lineTo(mx + mapW, my + sy2 * sy);
      ctx.stroke();
    }
    // Mission target and crates.
    const step = state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex].steps[state.missionStep] : null;
    if (step && step.kind === 'reach') {
      ctx.fillStyle = '#ffcf3a';
      ctx.beginPath();
      ctx.arc(mx + step.x * sx, my + step.y * sy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const crate of state.crates) {
      if (crate.taken) continue;
      ctx.fillStyle = '#ff9a3a';
      ctx.fillRect(mx + crate.x * sx - 3, my + crate.y * sy - 3, 6, 6);
    }
    for (const cop of state.police) {
      ctx.fillStyle = '#3a6ae8';
      ctx.beginPath();
      ctx.arc(mx + cop.x * sx, my + cop.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player is a white dot with a black ring.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#20242e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLARA BAY', mx, my + mapH + 4);
  }

  function drawHud(state, screen, best) {
    // Top-left: cash, wanted stars, health.
    ctx.fillStyle = 'rgba(16,20,28,0.8)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 250, 92, 10);
    ctx.fill();
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, 26, 46);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Best $${best.toLocaleString('en-US')}`, 26, 68);
    // Wanted stars.
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < Math.ceil(state.wanted) ? '#ffd23a' : 'rgba(255,255,255,0.25)';
      ctx.font = '22px sans-serif';
      ctx.fillText('★', 26 + i * 26, 96);
    }
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(26, 104, 160, 8);
    ctx.fillStyle = state.health > 30 ? '#7dff8a' : '#ff5a5a';
    ctx.fillRect(26, 104, 160 * (state.health / 100), 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Health ${Math.round(state.health)}`, 194, 112);

    // Mission panel, top-centre.
    const mission = state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
    ctx.fillStyle = 'rgba(16,20,28,0.8)';
    const panelW = 460;
    ctx.beginPath();
    ctx.roundRect((VIEW.width - panelW) / 2, 12, panelW, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#ffcf3a';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    if (mission) {
      ctx.fillText(`${mission.title}  •  ${mission.giver}`, VIEW.width / 2, 34);
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px sans-serif';
      const stepText = state.storyDone ? 'Free roam — explore Solara Bay.' : mission.steps[state.missionStep] ? mission.steps[state.missionStep].text : '';
      ctx.fillText(stepText, VIEW.width / 2, 56);
      const step = mission.steps[state.missionStep];
      if (mission.timeLimit || (step && step.kind === 'survive')) {
        ctx.fillStyle = state.missionTimer < 30 ? '#ff5a5a' : '#ffffff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`${Math.ceil(state.missionTimer)}s`, VIEW.width / 2 + panelW / 2 - 24, 34);
      }
    } else {
      ctx.fillText('Story complete!', VIEW.width / 2, 34);
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px sans-serif';
      ctx.fillText('Free roam — explore Solara Bay.', VIEW.width / 2, 56);
    }

    drawMinimap(state);

    // Speed and car health, bottom-right, only while driving.
    if (state.player.inCar) {
      ctx.fillStyle = 'rgba(16,20,28,0.8)';
      ctx.beginPath();
      ctx.roundRect(VIEW.width - 224, VIEW.height - 76, 210, 62, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(state.player.inCar.speed) * 0.12)} mph`, VIEW.width - 30, VIEW.height - 42);
      ctx.font = '12px sans-serif';
      ctx.fillText(state.player.inCar.model.name, VIEW.width - 30, VIEW.height - 24);
    }

    // Controls hint, bottom-left.
    ctx.fillStyle = 'rgba(16,20,28,0.65)';
    ctx.beginPath();
    ctx.roundRect(12, VIEW.height - 46, 430, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.player.inCar ? 'WASD drive • Space brake • E exit • H horn • P pause' : 'WASD move • Shift run • E enter car • F punch • P pause', 24, VIEW.height - 25);

    // Transient message banner.
    if (state.messageTimer > 0) {
      ctx.fillStyle = 'rgba(16,20,28,0.85)';
      const text = state.message;
      ctx.font = '15px sans-serif';
      const w = Math.min(VIEW.width - 40, ctx.measureText(text).width + 36);
      ctx.beginPath();
      ctx.roundRect((VIEW.width - w) / 2, VIEW.height - 108, w, 36, 8);
      ctx.fill();
      ctx.fillStyle = '#ffcf3a';
      ctx.textAlign = 'center';
      ctx.fillText(text, VIEW.width / 2, VIEW.height - 85);
    }
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(10,14,24,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcf3a';
    ctx.font = 'bold 74px sans-serif';
    ctx.fillText('SOLARA BAY', VIEW.width / 2, 210);
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px sans-serif';
    ctx.fillText('An open-world crime story in the spirit of GTA 6', VIEW.width / 2, 258);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#d8e0ea';
    ctx.fillText('Steal cars. Outrun the police. Run five jobs for Mara Voss and take the city.', VIEW.width / 2, 296);
    ctx.fillStyle = '#ffcf3a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press Enter or click to start', VIEW.width / 2, 380);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.fillText('WASD move / drive  •  E enter a car  •  F punch  •  Shift run  •  P pause  •  M mute', VIEW.width / 2, 430);
    ctx.fillText(`Best cash so far: $${best.toLocaleString('en-US')}`, VIEW.width / 2, 462);
    ctx.fillStyle = '#9fb0c0';
    ctx.font = '13px sans-serif';
    ctx.fillText('An original game. No characters, names or places from any commercial game.', VIEW.width / 2, 520);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10,14,24,0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 10);
    ctx.font = '18px sans-serif';
    ctx.fillText('Press P or Enter to keep playing', VIEW.width / 2, VIEW.height / 2 + 30);
  }

  function drawOver(state, best, won) {
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    if (won) {
      ctx.fillStyle = '#7dff8a';
      ctx.font = 'bold 56px sans-serif';
      ctx.fillText('THE CITY IS YOURS', VIEW.width / 2, 250);
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.fillText(`You finished all five jobs and banked $${state.cash.toLocaleString('en-US')}.`, VIEW.width / 2, 300);
    } else if (state.busted) {
      ctx.fillStyle = '#ff5a5a';
      ctx.font = 'bold 56px sans-serif';
      ctx.fillText('BUSTED', VIEW.width / 2, 250);
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.fillText('The Solara Bay police caught you. The story starts over.', VIEW.width / 2, 300);
    } else {
      ctx.fillStyle = '#ff5a5a';
      ctx.font = 'bold 56px sans-serif';
      ctx.fillText('WASTED', VIEW.width / 2, 250);
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.fillText('You did not survive Solara Bay. The story starts over.', VIEW.width / 2, 300);
    }
    ctx.fillStyle = '#ffcf3a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press Enter to play again', VIEW.width / 2, 380);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Cash banked: $${state.cash.toLocaleString('en-US')}   •   Best: $${best.toLocaleString('en-US')}`, VIEW.width / 2, 420);
  }

  function draw(world, city, screen, best) {
    const state = world.state;
    const camera = {
      x: Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, state.camera.x)) - VIEW.width / 2,
      y: Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, state.camera.y)) - VIEW.height / 2,
    };
    // On the title screen the camera rests over the marina, the prettiest corner.
    const viewCamera = screen === SCREEN_TITLE ? { x: 0, y: WORLD.height - VIEW.height } : camera;

    drawRoads(viewCamera);
    drawCity(city, viewCamera);

    // Mission crates.
    for (const crate of state.crates) {
      if (crate.taken) continue;
      const x = crate.x - viewCamera.x;
      const y = crate.y - viewCamera.y;
      ctx.fillStyle = '#ff9a3a';
      ctx.fillRect(x - 14, y - 14, 28, 28);
      ctx.strokeStyle = '#20242e';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 14, y - 14, 28, 28);
      ctx.fillStyle = '#20242e';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('◆', x, y + 6);
    }

    // Mission target marker.
    const step = state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex].steps[state.missionStep] : null;
    if (step && step.kind === 'reach' && screen !== SCREEN_TITLE) {
      drawMarker(step.x, step.y, viewCamera, state.time);
    }

    // Parked and traffic cars (the player's car is drawn last, on top).
    const playerCar = state.player.inCar;
    for (const car of state.cars) {
      if (car === playerCar) continue;
      drawCarShape(car.x - viewCamera.x, car.y - viewCamera.y, car.angle, car.color, false, car.speed);
    }
    for (const cop of state.police) {
      drawCarShape(cop.x - viewCamera.x, cop.y - viewCamera.y, cop.angle, cop.color, true, cop.speed);
      if (cop.sirenTimer < 0) {
        // A flashing halo sells the siren.
        ctx.fillStyle = 'rgba(58,106,232,0.25)';
        ctx.beginPath();
        ctx.arc(cop.x - viewCamera.x, cop.y - viewCamera.y, 52, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (playerCar) {
      drawCarShape(playerCar.x - viewCamera.x, playerCar.y - viewCamera.y, playerCar.angle, playerCar.color, false, playerCar.speed);
    }

    // Pedestrians, then the player on foot.
    for (const ped of state.peds) {
      drawPerson(ped.x - viewCamera.x, ped.y - viewCamera.y, ped.angle, ped.color, null);
    }
    if (!playerCar) {
      const p = state.player;
      drawPerson(p.x - viewCamera.x, p.y - viewCamera.y, p.angle, '#ff5a7a', 'YOU');
      if (p.punchTimer > 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x - viewCamera.x, p.y - viewCamera.y, 30, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Crash sparks.
    for (const effect of state.effects) {
      const x = effect.x - viewCamera.x;
      const y = effect.y - viewCamera.y;
      ctx.fillStyle = `rgba(255,200,60,${effect.timer * 2})`;
      ctx.beginPath();
      ctx.arc(x, y, 26 * effect.timer + 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // A red vignette while the police are on the player.
    if (state.wanted > 0 && screen === SCREEN_PLAY) {
      const pulse = 0.08 + 0.05 * Math.sin(state.time * 5);
      const gradient = ctx.createRadialGradient(
        VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35,
        VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.75,
      );
      gradient.addColorStop(0, 'rgba(255,40,40,0)');
      gradient.addColorStop(1, `rgba(255,40,40,${pulse})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else drawHud(state, screen, best);
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) drawOver(state, best, screen === SCREEN_WIN);
  }

  return { draw };
}
