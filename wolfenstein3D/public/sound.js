// Sound effects, made with the Web Audio API. No sound files are needed: every sound
// is a tone or a burst of noise that the browser generates as it plays.
// The audio context is passed in, so the tests can run in Node without a sound card.

function browserAudioContext() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export class Sound {
  /** makeContext returns an audio context, or null if sound is not available. */
  constructor(makeContext = browserAudioContext) {
    this.makeContext = makeContext;
    this.ctx = null;
    this.enabled = true;
  }

  /**
   * Browsers only allow sound after the player has clicked or pressed something.
   * Call this from such a handler; it is safe to call many times.
   */
  unlock() {
    if (!this.ctx) this.ctx = this.makeContext();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** Turns all sound on or off. Returns the new state. */
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /** A short note that fades out. slideTo bends the pitch as it plays. */
  tone(freq, dur, { type = 'square', volume = 0.1, slideTo = null, delay = 0 } = {}) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A burst of noise, like a bang. A lower `cutoff` makes it duller and heavier. */
  noise(dur, volume = 0.2, cutoff = 4000) {
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2; // fades as it goes
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  /** Plays the sound for one game event (see state.events in game.js). */
  play(event) {
    if (!this.enabled || !this.ctx) return;
    const handler = this.sounds[event.type];
    if (handler) handler.call(this, event);
  }

  sounds = {
    fire(event) {
      if (event.weapon === 'knife') {
        this.noise(0.08, 0.08, 6000);
      } else if (event.weapon === 'pistol') {
        this.noise(0.18, 0.3, 2600);
        this.tone(220, 0.1, { volume: 0.12, slideTo: 60 });
      } else {
        this.noise(0.1, 0.26, event.weapon === 'chaingun' ? 1800 : 3200);
        this.tone(160, 0.06, { volume: 0.1, slideTo: 50 });
      }
    },
    enemyFire(event) {
      // Quieter the further away the guard is.
      const volume = Math.max(0.05, 0.26 - event.dist * 0.02);
      this.noise(0.16, volume, 1500);
      this.tone(140, 0.09, { volume: volume * 0.4, slideTo: 45 });
    },
    hurt() {
      this.tone(180, 0.22, { type: 'sawtooth', volume: 0.16, slideTo: 70 });
    },
    die() {
      this.tone(300, 0.9, { type: 'sawtooth', volume: 0.18, slideTo: 40 });
    },
    enemyPain() {
      this.tone(420, 0.1, { type: 'sawtooth', volume: 0.08, slideTo: 260 });
    },
    enemyDie(event) {
      if (event.enemy === 'dog') {
        this.tone(900, 0.35, { type: 'triangle', volume: 0.1, slideTo: 300 }); // a yelp
        return;
      }
      this.tone(event.enemy === 'boss' ? 200 : 360, 0.4, { type: 'sawtooth', volume: 0.12, slideTo: 60 });
    },
    alert(event) {
      if (event.enemy === 'dog') {
        // Two quick barks: a rough noise burst with a falling growl under each.
        for (const delay of [0, 0.18]) {
          this.tone(420, 0.09, { type: 'sawtooth', volume: 0.12, slideTo: 200, delay });
        }
        this.noise(0.1, 0.12, 1200);
        return;
      }
      // A two-note bark: "Halt!"
      const base = event.enemy === 'boss' ? 150 : event.enemy === 'ss' ? 230 : 290;
      this.tone(base, 0.11, { type: 'sawtooth', volume: 0.1 });
      this.tone(base * 1.3, 0.16, { type: 'sawtooth', volume: 0.1, delay: 0.13 });
    },
    pickup(event) {
      if (event.kind === 'oneup') {
        for (const [i, freq] of [523, 784, 1047, 1568].entries()) this.tone(freq, 0.12, { type: 'triangle', volume: 0.1, delay: i * 0.07 });
        return;
      }
      const high = event.kind === 'treasure' || event.kind === 'key';
      this.tone(high ? 880 : 520, 0.08, { volume: 0.07 });
      this.tone(high ? 1320 : 780, 0.14, { volume: 0.07, delay: 0.07 });
    },
    bite() {
      this.noise(0.06, 0.2, 2500); // snap
      this.tone(260, 0.12, { type: 'sawtooth', volume: 0.08, slideTo: 120 });
    },
    secret() {
      // A low stone-on-stone rumble that lasts as long as the wall slides.
      this.noise(1.2, 0.18, 300);
      this.tone(55, 1.2, { type: 'sawtooth', volume: 0.06, slideTo: 40 });
    },
    door() {
      this.tone(70, 0.5, { type: 'sawtooth', volume: 0.07, slideTo: 130 });
    },
    locked() {
      this.tone(110, 0.12, { volume: 0.08 });
      this.tone(90, 0.16, { volume: 0.08, delay: 0.14 });
    },
    switch() {
      this.tone(600, 0.04, { volume: 0.05 });
    },
    exit() {
      for (const [i, freq] of [523, 659, 784, 1047].entries()) {
        this.tone(freq, 0.22, { type: 'triangle', volume: 0.12, delay: i * 0.12 });
      }
    },
  };
}
