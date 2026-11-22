// Solara Bay — city generation and collision queries. One job: the map itself.
// Deterministic: the same seed always builds the same city, so screenshots are reproducible.
import { WORLD_W, WORLD_H, GRID, ROAD_W, COLORS, PLACES } from './config.js';

// Mulberry32 — tiny seeded RNG, no library needed.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildCity(seed = 7) {
  const rng = makeRng(seed);
  const roadsX = [];
  const roadsY = [];
  for (let x = GRID; x < WORLD_W; x += GRID) roadsX.push(x);
  for (let y = GRID; y < WORLD_H; y += GRID) roadsY.push(y);

  // Buildings fill the blocks between roads, leaving the park, beach and port clear.
  const buildings = [];
  const park = { x: 1600, y: 1600, w: 380, h: 380 };
  const port = { x: 2900, y: 200, w: 280, h: 700 };
  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 5; by++) {
      const blockX = bx * GRID + ROAD_W / 2 + 24;
      const blockY = by * GRID + ROAD_W / 2 + 24;
      const blockW = GRID - ROAD_W - 48;
      const blockH = GRID - ROAD_W - 48;
      if (rectsOverlap(blockX, blockY, blockW, blockH, park.x - 190, park.y - 190, 380, 380)) continue;
      if (rectsOverlap(blockX, blockY, blockW, blockH, port.x - 140, port.y - 350, 280, 700)) continue;
      // One or two buildings per block, placed on a jittered sub-grid.
      const n = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const w = 90 + rng() * 110;
        const h = 80 + rng() * 100;
        const x = blockX + (blockW - w) * (n === 1 ? 0.5 : i / (n - 1) + (rng() - 0.5) * 0.1);
        const y = blockY + (blockH - h) * (0.5 + (rng() - 0.5) * 0.3);
        const color = COLORS.building[Math.floor(rng() * COLORS.building.length)];
        const roof = COLORS.roof[Math.floor(rng() * COLORS.roof.length)];
        buildings.push({ x, y, w, h, color, roof, windows: 2 + Math.floor(rng() * 4) });
      }
    }
  }

  // Palm trees along the beach and around the park.
  const palms = [];
  for (let x = 100; x < WORLD_W; x += 90) palms.push({ x: x + (rng() - 0.5) * 30, y: WORLD_H - 90 + (rng() - 0.5) * 40 });
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    palms.push({ x: park.x + Math.cos(a) * (200 + rng() * 60), y: park.y + Math.sin(a) * (200 + rng() * 60) });
  }

  // Parked cars on road shoulders, at fixed spots near places the player needs.
  // Every spot sits ON a road (x or y a multiple of 400, offset 30-60 onto the
  // shoulder) so a stolen car can always drive away without crossing a building.
  const parked = [];
  const spots = [
    { x: 460, y: 400 }, { x: 800, y: 460 }, { x: 1240, y: 800 }, { x: 1600, y: 1060 },
    { x: 2000, y: 660 }, { x: 2400, y: 1460 }, { x: 2800, y: 660 }, { x: 1060, y: 2000 },
    { x: 1860, y: 2000 }, { x: 2460, y: 1200 }, { x: 660, y: 1600 }, { x: 2800, y: 1860 },
  ];
  for (const s of spots) {
    parked.push({ x: s.x, y: s.y, angle: (Math.floor(rng() * 4) * Math.PI) / 2, color: COLORS.car[Math.floor(rng() * COLORS.car.length)] });
  }

  return { roadsX, roadsY, buildings, park, port, palms, parked, rng };
}

export function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

export function isOnRoad(x, y) {
  const rx = ((x % GRID) + GRID) % GRID;
  const ry = ((y % GRID) + GRID) % GRID;
  return rx < ROAD_W / 2 || rx > GRID - ROAD_W / 2 || ry < ROAD_W / 2 || ry > GRID - ROAD_W / 2;
}

export function pointInBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Nearest point on the road network to (x, y): used by traffic cars and the autopilot.
export function nearestRoadPoint(x, y) {
  const cx = Math.round(x / GRID) * GRID;
  const cy = Math.round(y / GRID) * GRID;
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx < dy) return { x: cx, y };
  return { x, y: cy };
}

// Distance from a point to the nearest road centre line.
export function roadDistance(x, y) {
  const rx = ((x % GRID) + GRID) % GRID;
  const ry = ((y % GRID) + GRID) % GRID;
  const dx = Math.min(rx, GRID - rx);
  const dy = Math.min(ry, GRID - ry);
  return Math.min(dx, dy);
}

export function placeById(id) {
  return PLACES[id];
}
