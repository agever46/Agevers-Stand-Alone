// Synthesized game sounds using Web Audio API — no external files needed

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  volume = 0.3,
  freqEnd?: number,
) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playNoise(duration: number, volume = 0.15) {
  try {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch {}
}

// ─── Looping jet engine ────────────────────────────────────

let jetEngineNodes: { noise: AudioBufferSourceNode; osc: OscillatorNode; gain: GainNode } | null = null;

function startJetEngine(volume = 0.22) {
  try {
    if (jetEngineNodes) return;
    const ctx = getCtx();
    // Sustained white noise loop — the core of a jet roar
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // High-pass shapes the noise into a hissing jet roar
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(900, ctx.currentTime);
    hp.frequency.linearRampToValueAtTime(1800, ctx.currentTime + 0.4);

    // Peaking filter accentuates the turbine whine
    const peak = ctx.createBiquadFilter();
    peak.type = "peaking";
    peak.frequency.value = 3500;
    peak.Q.value = 4;
    peak.gain.value = 14;

    // High-pitched turbine whine oscillator
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(3200, ctx.currentTime + 0.4);
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.04;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.08);

    noise.connect(hp);
    hp.connect(peak);
    peak.connect(gain);
    osc.connect(oscGain);
    oscGain.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
    osc.start();

    jetEngineNodes = { noise, osc, gain };
  } catch {}
}

function stopJetEngine() {
  try {
    if (!jetEngineNodes) return;
    const ctx = getCtx();
    const { noise, osc, gain } = jetEngineNodes;
    jetEngineNodes = null;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
    noise.stop(ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

// ─── Shared sounds ─────────────────────────────────────────

export const gameSounds = {
  // Winning / coin collect
  win: () => {
    playTone(523, 0.1, "square", 0.2);
    setTimeout(() => playTone(659, 0.1, "square", 0.2), 100);
    setTimeout(() => playTone(784, 0.15, "square", 0.25), 200);
    setTimeout(() => playTone(1047, 0.3, "square", 0.2), 300);
  },

  // Losing / game over
  lose: () => {
    playTone(400, 0.15, "sawtooth", 0.2);
    setTimeout(() => playTone(300, 0.15, "sawtooth", 0.2), 150);
    setTimeout(() => playTone(200, 0.3, "sawtooth", 0.25), 300);
  },

  // Click / tap
  click: () => playTone(800, 0.05, "square", 0.15),

  // ─── Spin Wheel ──────────────────────────────────────────
  spinTick: () => playTone(1200, 0.03, "square", 0.1),
  spinStart: () => playTone(400, 0.15, "triangle", 0.2, 800),

  // ─── Coin Flip ───────────────────────────────────────────
  coinFlip: () => {
    for (let i = 0; i < 8; i++) {
      setTimeout(() => playTone(1400 + (i % 2) * 400, 0.04, "sine", 0.12), i * 60);
    }
  },

  // ─── Dice Roll ───────────────────────────────────────────
  diceRoll: () => playNoise(0.12, 0.2),
  diceStop: () => playTone(600, 0.08, "triangle", 0.15),

  // ─── Minesweeper ─────────────────────────────────────────
  mineReveal: () => playTone(500, 0.04, "sine", 0.1),
  mineFlag: () => playTone(900, 0.06, "triangle", 0.12),
  mineExplode: () => {
    playNoise(0.3, 0.3);
    playTone(100, 0.3, "sawtooth", 0.2, 30);
  },

  // ─── Endless Runner ──────────────────────────────────────
  jump: () => playTone(300, 0.15, "sine", 0.15, 600),
  runnerScore: () => playTone(880, 0.06, "square", 0.1),
  crash: () => {
    playNoise(0.2, 0.25);
    playTone(150, 0.2, "sawtooth", 0.2, 50);
  },

  // ─── Duck Shoot ──────────────────────────────────────────
  shoot: () => {
    playTone(200, 0.12, "square", 0.3, 50);
  },
  duckHit: () => {
    playTone(1000, 0.08, "sine", 0.15, 400);
    setTimeout(() => playNoise(0.08, 0.1), 50);
  },

  // ─── Heli Bomber ─────────────────────────────────────────
  heliRotor: () => playTone(80, 0.06, "sawtooth", 0.05),
  bombDrop: () => playTone(400, 0.2, "sine", 0.15, 100),
  bombExplode: () => {
    playNoise(0.25, 0.3);
    playTone(80, 0.25, "sawtooth", 0.25, 20);
  },
  tankShoot: () => {
    playTone(150, 0.1, "square", 0.2, 60);
    playNoise(0.08, 0.12);
  },
  heliHit: () => {
    playNoise(0.4, 0.35);
    playTone(200, 0.3, "sawtooth", 0.3, 30);
  },

  // ─── Notification ────────────────────────────────────────
  notification: () => {
    playTone(880, 0.12, "sine", 0.25);
    setTimeout(() => playTone(1320, 0.2, "sine", 0.3), 120);
    setTimeout(() => playTone(1760, 0.25, "sine", 0.2), 280);
  },

  // ─── Jet engine (looping) ────────────────────────────────
  jetEngineStart: () => startJetEngine(),
  jetEngineStop: () => stopJetEngine(),

  // ─── Bubble Pop ──────────────────────────────────────────
  bubbleSwap: () => playTone(600, 0.06, "sine", 0.15, 900),
  bubblePop: () => {
    playTone(900, 0.08, "sine", 0.18, 1600);
    setTimeout(() => playTone(1400, 0.06, "triangle", 0.12, 2200), 30);
  },
  bubbleInvalid: () => playTone(180, 0.12, "sawtooth", 0.15, 120),
};
