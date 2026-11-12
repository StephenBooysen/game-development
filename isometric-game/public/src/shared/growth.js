/**
 * Planting, growth and harvest — for anything that sits on a tile and gets
 * better over days.
 *
 * A plot is a plain object in `grid.plots`; its model is an instance record in
 * the shared prop layer, swapped whenever it changes stage. Growth is resolved
 * once per night rather than continuously — a day is the unit the player thinks
 * in, and it makes the maths exact instead of drifty.
 *
 * Two shapes of growing thing are supported, because both games want both:
 *
 *   growable   staged, consumed when picked. A crop; a drill rig working a
 *              seam. Advances only on days it had charge (water / power), so a
 *              neglected one stalls rather than dies.
 *   perennial  placed once, then yields again and again on a timer. A fruit
 *              tree; a deep-core well.
 *
 * Definitions come from the game's tables and are read, never assumed:
 *   growable  { name, item, kit, phases, stageDays, yield:[lo,hi], models,
 *               regrow?, icon }
 *   perennial { name, yields, kit, phases, growDays, yieldEvery, models,
 *               marker:[kit,model], icon }
 */
export class GrowthSystem {
  /**
   * @param {Grid} grid
   * @param {World} world
   * @param {object} rules the game's tables
   */
  constructor(grid, world, rules) {
    this.grid = grid;
    this.world = world;
    this.rules = rules;
    this.growables = rules.growables || {};
    this.perennials = rules.perennials || {};
  }

  // --- table helpers -------------------------------------------------------

  totalDays(def) {
    return def.stageDays.reduce((a, b) => a + b, 0);
  }

  /** Stage index something with `days` charged days should be showing. */
  stageFor(def, days) {
    let acc = 0;
    for (let s = 0; s < def.stageDays.length; s++) {
      acc += def.stageDays[s];
      if (days < acc) return s;
    }
    return def.stageDays.length;
  }

  daysLeft(def, days) {
    return Math.max(0, this.totalDays(def) - days);
  }

  isMature(def, stage) {
    return stage >= def.stageDays.length;
  }

  // --- planting ------------------------------------------------------------

  /** Why this tile can't take one right now, or null if it can. */
  plantBlocker(x, z, id, phase) {
    const g = this.grid;
    const v = this.rules.vocab;
    if (!g.inBounds(x, z)) return 'out of bounds';
    const i = g.idx(x, z);
    if (!g.prepared[i]) return v.needsPrepared;
    if (g.plots.has(i)) return v.alreadyPlanted;
    if (g.objects.has(i)) return 'something is in the way';
    const def = this.growables[id];
    if (!def) return 'nothing to place';
    if (!def.phases.includes(phase.key)) {
      return v.wrongPhase(def, phase);
    }
    return null;
  }

  plant(x, z, id) {
    const g = this.grid;
    const i = g.idx(x, z);
    const plot = {
      id,
      stage: 0,
      days: 0,
      chargedToday: g.charge[i] > 0 ? 1 : 0,
      missed: 0,
      quality: 1,
      record: null,
    };
    g.plots.set(i, plot);
    this.applyStageVisual(x, z, plot);
    return plot;
  }

  // --- visuals -------------------------------------------------------------

  applyStageVisual(x, z, plot) {
    const def = this.growables[plot.id];
    if (plot.record) {
      this.world.props.remove(plot.record);
      plot.record = null;
    }
    const model = def?.models[Math.min(plot.stage, def.models.length - 1)];
    if (!model) return;

    // A stable per-tile rotation keeps a planted row from looking
    // machine-stamped without needing to store the angle.
    const hash = (x * 73856093) ^ (z * 19349663);
    const ry = ((hash >>> 0) % 628) / 100;
    const grown = this.isMature(def, plot.stage);
    plot.record = this.world.props.add(def.kit || 'nature', model, {
      x, z, y: def.y ?? 0.05, ry: def.fixedRotation ? (def.ry ?? 0) : ry,
      scale: (grown ? 1 : 0.72 + plot.stage * 0.12) * (def.scale ?? 1),
      wind: def.wind ?? true,
    });
  }

  setStage(x, z, plot, stage) {
    if (plot.stage === stage) return;
    plot.stage = stage;
    this.applyStageVisual(x, z, plot);
  }

  /** Rebuilds every plot's instance — used after a load. */
  refreshAll() {
    for (const [i, plot] of this.grid.plots) {
      plot.record = null;
      this.applyStageVisual(this.grid.xOf(i), this.grid.zOf(i), plot);
    }
  }

  remove(x, z) {
    const i = this.grid.idx(x, z);
    const plot = this.grid.plots.get(i);
    if (!plot) return null;
    if (plot.record) this.world.props.remove(plot.record);
    this.grid.plots.delete(i);
    return plot;
  }

  // --- interaction ---------------------------------------------------------

  charge(x, z) {
    const plot = this.grid.plotAt(x, z);
    if (plot) plot.chargedToday = 1;
  }

  ready(x, z) {
    const plot = this.grid.plotAt(x, z);
    if (!plot) return false;
    const def = this.growables[plot.id];
    return !!def && this.isMature(def, plot.stage);
  }

  /**
   * Picks a mature plot. Regrowing kinds step back a stage instead of vanishing.
   * @returns {{item: string, count: number, quality: number, name: string}|null}
   */
  harvest(x, z) {
    const plot = this.grid.plotAt(x, z);
    if (!plot) return null;
    const def = this.growables[plot.id];
    if (!def || !this.isMature(def, plot.stage)) return null;

    const [lo, hi] = def.yield;
    let count = lo + Math.floor(Math.random() * (hi - lo + 1));
    // One that never went short comes in noticeably better.
    const quality = plot.missed === 0 ? 2 : 1;
    if (quality === 2 && Math.random() < 0.5) count += 1;

    if (def.regrow) {
      plot.days = Math.max(0, this.totalDays(def) - def.regrow);
      plot.missed = 0;
      this.setStage(x, z, plot, this.stageFor(def, plot.days));
    } else {
      this.remove(x, z);
    }

    return { item: def.item, count, quality, name: def.name };
  }

  // --- the night pass ------------------------------------------------------

  /**
   * Advances every plot and perennial one day.
   * @param {{charged: boolean, phase: object}} ctx
   * @returns {{grown, ready, withered, yielded, matured}}
   */
  advanceDay({ charged, phase }) {
    const g = this.grid;
    const log = { grown: 0, ready: 0, withered: 0, yielded: 0, matured: 0 };
    const key = phase.key;

    for (const [i, plot] of Array.from(g.plots)) {
      const x = g.xOf(i);
      const z = g.zOf(i);
      const def = this.growables[plot.id];

      if (!def || !def.phases.includes(key)) {
        this.remove(x, z);
        log.withered++;
        continue;
      }

      const fed = plot.chargedToday || charged;
      if (fed) {
        plot.days++;
        log.grown++;
      } else {
        plot.missed++;
      }
      plot.chargedToday = charged ? 1 : 0;

      const stage = this.stageFor(def, plot.days);
      if (stage !== plot.stage) this.setStage(x, z, plot, stage);
      if (this.isMature(def, plot.stage)) log.ready++;
    }

    // Perennials live in the object layer, not the plot map.
    for (const [, obj] of g.objects) {
      if (obj.kind !== 'perennial') continue;
      const def = this.perennials[obj.species];
      if (!def) continue;

      obj.age = (obj.age || 0) + 1;
      const grown = obj.age >= def.growDays;
      const stageIdx = grown ? 2 : obj.age >= Math.floor(def.growDays / 2) ? 1 : 0;
      if (stageIdx !== obj.stage) {
        obj.stage = stageIdx;
        this.world.reskinObject(obj, def.models[stageIdx], {
          scale: (0.8 + stageIdx * 0.15) * (def.scale ?? 1),
        });
        if (grown) log.matured++;
      }

      if (grown && def.phases.includes(key) && !obj.ripe) {
        obj.since = (obj.since || 0) + 1;
        if (obj.since >= def.yieldEvery) {
          obj.ripe = 1;
          obj.since = 0;
          this.addMarker(obj, def);
          log.yielded++;
        }
      }
    }

    return log;
  }

  // --- the "there's something to collect" marker ---------------------------

  addMarker(obj, def) {
    if (obj.markerRecord || !def.marker) return;
    const [kit, model] = def.marker;
    obj.markerRecord = this.world.props.add(kit, model, {
      x: obj.x + (def.markerOffset?.[0] ?? 0.32),
      z: obj.z + (def.markerOffset?.[1] ?? 0.18),
      y: def.markerOffset?.[2] ?? 0.7,
      scale: def.markerScale ?? 0.85,
      ry: 0.6,
      castShadow: false,
    });
  }

  clearMarker(obj) {
    if (!obj.markerRecord) return;
    this.world.props.remove(obj.markerRecord);
    obj.markerRecord = null;
  }

  /** Restores markers for perennials loaded from a save. */
  refreshPerennials() {
    for (const obj of this.grid.objects.values()) {
      if (obj.kind !== 'perennial') continue;
      obj.markerRecord = null;
      const def = this.perennials[obj.species];
      if (def && obj.ripe) this.addMarker(obj, def);
    }
  }
}
