// Sound, synthesised live with WebAudio: no audio files, no network.
// Engine hum, sirens, gunshots, pickups, cash and a tiny bass line for the title.
export class Sound {
  constructor() {
    this.context = null;
    this.muted = false;
    this.musicTimer = 0;
    this.musicNote = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  ensure() {
    if (!this.context) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();
      } catch {
        this.context = null;
      }
    }
    if (this.context && this.context.state === 'suspended') this.context.resume();
    return this.context;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopEngine();
    return this.muted;
  }

  blip(frequency, duration, type, volume) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume || 0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  shoot() { this.blip(880, 0.08, 'square', 0.06); this.blip(220, 0.12, 'sawtooth', 0.05); }
  punch() { this.blip(140, 0.1, 'sine', 0.12); }
  pickup() { this.blip(660, 0.09, 'sine', 0.09); this.blip(990, 0.12, 'sine', 0.08); }
  cash() {
    this.blip(523, 0.1, 'sine', 0.09);
    setTimeout(() => this.blip(659, 0.1, 'sine', 0.09), 90);
    setTimeout(() => this.blip(784, 0.18, 'sine', 0.09), 180);
  }
  crash() { this.blip(90, 0.25, 'sawtooth', 0.14); }
  busted() {
    this.blip(392, 0.2, 'square', 0.08);
    setTimeout(() => this.blip(311, 0.35, 'square', 0.08), 200);
  }
  missionStart() { this.blip(440, 0.12, 'triangle', 0.1); setTimeout(() => this.blip(660, 0.2, 'triangle', 0.1), 120); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.1), i * 110));
  }

  // A looping two-tone siren while the player is wanted.
  siren(on) {
    if (this.muted) on = false;
    const ctx = this.ensure();
    if (!ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = ctx.createOscillator();
      this.sirenGain = ctx.createGain();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain.gain.value = 0.025;
      this.sirenOsc.connect(this.sirenGain).connect(ctx.destination);
      this.sirenOsc.start();
      this.sirenPhase = 0;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenGain = null;
    }
    if (this.sirenOsc) {
      this.sirenPhase = (this.sirenPhase || 0) + 0.09;
      this.sirenOsc.frequency.value = 700 + Math.sin(this.sirenPhase) * 220;
    }
  }

  // Engine hum that follows the player's speed.
  engine(speedRatio) {
    if (this.muted || speedRatio <= 0.02) {
      this.stopEngine();
      return;
    }
    const ctx = this.ensure();
    if (!ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = ctx.createOscillator();
      this.engineGain = ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0.02;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      this.engineOsc.connect(filter).connect(this.engineGain).connect(ctx.destination);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 60 + speedRatio * 160;
    this.engineGain.gain.value = 0.015 + speedRatio * 0.03;
  }

  stopEngine() {
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch { /* already stopped */ }
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  // A slow bass line under the title screen and while driving.
  music(dt, playing) {
    if (this.muted || !playing) return;
    const ctx = this.ensure();
    if (!ctx) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.42;
    const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
    const note = bass[this.musicNote % bass.length];
    this.musicNote += 1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = note;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
  }
}
