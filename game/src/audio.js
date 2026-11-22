// Synthesized sound, one job: every beep, siren and engine hum is made with WebAudio
// oscillators and noise, so the game ships no audio files at all. All sounds are
// best-effort: if the browser blocks audio, the game plays on silently.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineNodes = null;
  let musicTimer = null;
  let musicStep = 0;

  // A lazy synthwave-ish bass line, one note per beat, looping forever.
  const BASS_LINE = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 0, 65.41, 0];

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + duration);
      gain.gain.setValueAtTime(volume || 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Audio is decoration; never let it break the game.
    }
  }

  function noise(duration, volume, lowpass) {
    if (!ensure() || muted) return;
    try {
      const now = context.currentTime;
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume || 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(now);
    } catch {
      // Audio is decoration; never let it break the game.
    }
  }

  return {
    unlock() {
      resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    get muted() {
      return muted;
    },
    click() {
      tone(660, 0.07, 'square', 0.12);
    },
    pickup() {
      tone(880, 0.1, 'sine', 0.2);
      setTimeout(() => tone(1320, 0.14, 'sine', 0.2), 90);
    },
    cash() {
      [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => tone(freq, 0.16, 'triangle', 0.2), i * 80));
    },
    crash() {
      noise(0.25, 0.4, 900);
      tone(90, 0.25, 'sawtooth', 0.25, 40);
    },
    punch() {
      noise(0.08, 0.25, 2000);
    },
    horn() {
      tone(370, 0.35, 'square', 0.12);
      tone(466, 0.35, 'square', 0.1);
    },
    siren() {
      tone(700, 0.5, 'sine', 0.08, 950);
      setTimeout(() => tone(950, 0.5, 'sine', 0.08, 700), 500);
    },
    wantedUp() {
      tone(440, 0.18, 'sawtooth', 0.16, 220);
    },
    missionDone() {
      [523, 659, 784, 1047, 1319].forEach((freq, i) => setTimeout(() => tone(freq, 0.2, 'triangle', 0.22), i * 100));
    },
    busted() {
      [392, 330, 262, 196].forEach((freq, i) => setTimeout(() => tone(freq, 0.3, 'sawtooth', 0.18), i * 160));
    },
    engineStart() {
      tone(60, 0.4, 'sawtooth', 0.2, 140);
      noise(0.3, 0.12, 600);
    },
    /** A continuous engine hum whose pitch follows speed; call every frame or with 0 to stop. */
    engine(speedRatio) {
      if (!ensure() || muted) {
        if (engineNodes) {
          try { engineNodes.osc.stop(); } catch { /* already stopped */ }
          engineNodes = null;
        }
        return;
      }
      resume();
      if (speedRatio <= 0.02) {
        if (engineNodes) {
          try { engineNodes.osc.stop(); } catch { /* already stopped */ }
          engineNodes = null;
        }
        return;
      }
      try {
        if (!engineNodes) {
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = 70;
          gain.gain.value = 0.05;
          const filter = context.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 500;
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(master);
          osc.start();
          engineNodes = { osc, gain };
        }
        engineNodes.osc.frequency.value = 70 + speedRatio * 160;
        engineNodes.gain.gain.value = 0.03 + speedRatio * 0.05;
      } catch {
        // Audio is decoration; never let it break the game.
      }
    },
    startMusic() {
      if (musicTimer || !ensure()) return;
      musicTimer = setInterval(() => {
        if (muted) return;
        const freq = BASS_LINE[musicStep % BASS_LINE.length];
        musicStep += 1;
        if (freq > 0) tone(freq, 0.32, 'triangle', 0.1);
      }, 340);
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
