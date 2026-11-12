/**
 * All sound is synthesised at runtime — the packs ship models, not audio, and a
 * game needs maybe a dozen short noises. Everything is built from two
 * primitives: a shaped oscillator and a filtered noise burst.
 *
 * The context is created on the first user gesture, because browsers won't let
 * it start any earlier.
 *
 * A voice is just a function of the primitives, so a game contributes sound by
 * handing in more of them. The handful below are the ones that mean the same
 * thing everywhere — a coin is a coin — and everything with a texture (soil,
 * stone, vacuum) is left to the game.
 */

/** Voices every game gets for free. */
export const BASE_VOICES = {
  coin: (s) => {
    s.tone({ freq: 1180, type: 'square', dur: 0.09, gain: 0.12 });
    s.tone({ freq: 1760, type: 'square', dur: 0.14, gain: 0.1, delay: 0.06 });
  },
  buy: (s) => {
    s.tone({ freq: 520, type: 'triangle', dur: 0.1, gain: 0.18 });
    s.tone({ freq: 780, type: 'triangle', dur: 0.16, gain: 0.16, delay: 0.08 });
  },
  deny: (s) => s.tone({ freq: 180, to: 120, type: 'sawtooth', dur: 0.18, gain: 0.14 }),
  ui: (s) => s.tone({ freq: 900, type: 'sine', dur: 0.05, gain: 0.08 }),
  step: (s) => s.burst({ freq: 260, to: 120, dur: 0.07, gain: 0.055, q: 0.7, type: 'lowpass' }),
  swing: (s) => s.burst({ freq: 1100, to: 380, dur: 0.14, gain: 0.1, q: 0.6, type: 'lowpass' }),
  harvest: (s) => {
    s.tone({ freq: 660, type: 'triangle', dur: 0.12, gain: 0.22 });
    s.tone({ freq: 990, type: 'triangle', dur: 0.18, gain: 0.18, delay: 0.07 });
  },
  plant: (s) => s.tone({ freq: 500, to: 780, type: 'sine', dur: 0.14, gain: 0.2 }),
  sleep: (s) => {
    s.tone({ freq: 330, to: 165, type: 'sine', dur: 1.4, gain: 0.16 });
    s.tone({ freq: 247, to: 123, type: 'sine', dur: 1.6, gain: 0.12, delay: 0.12 });
  },
  dawn: (s) => [523, 659, 784, 1047].forEach((f, i) =>
    s.tone({ freq: f, type: 'triangle', dur: 0.42, gain: 0.14, delay: i * 0.1 })),
  levelup: (s) => [392, 523, 659].forEach((f, i) =>
    s.tone({ freq: f, type: 'square', dur: 0.2, gain: 0.1, delay: i * 0.08 })),
};

export class Sfx {
  /**
   * @param {object} [opts]
   * @param {Record<string, (sfx: Sfx) => void>} [opts.voices] merged over the base set
   * @param {(sfx: Sfx, nightFactor: number) => number} [opts.ambience]
   *   makes an ambient noise and returns seconds until the next one
   * @param {object} [opts.bed] continuous background: {freq, gain, type}
   */
  constructor({ voices = {}, ambience = null, bed = {} } = {}) {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.muted = false;
    this._noise = null;
    this._bed = null;
    this._ambientAt = 0;
    this.voices = { ...BASE_VOICES, ...voices };
    this.ambienceFn = ambience;
    this.bedOpts = { freq: 1400, gain: 0.06, type: 'lowpass', ...bed };
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);

    // Two seconds of white noise, reused by every percussive sound.
    const frames = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    this._noise = buffer;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  get now() {
    return this.ctx.currentTime;
  }

  // --- primitives ----------------------------------------------------------

  tone({ freq = 440, to = freq, type = 'sine', dur = 0.18, gain = 0.3, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.now + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  burst({ dur = 0.2, gain = 0.3, freq = 900, to = freq, q = 1, type = 'bandpass', delay = 0 }) {
    if (!this.ctx || !this._noise) return;
    const t = this.now + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (to !== freq) filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    filter.Q.value = q;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // --- the sound set -------------------------------------------------------

  play(name) {
    if (!this.ctx) return;
    this.voices[name]?.(this);
  }

  // --- continuous bed ------------------------------------------------------

  /** A looping filtered-noise bed: rain on the roof, dust against the visor. */
  setBed(on, intensity = 0.4) {
    if (!this.ctx) return;
    if (on && !this._bed) {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noise;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = this.bedOpts.type;
      filter.frequency.value = this.bedOpts.freq;
      const amp = this.ctx.createGain();
      amp.gain.value = 0;
      src.connect(filter).connect(amp).connect(this.master);
      src.start();
      this._bed = { src, amp };
    }
    if (this._bed) {
      const target = on ? this.bedOpts.gain * intensity : 0;
      this._bed.amp.gain.linearRampToValueAtTime(target, this.now + 1.2);
      if (!on) {
        const dead = this._bed;
        this._bed = null;
        setTimeout(() => { try { dead.src.stop(); } catch { /* already stopped */ } }, 1600);
      }
    }
  }

  /**
   * Called every frame; the game's ambience function decides for itself how
   * often to actually make a noise by returning the gap until the next one.
   */
  ambience(dt, nightFactor) {
    if (!this.ctx || !this.ambienceFn) return;
    this._ambientAt -= dt;
    if (this._ambientAt > 0) return;
    this._ambientAt = this.ambienceFn(this, nightFactor) || 3;
  }
}
