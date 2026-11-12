/**
 * Turns "the player clicked tile (x, z) holding a thing" into a change in the
 * world.
 *
 * Everything funnels through `use()` so there is exactly one place that decides
 * what a click means, and one place that spends energy. UI feedback is injected
 * rather than imported — this module never touches the DOM, which is also why
 * it can be driven headlessly.
 *
 * The verbs are the ones both games turned out to share. A held item declares
 * which one it performs via `def.tool`, and a world object declares which one
 * it answers to via `obj.needs`:
 *
 *   prepare   work a tile into a bed        hoe a field · survey a deposit
 *   charge    top up a prepared tile        water it   · power the rig
 *   fell      knock down something standing axe a tree · cut an ice spire
 *   break     shatter something hard        pickaxe    · drill a boulder
 *   clear     sweep something light away    scythe     · grind up debris
 *
 * A game subclasses this only when it has a verb the other genuinely lacks.
 */
export class Actions {
  constructor({ grid, state, world, growth, player, sfx, terrain, rules, ui }) {
    this.grid = grid;
    this.state = state;
    this.world = world;
    this.growth = growth;
    this.player = player;
    this.sfx = sfx;
    this.terrain = terrain;
    this.rules = rules;
    this.vocab = rules.vocab;
    this.ui = ui;
    this.cooldown = 0;
    this._denyAt = 0;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this._denyAt > 0) this._denyAt -= dt;
  }

  deny(message) {
    // Rate-limited: click-and-hold on an out-of-reach tile shouldn't machine-gun.
    if (this._denyAt > 0) return;
    this._denyAt = 0.6;
    this.sfx.play('deny');
    if (message) this.ui.toast(message, 'warn');
  }

  spend(amount) {
    if (amount <= 0) return true;
    if (!this.state.spendEnergy(amount)) {
      this.deny(this.vocab.tooTired);
      return false;
    }
    return true;
  }

  /** Sound name for a verb, so a game can swap the whole set in its rules. */
  sound(key) {
    return this.rules.sounds?.[key] ?? key;
  }

  // --- entry point ---------------------------------------------------------

  use(hover) {
    if (!hover || this.cooldown > 0) return;
    const { x, z } = hover;

    // No toast for this one: the readout already flags "out of reach" under the
    // cursor, and click-dragging across a row would otherwise bury the screen.
    if (this.player.distanceToTile(x, z) > this.rules.player.reach) {
      this.deny(null);
      return;
    }

    this.player.faceTile(x, z);
    const obj = this.grid.objectAt(x, z);
    const def = this.state.heldDef;

    if (obj) {
      switch (obj.kind) {
        case 'shop': return this.open('shop');
        case 'bin': return this.ship();
        case 'door': return this.ui.sleep();
        case 'perennial': return this.collect(obj);
        default: break;
      }
    }

    // A ripe plot is picked with whatever's in hand — except the prepare tool,
    // which would otherwise plough up a finished harvest by accident.
    if (this.growth.ready(x, z) && def?.tool !== 'prepare') return this.harvest(x, z);

    if (obj?.breakable) return this.strike(obj, def);

    switch (def?.tool) {
      case 'prepare': return this.prepare(x, z);
      case 'charge': return this.recharge(x, z);
      case 'fell':
      case 'break':
      case 'clear':
        return this.deny(this.vocab.nothingHere);
      default: break;
    }

    if (def?.kind === 'seed') return this.plant(x, z, def.grows);
    if (def?.kind === 'sapling') return this.placePerennial(x, z, def.species);
    return this.deny(null);
  }

  open(panel) {
    this.cooldown = 0.3;
    this.sfx.play('ui');
    this.ui.openPanel(panel);
  }

  // --- prepare -------------------------------------------------------------

  prepare(x, z) {
    const g = this.grid;
    const wide = this.state.hasWide('prepare');
    const tiles = wide ? [...g.around(x, z, 1)] : [{ x, z, i: g.idx(x, z) }];
    const preparable = this.rules.preparable;

    const targets = tiles.filter(({ i }) => {
      if (g.solid[i] || g.objects.has(i) || g.plots.has(i) || g.prepared[i]) return false;
      return preparable.includes(g.terrain[i]);
    });

    // Working a bare prepared tile takes the bed back out — a cheap undo.
    if (targets.length === 0) {
      const i = g.idx(x, z);
      if (g.prepared[i] && !g.plots.has(i)) {
        g.setPrepared(x, z, false);
        this.sfx.play(this.sound('prepare'));
        this.cooldown = this.rules.player.actionCooldown;
        this.player.act('swing');
        return;
      }
      return this.deny(this.vocab.cantPrepare);
    }

    const cost = this.state.def(this.state.held)?.energy ?? 0;
    if (!this.spend(cost * (wide ? Math.min(3, targets.length) : 1))) return;

    for (const t of targets) g.setPrepared(t.x, t.z, true);
    this.player.act('swing');
    this.sfx.play(this.sound('prepare'));
    this.cooldown = this.rules.player.actionCooldown;
  }

  // --- charge --------------------------------------------------------------

  recharge(x, z) {
    const g = this.grid;

    if (this.rules.chargeSources.includes(g.terrain[g.idx(x, z)])) {
      if (this.state.reserve >= this.state.reserveMax) return this.deny(this.vocab.reserveFull);
      this.state.reserve = this.state.reserveMax;
      this.player.act('reach');
      this.sfx.play(this.sound('charge'));
      this.ui.floater(x, z, this.vocab.refilled, 'good');
      this.cooldown = this.rules.player.actionCooldown;
      return;
    }

    const wide = this.state.hasWide('charge');
    const tiles = wide ? [...g.around(x, z, 1)] : [{ x, z, i: g.idx(x, z) }];
    const targets = tiles.filter(({ i }) => g.prepared[i] && g.charge[i] === 0);

    if (targets.length === 0) return this.deny(this.vocab.nothingToCharge);
    if (this.state.reserve <= 0) return this.deny(this.vocab.reserveEmpty);

    const doable = Math.min(targets.length, this.state.reserve);
    if (!this.spend(this.state.def(this.state.held)?.energy ?? 0)) return;

    for (let k = 0; k < doable; k++) {
      const t = targets[k];
      g.setCharge(t.x, t.z, 1);
      this.growth.charge(t.x, t.z);
    }
    this.state.reserve -= doable;

    this.player.act('reach');
    this.sfx.play(this.sound('charge'));
    this.cooldown = this.rules.player.actionCooldown;
  }

  // --- breaking things down ------------------------------------------------

  /** Felling, breaking and clearing all share the same damage loop. */
  strike(obj, def) {
    // Loose pickups come away in one go, no tool required.
    if (obj.kind === 'forage') {
      const drop = obj.drops;
      this.world.removeObject(obj.x, obj.z);
      this.state.add(drop, 1);
      this.player.act('gather');
      this.sfx.play(this.sound('harvest'));
      this.ui.floater(obj.x, obj.z, `+1 ${this.state.def(drop).name}`, 'good');
      this.cooldown = this.rules.player.actionCooldown;
      return;
    }

    const need = obj.needs;
    if (!need) return this.deny(null);
    if (def?.tool !== need) return this.deny(this.vocab.needsTool(need));

    const powered = this.state.hasPower(need);
    const damage = powered ? obj.maxHp : 1;

    if (!this.spend(this.state.def(this.state.held)?.energy ?? 0)) return;

    obj.hp -= damage;
    this.player.act('swing');
    this.cooldown = this.rules.player.actionCooldown;

    if (obj.hp > 0) {
      this.sfx.play(this.sound(`strike_${need}`));
      return;
    }

    const drop = obj.drops;
    const count = (obj.dropCount ?? 1) + (powered ? 1 : 0);
    this.state.add(drop, count);
    if (need === 'fell') this.state.stats.cleared++;
    if (need === 'break') this.state.stats.broken++;

    const { x, z } = obj;
    const leaves = obj.leaves;
    const ry = obj.ry;
    const scale = obj.scale;
    this.world.removeObject(x, z);
    // Some things leave a remnant behind; it reads much better than a gap.
    if (leaves) this.world.prop(leaves[0], leaves[1], x, z, { ry, scale });

    this.sfx.play(this.sound(`fall_${need}`));
    this.ui.floater(x, z, `+${count} ${this.state.def(drop).name}`, 'good');
  }

  // --- plots ---------------------------------------------------------------

  plant(x, z, id) {
    const blocker = this.growth.plantBlocker(x, z, id, this.state.phase);
    if (blocker) return this.deny(capitalise(blocker));
    if (!this.state.take(this.rules.seedIdFor(id), 1)) return this.deny(this.vocab.outOfSeed);

    this.growth.plant(x, z, id);
    this.player.act('reach');
    this.sfx.play(this.sound('plant'));
    this.cooldown = this.rules.player.actionCooldown * 0.7;
  }

  harvest(x, z) {
    const picked = this.growth.harvest(x, z);
    if (!picked) return;

    this.state.add(picked.item, picked.count);
    this.state.stats.harvested += picked.count;
    this.player.act('gather');
    this.sfx.play(this.sound('harvest'));

    const star = picked.quality === 2 ? ' ★' : '';
    this.ui.floater(x, z, `+${picked.count} ${picked.name}${star}`,
      picked.quality === 2 ? 'cash' : 'good');
    this.cooldown = this.rules.player.actionCooldown;
  }

  // --- perennials ----------------------------------------------------------

  placePerennial(x, z, species) {
    const g = this.grid;
    const i = g.idx(x, z);
    const def = this.rules.perennials[species];
    if (!def) return this.deny(null);
    if (g.solid[i] || g.objects.has(i) || g.plots.has(i)) return this.deny(this.vocab.noRoom);
    if (!this.rules.perennialGround.includes(g.terrain[i])) {
      return this.deny(this.vocab.needsOpenGround);
    }
    // These need elbow room, or the field becomes an impassable thicket.
    for (const n of g.around(x, z, 1)) {
      if (n.i !== i && g.objects.get(n.i)?.kind === 'perennial') {
        return this.deny(this.vocab.tooClose);
      }
    }
    if (!this.state.take(this.rules.saplingIdFor(species), 1)) {
      return this.deny(this.vocab.outOfSapling);
    }

    g.setPrepared(x, z, false);
    this.world.placeObject(x, z, {
      kind: 'perennial', species, kit: def.kit || 'nature', model: def.models[0],
      stage: 0, age: 0, since: 0, ripe: 0,
      scale: 0.8 * (def.scale ?? 1), ry: Math.random() * Math.PI * 2,
      solid: true, breakable: false, label: def.name,
    });

    this.player.act('reach');
    this.sfx.play(this.sound('plant'));
    this.ui.floater(x, z, def.name, 'good');
    this.cooldown = this.rules.player.actionCooldown;
  }

  collect(obj) {
    const def = this.rules.perennials[obj.species];
    if (!def) return;
    if (!obj.ripe) {
      const left = Math.max(0, def.growDays - (obj.age || 0));
      return this.deny(left > 0 ? this.vocab.notGrownYet(left) : this.vocab.nothingRipe);
    }
    obj.ripe = 0;
    obj.since = 0;
    this.growth.clearMarker(obj);
    this.state.add(def.yields, 1);
    this.state.stats.harvested++;
    this.player.act('gather');
    this.sfx.play(this.sound('harvest'));
    this.ui.floater(obj.x, obj.z, `+1 ${this.state.def(def.yields).name}`, 'good');
    this.cooldown = this.rules.player.actionCooldown;
  }

  // --- the outbound bin ----------------------------------------------------

  ship() {
    const id = this.state.held;
    const def = this.state.heldDef;
    if (!def || def.kind === 'tool' || !this.state.sellValue(id)) {
      return this.deny(this.vocab.binOnlySellable);
    }
    const count = this.state.count(id);
    if (count <= 0) return this.deny(this.vocab.nothingToShip);

    this.state.take(id, count);
    this.state.shipped.set(id, (this.state.shipped.get(id) || 0) + count);
    this.sfx.play('coin');
    this.ui.toast(this.vocab.shipped(count, def.name), 'cash');
    this.cooldown = 0.3;
  }

  // --- hover text ----------------------------------------------------------

  /** Markup for the readout strip under the cursor. */
  describe(hover) {
    if (!hover) return null;
    const { x, z } = hover;
    const g = this.grid;
    const v = this.vocab;
    const i = g.idx(x, z);
    const far = this.player.distanceToTile(x, z) > this.rules.player.reach;
    const wrap = (text) => (far ? `${text} <span class="warn">· out of reach</span>` : text);

    const obj = g.objectAt(x, z);
    if (obj) {
      if (obj.kind === 'shop') return wrap(v.readout.shop);
      if (obj.kind === 'bin') return wrap(v.readout.bin);
      if (obj.kind === 'door') return wrap(v.readout.door);
      if (obj.kind === 'perennial') {
        const def = this.rules.perennials[obj.species];
        if (obj.ripe) return wrap(v.readout.perennialRipe(def));
        const left = Math.max(0, def.growDays - (obj.age || 0));
        return wrap(left > 0 ? v.readout.perennialGrowing(def, left) : v.readout.perennialRipening(def));
      }
      const hint = obj.needs ? ` · ${v.needsToolShort(obj.needs)}` : v.readout.gatherHint;
      const hp = obj.maxHp > 1 ? ` (${obj.hp}/${obj.maxHp})` : '';
      return wrap(`<b>${obj.label || obj.kind}</b>${hp}${hint}`);
    }

    const plot = g.plotAt(x, z);
    if (plot) {
      const def = this.rules.growables[plot.id];
      if (def && this.growth.isMature(def, plot.stage)) return wrap(v.readout.plotReady(def));
      if (def) {
        const left = this.growth.daysLeft(def, plot.days);
        const starved = g.charge[i] === 0 && !plot.chargedToday;
        return wrap(v.readout.plotGrowing(def, left, starved));
      }
    }

    if (g.prepared[i]) {
      return wrap(g.charge[i] > 0 ? v.readout.preparedCharged : v.readout.preparedFlat);
    }
    if (this.rules.chargeSources.includes(g.terrain[i])) return wrap(v.readout.source);
    if (g.solid[i]) return null;
    if (this.rules.preparable.includes(g.terrain[i])) return wrap(v.readout.openGround);
    return null;
  }
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
