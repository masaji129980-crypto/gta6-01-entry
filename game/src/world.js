// The world: everything that lives in Solmar and how it changes each frame —
// the player on foot and in cars, traffic, pedestrians, police, bullets,
// pickups, taxi jobs, the day/night clock, and saving.
import {
  WORLD, PLAYER, CAR, POLICE, BEACH, clamp, distance, angleTo, angleDiff, mulberry32,
} from './config.js';
import { buildCity, collideBuildings, insideBuilding } from './city.js';
import {
  makeCar, randomParkedCar, randomTrafficCar, drivePlayerCar, updateTrafficCar,
  updatePoliceCar, nearestCar, carsCollide,
} from './vehicles.js';
import {
  makePedestrian, makeCop, updatePedestrian, updateCop, updateGangMember, scareNearbyPeds,
} from './people.js';
import { MissionManager } from './missions.js';
import { Wanted } from './police.js';
import { Sound } from './audio.js';

export const SAVE_KEY = 'solmar-heat-save-v1';

export class World {
  constructor(seed) {
    this.seed = seed;
    this.random = mulberry32(seed);
    this.city = buildCity(seed);
    this.sound = new Sound();
    this.missions = new MissionManager();
    this.wanted = new Wanted();
    this.time = 0;
    this.clock = 10 * 3600; // 10:00 in the morning
    this.reset();
  }

  reset() {
    this.player = {
      x: 1180, y: 1560, angle: -Math.PI / 2,
      speed: 0, health: PLAYER.maxHealth, cash: 250,
      car: null, onFoot: true, ammo: 24, wanted: 0,
      punchCooldown: 0, shootCooldown: 0, invulnerable: 0,
    };
    this.cars = [];
    this.peds = [];
    this.cops = [];
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.policeCars = [];
    this.taxi = { active: false, passenger: null, stage: 0, fare: 0 };
    this.busted = false;
    this.wasted = false;
    this.message = '';
    this.messageTimer = 0;
    this.danger = { x: 0, y: 0 };
    this.sprayCooldown = 0;
    // Parked cars the player can steal, and traffic already on the roads.
    for (let i = 0; i < 14; i += 1) this.cars.push(randomParkedCar(this.random, this.city));
    for (let i = 0; i < 16; i += 1) this.cars.push(randomTrafficCar(this.random));
    for (let i = 0; i < 34; i += 1) this.peds.push(makePedestrian(this.random));
    // Hidden cash bundles to find around the city.
    for (let i = 0; i < 10; i += 1) {
      this.pickups.push({
        x: 200 + this.random() * 2800,
        y: 200 + this.random() * 2300,
        kind: 'cash', amount: 100 + Math.floor(this.random() * 4) * 50, taken: false,
      });
    }
    this.pickups.push({ x: 560, y: 560, kind: 'health', amount: 50, taken: false });
    this.pickups.push({ x: 2900, y: 560, kind: 'health', amount: 50, taken: false });
    this.pickups.push({ x: 560, y: 2400, kind: 'ammo', amount: 24, taken: false });
  }

  setWanted(level) {
    this.wanted.set(level);
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.player.cash = data.cash || 250;
      this.player.x = data.x || 1180;
      this.player.y = data.y || 1560;
      this.missions.index = data.missionIndex || 0;
      this.missions.completedCount = data.completedCount || 0;
      this.missions.totalEarned = data.totalEarned || 0;
      return true;
    } catch {
      return false;
    }
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.player.cash,
        x: this.player.x, y: this.player.y,
        missionIndex: this.missions.index,
        completedCount: this.missions.completedCount,
        totalEarned: this.missions.totalEarned,
      }));
    } catch { /* storage unavailable: the game still plays */ }
  }

  showMessage(text, seconds) {
    this.message = text;
    this.messageTimer = seconds;
  }

  update(input, dt, camera) {
    this.time += dt;
    this.clock = (this.clock + dt * 240) % 86400; // a full day in 6 minutes
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.sprayCooldown > 0) this.sprayCooldown -= dt;
    const player = this.player;
    if (this.busted || this.wasted) {
      if (input.justPressed('enter')) this.respawn();
      return;
    }
    this.handlePlayer(input, dt, camera);
    this.handleMissions(input, dt);
    this.handleTaxi(input, dt);
    this.handlePickups(dt);
    this.handleSprayShop(dt);
    this.updateCars(dt);
    this.updatePeople(dt);
    this.updatePolice(dt);
    this.updateBullets(dt);
    this.updateParticles(dt);
    this.missions.update(this, dt);
    // Wanted heat cools when no police unit can see the player.
    const seen = this.policeCars.some((c) => distance(c.x, c.y, player.x, player.y) < 520)
      || this.cops.some((c) => distance(c.x, c.y, player.x, player.y) < 320);
    this.wanted.update(dt, seen);
    player.wanted = this.wanted.stars;
    this.sound.siren(this.wanted.stars > 0);
    this.sound.engine(player.car ? Math.abs(player.car.speed) / CAR.maxSpeed : 0);
    this.sound.music(dt, true);
    if (player.health <= 0) {
      this.wasted = true;
      this.sound.busted();
      this.explosion(player.x, player.y, '#e33f2e');
    }
  }

  handlePlayer(input, dt, camera) {
    const player = this.player;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.shootCooldown > 0) player.shootCooldown -= dt;
    if (player.car) {
      drivePlayerCar(player.car, input, dt, this.city);
      player.x = player.car.x;
      player.y = player.car.y;
      player.angle = player.car.angle;
      if (input.justPressed('e')) this.exitCar();
      if (input.justPressed(' ')) { /* handbrake handled in drivePlayerCar */ }
      return;
    }
    // On foot: WASD moves, Shift runs, mouse aims.
    let mx = (input.down('d', 'arrowright') ? 1 : 0) - (input.down('a', 'arrowleft') ? 1 : 0);
    let my = (input.down('s', 'arrowdown') ? 1 : 0) - (input.down('w', 'arrowup') ? 1 : 0);
    const run = input.down('shift');
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
      player.speed = speed;
      const nx = player.x + mx * speed * dt;
      const ny = player.y + my * speed * dt;
      const fixed = collideBuildings(this.city, nx, ny, PLAYER.radius);
      player.x = clamp(fixed.x, 40, WORLD.size - 40);
      player.y = clamp(fixed.y, 40, WORLD.size - 40);
      player.angle = Math.atan2(my, mx);
    } else {
      player.speed = 0;
    }
    // Aim at the mouse (screen space -> world space via the camera).
    if (camera) {
      const wx = camera.x + (input.mouse.x - camera.w / 2) / camera.zoom;
      const wy = camera.y + (input.mouse.y - camera.h / 2) / camera.zoom;
      if (distance(wx, wy, player.x, player.y) > 30) {
        player.aimAngle = Math.atan2(wy - player.y, wx - player.x);
      }
    }
    if (input.justPressed('e')) this.tryEnterCar();
    if (input.mouse.clicked && player.ammo > 0 && player.shootCooldown <= 0) this.shoot();
    if (input.justPressed(' ') && player.punchCooldown <= 0) this.punch();
  }

  tryEnterCar() {
    const player = this.player;
    const car = nearestCar(this.cars, player.x, player.y, 70);
    if (!car) return;
    if (car.driver === 'parked' || car.driver === 'traffic') {
      if (car.driver === 'parked') {
        this.wanted.commitCrime(8);
        this.showMessage('Car stolen! The owner called it in.', 2.5);
      } else {
        this.wanted.commitCrime(14);
        this.showMessage('You yanked the driver out!', 2.5);
        this.peds.push(makePedestrian(this.random));
      }
      this.sound.pickup();
    }
    car.driver = 'player';
    player.car = car;
    player.onFoot = false;
  }

  exitCar() {
    const player = this.player;
    const car = player.car;
    if (!car) return;
    car.speed *= 0.2;
    car.driver = 'parked';
    player.car = null;
    player.onFoot = true;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
  }

  shoot() {
    const player = this.player;
    player.ammo -= 1;
    player.shootCooldown = 0.28;
    const angle = player.aimAngle ?? player.angle;
    this.bullets.push({
      x: player.x + Math.cos(angle) * 20,
      y: player.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900,
      life: 0.6, friendly: true,
    });
    this.sound.shoot();
    this.wanted.commitCrime(6);
    this.danger = { x: player.x, y: player.y };
    scareNearbyPeds(this.peds, player.x, player.y, 320);
  }

  punch() {
    const player = this.player;
    player.punchCooldown = 0.4;
    this.sound.punch();
    const range = 46;
    const px = player.x + Math.cos(player.angle) * range;
    const py = player.y + Math.sin(player.angle) * range;
    for (const ped of this.peds) {
      if (distance(ped.x, ped.y, px, py) < 30) {
        this.wanted.commitCrime(12);
        this.showMessage('You hit a pedestrian! The cops are coming.', 2.5);
        ped.flee = 4;
        this.danger = { x: player.x, y: player.y };
      }
    }
    for (const foe of this.missions.active?.foes || []) {
      if (foe.health > 0 && distance(foe.x, foe.y, px, py) < 34) {
        foe.health -= PLAYER.punchDamage;
        this.particles.push({ x: foe.x, y: foe.y, vx: 0, vy: -30, life: 0.5, max: 0.5, color: '#ffd166', size: 5 });
      }
    }
  }

  handleMissions(input, dt) {
    if (input.justPressed('enter') && !this.missions.active && !this.missions.allDone) {
      this.missions.start(this);
    }
  }

  handleTaxi(input, dt) {
    const player = this.player;
    const taxi = this.taxi;
    if (!taxi.active) {
      // A taxi job starts when the player is driving a cab and presses T.
      if (input.justPressed('t') && player.car && player.car.model.kind === 'taxi') {
        const dest = this.randomRoadPoint();
        taxi.active = true;
        taxi.stage = 0;
        taxi.destination = dest;
        taxi.fare = 150 + Math.floor(this.random() * 4) * 50;
        taxi.pickupPoint = this.randomRoadPointNear(player.x, player.y, 500);
        this.showMessage(`Taxi job: pick up the fare at the marker ($${taxi.fare})`, 3);
      }
      return;
    }
    const target = taxi.stage === 0 ? taxi.pickupPoint : taxi.destination;
    if (distance(player.x, player.y, target.x, target.y) < 90) {
      if (taxi.stage === 0) {
        taxi.stage = 1;
        this.showMessage('Passenger aboard — drive to the destination!', 3);
        this.sound.pickup();
      } else {
        player.cash += taxi.fare;
        this.showMessage(`Fare complete — +$${taxi.fare}`, 3);
        this.sound.cash();
        taxi.active = false;
        this.saveGame();
      }
    }
  }

  randomRoadPoint() {
    const vertical = this.random() < 0.5;
    if (vertical) {
      const rx = 144 + Math.floor(this.random() * 8) * 360;
      return { x: rx, y: 200 + this.random() * 2400 };
    }
    const ry = 144 + Math.floor(this.random() * 8) * 360;
    return { x: 200 + this.random() * 2800, y: ry };
  }

  randomRoadPointNear(x, y, radius) {
    const p = this.randomRoadPoint();
    return { x: clamp(p.x, x - radius, x + radius), y: clamp(p.y, y - radius, y + radius) };
  }

  handlePickups(dt) {
    const player = this.player;
    for (const pickup of this.pickups) {
      if (pickup.taken) continue;
      if (distance(player.x, player.y, pickup.x, pickup.y) < 40) {
        pickup.taken = true;
        if (pickup.kind === 'cash') {
          player.cash += pickup.amount;
          this.showMessage(`Found hidden cash: +$${pickup.amount}`, 2.5);
          this.sound.cash();
        } else if (pickup.kind === 'health') {
          player.health = Math.min(PLAYER.maxHealth, player.health + pickup.amount);
          this.showMessage(`Health +${pickup.amount}`, 2.5);
          this.sound.pickup();
        } else {
          player.ammo += pickup.amount;
          this.showMessage(`Ammo +${pickup.amount}`, 2.5);
          this.sound.pickup();
        }
        this.saveGame();
      }
    }
  }

  handleSprayShop(dt) {
    const player = this.player;
    if (this.wanted.stars === 0 || !player.car || this.sprayCooldown > 0) return;
    if (distance(player.x, player.y, 2100, 1750) < 110 && player.cash >= 200) {
      player.cash -= 200;
      this.wanted.clear();
      this.policeCars.length = 0;
      this.cops.length = 0;
      this.sprayCooldown = 5;
      this.showMessage('Resprayed — wanted level cleared ($200)', 3);
      this.sound.cash();
      this.saveGame();
    }
  }

  updateCars(dt) {
    const player = this.player;
    const all = [...this.cars, ...this.policeCars];
    for (const car of this.cars) {
      if (car.driver === 'traffic') updateTrafficCar(car, dt, this.city, all);
    }
    // Car-on-car collisions.
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        if (carsCollide(all[i], all[j])) {
          if (all[i] === player.car || all[j] === player.car) {
            if (Math.abs(player.car.speed) > 240) {
              player.health -= 6;
              this.sound.crash();
            }
          }
        }
      }
    }
    // Traffic respawns far away so the streets never empty out.
    if (this.cars.filter((c) => c.driver === 'traffic').length < 12) {
      this.cars.push(randomTrafficCar(this.random));
    }
    // A parked car the player wrecks into a building smokes.
    for (const car of all) {
      if (car.crashFlash > 0 && this.random() < 0.3) {
        this.particles.push({
          x: car.x, y: car.y, vx: (this.random() - 0.5) * 40, vy: -50 - this.random() * 40,
          life: 0.8, max: 0.8, color: '#999999', size: 4,
        });
      }
    }
  }

  updatePeople(dt) {
    const player = this.player;
    for (const ped of this.peds) updatePedestrian(ped, dt, this.city, this.random, this.danger);
    // A cop on foot grabs the player when they get close.
    for (const cop of this.cops) {
      updateCop(cop, dt, this.city, player);
      if (!player.car && distance(cop.x, cop.y, player.x, player.y) < 26 && player.invulnerable <= 0) {
        this.busted = true;
        this.sound.busted();
      }
    }
    // Mission gang members.
    const foes = this.missions.active?.foes || [];
    for (const foe of foes) {
      if (foe.health <= 0) continue;
      updateGangMember(foe, dt, this.city, player);
      if (distance(foe.x, foe.y, player.x, player.y) < 30 && player.invulnerable <= 0) {
        player.health -= 14;
        player.invulnerable = 0.8;
        this.sound.punch();
      }
    }
  }

  updatePolice(dt) {
    const player = this.player;
    const want = this.wanted.unitCount();
    // Spawn units up to the wanted level, retire them when the heat is gone.
    if (this.wanted.stars > 0 && this.policeCars.length + this.cops.length < want) {
      const car = this.wanted.spawnUnit(this, this.random);
      this.policeCars.push(car);
    }
    if (this.wanted.stars === 0 && this.policeCars.length > 0) {
      this.policeCars.length = 0;
      this.cops.length = 0;
    }
    for (const car of this.policeCars) {
      updatePoliceCar(car, player, dt, this.city);
      const d = distance(car.x, car.y, player.x, player.y);
      if (d < 60) {
        if (player.car) {
          if (Math.abs(car.speed) > 200) {
            player.health -= 4;
            this.sound.crash();
          }
          // Ram the player's car to a crawl.
          player.car.speed *= 0.96;
        } else if (this.cops.length < 2 && this.random() < 0.02) {
          // A cop gets out and chases on foot.
          this.cops.push(makeCop(car.x + 30, car.y + 30));
        }
      }
    }
    // Police gunfire when the player is wanted and on foot, from a distance.
    if (this.wanted.stars >= 2 && !player.car && this.random() < dt * 0.6 && this.policeCars.length > 0) {
      const shooter = this.policeCars[0];
      const angle = angleTo(shooter.x, shooter.y, player.x, player.y) + (this.random() - 0.5) * 0.3;
      this.bullets.push({
        x: shooter.x, y: shooter.y,
        vx: Math.cos(angle) * 700, vy: Math.sin(angle) * 700,
        life: 0.9, friendly: false,
      });
      this.sound.shoot();
    }
  }

  updateBullets(dt) {
    const player = this.player;
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0) continue;
      if (bullet.friendly) {
        for (const foe of this.missions.active?.foes || []) {
          if (foe.health > 0 && distance(foe.x, foe.y, bullet.x, bullet.y) < 20) {
            foe.health -= PLAYER.bulletDamage;
            bullet.life = 0;
            this.particles.push({ x: foe.x, y: foe.y, vx: 0, vy: -40, life: 0.4, max: 0.4, color: '#e33f2e', size: 5 });
          }
        }
        for (const cop of this.cops) {
          if (distance(cop.x, cop.y, bullet.x, bullet.y) < 18) {
            bullet.life = 0;
            this.wanted.commitCrime(10);
          }
        }
        for (const ped of this.peds) {
          if (distance(ped.x, ped.y, bullet.x, bullet.y) < 16) {
            bullet.life = 0;
            ped.flee = 4;
            this.wanted.commitCrime(10);
            this.danger = { x: player.x, y: player.y };
          }
        }
      } else if (!player.car && player.invulnerable <= 0 && distance(player.x, player.y, bullet.x, bullet.y) < 16) {
        player.health -= 8;
        player.invulnerable = 0.4;
        bullet.life = 0;
      }
      if (insideBuilding(this.city, bullet.x, bullet.y)) bullet.life = 0;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  explosion(x, y, color) {
    for (let i = 0; i < 26; i += 1) {
      const a = this.random() * Math.PI * 2;
      const s = 60 + this.random() * 220;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.6 + this.random() * 0.6, max: 1.2, color: i % 3 === 0 ? '#ffd166' : color, size: 4 + this.random() * 5,
      });
    }
  }

  respawn() {
    const lost = Math.min(this.player.cash, 150);
    this.player.cash -= lost;
    this.player.health = PLAYER.maxHealth;
    this.player.x = 560;
    this.player.y = 560;
    this.player.car = null;
    this.player.onFoot = true;
    this.player.invulnerable = 3;
    this.wanted.clear();
    this.policeCars.length = 0;
    this.cops.length = 0;
    this.busted = false;
    this.wasted = false;
    this.showMessage(`You woke up at St. Mary Hospital. Lost $${lost}.`, 4);
    this.saveGame();
  }

  isNight() {
    const hour = this.clock / 3600;
    return hour < 6 || hour >= 19;
  }

  timeLabel() {
    const hour = Math.floor(this.clock / 3600);
    const minute = Math.floor((this.clock % 3600) / 60);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
}
