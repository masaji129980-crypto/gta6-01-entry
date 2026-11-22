// People on foot: pedestrians strolling the sidewalks, cops who chase on foot,
// gang members for the shakedown mission, and taxi passengers.
import { WORLD, PLAYER, clamp, distance, angleTo, angleDiff } from './config.js';
import { onRoad, collideBuildings, insideBuilding } from './city.js';

const SKINS = ['#f2c89b', '#c98d5f', '#8a5a3b', '#e8b48a', '#6b4423'];
const SHIRTS = ['#e33f2e', '#2e6fe3', '#37b24d', '#e3c52e', '#8e44ad', '#f2f2f2', '#14181f', '#ff8c42'];

let nextPersonId = 1;

export function makePedestrian(random) {
  const x = 200 + random() * (WORLD.size - 400);
  const y = 200 + random() * (WORLD.size - 700);
  return {
    id: nextPersonId,
    kind: 'ped',
    x, y,
    angle: random() * Math.PI * 2,
    speed: 40 + random() * 40,
    skin: SKINS[Math.floor(random() * SKINS.length)],
    shirt: SHIRTS[Math.floor(random() * SHIRTS.length)],
    walkPhase: random() * 6,
    target: null,
    flee: 0,
    state: 'walk',
  };
}

export function makeCop(x, y) {
  return {
    id: nextPersonId,
    kind: 'cop',
    x, y,
    angle: 0,
    speed: 190,
    skin: SKINS[1],
    shirt: '#1c2f4d',
    walkPhase: 0,
    target: null,
    flee: 0,
    state: 'chase',
  };
}

export function makeGangMember(x, y) {
  return {
    id: nextPersonId,
    kind: 'gang',
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 120,
    skin: SKINS[2],
    shirt: '#5a1f1f',
    walkPhase: 0,
    target: null,
    flee: 0,
    state: 'guard',
    health: 100,
  };
}

function pickStrollTarget(person, random) {
  // Stroll along a nearby road, staying on the sidewalk.
  const vertical = random() < 0.5;
  if (vertical) {
    const rx = 144 + Math.floor(random() * 8) * 360;
    return { x: rx + (random() < 0.5 ? -46 : 46), y: person.y + (random() - 0.5) * 500 };
  }
  const ry = 144 + Math.floor(random() * 8) * 360;
  return { x: person.x + (random() - 0.5) * 500, y: ry + (random() < 0.5 ? -46 : 46) };
}

export function updatePedestrian(person, dt, city, random, danger) {
  person.walkPhase += dt * 8;
  if (person.flee > 0) {
    person.flee -= dt;
    // Run away from the danger point.
    const away = angleTo(danger.x, danger.y, person.x, person.y);
    person.angle += angleDiff(person.angle, away) * dt * 6;
    person.x += Math.cos(person.angle) * person.speed * 2.4 * dt;
    person.y += Math.sin(person.angle) * person.speed * 2.4 * dt;
  } else {
    if (!person.target || distance(person.x, person.y, person.target.x, person.target.y) < 20) {
      person.target = pickStrollTarget(person, random);
    }
    const want = angleTo(person.x, person.y, person.target.x, person.target.y);
    person.angle += angleDiff(person.angle, want) * dt * 4;
    person.x += Math.cos(person.angle) * person.speed * dt;
    person.y += Math.sin(person.angle) * person.speed * dt;
  }
  person.x = clamp(person.x, 60, WORLD.size - 60);
  person.y = clamp(person.y, 60, WORLD.size - 60);
  const fixed = collideBuildings(city, person.x, person.y, 12);
  person.x = fixed.x;
  person.y = fixed.y;
}

export function updateCop(cop, dt, city, player) {
  cop.walkPhase += dt * 10;
  const want = angleTo(cop.x, cop.y, player.x, player.y);
  cop.angle += angleDiff(cop.angle, want) * dt * 5;
  cop.x += Math.cos(cop.angle) * cop.speed * dt;
  cop.y += Math.sin(cop.angle) * cop.speed * dt;
  const fixed = collideBuildings(city, cop.x, cop.y, 12);
  cop.x = fixed.x;
  cop.y = fixed.y;
}

export function updateGangMember(foe, dt, city, player) {
  foe.walkPhase += dt * 8;
  const d = distance(foe.x, foe.y, player.x, player.y);
  if (d < 320) {
    // A Viper charges the player when they get close.
    const want = angleTo(foe.x, foe.y, player.x, player.y);
    foe.angle += angleDiff(foe.angle, want) * dt * 5;
    foe.x += Math.cos(foe.angle) * foe.speed * dt;
    foe.y += Math.sin(foe.angle) * foe.speed * dt;
  } else {
    foe.angle += dt * 0.5;
  }
  const fixed = collideBuildings(city, foe.x, foe.y, 12);
  foe.x = fixed.x;
  foe.y = fixed.y;
}

export function scareNearbyPeds(peds, x, y, radius) {
  for (const ped of peds) {
    if (distance(ped.x, ped.y, x, y) < radius) ped.flee = 2.5;
  }
}
