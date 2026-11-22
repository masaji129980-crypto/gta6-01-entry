// The story mission chain: one active mission at a time, with stages,
// a timer where the story needs one, and cash on completion.
import { MISSIONS, distance } from './config.js';
import { makeGangMember } from './people.js';

export class MissionManager {
  constructor() {
    this.index = 0; // which mission is next
    this.active = null; // { def, stage, timer, foesLeft }
    this.message = '';
    this.messageTimer = 0;
    this.completedCount = 0;
    this.totalEarned = 0;
  }

  get current() {
    return MISSIONS[this.index] || null;
  }

  get allDone() {
    return this.index >= MISSIONS.length;
  }

  start(world) {
    const def = this.current;
    if (!def || this.active) return false;
    const foes = [];
    if (def.foes) {
      for (let i = 0; i < def.foes; i += 1) {
        foes.push(makeGangMember(def.target.x + (i - 1) * 90, def.target.y + (i % 2) * 70 - 35));
      }
    }
    this.active = {
      def,
      stage: 0,
      timer: def.timer || 0,
      foes,
      foesLeft: def.foes || 0,
      grabbed: false,
    };
    if (def.wantedOnStart > 0) world.setWanted(def.wantedOnStart);
    this.showMessage(`${def.title} — ${def.giver}`, 4);
    world.sound.missionStart();
    return true;
  }

  showMessage(text, seconds) {
    this.message = text;
    this.messageTimer = seconds;
  }

  update(world, dt) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    const mission = this.active;
    if (!mission) return;
    const player = world.player;
    if (mission.timer > 0) {
      mission.timer -= dt;
      if (mission.timer <= 0) {
        this.fail(world, 'Out of time!');
        return;
      }
    }
    const def = mission.def;
    const target = mission.stage === 0 ? def.target : def.target2;
    if (mission.foesLeft > 0) {
      if (mission.foes.every((f) => f.health <= 0)) {
        this.complete(world);
      }
      return;
    }
    if (!target) return;
    const inCar = !!player.car;
    const needCar = mission.stage === 0 ? def.needCar : false;
    const d = distance(player.x, player.y, target.x, target.y);
    const ok = needCar ? (inCar && d < 110) : d < 70;
    if (!ok) return;
    if (mission.stage === 0 && def.target2) {
      mission.stage = 1;
      mission.grabbed = true;
      if (def.id === 'm5') world.setWanted(def.wantedAfter || 3);
      this.showMessage('Got it — now get to the next marker!', 3);
      world.sound.pickup();
      return;
    }
    this.complete(world);
  }

  complete(world) {
    const mission = this.active;
    const pay = mission.def.pay;
    world.player.cash += pay;
    this.totalEarned += pay;
    this.completedCount += 1;
    this.index += 1;
    this.active = null;
    this.showMessage(`Mission complete — +$${pay}`, 4);
    world.sound.cash();
    world.sound.missionDone();
    world.saveGame();
  }

  fail(world, reason) {
    this.active = null;
    this.showMessage(`Mission failed: ${reason} — press Enter to retry`, 5);
    world.sound.busted();
    if (world.player.car) world.player.car.speed = 0;
  }

  // Where the HUD and minimap should point right now.
  objectiveTarget() {
    if (!this.active) return null;
    const def = this.active.def;
    if (this.active.foesLeft > 0) {
      const alive = this.active.foes.find((f) => f.health > 0);
      return alive ? { x: alive.x, y: alive.y } : null;
    }
    return this.active.stage === 0 ? def.target : def.target2;
  }

  objectiveText() {
    if (this.allDone) return 'Story complete — you are the King of Solmar. Free roam!';
    if (!this.active) {
      const next = this.current;
      return `Next mission: ${next.title} — press Enter to start`;
    }
    let text = this.active.def.objective;
    if (this.active.timer > 0) text += `  (${Math.ceil(this.active.timer)}s)`;
    if (this.active.foesLeft > 0) {
      const left = this.active.foes.filter((f) => f.health > 0).length;
      text += `  (${left} left)`;
    }
    return text;
  }
}
