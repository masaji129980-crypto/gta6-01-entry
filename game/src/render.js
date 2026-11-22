// Everything the player sees: the city from above, the cars and people in it,
// the day/night light, the HUD with its minimap, and the title, pause and
// busted screens. All drawn with the 2D canvas, no images.
import { WORLD, ROADS_X, ROADS_Y, BEACH, PLAYER, clamp, distance } from './config.js';
import { DISTRICTS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const ROAD_COLOR = '#3a3f47';
const SIDEWALK = '#8d8578';
const GRASS = '#5d8a4a';
const SAND = '#e0c98f';
const WATER = '#2a7fa8';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0, w: 1280, h: 800, zoom: 1 };
  }

  resize(width, height, dpr) {
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.camera.w = width;
    this.camera.h = height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  follow(player, dt) {
    const target = { x: player.x, y: player.y };
    const k = 1 - Math.pow(0.001, dt);
    this.camera.x += (target.x - this.camera.x) * k;
    this.camera.y += (target.y - this.camera.y) * k;
    const zoomTarget = player.car ? 0.85 : 1.0;
    this.camera.zoom += (zoomTarget - this.camera.zoom) * k;
  }

  worldToScreen(x, y) {
    const cam = this.camera;
    return {
      x: (x - cam.x) * cam.zoom + cam.w / 2,
      y: (y - cam.y) * cam.zoom + cam.h / 2,
    };
  }

  draw(world, screen, shotLabel) {
    const ctx = this.ctx;
    const cam = this.camera;
    const { w, h } = cam;
    this.timeNow = world.time;
    this.night = world.isNight();
    ctx.clearRect(0, 0, w, h);
    if (screen === SCREEN_TITLE) {
      this.drawCity(world, 0.7);
      this.drawTitle(world);
      return;
    }
    this.drawCity(world, 1);
    this.drawPickups(world);
    this.drawCars(world);
    this.drawPeople(world);
    this.drawPlayer(world);
    this.drawBullets(world);
    this.drawParticles(world);
    this.drawNight(world);
    this.drawHud(world, screen);
    if (world.busted) this.drawOverlay('BUSTED!', 'The Solmar PD picked you up. Press Enter to wake up at the hospital.', '#2e6fe3');
    else if (world.wasted) this.drawOverlay('WASTED', 'You did not make it out of Solmar. Press Enter to try again.', '#e33f2e');
    else if (screen === SCREEN_PAUSE) this.drawOverlay('PAUSED', 'Press P or Esc to keep playing. M mutes the sound.', '#f2f2f2');
    if (shotLabel) {
      ctx.font = '13px sans-serif';
      const lw = ctx.measureText(shotLabel).width + 24;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(12, 96, lw, 24);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(shotLabel, 24, 113);
    }
  }

  drawCity(world, detail) {
    const ctx = this.ctx;
    const cam = this.camera;
    const view = {
      x0: cam.x - cam.w / 2 / cam.zoom - 80,
      y0: cam.y - cam.h / 2 / cam.zoom - 80,
      x1: cam.x + cam.w / 2 / cam.zoom + 80,
      y1: cam.y + cam.h / 2 / cam.zoom + 80,
    };
    // Grass base, then the beach and the sea along the south edge.
    ctx.fillStyle = GRASS;
    ctx.fillRect(0, 0, cam.w, cam.h);
    const sand = this.worldToScreen(0, BEACH.y);
    const water = this.worldToScreen(0, BEACH.waterY);
    ctx.fillStyle = SAND;
    ctx.fillRect(0, sand.y, cam.w, water.y - sand.y);
    ctx.fillStyle = WATER;
    ctx.fillRect(0, water.y, cam.w, cam.h - water.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, water.y + Math.sin(world.time * 1.4) * 3);
    ctx.lineTo(cam.w, water.y + Math.cos(world.time * 1.1) * 3);
    ctx.stroke();
    // District ground tint.
    for (const d of DISTRICTS) {
      if (d.kind !== 'park') continue;
      const p = this.worldToScreen(d.x, d.y);
      ctx.fillStyle = '#4d8a4f';
      ctx.fillRect(p.x, p.y, d.w * cam.zoom, d.h * cam.zoom);
    }
    // Roads.
    ctx.fillStyle = ROAD_COLOR;
    for (const rx of ROADS_X) {
      const p = this.worldToScreen(rx - WORLD.road / 2, 0);
      ctx.fillRect(p.x, 0, WORLD.road * cam.zoom, cam.h);
    }
    for (const ry of ROADS_Y) {
      const p = this.worldToScreen(0, ry - WORLD.road / 2);
      ctx.fillRect(0, p.y, cam.w, WORLD.road * cam.zoom);
    }
    // Sidewalks.
    ctx.fillStyle = SIDEWALK;
    for (const rx of ROADS_X) {
      const p = this.worldToScreen(rx - WORLD.road / 2 - 10, 0);
      ctx.fillRect(p.x, 0, 10 * cam.zoom, cam.h);
      const q = this.worldToScreen(rx + WORLD.road / 2, 0);
      ctx.fillRect(q.x, 0, 10 * cam.zoom, cam.h);
    }
    for (const ry of ROADS_Y) {
      const p = this.worldToScreen(0, ry - WORLD.road / 2 - 10);
      ctx.fillRect(0, p.y, cam.w, 10 * cam.zoom);
      const q = this.worldToScreen(0, ry + WORLD.road / 2);
      ctx.fillRect(0, q.y, cam.w, 10 * cam.zoom);
    }
    // Lane dashes.
    ctx.strokeStyle = 'rgba(240,220,90,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    for (const rx of ROADS_X) {
      const p = this.worldToScreen(rx, 0);
      ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, cam.h); ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      const p = this.worldToScreen(0, ry);
      ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(cam.w, p.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Buildings with a drop shadow and a darker roof.
    for (const b of world.city.buildings) {
      if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0) continue;
      const p = this.worldToScreen(b.x, b.y);
      const w = b.w * cam.zoom;
      const h = b.h * cam.zoom;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(p.x + 6, p.y + 8, w, h);
      ctx.fillStyle = b.color;
      ctx.fillRect(p.x, p.y, w, h);
      ctx.fillStyle = b.roof || b.color;
      ctx.fillRect(p.x + 5, p.y + 5, w - 10, h - 10);
      if (b.hgt >= 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        const cols = Math.floor(w / 22);
        const rows = Math.floor(h / 26);
        for (let i = 0; i < cols; i += 1) {
          for (let j = 0; j < rows; j += 1) {
            if ((i * 7 + j * 13 + b.x) % 5 === 0) ctx.fillRect(p.x + 8 + i * 22, p.y + 8 + j * 26, 10, 12);
          }
        }
      } else {
        // Roof vents and a skylight so low buildings are not flat slabs.
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(p.x + w * 0.2, p.y + h * 0.25, w * 0.16, h * 0.2);
        ctx.fillRect(p.x + w * 0.62, p.y + h * 0.6, w * 0.16, h * 0.18);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(p.x + w * 0.45, p.y + h * 0.4, w * 0.14, h * 0.16);
      }
      if (b.label) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(10, 13 * cam.zoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(b.label, p.x + w / 2, p.y + h / 2 + 4);
        ctx.textAlign = 'left';
      }
    }
    // Trees and lamps.
    for (const t of world.city.trees) {
      if (t.x < view.x0 || t.x > view.x1 || t.y < view.y0 || t.y > view.y1) continue;
      const p = this.worldToScreen(t.x, t.y);
      ctx.fillStyle = '#2f6b33';
      ctx.beginPath(); ctx.arc(p.x, p.y, t.r * cam.zoom, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4d8a4f';
      ctx.beginPath(); ctx.arc(p.x - 3, p.y - 3, t.r * 0.7 * cam.zoom, 0, Math.PI * 2); ctx.fill();
    }
    if (detail > 0.8) {
      for (const lamp of world.city.lamps) {
        if (lamp.x < view.x0 || lamp.x > view.x1 || lamp.y < view.y0 || lamp.y > view.y1) continue;
        const p = this.worldToScreen(lamp.x, lamp.y);
        ctx.fillStyle = '#444';
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        if (world.isNight()) {
          ctx.fillStyle = 'rgba(255,220,120,0.25)';
          ctx.beginPath(); ctx.arc(p.x, p.y, 26 * cam.zoom, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // Mission / taxi / landmark markers on the ground.
    const target = world.missions.objectiveTarget();
    if (target) this.drawGroundMarker(target.x, target.y, '#f2a007', world.time);
    if (world.taxi.active) {
      const dest = world.taxi.stage === 0 ? world.taxi.pickupPoint : world.taxi.destination;
      this.drawGroundMarker(dest.x, dest.y, '#4ec9b0', world.time);
    }
    for (const landmark of world.city.landmarks) {
      const p = this.worldToScreen(landmark.x, landmark.y);
      if (p.x < -40 || p.x > cam.w + 40 || p.y < -40 || p.y > cam.h + 40) continue;
      ctx.fillStyle = landmark.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(landmark.icon, p.x, p.y + 4);
      ctx.textAlign = 'left';
    }
  }

  drawGroundMarker(x, y, color, time) {
    const p = this.worldToScreen(x, y);
    const pulse = 26 + Math.sin(time * 5) * 6;
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    // A light pillar so the marker reads from far away.
    const grad = ctx.createLinearGradient(p.x, p.y - 90, p.x, p.y);
    grad.addColorStop(0, 'rgba(242,160,7,0)');
    grad.addColorStop(1, 'rgba(242,160,7,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(p.x - 3, p.y - 90, 6, 90);
  }

  drawPickups(world) {
    const ctx = this.ctx;
    for (const pickup of world.pickups) {
      if (pickup.taken) continue;
      const p = this.worldToScreen(pickup.x, pickup.y);
      if (p.x < -30 || p.x > this.camera.w + 30 || p.y < -30 || p.y > this.camera.h + 30) continue;
      const bob = Math.sin(world.time * 4 + pickup.x) * 3;
      ctx.fillStyle = pickup.kind === 'cash' ? '#37b24d' : pickup.kind === 'health' ? '#e33f2e' : '#f2a007';
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pickup.kind === 'cash' ? '$' : pickup.kind === 'health' ? '+' : 'A', p.x, p.y + bob + 4);
      ctx.textAlign = 'left';
    }
  }

  drawCarShape(car, isPlayer) {
    const ctx = this.ctx;
    const cam = this.camera;
    const p = this.worldToScreen(car.x, car.y);
    const len = car.length * cam.zoom;
    const wid = car.width * cam.zoom;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-len / 2 + 4, -wid / 2 + 5, len, wid);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    ctx.beginPath();
    ctx.roundRect(-len * 0.18, -wid * 0.36, len * 0.32, wid * 0.72, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(len * 0.28, -wid / 2 + 3, 4, 5);
    ctx.fillRect(len * 0.28, wid / 2 - 8, 4, 5);
    // Headlights at night.
    if (this.night) {
      ctx.fillStyle = 'rgba(255,240,170,0.9)';
      ctx.fillRect(len / 2 - 2, -wid / 2 + 4, 4, 6);
      ctx.fillRect(len / 2 - 2, wid / 2 - 10, 4, 6);
    }
    if (car.siren) {
      const on = Math.floor(this.timeNow * 6) % 2 === 0;
      ctx.fillStyle = on ? '#ff2e2e' : '#2e6fff';
      ctx.beginPath(); ctx.arc(-len * 0.1, 0, 6, 0, Math.PI * 2); ctx.fill();
    }
    if (isPlayer) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-len / 2 - 3, -wid / 2 - 3, len + 6, wid + 6, 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCars(world) {
    for (const car of world.cars) {
      if (car === world.player.car) continue;
      const p = this.worldToScreen(car.x, car.y);
      if (p.x < -80 || p.x > this.camera.w + 80 || p.y < -80 || p.y > this.camera.h + 80) continue;
      this.drawCarShape(car, false);
    }
    for (const car of world.policeCars) this.drawCarShape(car, false);
    if (world.player.car) this.drawCarShape(world.player.car, true);
  }

  drawPersonShape(x, y, angle, skin, shirt, phase, isPlayer) {
    const ctx = this.ctx;
    const cam = this.camera;
    const p = this.worldToScreen(x, y);
    const bob = Math.sin(phase) * 2;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(angle);
    // Legs stepping as they walk.
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(-4 + bob, -7, 8, 5);
    ctx.fillRect(-4 - bob, 2, 8, 5);
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.roundRect(-9, -9, 18, 18, 6); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath(); ctx.arc(0, -2, 7, Math.PI, 0); ctx.fill();
    if (isPlayer) {
      ctx.rotate(-angle);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  drawPeople(world) {
    for (const ped of world.peds) {
      const p = this.worldToScreen(ped.x, ped.y);
      if (p.x < -40 || p.x > this.camera.w + 40 || p.y < -40 || p.y > this.camera.h + 40) continue;
      this.drawPersonShape(ped.x, ped.y, ped.angle, ped.skin, ped.shirt, ped.walkPhase, false);
    }
    for (const cop of world.cops) {
      this.drawPersonShape(cop.x, cop.y, cop.angle, cop.skin, cop.shirt, cop.walkPhase, false);
      const p = this.worldToScreen(cop.x, cop.y);
      ctxFillText(this.ctx, 'POLICE', p.x, p.y - 22, '#9ecbff');
    }
    const foes = world.missions.active?.foes || [];
    for (const foe of foes) {
      if (foe.health <= 0) continue;
      this.drawPersonShape(foe.x, foe.y, foe.angle, foe.skin, foe.shirt, foe.walkPhase, false);
      const p = this.worldToScreen(foe.x, foe.y);
      this.drawBar(p.x - 16, p.y - 26, 32, 5, foe.health / 100, '#e33f2e');
      ctxFillText(this.ctx, 'VIPER', p.x, p.y - 32, '#ff9a9a');
    }
  }

  drawPlayer(world) {
    const player = world.player;
    if (player.car) return;
    const blink = player.invulnerable > 0 && Math.floor(world.time * 10) % 2 === 0;
    if (!blink) this.drawPersonShape(player.x, player.y, player.aimAngle ?? player.angle, '#e8b48a', '#e33f2e', world.time * 8, true);
    // Aim line and crosshair on foot.
    if (player.aimAngle !== undefined) {
      const ctx = this.ctx;
      const p = this.worldToScreen(player.x, player.y);
      const aim = player.aimAngle;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(aim) * 22, p.y + Math.sin(aim) * 22);
      ctx.lineTo(p.x + Math.cos(aim) * 52, p.y + Math.sin(aim) * 52);
      ctx.stroke();
    }
  }

  drawBullets(world) {
    const ctx = this.ctx;
    for (const b of world.bullets) {
      const p = this.worldToScreen(b.x, b.y);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - b.vx * 0.02, p.y - b.vy * 0.02);
      ctx.stroke();
    }
  }

  drawParticles(world) {
    const ctx = this.ctx;
    for (const p of world.particles) {
      const s = this.worldToScreen(p.x, p.y);
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawNight(world) {
    const hour = world.clock / 3600;
    let darkness = 0;
    if (hour >= 19 || hour < 6) darkness = 0.42;
    else if (hour >= 17.5) darkness = 0.2;
    else if (hour < 7) darkness = 0.2;
    this.night = darkness > 0.3;
    if (darkness <= 0) return;
    const ctx = this.ctx;
    const cam = this.camera;
    ctx.fillStyle = `rgba(8,12,40,${darkness})`;
    ctx.fillRect(0, 0, cam.w, cam.h);
    // A pool of light around the player and the headlights.
    const p = this.worldToScreen(world.player.x, world.player.y);
    const grad = ctx.createRadialGradient(p.x, p.y, 40, p.x, p.y, 260);
    grad.addColorStop(0, 'rgba(255,230,160,0.20)');
    grad.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(p.x - 260, p.y - 260, 520, 520);
  }

  drawHud(world, screen) {
    const ctx = this.ctx;
    const cam = this.camera;
    const player = world.player;
    // Cash and health, top left.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(12, 12, 250, 76);
    ctx.fillStyle = '#37b24d';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`$${player.cash.toLocaleString('en-US')}`, 24, 38);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Ammo ${player.ammo}   ${world.timeLabel()}`, 24, 70);
    this.drawBar(140, 24, 100, 13, player.health / PLAYER.maxHealth, '#37b24d');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('HEALTH', 140, 52);
    // Wanted stars, top centre.
    const stars = world.wanted.stars;
    const sx = cam.w / 2 - stars * 16 - 20;
    for (let i = 0; i < 5; i += 1) {
      ctx.font = '26px sans-serif';
      ctx.fillStyle = i < stars ? '#ffd166' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', sx + i * 32, 40);
    }
    if (stars > 0) {
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stars >= 3 ? 'THE HEAT IS ON' : 'WANTED', cam.w / 2, 58);
      ctx.textAlign = 'left';
    }
    // Mission objective banner, above the controls hint at the bottom.
    const objective = world.missions.objectiveText();
    ctx.font = 'bold 15px sans-serif';
    const ow = ctx.measureText(objective).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(cam.w / 2 - ow / 2, cam.h - 96, ow, 34);
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.fillText(objective, cam.w / 2, cam.h - 74);
    ctx.textAlign = 'left';
    // Speed and car name when driving.
    if (player.car) {
      const kmh = Math.round(Math.abs(player.car.speed) * 0.36);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(cam.w - 220, cam.h - 52, 130, 34);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${kmh} km/h  ${player.car.model.name}`, cam.w - 208, cam.h - 30);
    }
    // Toast message.
    const msg = world.missions.messageTimer > 0 ? world.missions.message : world.message;
    const msgTimer = world.missions.messageTimer > 0 ? world.missions.messageTimer : world.messageTimer;
    if (msg && msgTimer > 0) {
      ctx.font = 'bold 16px sans-serif';
      const mw = ctx.measureText(msg).width + 28;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(cam.w / 2 - mw / 2, 76, mw, 32);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(msg, cam.w / 2, 97);
      ctx.textAlign = 'left';
    }
    // Controls hint, bottom left.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(12, cam.h - 52, 330, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '12px sans-serif';
    ctx.fillText('WASD move/drive   E enter car   Space punch/brake   Click shoot   Enter mission', 22, cam.h - 30);
    this.drawMinimap(world);
  }

  drawMinimap(world) {
    const ctx = this.ctx;
    const cam = this.camera;
    const size = 190;
    const x0 = cam.w - size - 14;
    const y0 = 14;
    const scale = size / WORLD.size;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
    ctx.fillStyle = '#3f6b34';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#3a3f47';
    for (const rx of ROADS_X) ctx.fillRect(x0 + rx * scale - 1, y0, 2, size);
    for (const ry of ROADS_Y) ctx.fillRect(x0, y0 + ry * scale, size, 2);
    // Beach strip.
    ctx.fillStyle = '#2a7fa8';
    ctx.fillRect(x0, y0 + BEACH.waterY * scale, size, size - BEACH.waterY * scale);
    ctx.fillStyle = '#e0c98f';
    ctx.fillRect(x0, y0 + BEACH.y * scale, size, (BEACH.waterY - BEACH.y) * scale);
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x0 + x * scale, y0 + y * scale, r, 0, Math.PI * 2); ctx.fill();
    };
    const target = world.missions.objectiveTarget();
    if (target) dot(target.x, target.y, '#f2a007', 5);
    if (world.taxi.active) {
      const dest = world.taxi.stage === 0 ? world.taxi.pickupPoint : world.taxi.destination;
      dot(dest.x, dest.y, '#4ec9b0', 4);
    }
    for (const car of world.policeCars) dot(car.x, car.y, '#2e6fff', 3);
    for (const landmark of world.city.landmarks) dot(landmark.x, landmark.y, landmark.color, 2.5);
    // Player arrow, pointing where they face.
    const px = x0 + world.player.x * scale;
    const py = y0 + world.player.y * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(world.player.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('SOLMAR', x0 + 6, y0 + size - 6);
  }

  drawBar(x, y, w, h, ratio, color) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * clamp(ratio, 0, 1), h);
  }

  drawTitle(world) {
    const ctx = this.ctx;
    const cam = this.camera;
    ctx.fillStyle = 'rgba(5,10,25,0.62)';
    ctx.fillRect(0, 0, cam.w, cam.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('SOLMAR HEAT', cam.w / 2, 190);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('An open-world crime story — steal cars, dodge the cops, run the city.', cam.w / 2, 232);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#cfe3ff';
    ctx.fillText('6 story missions  •  traffic & pedestrians  •  wanted levels & police chases', cam.w / 2, 262);
    ctx.fillText('taxi jobs  •  hidden cash  •  spray shop  •  day & night in the city of Solmar', cam.w / 2, 286);
    ctx.fillStyle = '#37b24d';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Press ENTER to start', cam.w / 2, 360);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('HOW TO PLAY', cam.w / 2, 420);
    ctx.font = '14px sans-serif';
    const lines = [
      'WASD / arrows — walk and drive    Shift — run',
      'E — enter or steal a car, exit a car    Space — handbrake / punch',
      'Mouse + click — aim and shoot on foot    T — taxi job in a cab',
      'Enter — start the next story mission    P — pause    M — mute',
    ];
    lines.forEach((line, i) => ctx.fillText(line, cam.w / 2, 448 + i * 24));
    ctx.fillStyle = '#9ecbff';
    ctx.font = '13px sans-serif';
    ctx.fillText('Save: your cash and story progress save automatically at the safehouse and after every mission.', cam.w / 2, 580);
    ctx.fillText('An original game. Solmar, its people and its story are invented here — no part of any other game.', cam.w / 2, 604);
    ctx.textAlign = 'left';
  }

  drawOverlay(title, subtitle, color) {
    const ctx = this.ctx;
    const cam = this.camera;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, cam.w, cam.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText(title, cam.w / 2, cam.h / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(subtitle, cam.w / 2, cam.h / 2 + 24);
    ctx.textAlign = 'left';
  }
}

function ctxFillText(ctx, text, x, y, color) {
  ctx.fillStyle = color;
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}
