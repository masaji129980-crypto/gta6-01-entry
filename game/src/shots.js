// Screenshot scenes for ?shot=cover|street|night|title.
// Each one stages a real game state — a car chase, street life, a night pursuit,
// the title screen — by driving the world forward with a scripted autopilot,
// so every screenshot is a frame of the actual game, not a mock-up.
import { STEP, ROADS_X, ROADS_Y, WORLD, clamp } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { makeCar, updatePoliceCar } from './vehicles.js';
import { updatePedestrian, makePedestrian } from './people.js';
import { collideBuildings } from './city.js';

const SAMPLE = STEP;

function nearestRoad(list, value) {
  let best = list[0];
  for (const v of list) if (Math.abs(v - value) < Math.abs(best - value)) best = v;
  return best;
}

// Waypoints along the road grid from the car to a target: drive along the
// current avenue, turn at an intersection, then along the cross avenue.
function planRoute(from, to) {
  const vx = nearestRoad(ROADS_X, to.x);
  const hy = nearestRoad(ROADS_Y, to.y);
  const ry = nearestRoad(ROADS_Y, from.y);
  return [
    { x: vx, y: ry },
    { x: vx, y: hy },
    { x: to.x, y: hy },
  ];
}

// Drive the player's car along a waypoint route, staying on the roads.
function autopilotDrive(world, route, routeIndex) {
  const player = world.player;
  const car = player.car;
  if (!car) return routeIndex;
  let index = routeIndex;
  let target = route[Math.min(index, route.length - 1)];
  if (Math.hypot(target.x - car.x, target.y - car.y) < 34 && index < route.length - 1) {
    index += 1;
    target = route[index];
  }
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Slow down for sharp turns so the car makes the corner instead of
  // grinding along the building on the inside of it.
  const turnSharpness = Math.min(1, Math.abs(diff) / 1.0);
  const targetSpeed = 400 * (1 - turnSharpness * 0.8);
  car.speed += (targetSpeed - car.speed) * Math.min(1, SAMPLE * 4);
  car.angle += clamp(diff, -3.2 * SAMPLE, 3.2 * SAMPLE);
  const nx = car.x + Math.cos(car.angle) * car.speed * SAMPLE;
  const ny = car.y + Math.sin(car.angle) * car.speed * SAMPLE;
  const fixed = collideBuildings(world.city, nx, ny, 24);
  if (fixed.hit) car.speed *= 0.5;
  car.x = clamp(fixed.x, 40, WORLD.size - 40);
  car.y = clamp(fixed.y, 40, WORLD.size - 40);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  return index;
}

function putPlayerInCar(world, modelIndex, x, y, angle) {
  const car = makeCar(x, y, angle, modelIndex, 'player');
  car.speed = 300;
  world.cars.push(car);
  world.player.car = car;
  world.player.onFoot = false;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
}

function stageChase(world, wanted, seconds) {
  world.setWanted(wanted);
  const target = world.missions.objectiveTarget() || { x: 2000, y: 1500 };
  const route = planRoute(world.player, target);
  let routeIndex = 0;
  const trail = [];
  // Police interceptors start behind the player and hunt them down the road.
  const want = world.wanted.unitCount();
  for (let i = 0; i < want; i += 1) {
    const behind = 170 + i * 130;
    const lateral = (i % 2 === 0 ? -1 : 1) * 36;
    const angle = world.player.angle;
    const car = makeCar(
      world.player.x - Math.cos(angle) * behind - Math.sin(angle) * lateral,
      world.player.y - Math.sin(angle) * behind + Math.cos(angle) * lateral,
      angle, 7, 'police',
    );
    car.speed = 420;
    car.siren = true;
    world.policeCars.push(car);
  }
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    routeIndex = autopilotDrive(world, route, routeIndex);
    // The police follow the player's trail down the same roads, staying
    // behind instead of cutting straight through the buildings at them.
    trail.push({ x: world.player.x, y: world.player.y });
    for (let j = 0; j < world.policeCars.length; j += 1) {
      const cop = world.policeCars[j];
      const back = 100 + j * 55;
      const targetPoint = trail[Math.max(0, trail.length - 1 - back)] || world.player;
      updatePoliceCar(cop, targetPoint, SAMPLE, world.city);
    }
    for (const ped of world.peds) updatePedestrian(ped, SAMPLE, world.city, world.random, world.danger);
    world.time += SAMPLE;
    world.clock = (world.clock + SAMPLE * 240) % 86400;
  }
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'title') {
    world.clock = 10 * 3600;
    return { screen: SCREEN_TITLE, label: 'SOLMAR HEAT — title screen' };
  }
  if (name === 'street') {
    // On foot in the Old Town, pedestrians around, a mission waiting.
    world.player.x = 560;
    world.player.y = 560;
    world.player.angle = Math.PI / 4;
    world.clock = 14 * 3600;
    // A busy sidewalk around the player for the shot.
    for (let i = 0; i < 9; i += 1) {
      const ped = makePedestrian(world.random);
      ped.x = clamp(560 + (world.random() - 0.5) * 420, 80, 3120);
      ped.y = clamp(560 + (world.random() - 0.5) * 420, 80, 2400);
      world.peds.push(ped);
    }
    world.missions.start(world);
    for (let i = 0; i < 8 / SAMPLE; i += 1) {
      for (const ped of world.peds) updatePedestrian(ped, SAMPLE, world.city, world.random, world.danger);
      world.time += SAMPLE;
    }
    return { screen: SCREEN_PLAY, label: 'On foot in Old Town — mission 1: First Wheels' };
  }
  if (name === 'night') {
    world.clock = 22 * 3600;
    putPlayerInCar(world, 0, 1500, 1584, 0);
    world.missions.index = 2;
    world.missions.start(world);
    stageChase(world, 4, 6);
    return { screen: SCREEN_PLAY, label: 'Night chase — 4 wanted stars, police on your tail' };
  }
  // cover: a daytime getaway downtown, 3 stars, interceptors behind.
  world.clock = 16.5 * 3600;
  putPlayerInCar(world, 0, 1300, 864, 0);
  world.missions.index = 2;
  world.missions.start(world);
  stageChase(world, 3, 6);
  return { screen: SCREEN_PLAY, label: 'Getaway downtown — 3 wanted stars, mission: Getaway Driver' };
}
