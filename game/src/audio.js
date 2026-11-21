// Procedural sound, WebAudio only — no audio files. A low ambient hum runs under
// everything, footsteps tick while the player moves, a pickup blips, an alert
// stings, and a win plays a short jingle. Nothing starts before the first user
// gesture (browsers require it); the screenshot scenes never start audio at all.

export function createAudio() {
  let context = null;
  let master = null;
  let hum = null;
  let muted = false;
  let stepTimer = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      // Ambient hum: two detuned low oscillators, barely there.
      const humGain = context.createGain();
      humGain.gain.value = 0.035;
      humGain.connect(master);
      for (const freq of [55, 55.7]) {
        const osc = context.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(humGain);
        osc.start();
      }
      hum = humGain;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + duration + 0.02);
    } catch {
      // Audio is decoration; a failure here never stops the game.
    }
  }

  function noiseBurst(duration, volume, lowpass) {
    if (!context || muted) return;
    try {
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // Audio is decoration; a failure here never stops the game.
    }
  }

  return {
    /** Call from a user gesture; starts the audio context and the hum. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** Soft footstep tick, throttled by the caller to the player's stride. */
    footstep(sneaking) {
      if (!context || muted) return;
      stepTimer -= 1;
      if (stepTimer > 0) return;
      stepTimer = sneaking ? 26 : 15;
      noiseBurst(0.05, sneaking ? 0.05 : 0.12, sneaking ? 400 : 900);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.22, 1320);
    },
    key() {
      tone(660, 0.1, 'triangle', 0.22);
      setTimeout(() => tone(990, 0.16, 'triangle', 0.22), 90);
    },
    alert() {
      tone(220, 0.35, 'sawtooth', 0.25, 110);
      tone(233, 0.35, 'sawtooth', 0.18, 116);
    },
    caught() {
      tone(160, 0.5, 'sawtooth', 0.3, 60);
      noiseBurst(0.3, 0.25, 500);
    },
    levelClear() {
      tone(523, 0.12, 'triangle', 0.22);
      setTimeout(() => tone(659, 0.12, 'triangle', 0.22), 110);
      setTimeout(() => tone(784, 0.22, 'triangle', 0.24), 220);
    },
    win() {
      const notes = [523, 659, 784, 1047, 784, 1047];
      notes.forEach((freq, i) => setTimeout(() => tone(freq, 0.2, 'triangle', 0.24), i * 130));
    },
    gameOver() {
      const notes = [392, 330, 262, 196];
      notes.forEach((freq, i) => setTimeout(() => tone(freq, 0.28, 'triangle', 0.22), i * 160));
    },
  };
}
