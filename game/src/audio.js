// Solara Bay — synthesized sound. One job: every sound effect and the radio music.
// No audio files: everything is WebAudio oscillators and filtered noise, made at run time.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOn = false;
    this.sirenOsc = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    this.startEngine();
    this.startMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.2, freq = 800, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start(t0);
  }

  pickup() { this.tone(880, 0.12, 'sine', 0.25, 1320); }
  cash() { this.tone(660, 0.1, 'square', 0.12); this.tone(990, 0.16, 'square', 0.12, null, 0.09); }
  punch() { this.noise(0.12, 0.35, 300); }
  crash() { this.noise(0.3, 0.4, 500); this.tone(90, 0.25, 'sawtooth', 0.25, 40); }
  busted() { this.tone(220, 0.5, 'sawtooth', 0.2, 110); this.tone(220, 0.5, 'sawtooth', 0.2, 110, 0.55); }
  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this.tone(n, 0.22, 'triangle', 0.22, null, i * 0.13));
  }
  missionStart() { this.tone(392, 0.15, 'triangle', 0.2); this.tone(523, 0.2, 'triangle', 0.2, null, 0.12); }
  win() {
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((n, i) => this.tone(n, 0.3, 'triangle', 0.22, null, i * 0.16));
  }
  carDoor() { this.noise(0.08, 0.2, 1200); }

  startEngine() {
    if (!this.ctx) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 400;
    this.engineOsc.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speed01, driving) {
    if (!this.engineOsc || !this.engineGain) return;
    const target = driving ? 0.03 + speed01 * 0.06 : 0;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx || on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      const gain = this.ctx.createGain();
      gain.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 250;
      lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 800;
      this.sirenOsc.connect(gain); gain.connect(this.master);
      this.sirenOsc.start(); lfo.start();
      this.sirenOsc._lfo = lfo; this.sirenOsc._gain = gain;
    } else if (this.sirenOsc) {
      try { this.sirenOsc._lfo.stop(); this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
      this.sirenOsc = null;
    }
  }

  // Tiny looping bassline "radio" — a chill Latin-ish groove, synthesized.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [110, 0, 110, 0, 130.8, 0, 98, 0, 110, 0, 146.8, 0, 130.8, 0, 98, 0];
    const chords = [220, 261.6, 329.6];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const b = bass[this.musicStep % bass.length];
      if (b) this.tone(b, 0.22, 'triangle', 0.10);
      if (this.musicStep % 4 === 0) {
        const c = chords[Math.floor(this.musicStep / 4) % chords.length];
        this.tone(c, 0.4, 'sine', 0.05);
      }
      this.musicStep++;
    }, 240);
  }
}
