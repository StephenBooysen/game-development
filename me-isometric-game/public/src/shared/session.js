import { Engine } from '../core/engine.js';
import { IsoCamera } from '../core/isoCamera.js';
import { Input } from '../core/input.js';
import { AssetLibrary } from '../core/assets.js';
import { makeNoise, makeRng } from '../core/rng.js';

import { Grid } from './grid.js';
import { Terrain } from './terrain.js';
import { PropLayer } from './props.js';
import { Sky } from './sky.js';
import { ParticleWeather } from './particles.js';
import { GameState } from './state.js';
import { GrowthSystem } from './growth.js';
import { Player } from './player.js';
import { Actions } from './actions.js';
import { Sfx } from './audio.js';
import { Hud } from './hud.js';
import { Panels } from './panels.js';
import { makeSaveStore } from './saves.js';

/**
 * One run of one game, from the loading bar to the save on the way out.
 *
 * This is the shape both games turned out to have in common, and it is most of
 * a game: load the art, build a world from a seed, wire the input, run a frame
 * loop that advances a clock and follows the sun, resolve a night, and write it
 * all down. A game module supplies the pieces — its tables, its worldgen, its
 * sky — and never has to state the order any of it happens in.
 */
export class Session {
  constructor(module, canvas) {
    this.module = module;
    this.rules = module.rules;
    this.saves = makeSaveStore(module.slot, module.legacyKeys);

    this.hud = new Hud(this.rules.vocab);
    this.hud.setClock(this.rules.time);
    this.sfx = new Sfx(module.audio);
    this.canvas = canvas;

    this.engine = new Engine(this.canvas);
    this.iso = new IsoCamera();
    this.engine.attachCamera(this.iso);
    this.engine.setShadowExtent(22);
    this.hud.setCamera(this.iso.camera);

    this.assets = new AssetLibrary(module.palette, module.kitGrades);
    this.input = new Input(this.canvas, this.iso);

    this.paused = false;
    this.transitioning = false;
    this.started = false;
    this._saveTimer = 0;
  }

  // --- boot ----------------------------------------------------------------

  /** Loads the art for this game. Resolves true when it's safe to start. */
  async boot() {
    const m = this.module;
    this.hud.showBoot(m);
    document.body.dataset.game = m.theme;

    try {
      const total = m.manifest.reduce((n, [, names]) => n + names.length, 0);
      await this.assets.loadManifest(m.manifest, (done) => {
        const fraction = done / total;
        const line = m.bootLines[
          Math.min(m.bootLines.length - 1, Math.floor(fraction * m.bootLines.length))
        ];
        this.hud.progress(fraction, line);
      });
    } catch (err) {
      this.hud.bootError(`Couldn't load the art packs.\n${err.message}`);
      return false;
    }
    this.hud.progress(1, 'ready');
    return true;
  }

  // --- world assembly ------------------------------------------------------

  startNew() {
    // Guard against a double-click on the launcher: building twice would leave
    // a whole orphaned world in the scene.
    if (this.state) return;
    const seed = makeRng(Date.now() & 0xffffffff).int(1, 0xffffff);
    this.build(new GameState(this.rules, seed));
    this.player.spawn(this.landmarks.spawn.x, this.landmarks.spawn.z);
    this.rollWeather();
    this.begin();
    this.hud.toast(this.rules.vocab.opening, 'info');
    // Commit the new run immediately: the lobby reads the save to decide what
    // it can offer, and a run that only exists in memory isn't one yet.
    this.save(false);
  }

  startFrom(data) {
    if (this.state) return;
    const state = GameState.deserialize(this.rules, data.state);
    this.build(state, data);
    const at = data.player || this.landmarks.spawn;
    this.player.spawn(at.x, at.z);
    this.weather.setMode(state.weather);
    this.sfx.setBed(this.weather.charges(state.weather));
    this.begin();
    this.hud.toast(this.rules.vocab.welcomeBack(state), 'info');
  }

  /** Builds the scene for a state object; `save` restores player changes. */
  build(state, save = null) {
    const m = this.module;
    this.state = state;

    this.grid = new Grid({
      size: this.rules.world.size,
      blocked: this.rules.blockedTerrain,
      ground: this.rules.groundTerrain,
    });
    this.props = new PropLayer(this.assets, this.engine.scene);
    this.world = m.createWorld({
      grid: this.grid, props: this.props, assets: this.assets,
      scene: this.engine.scene, rules: this.rules,
    });

    this.landmarks = this.world.generate(state.seed);

    // Terrain the player changed overrides the generated ground.
    if (save?.grid) {
      this.grid.loadTerrain(save.grid);
      this.grid.plots = Grid.plotsFrom(save.grid);
    }

    this.terrain = new Terrain(this.grid, makeNoise(state.seed), m.terrainPaint);
    this.engine.scene.add(this.terrain.mesh);
    this.terrain.bakeShade(m.terrainPaint.shadeSpread);
    this.terrain.setTint(state.phase.tint);

    for (const layer of m.createSurfaces?.({ grid: this.grid, rules: this.rules }) || []) {
      this.engine.scene.add(layer.mesh);
      (this.surfaces ||= []).push(layer);
    }

    this.sky = new Sky(this.engine, m.sky);
    this.sky.depthOffset = this.iso.distance;
    this.weather = new ParticleWeather(this.engine.scene, m.weather.modes, m.weather.charging);

    this.growth = new GrowthSystem(this.grid, this.world, this.rules);
    if (save?.grid) {
      this.world.restoreObjects(save.grid.objects);
      this.growth.refreshAll();
      this.growth.refreshPerennials();
    }
    this.world.applyPhase(state.phase.key);

    this.player = new Player({
      assets: this.assets,
      scene: this.engine.scene,
      grid: this.grid,
      state,
      sfx: this.sfx,
      modelName: m.characters[state.character % m.characters.length],
      toolModel: this.rules.toolModel,
    });
    this.player.setHeld(state.held);

    const ui = {
      toast: (msg, tone) => this.hud.toast(msg, tone),
      floater: (x, z, text, tone) => this.hud.floater(x, z, text, tone),
      openPanel: (name) => this.panels.show(name),
      sleep: () => this.sleep(false),
    };
    const ctx = {
      grid: this.grid, state, world: this.world, growth: this.growth,
      player: this.player, sfx: this.sfx, terrain: this.terrain,
      rules: this.rules, ui,
    };
    this.actions = m.createActions ? m.createActions(ctx) : new Actions(ctx);

    this.panels = new Panels({
      state,
      sfx: this.sfx,
      hud: this.hud,
      grid: this.grid,
      player: this.player,
      world: this.world,
      growth: this.growth,
      rules: this.rules,
      on: {
        setting: (key, value) => this.applySetting(key, value),
        save: () => this.save(true),
        sleep: () => this.sleep(false),
        quit: () => this.abandon(),
        lobby: () => this.toLobby(),
        refresh: () => this.refreshHud(),
      },
    });

    this.input.attachGrid(this.grid);
    this.applySetting('shadows', state.settings.shadows);
    this.applySetting('bloom', state.settings.bloom);
    this.applySetting('volume', state.settings.volume);
  }

  begin() {
    this.hud.enterGame();
    this.refreshHud();
    this.bindInput();
    this.iso.setFocus(this.player.pos.x, this.player.pos.z, true);
    this.sky.update(this.state.hourOfDay);

    if (!this.started) {
      this.started = true;
      this.engine.onUpdate((dt) => this.update(dt));
      this.engine.start();
    }
  }

  refreshHud() {
    this.hud.refreshHotbar(this.state);
    this.player.setHeld(this.state.held);
  }

  applySetting(key, value) {
    if (key === 'shadows') this.engine.setShadowQuality(value);
    if (key === 'bloom') this.engine.setBloomEnabled(value);
    if (key === 'volume') this.sfx.setVolume(value);
    if (key === 'dayLength') this.state.settings.dayLength = value;
  }

  // --- input ---------------------------------------------------------------

  bindInput() {
    if (this._bound) return;
    this._bound = true;

    this.hud.onSlotClick((index) => {
      this.state.select(index);
      this.refreshHud();
      this.sfx.play('ui');
    });

    this.input.on('primary', (hover) => {
      this.sfx.unlock();
      if (!this.paused) this.actions.use(hover);
    });

    this.input.on('secondary', (hover) => {
      if (this.paused || !hover) return;
      if (!this.player.walkTo(hover.x, hover.z)) this.sfx.play('deny');
    });

    this.input.on('wheel', (dir, event) => {
      if (event.shiftKey) {
        this.state.cycle(dir);
        this.refreshHud();
        this.sfx.play('ui');
      } else {
        this.iso.zoomBy(dir * 0.12);
      }
    });

    this.input.on('key', (code, event, repeat) => {
      this.sfx.unlock();
      if (repeat) return;

      if (code.startsWith('Digit')) {
        const n = Number(code.slice(5));
        if (n >= 1 && n <= 8) {
          this.state.select(n - 1);
          this.refreshHud();
          return;
        }
      }

      switch (code) {
        case 'KeyQ': this.iso.rotate(-1); break;
        case 'KeyE': this.iso.rotate(1); break;
        case 'KeyI': this.panels.toggle('inventory'); break;
        case 'KeyB': this.panels.toggle('shop'); break;
        case 'KeyJ': this.panels.toggle('almanac'); break;
        case 'Tab':
          event.preventDefault();
          this.panels.toggle('map');
          break;
        case 'Escape':
          if (this.panels.isOpen) this.panels.close();
          else this.panels.toggle('menu');
          break;
        case 'KeyF':
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen?.();
          break;
        case 'KeyM': {
          const muted = this.sfx.toggleMute();
          this.hud.toast(muted ? 'Sound off.' : 'Sound on.', 'info');
          break;
        }
        case 'Space':
          event.preventDefault();
          if (!this.paused) this.actions.use(this.input.hover);
          break;
        default: break;
      }
    });
  }

  // --- frame ---------------------------------------------------------------

  update(dt) {
    if (!this.state) return;
    this.paused = this.panels.isOpen || this.transitioning;

    if (!this.paused) this.advanceClock(dt);

    this.iso.setFocus(this.player.pos.x, this.player.pos.z);
    this.iso.update(dt);
    this.input.updatePick(this.grid);

    this.player.update(dt, { input: this.input, iso: this.iso, frozen: this.paused });
    this.actions.update(dt);

    // Click-and-hold paints: working a row shouldn't need eight clicks.
    if (!this.paused && this.input.primaryDown && !this.input.blocked) {
      this.actions.use(this.input.hover);
    }

    this.sky.depthOffset = this.iso.distance;
    this.sky.update(this.state.hourOfDay);
    this.followSun();
    this.sky.follow(this.player.pos.x, this.player.pos.z);
    this.world.updateLamps(this.sky.nightFactor);
    this.weather.update(dt, this.player.pos);

    this.terrain.refresh();
    this.props.update(dt);
    for (const layer of this.surfaces || []) layer.update(dt);

    this.hud.update(this.state, this.sky.nightFactor);
    this.hud.setReadout(this.paused ? null : this.actions.describe(this.input.hover));
    this.sfx.ambience(dt, this.sky.nightFactor);

    this._saveTimer += dt;
    if (this._saveTimer > 120 && !this.paused) {
      this._saveTimer = 0;
      this.save(false);
    }
  }

  advanceClock(dt) {
    const t = this.rules.time;
    const span = t.collapseHour - t.wakeHour;
    this.state.time += dt * (span / this.state.settings.dayLength);
    if (this.state.time >= t.collapseHour) this.sleep(true);
  }

  /**
   * The sun is the only shadow caster and its frustum is deliberately tight, so
   * it has to ride along with the player or half the map loses its shadows.
   */
  followSun() {
    const dir = this.sky.uniforms.uSunDir.value;
    const p = this.player.pos;
    const height = Math.max(dir.y, 0.45);
    this.engine.sun.position.set(p.x + dir.x * 55, height * 55, p.z + dir.z * 55);
    this.engine.sun.target.position.set(p.x, 0, p.z);
    this.engine.sun.target.updateMatrixWorld();
  }

  // --- the night -----------------------------------------------------------

  rollWeather() {
    const table = this.module.weather.table[this.state.phase.key]
      || Object.values(this.module.weather.table)[0];
    let roll = Math.random();
    let picked = table[0][0];
    for (const [kind, odds] of table) {
      if (roll < odds) { picked = kind; break; }
      roll -= odds;
    }
    this.state.weather = picked;
    this.weather.setMode(picked);
    this.sfx.setBed(this.weather.charges(picked), this.module.weather.bedIntensity?.[picked] ?? 0.6);
    return picked;
  }

  async sleep(collapsed) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.panels.close();

    const v = this.rules.vocab;
    this.player.act(collapsed ? 'faint' : 'sleep');
    this.sfx.play(collapsed ? 'deny' : 'sleep');
    await wait(collapsed ? 700 : 1100);

    const lines = [];
    const beforePhase = this.state.phaseIndex;

    // The outbound bin settles up overnight.
    let shippedGold = 0;
    let shippedCount = 0;
    for (const [id, n] of this.state.shipped) {
      shippedGold += this.state.sellValue(id) * n;
      shippedCount += n;
    }
    if (shippedGold > 0) {
      this.state.earn(shippedGold);
      lines.push(v.morning.shipped(shippedCount, shippedGold));
    }
    this.state.shipped.clear();

    this.state.day++;
    const phase = this.state.phase;
    const weather = this.rollWeather();
    const charged = this.weather.charges(weather);

    const log = this.growth.advanceDay({ charged, phase });

    // Beds run flat overnight unless the sky did the work.
    const g = this.grid;
    for (let i = 0; i < g.prepared.length; i++) {
      if (!g.prepared[i]) continue;
      const want = charged ? 1 : 0;
      if (g.charge[i] !== want) {
        g.charge[i] = want;
        g.dirtyTiles.add(i);
      }
    }

    this.state.time = this.rules.time.wakeHour;
    this.state.collapsed = collapsed;
    this.state.restoreEnergy(collapsed ? 0.55 : 1);
    this.state.reserve = this.state.reserveMax;

    if (this.state.phaseIndex !== beforePhase) {
      this.world.applyPhase(phase.key);
      this.terrain.setTint(phase.tint);
      lines.push(v.morning.phaseArrived(phase));
    }
    this.terrain.refresh();

    if (charged) lines.push(v.morning.charged);
    if (log.grown) lines.push(v.morning.grown(log.grown));
    if (log.ready) lines.push(v.morning.ready(log.ready));
    if (log.yielded) lines.push(v.morning.yielded(log.yielded));
    if (log.matured) lines.push(v.morning.matured(log.matured));
    if (log.withered) lines.push(v.morning.withered(log.withered));
    if (collapsed) lines.push(v.morning.collapsed);
    if (lines.length === 0) lines.push(v.morning.quiet);

    this.player.spawn(this.landmarks.spawn.x, this.landmarks.spawn.z);
    this.iso.setFocus(this.player.pos.x, this.player.pos.z, true);
    this.sky.update(this.state.hourOfDay);
    this.refreshHud();

    await this.hud.daybreak({
      title: `${v.hud.dayWord} ${this.state.day}`,
      sub: `${phase.name} · ${this.module.weather.labels[weather]}`,
      lines,
    });

    this.sfx.play('dawn');
    this.transitioning = false;
    this._saveTimer = 0;
    this.save(false);
  }

  // --- persistence ---------------------------------------------------------

  async save(announce) {
    if (!this.state) return;
    const payload = {
      state: this.state.serialize(),
      grid: this.grid.serialize(),
      player: { x: Math.round(this.player.pos.x), z: Math.round(this.player.pos.z) },
    };
    try {
      await this.saves.write(payload);
      if (announce) {
        this.panels.note(`Saved at ${new Date().toLocaleTimeString()}.`);
        this.hud.toast(this.rules.vocab.saved, 'info');
        this.sfx.play('ui');
      }
    } catch (err) {
      if (announce) {
        this.panels.note(`Save failed: ${err.message}`);
        this.hud.toast(this.rules.vocab.saveFailed, 'bad');
      }
    }
  }

  async abandon() {
    this.panels.note('Abandoning…');
    await this.saves.clear();
    this.toLobby();
  }

  /**
   * Back to the launcher via a reload.
   *
   * Tearing a world down by hand means disposing every geometry, material,
   * render target and listener the run created, and any one of them missed is a
   * leak that only shows up after the third game switch. A reload is exact, and
   * from a warm cache it costs less than the teardown would.
   */
  async toLobby() {
    await this.save(false);
    location.hash = '';
    location.reload();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
