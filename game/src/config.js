// SOLMAR HEAT — configuration, city layout data and the story mission chain.
// Every name, place and character here is original fiction, invented for this game.
export const WORLD = { size: 3200, road: 72, block: 288 };
export const VIEW = { width: 1280, height: 800 };
export const STEP = 1 / 60;

// The road grid: vertical and horizontal avenues, spaced by block + road.
export const ROADS_X = [];
export const ROADS_Y = [];
for (let p = 144; p <= WORLD.size - 144; p += WORLD.block + WORLD.road) {
  ROADS_X.push(p);
  ROADS_Y.push(p);
}

// City districts, each a rectangle of blocks with its own flavour.
export const DISTRICTS = [
  { name: 'Downtown', x: 1000, y: 200, w: 1100, h: 900, kind: 'towers' },
  { name: 'Old Town', x: 200, y: 200, w: 800, h: 900, kind: 'brick' },
  { name: 'Harbour', x: 2100, y: 200, w: 1000, h: 900, kind: 'warehouses' },
  { name: 'Marina Park', x: 200, y: 1100, w: 800, h: 700, kind: 'park' },
  { name: 'Central', x: 1000, y: 1100, w: 1100, h: 700, kind: 'shops' },
  { name: 'Southside', x: 2100, y: 1100, w: 1000, h: 700, kind: 'houses' },
  { name: 'The Strip', x: 200, y: 1800, w: 800, h: 700, kind: 'neon' },
  { name: 'Little Havana', x: 1000, y: 1800, w: 1100, h: 700, kind: 'colourful' },
  { name: 'Docks', x: 2100, y: 1800, w: 1000, h: 700, kind: 'industrial' },
];
// The beach runs along the whole south edge of the map.
export const BEACH = { y: 2560, waterY: 2960 };

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 265,
  radius: 14,
  maxHealth: 100,
  punchDamage: 34,
  bulletDamage: 25,
};

export const CAR = {
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 160,
  steer: 2.6,
  grip: 0.92,
  radius: 26,
};

export const POLICE = {
  maxWanted: 5,
  chaseSpeed: 470,
  ramDamage: 12,
  copSpeed: 190,
  spawnDistance: 700,
  decaySeconds: 26,
};

// Car models the player and traffic can drive. All original names.
export const CAR_MODELS = [
  { name: 'Comet', color: '#e33f2e', speed: 1.12, kind: 'sport' },
  { name: 'Stallion', color: '#2e6fe3', speed: 1.0, kind: 'muscle' },
  { name: 'Panto', color: '#e3c52e', speed: 0.82, kind: 'compact' },
  { name: 'Rumbler', color: '#37b24d', speed: 0.9, kind: 'sedan' },
  { name: 'Voodoo', color: '#8e44ad', speed: 0.95, kind: 'lowrider' },
  { name: 'Cab', color: '#f2a007', speed: 0.88, kind: 'taxi' },
  { name: 'Hauler', color: '#6c757d', speed: 0.72, kind: 'truck' },
  { name: 'Interceptor', color: '#14181f', speed: 1.18, kind: 'police' },
];

// The story: six missions, told in order. Cash is the reward for each.
export const MISSIONS = [
  {
    id: 'm1', title: 'First Wheels', giver: 'Mama Rosa',
    brief: 'You are back in Solmar with $250 and a debt. Rosa needs a car. Steal any parked car and bring it to the garage on Palm Row.',
    objective: 'Steal a car and drive it to the garage marker',
    target: { x: 1180, y: 1420 }, needCar: true, pay: 600, wantedOnStart: 0,
  },
  {
    id: 'm2', title: 'The Pickup', giver: 'Mama Rosa',
    brief: 'A package is waiting behind the Marina Park kiosk. Pick it up on foot, then drive it to the drop at the Docks. No police attention.',
    objective: 'Collect the package, then deliver it to the Docks',
    target: { x: 560, y: 1420 }, target2: { x: 2500, y: 2100 }, needCar: false, pay: 900, wantedOnStart: 0,
  },
  {
    id: 'm3', title: 'Getaway Driver', giver: 'Eddie Voss',
    brief: 'Eddie knocked over a jewellery store and the cops are already rolling. Get in the car, shake the heat and reach the safehouse before the timer runs out.',
    objective: 'Reach the safehouse in 90 seconds with the police on you',
    target: { x: 2500, y: 560 }, needCar: true, pay: 1400, wantedOnStart: 2, timer: 90,
  },
  {
    id: 'm4', title: 'The Shakedown', giver: 'Eddie Voss',
    brief: 'The Vipers moved into Little Havana and they are taxing Rosa\'s shops. Go on foot and deal with three of them. You have a pistol now — aim with the mouse, click to shoot.',
    objective: 'Take down 3 Vipers in Little Havana',
    target: { x: 1500, y: 2100 }, needCar: false, pay: 1800, wantedOnStart: 0, foes: 3,
  },
  {
    id: 'm5', title: 'The Bank Job', giver: 'Mama Rosa',
    brief: 'The big one. Hit the Solmar National Bank, grab the cash, then lose a three-star wanted level and get to the beach house. Rosa is counting on you.',
    objective: 'Rob the bank, then escape to the beach house',
    target: { x: 1500, y: 560 }, target2: { x: 560, y: 2700 }, needCar: false, pay: 3200, wantedOnStart: 0, wantedAfter: 3,
  },
  {
    id: 'm6', title: 'King of Solmar', giver: 'Mama Rosa',
    brief: 'One last delivery: the yacht at the marina is leaving at dawn and the whole city wants what is in the case. Drive it to the pier. Finish this and Solmar is yours.',
    objective: 'Deliver the case to the yacht at the marina pier',
    target: { x: 2900, y: 2700 }, needCar: true, pay: 5000, wantedOnStart: 2, timer: 120,
  },
];

export const CONTROLS = [
  ['W A S D / arrows', 'Walk / drive'],
  ['Shift', 'Run (on foot)'],
  ['E', 'Enter / steal a car, exit a car'],
  ['Space', 'Handbrake (driving) / punch (on foot)'],
  ['Mouse + click', 'Aim and shoot (on foot)'],
  ['T', 'Taxi job: pick up / drop off'],
  ['M', 'Mute sound'],
  ['P / Esc', 'Pause'],
  ['Enter', 'Start mission / continue'],
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
