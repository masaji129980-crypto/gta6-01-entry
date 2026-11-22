// The wanted system: stars rise with crimes, police spawn to match them,
// and the heat cools off when the player stays out of sight.
import { POLICE, clamp } from './config.js';
import { makeCar } from './vehicles.js';

export class Wanted {
  constructor() {
    this.stars = 0;
    this.heat = 0; // 0..100, fills toward the next star
    this.coolTimer = 0;
    this.seenTimer = 0;
  }

  set(level) {
    this.stars = clamp(level, 0, POLICE.maxWanted);
    this.heat = this.stars * 20;
    this.coolTimer = 0;
  }

  commitCrime(amount) {
    this.heat += amount;
    this.coolTimer = 0;
    const level = Math.min(POLICE.maxWanted, Math.floor(this.heat / 20));
    if (level > this.stars) {
      this.stars = level;
      return true; // rose a star
    }
    return false;
  }

  clear() {
    this.stars = 0;
    this.heat = 0;
    this.coolTimer = 0;
  }

  update(dt, playerVisible) {
    if (this.stars === 0) return;
    if (playerVisible) {
      this.seenTimer = 2;
      this.coolTimer = 0;
    } else {
      this.coolTimer += dt;
      if (this.coolTimer > POLICE.decaySeconds) {
        this.stars -= 1;
        this.heat = this.stars * 20;
        this.coolTimer = 0;
      }
    }
  }

  // How many police units the current wanted level fields.
  unitCount() {
    return this.stars <= 1 ? 1 : this.stars <= 2 ? 2 : this.stars <= 3 ? 3 : this.stars <= 4 ? 4 : 6;
  }

  // Spawn a police car at the edge of the player's view, on a road.
  spawnUnit(world, random) {
    const player = world.player;
    const angle = random() * Math.PI * 2;
    const x = player.x + Math.cos(angle) * POLICE.spawnDistance;
    const y = player.y + Math.sin(angle) * POLICE.spawnDistance;
    const car = makeCar(
      Math.max(80, Math.min(3120, x)),
      Math.max(80, Math.min(3120, y)),
      Math.atan2(player.y - y, player.x - x),
      7, 'police',
    );
    car.speed = 300;
    car.siren = true;
    return car;
  }
}
