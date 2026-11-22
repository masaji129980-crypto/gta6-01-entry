// The city of Solmar: a road grid, buildings, parks, beach and landmarks.
// Generated once from a seed so every run (and every screenshot) shows the same city.
import { WORLD, ROADS_X, ROADS_Y, BEACH, DISTRICTS, mulberry32 } from './config.js';

const PALETTES = {
  towers: ['#7d8aa0', '#5d6b82', '#93a5bd', '#6b7f9e', '#a8b6c8'],
  brick: ['#a5654a', '#8f5a44', '#b07a5e', '#7d4f3a'],
  warehouses: ['#8a7f70', '#6e6a63', '#9a8f80', '#5f5a52'],
  park: ['#4d8a4f', '#5da05e', '#3f7d46'],
  shops: ['#c98f4e', '#b07a8a', '#7a9ab0', '#a8a05e', '#c9b458'],
  houses: ['#d8b48f', '#c9a58a', '#e0c9a8', '#b08a6a'],
  neon: ['#c95e8f', '#8f6ec9', '#4ec9b0', '#c9a24e'],
  colourful: ['#e07a5f', '#f2c14e', '#81b29a', '#e76f88', '#f4a261'],
  industrial: ['#6e6e6e', '#7d7d7d', '#5a5a5a', '#8a8578'],
};

function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return { name: 'Outskirts', kind: 'houses' };
}

export function buildCity(seed) {
  const random = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  // One building (or a few) per city block, between the roads.
  for (let bx = 0; bx < ROADS_X.length - 1; bx += 1) {
    for (let by = 0; by < ROADS_Y.length - 1; by += 1) {
      const x0 = ROADS_X[bx] + WORLD.road / 2 + 14;
      const y0 = ROADS_Y[by] + WORLD.road / 2 + 14;
      const x1 = ROADS_X[bx + 1] - WORLD.road / 2 - 14;
      const y1 = ROADS_Y[by + 1] - WORLD.road / 2 - 14;
      if (y0 > BEACH.y) continue;
      const district = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
      if (district.kind === 'park') {
        for (let i = 0; i < 9; i += 1) {
          trees.push({ x: x0 + random() * (x1 - x0), y: y0 + random() * (y1 - y0), r: 12 + random() * 10 });
        }
        buildings.push({ x: x0 + 60, y: y0 + 60, w: 90, h: 60, color: '#d8c9a0', roof: '#a8584a', hgt: 1, label: 'KIOSK' });
        continue;
      }
      const palette = PALETTES[district.kind] || PALETTES.houses;
      const tall = district.kind === 'towers' ? 3 + Math.floor(random() * 4) : 1 + Math.floor(random() * 2);
      const split = random() < 0.45;
      if (split) {
        const mw = (x1 - x0) / 2 - 10;
        buildings.push({
          x: x0, y: y0, w: mw, h: y1 - y0 - 8,
          color: palette[Math.floor(random() * palette.length)], hgt: tall,
          roof: shade(palette[Math.floor(random() * palette.length)]),
        });
        buildings.push({
          x: x0 + mw + 20, y: y0, w: mw, h: y1 - y0 - 8,
          color: palette[Math.floor(random() * palette.length)], hgt: tall,
          roof: shade(palette[Math.floor(random() * palette.length)]),
        });
      } else {
        buildings.push({
          x: x0 + 8, y: y0 + 8, w: x1 - x0 - 16, h: y1 - y0 - 16,
          color: palette[Math.floor(random() * palette.length)], hgt: tall,
          roof: shade(palette[Math.floor(random() * palette.length)]),
        });
      }
      if (random() < 0.6) {
        trees.push({ x: x0 + 10 + random() * 30, y: y0 + 10 + random() * 30, r: 9 + random() * 6 });
      }
    }
  }
  // Street lamps along every avenue, at every intersection corner.
  for (const x of ROADS_X) {
    for (const y of ROADS_Y) {
      if (y > BEACH.y) continue;
      lamps.push({ x: x - WORLD.road / 2 - 6, y: y - WORLD.road / 2 - 6 });
    }
  }
  // Landmarks the story and the HUD point at.
  const landmarks = [
    { name: 'Rosa\'s Garage', x: 1180, y: 1420, icon: 'G', color: '#f2a007' },
    { name: 'Solmar National Bank', x: 1500, y: 560, icon: '$', color: '#37b24d' },
    { name: 'Safehouse', x: 2500, y: 560, icon: 'H', color: '#2e6fe3' },
    { name: 'Beach House', x: 560, y: 2700, icon: 'H', color: '#2e6fe3' },
    { name: 'Spray Shop', x: 2100, y: 1750, icon: 'S', color: '#e33f9e' },
    { name: 'Marina Pier', x: 2900, y: 2700, icon: 'Y', color: '#4ec9b0' },
    { name: 'St. Mary Hospital', x: 560, y: 560, icon: '+', color: '#e33f2e' },
  ];
  return { buildings, trees, lamps, landmarks, random };
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 24);
  const g = Math.max(0, ((n >> 8) & 255) - 24);
  const b = Math.max(0, (n & 255) - 24);
  return `rgb(${r},${g},${b})`;
}

// Is a point on a road (including the sidewalk edge)? Used by traffic and walking.
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= WORLD.road / 2 + 6) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= WORLD.road / 2 + 6) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let bestX = ROADS_X[0]; let bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; bestX = rx; }
  }
  let bestY = ROADS_Y[0]; bestD = Infinity;
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; bestY = ry; }
  }
  return Math.abs(x - bestX) < Math.abs(y - bestY) ? { x: bestX, y } : { x, y: bestY };
}

// Push a circle out of every building it overlaps; returns true when a hit happened.
export function collideBuildings(city, x, y, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx; const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        y = cy + (dy / d) * radius;
      } else {
        x += radius;
      }
    }
  }
  return { x, y, hit };
}

export function insideBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
  }
  return null;
}
