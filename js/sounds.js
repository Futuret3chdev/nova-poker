/** Casino SFX — Web Audio API (no external files). */
let ctx = null;
let unlocked = false;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function unlockAudio() {
  try {
    const c = getCtx();
    if (c.state === 'suspended') c.resume();
    unlocked = true;
  } catch (_) {}
}

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0) {
  try {
    const c = getCtx();
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  } catch (_) {}
}

function noiseBurst(dur = 0.08, vol = 0.06) {
  try {
    const c = getCtx();
    const buffer = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource();
    const gain = c.createGain();
    src.buffer = buffer;
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(c.destination);
    src.start();
  } catch (_) {}
}

export const casinoSound = {
  chip() {
    unlockAudio();
    tone(880, 0.06, 'square', 0.08);
    tone(1320, 0.04, 'sine', 0.05, 0.02);
  },

  wheelTick() {
    unlockAudio();
    tone(420 + Math.random() * 80, 0.03, 'triangle', 0.06);
  },

  spinStart() {
    unlockAudio();
    tone(180, 0.25, 'sawtooth', 0.07);
    noiseBurst(0.15, 0.04);
  },

  win() {
    unlockAudio();
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'sine', 0.1, i * 0.1));
  },

  bigWin() {
    unlockAudio();
    [523, 659, 784, 988, 1175, 1319, 1568].forEach((f, i) => tone(f, 0.22, 'sine', 0.11, i * 0.07));
    noiseBurst(0.18, 0.05);
    tone(1047, 0.35, 'triangle', 0.08, 0.55);
  },

  lose() {
    unlockAudio();
    tone(220, 0.3, 'sawtooth', 0.08);
    tone(165, 0.4, 'sine', 0.06, 0.12);
  },

  deal() {
    unlockAudio();
    noiseBurst(0.05, 0.05);
    tone(300, 0.08, 'triangle', 0.06, 0.03);
  },

  fold() {
    unlockAudio();
    tone(200, 0.12, 'sine', 0.07);
  },

  call() {
    unlockAudio();
    tone(440, 0.1, 'sine', 0.08);
  },

  raise() {
    unlockAudio();
    tone(550, 0.08, 'square', 0.07);
    tone(700, 0.1, 'sine', 0.06, 0.06);
  },

  yourTurn() {
    unlockAudio();
    tone(660, 0.12, 'sine', 0.09);
    tone(880, 0.15, 'sine', 0.07, 0.1);
  },

  lobby() {
    unlockAudio();
    tone(392, 0.15, 'sine', 0.06);
    tone(523, 0.2, 'sine', 0.05, 0.08);
  },

  _clubTimer: null,

  clubAmbience() {
    unlockAudio();
    casinoSound.clubAmbienceStop();
    const beat = () => {
      tone(80, 0.08, 'sine', 0.06);
      tone(160, 0.06, 'triangle', 0.04, 0.02);
    };
    beat();
    casinoSound._clubTimer = setInterval(beat, 480);
  },

  clubAmbienceStop() {
    if (casinoSound._clubTimer) {
      clearInterval(casinoSound._clubTimer);
      casinoSound._clubTimer = null;
    }
  },

  clubHit() {
    unlockAudio();
    tone(220, 0.1, 'square', 0.08);
    tone(440, 0.12, 'sine', 0.07, 0.05);
  }
};