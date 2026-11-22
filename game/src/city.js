// The city of Solara Bay, one job: turn a seed into streets, buildings, parks and the
// beach, plus the geometry questions the rest of the game asks (where is the road,
// does this circle hit a building, where can a car spawn).
import { AVENUES, STREETS, WORLD } from './config.js';

const BUILDING_COLORS = ['#d8c49a', '#c9a98a', '#b8c4c9', '#d9b8a3', '#a8b8a0', '#c4b8d0', '#e0cfa8', '#9fb8c8'];
const ROOF_COLORS = ['#8a6f5a', '#6f7f8a', '#a08a6a', '#7a8a7a', '#8a7a8a'];
const PARK_TREES = 5;

// A block is the rectangle between two neighbouring roads; the beach is the strip
// west of the first avenue, the marina sits at its southern end.
export function createCity(random) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const lots = [];

  const roadHalf = WORLD.roadWidth / 2;
  const xs = [0, ...AVENUES, WORLD.width];
  const ys = [0, ...STREETS, WORLD.height];

  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + (bx === 0 ? 0 : roadHalf) + 14;
      const x1 = xs[bx + 1] - (bx === xs.length - 2 ? 0 : roadHalf) - 14;
      const y0 = ys[by] + (by === 0 ? 0 : roadHalf) + 14;
      const y1 = ys[by + 1] - (by === ys.length - 2 ? 0 : roadHalf) - 14;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 90 || h < 90) continue;
      // The western strip is beach, not buildings.
      if (bx === 0) {
        for (let i = 0; i < 4; i += 1) {
          trees.push({ x: x0 + random.range(20, w - 20), y: y0 + random.range(20, h - 20), r: 9 });
        }
        continue;
      }
      const roll = random.next();
      if (bx === 2 && by === 3) {
        // City Hall owns this whole block: a tall landmark, no generated buildings.
        buildings.push({
          x: x0 + 30, y: y0 + 30, w: w - 60, h: h - 60, color: '#e8dcc0', roof: '#7a6a55',
          height: 5, windows: 6, landmark: 'City Hall',
        });
        continue;
      }
      if (roll < 0.16) {
        // A park: grass, trees, a pond.
        parks.push({ x: x0, y: y0, w, h });
        for (let i = 0; i < PARK_TREES; i += 1) {
          trees.push({ x: x0 + random.range(24, w - 24), y: y0 + random.range(24, h - 24), r: 10 });
        }
        continue;
      }
      if (roll < 0.26) {
        // An open lot: parked cars and little else.
        lots.push({ x: x0, y: y0, w, h });
        continue;
      }
      // One to four buildings fill the block, with alleys between them.
      const cols = w > 300 ? 2 : 1;
      const rows = h > 300 ? 2 : 1;
      const cellW = w / cols;
      const cellH = h / rows;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const bw = cellW * random.range(0.55, 0.8);
          const bh = cellH * random.range(0.55, 0.8);
          const bx0 = x0 + cx * cellW + (cellW - bw) / 2;
          const by0 = y0 + cy * cellH + (cellH - bh) / 2;
          buildings.push({
            x: bx0,
            y: by0,
            w: bw,
            h: bh,
            color: random.pick(BUILDING_COLORS),
            roof: random.pick(ROOF_COLORS),
            height: random.int(1, 4),
            windows: random.int(2, 5),
          });
        }
      }
    }
  }

  function onRoad(x, y, margin) {
    const m = margin ?? 0;
    for (const ax of AVENUES) {
      if (Math.abs(x - ax) <= WORLD.roadWidth / 2 + m && y >= 0 && y <= WORLD.height) return true;
    }
    for (const sy of STREETS) {
      if (Math.abs(y - sy) <= WORLD.roadWidth / 2 + m && x >= 0 && x <= WORLD.width) return true;
    }
    return false;
  }

  function onBeach(x) {
    return x < AVENUES[0] - WORLD.roadWidth / 2;
  }

  /** True when the circle at (x, y) with radius r overlaps a building. */
  function hitsBuilding(x, y, r) {
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  }

  /** Push a circle out of any building it overlaps; returns true if it moved. */
  function resolveBuildingCollision(circle) {
    let moved = false;
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      const cx = Math.max(b.x, Math.min(circle.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(circle.y, b.y + b.h));
      const dx = circle.x - cx;
      const dy = circle.y - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq >= circle.r * circle.r) continue;
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        circle.x = cx + (dx / dist) * circle.r;
        circle.y = cy + (dy / dist) * circle.r;
      } else {
        // Dead centre inside the building: push out along the shortest side.
        const left = circle.x - b.x;
        const right = b.x + b.w - circle.x;
        const top = circle.y - b.y;
        const bottom = b.y + b.h - circle.y;
        const min = Math.min(left, right, top, bottom);
        if (min === left) circle.x = b.x - circle.r;
        else if (min === right) circle.x = b.x + b.w + circle.r;
        else if (min === top) circle.y = b.y - circle.r;
        else circle.y = b.y + b.h + circle.r;
      }
      moved = true;
    }
    return moved;
  }

  /** The nearest point on a road centre line to (x, y), for steering and spawning. */
  function nearestRoadPoint(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const ax of AVENUES) {
      const px = ax;
      const py = Math.max(0, Math.min(WORLD.height, y));
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < bestDist) { bestDist = d; best = { x: px, y: py, vertical: true }; }
    }
    for (const sy of STREETS) {
      const px = Math.max(0, Math.min(WORLD.width, x));
      const py = sy;
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < bestDist) { bestDist = d; best = { x: px, y: py, vertical: false }; }
    }
    return best;
  }

  /** A random point on a road, for traffic and pedestrian spawns. */
  function randomRoadPoint() {
    if (random.next() < 0.5) {
      return { x: random.pick(AVENUES), y: random.range(80, WORLD.height - 80), vertical: true };
    }
    return { x: random.range(80, WORLD.width - 80), y: random.pick(STREETS), vertical: false };
  }

  function nearestAvenue(x) {
    let best = AVENUES[0];
    for (const ax of AVENUES) if (Math.abs(ax - x) < Math.abs(best - x)) best = ax;
    return best;
  }

  function nearestStreet(y) {
    let best = STREETS[0];
    for (const sy of STREETS) if (Math.abs(sy - y) < Math.abs(best - y)) best = sy;
    return best;
  }

  /**
   * The next waypoint for driving (or walking) from (x, y) to (tx, ty) along the
   * road grid: stay on the current road to the intersection nearest the target,
   * turn, and only cut across open ground for the final approach. Keeps cars off
   * the buildings that fill every block.
   */
  function routeWaypoint(x, y, tx, ty) {
    if (distance(x, y, tx, ty) < 150) return { x: tx, y: ty };
    const targetAvenue = nearestAvenue(tx);
    const targetStreet = nearestStreet(ty);
    const half = WORLD.roadWidth / 2;
    let onAvenue = null;
    let onStreet = null;
    for (const ax of AVENUES) if (Math.abs(x - ax) <= half) onAvenue = ax;
    for (const sy of STREETS) if (Math.abs(y - sy) <= half) onStreet = sy;
    if (onAvenue === null && onStreet === null) return nearestRoadPoint(x, y);
    if (onAvenue !== null && onStreet !== null) {
      // At an intersection: stay on the road that already leads toward the target.
      // If the car is on the target's avenue, drive along it; if on the target's
      // street, drive along that; otherwise turn onto the avenue first. Never
      // return the intersection itself as the waypoint, or the car orbits it.
      if (onAvenue === targetAvenue) onStreet = null;
      else if (onStreet === targetStreet) onAvenue = null;
      else onStreet = null;
    }
    if (onAvenue !== null) {
      if (onAvenue === targetAvenue) return { x: onAvenue, y: ty };
      return { x: onAvenue, y: targetStreet };
    }
    if (onStreet === targetStreet) return { x: tx, y: onStreet };
    return { x: targetAvenue, y: onStreet };
  }

  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
    const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  /** True when no building stands between the two points (for police line of sight). */
  function hasLineOfSight(x1, y1, x2, y2) {
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x1 > b.x && x1 < b.x + b.w && y1 > b.y && y1 < b.y + b.h) return false;
      if (x2 > b.x && x2 < b.x + b.w && y2 > b.y && y2 < b.y + b.h) return false;
      if (
        segmentsCross(x1, y1, x2, y2, b.x, b.y, b.x + b.w, b.y) ||
        segmentsCross(x1, y1, x2, y2, b.x + b.w, b.y, b.x + b.w, b.y + b.h) ||
        segmentsCross(x1, y1, x2, y2, b.x + b.w, b.y + b.h, b.x, b.y + b.h) ||
        segmentsCross(x1, y1, x2, y2, b.x, b.y + b.h, b.x, b.y)
      ) return false;
    }
    return true;
  }

  return {
    buildings,
    parks,
    trees,
    lots,
    onRoad,
    onBeach,
    hitsBuilding,
    hasLineOfSight,
    resolveBuildingCollision,
    nearestRoadPoint,
    nearestAvenue,
    nearestStreet,
    routeWaypoint,
    randomRoadPoint,
  };
}
