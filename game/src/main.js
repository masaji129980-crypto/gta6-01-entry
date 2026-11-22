// SOLMAR HEAT — entry point: the game loop, screens, pause, saving and the
// ?shot= scenes that stage the screenshots. Plain ES modules, no network.
import { World } from './world.js';
import { Renderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE } from './render.js';
import { Input } from './input.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const world = new World(20261122);
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed') || '1');

let screen = SCREEN_TITLE;
let shotLabel = null;
let lastTime = performance.now();
let saveLoaded = false;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(window.innerWidth, window.innerHeight, dpr);
}
window.addEventListener('resize', resize);
resize();

// Screenshot mode: stage a real scene, draw one frame, stop. The shot is the
// game itself, played forward from a fixed seed.
if (shotName) {
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  shotLabel = staged.label;
  renderer.camera.x = world.player.x;
  renderer.camera.y = world.player.y;
  renderer.camera.zoom = world.player.car ? 0.85 : 1.0;
  renderer.draw(world, screen, shotLabel);
  document.title = `SOLMAR HEAT — ${shotName}`;
  status.textContent = shotLabel;
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  if (input.justPressed('m')) {
    const muted = world.sound.toggleMute();
    world.showMessage(muted ? 'Sound muted' : 'Sound on', 1.5);
  }
  if (screen === SCREEN_TITLE) {
    world.time += dt;
    renderer.camera.x += (world.player.x - renderer.camera.x) * 0.01;
    renderer.camera.y += (world.player.y - renderer.camera.y) * 0.01;
    if (input.justPressed('enter')) {
      if (!saveLoaded) {
        saveLoaded = world.loadSave();
        if (saveLoaded) world.showMessage('Save loaded — welcome back to Solmar', 3);
      }
      screen = SCREEN_PLAY;
      world.sound.ensure();
      world.sound.missionStart();
    }
  } else if (screen === SCREEN_PAUSE) {
    if (input.justPressed('p', 'escape', 'enter')) screen = SCREEN_PLAY;
  } else if (screen === SCREEN_PLAY) {
    if (input.justPressed('p', 'escape')) {
      screen = SCREEN_PAUSE;
    } else {
      world.update(input, dt, renderer.camera);
      renderer.follow(world.player, dt);
      if (world.busted || world.wasted) {
        status.textContent = world.busted ? 'Busted by the police' : 'Wasted';
      }
    }
  }
  renderer.draw(world, screen, null);
  status.textContent = screen === SCREEN_PLAY
    ? `${world.missions.objectiveText()} — $${world.player.cash}, wanted ${world.wanted.stars} stars`
    : 'SOLMAR HEAT — press Enter to play';
  input.endFrame();
  requestAnimationFrame(frame);
}

// Save when the player leaves the page, so progress is never lost.
window.addEventListener('beforeunload', () => world.saveGame());
