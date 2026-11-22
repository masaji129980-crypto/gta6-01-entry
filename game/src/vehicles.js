// Cars: traffic that follows the road grid, the player's car, and police interceptors.
// Arcade physics on purpose: quick to pick up, with drift on the handbrake.
import { WORLD, ROADS_X, ROADS_Y, CAR, CAR_MODELS, clamp, angleDiff, distance } from './config.js';
import { onRoad, nearestRoadPoint, collideBuildings } from './city.js';

let nextCarId = 1;

export function makeCar(x, y, angle, modelIndex, driver) {
  const model = CAR_MODELS[modelIndex % CAR_MODELS.length];
  return {
    id: nextCarId,
    kind: 'car',
    x, y, angle,
    speed: 0,
    model,
    color: model.color,
    width: 46,
    length: 78,
    driver: driver || 'traffic',
    route: null,
    routeIndex: 0,
    stuck: 0,
    wrecked: false,
    smoke: 0,
  };
}

export function randomParkedCar(random, city) {
  // Parked along a road, just off the driving lane.
  const vertical = random() < 0.5;
  if (vertical) {
    const rx = ROADS_X[Math.floor(random() * ROADS_X.length)];
    const y = 200 + random() * (WORLD.size - 500);
    return makeCar(rx + 22, y, random() < 0.5 ? Math.PI / 2 : -Math.PI / 2, Math.floor(random() * 6), 'parked');
  }
  const ry = ROADS_Y[Math.floor(random() * ROADS_Y.length)];
  const x = 200 + random() * (WORLD.size - 500);
  return makeCar(x, ry + 22, random() < 0.5 ? 0 : Math.PI, Math.floor(random() * 6), 'parked');
}

export function randomTrafficCar(random) {
  const vertical = random() < 0.5;
  if (vertical) {
    const rx = ROADS_X[Math.floor(random() * ROADS_X.length)];
    const y = 150 + random() * (WORLD.size - 300);
    const car = makeCar(rx + (random() < 0.5 ? -16 : 16), y, random() < 0.5 ? Math.PI / 2 : -Math.PI / 2, Math.floor(random() * 7), 'traffic');
    car.speed = 120 + random() * 90;
    car.route = buildRoute(random, car.x, car.y);
    return car;
  }
  const ry = ROADS_Y[Math.floor(random() * ROADS_Y.length)];
  const x = 150 + random() * (WORLD.size - 300);
  const car = makeCar(x, ry + (random() < 0.5 ? -16 : 16), random() < 0.5 ? 0 : Math.PI, Math.floor(random() * 7), 'traffic');
  car.speed = 120 + random() * 90;
  car.route = buildRoute(random, car.x, car.y);
  return car;
}

// A route is a list of intersections to drive through, turning at each one.
export function buildRoute(random, x, y) {
  const points = [];
  let px = x; let py = y;
  for (let i = 0; i < 6; i += 1) {
    const vertical = random() < 0.5;
    if (vertical) {
      const rx = ROADS_X[Math.floor(random() * ROADS_X.length)];
      points.push({ x: rx, y: py });
      px = rx;
    } else {
      const ry = ROADS_Y[Math.floor(random() * ROADS_Y.length)];
      points.push({ x: px, y: ry });
      py = ry;
    }
  }
  return points;
}

export function drivePlayerCar(car, input, dt, city) {
  const forward = input.down('w', 'arrowup');
  const back = input.down('s', 'arrowdown');
  const left = input.down('a', 'arrowleft');
  const right = input.down('d', 'arrowright');
  const brake = input.down(' ');
  const top = CAR.maxSpeed * car.model.speed;
  if (forward) car.speed += CAR.accel * dt;
  if (back) car.speed -= (car.speed > 5 ? CAR.brake : CAR.reverseAccel) * dt;
  if (brake) car.speed *= Math.pow(0.12, dt);
  if (!forward && !back) car.speed *= Math.pow(0.35, dt);
  car.speed = clamp(car.speed, -CAR.maxReverse, top);
  const steerDir = car.speed >= 0 ? 1 : -1;
  const steerAmount = (left ? -1 : 0) + (right ? 1 : 0);
  car.angle += steerAmount * CAR.steer * steerDir * dt * clamp(Math.abs(car.speed) / 140, 0, 1) * (brake ? 1.5 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collideBuildings(city, nx, ny, 24);
  if (fixed.hit && Math.abs(car.speed) > 180) {
    car.speed *= -0.25;
    car.crashFlash = 1;
  } else if (fixed.hit) {
    car.speed *= 0.4;
  }
  car.x = clamp(fixed.x, 40, WORLD.size - 40);
  car.y = clamp(fixed.y, 40, WORLD.size - 40);
  if (car.crashFlash > 0) car.crashFlash -= dt * 3;
}

export function updateTrafficCar(car, dt, city, cars) {
  if (!car.route || car.route.length === 0) return;
  const target = car.route[car.routeIndex % car.route.length];
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 26) {
    car.routeIndex += 1;
    if (car.routeIndex >= car.route.length) {
      car.route = buildRoute(Math.random, car.x, car.y);
      car.routeIndex = 0;
    }
    return;
  }
  const want = Math.atan2(dy, dx);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
  const cruise = 150;
  car.speed += (cruise - car.speed) * dt * 0.8;
  // Slow down for the car ahead.
  for (const other of cars) {
    if (other === car || other.wrecked) continue;
    const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
    const side = Math.abs((other.x - car.x) * Math.sin(car.angle) - (other.y - car.y) * Math.cos(car.angle));
    if (ahead > 0 && ahead < 90 && side < 40) car.speed = Math.min(car.speed, 40);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collideBuildings(city, nx, ny, 24);
  car.x = clamp(fixed.x, 40, WORLD.size - 40);
  car.y = clamp(fixed.y, 40, WORLD.size - 40);
  if (fixed.hit) {
    car.routeIndex += 1;
    car.angle += 0.6;
  }
}

// A police interceptor hunts the player: steer at them, ram them, keep up.
export function updatePoliceCar(car, target, dt, city) {
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -3.4 * dt, 3.4 * dt);
  const d = distance(car.x, car.y, target.x, target.y);
  const top = d > 260 ? 500 : 380;
  car.speed += (top - car.speed) * dt * 0.9;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collideBuildings(city, nx, ny, 24);
  if (fixed.hit) {
    car.speed *= 0.3;
    car.angle += 0.8;
  }
  car.x = clamp(fixed.x, 40, WORLD.size - 40);
  car.y = clamp(fixed.y, 40, WORLD.size - 40);
}

export function nearestCar(cars, x, y, maxDist) {
  let best = null; let bestD = maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = distance(car.x, car.y, x, y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function carsCollide(a, b) {
  const d = distance(a.x, a.y, b.x, b.y);
  if (d < 52 && d > 0.01) {
    const push = (52 - d) / 2;
    const nx = (a.x - b.x) / d;
    const ny = (a.y - b.y) / d;
    a.x += nx * push; a.y += ny * push;
    b.x -= nx * push; b.y -= ny * push;
    const swap = a.speed;
    a.speed = b.speed * 0.5;
    b.speed = swap * 0.5;
    return true;
  }
  return false;
}

export { onRoad, nearestRoadPoint };
