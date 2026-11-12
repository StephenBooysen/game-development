import { TIME, PLAYER, ECONOMY, HOTBAR_SLOTS } from '../core/config.js';

/**
 * Everything that makes one run *this* run: the clock, the wallet, the pack.
 *
 * Deliberately free of three.js — a world can be rebuilt from a state object
 * plus a seed, which is what makes save/load a small problem instead of a big
 * one.
 *
 * Nothing here knows what a turnip or a drill rig is. A game hands in its
 * `rules` (its item table, its upgrade table, its calendar) and this reads them.
 * Upgrades in particular are pure data: an entry carries an `effect` and the
 * getters below add it up, so buying a bigger tank never needs a new branch.
 *
 *   effect.energy   raises the energy ceiling by n
 *   effect.reserve  raises the carried reserve to n (best one wins)
 *   effect.speed    multiplies walk and run speed
 *   effect.wide     the named verb works a 3×3 instead of one tile
 *   effect.power    the named tool class fells its target in one hit
 */
export class GameState {
  /**
   * @param {object} rules the game's tables — see `games/<id>/index.js`
   * @param {number} [seed]
   */
  constructor(rules, seed = (Math.random() * 0xffffffff) >>> 0) {
    this.rules = rules;
    this.seed = seed >>> 0;
    this.character = this.seed % (rules.characters?.length || 2);

    this.day = 1;
    /** Hours since midnight; the day runs wakeHour → collapseHour. */
    this.time = rules.time.wakeHour;
    this.weather = rules.weather?.initial || 'clear';
    /** Set when the player passed out rather than turning in. */
    this.collapsed = false;

    this.gold = rules.economy.startingGold;
    this.energy = rules.player.maxEnergy;
    /** The carried consumable: watering-can water, power-cell charge. */
    this.reserve = rules.reserveBase;

    /** @type {Map<string, number>} */
    this.inv = new Map();
    this.hotbar = rules.defaultHotbar.slice();
    this.selected = 0;

    /** @type {Set<string>} purchased upgrade ids */
    this.upgrades = new Set();
    /** @type {Map<string, number>} items in the outbound bin, paid at dawn */
    this.shipped = new Map();

    this.settings = {
      volume: 0.7,
      shadows: 'medium',
      bloom: true,
      dayLength: rules.time.dayLength,
    };

    this.stats = { harvested: 0, earned: 0, cleared: 0, broken: 0 };

    for (const id of rules.defaultHotbar) {
      if (id) this.inv.set(id, this.isTool(id) ? 1 : 0);
    }
    for (const [id, n] of Object.entries(rules.startingInventory || {})) {
      this.inv.set(id, n);
    }
  }

  // --- table lookups -------------------------------------------------------

  def(id) {
    return this.rules.items[id] || null;
  }

  isTool(id) {
    return this.rules.items[id]?.kind === 'tool';
  }

  sellValue(id) {
    return this.rules.items[id]?.sell ?? 0;
  }

  // --- clock ---------------------------------------------------------------

  get time_() {
    return this.rules.time;
  }

  /** 0..1 through the waking day. */
  get dayProgress() {
    const t = this.rules.time;
    return (this.time - t.wakeHour) / (t.collapseHour - t.wakeHour);
  }

  get hourOfDay() {
    return this.time % 24;
  }

  get phaseIndex() {
    const t = this.rules.time;
    return Math.floor((this.day - 1) / t.daysPerPhase) % this.rules.phases.length;
  }

  get phase() {
    return this.rules.phases[this.phaseIndex];
  }

  get dayOfPhase() {
    return ((this.day - 1) % this.rules.time.daysPerPhase) + 1;
  }

  get year() {
    const t = this.rules.time;
    return Math.floor((this.day - 1) / (t.daysPerPhase * this.rules.phases.length)) + 1;
  }

  /** "6:00a" — the HUD wants something short and unambiguous. */
  get clockLabel() {
    const h24 = Math.floor(this.hourOfDay);
    const m = Math.floor((this.time % 1) * 60 / 10) * 10;
    const suffix = h24 >= 12 ? 'p' : 'a';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
  }

  // --- upgrade effects -----------------------------------------------------

  /** Every purchased upgrade's effect block. */
  *effects() {
    for (const id of this.upgrades) {
      const effect = this.rules.upgrades[id]?.effect;
      if (effect) yield effect;
    }
  }

  get maxEnergy() {
    let total = this.rules.player.maxEnergy;
    for (const e of this.effects()) total += e.energy || 0;
    return total;
  }

  get reserveMax() {
    let best = this.rules.reserveBase;
    for (const e of this.effects()) if (e.reserve) best = Math.max(best, e.reserve);
    return best;
  }

  get speedFactor() {
    let f = 1;
    for (const e of this.effects()) f *= e.speed || 1;
    return f;
  }

  get moveSpeed() {
    return this.rules.player.speed * this.speedFactor;
  }

  get runSpeed() {
    return this.rules.player.runSpeed * this.speedFactor;
  }

  /** True when an upgrade widens the named verb to a 3×3. */
  hasWide(verb) {
    for (const e of this.effects()) if (e.wide === verb) return true;
    return false;
  }

  /** True when an upgrade makes the named tool class a one-hit. */
  hasPower(toolClass) {
    for (const e of this.effects()) if (e.power === toolClass) return true;
    return false;
  }

  // --- vitals --------------------------------------------------------------

  /** Returns false (and spends nothing) when there isn't the energy for it. */
  spendEnergy(amount) {
    if (this.energy < amount) return false;
    this.energy = Math.max(0, this.energy - amount);
    return true;
  }

  restoreEnergy(fraction = 1) {
    this.energy = Math.round(this.maxEnergy * fraction);
  }

  // --- wallet --------------------------------------------------------------

  earn(amount) {
    this.gold += amount;
    this.stats.earned += amount;
  }

  spend(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  // --- inventory -----------------------------------------------------------

  count(id) {
    return this.inv.get(id) || 0;
  }

  add(id, n = 1) {
    if (!this.rules.items[id]) return 0;
    const next = this.count(id) + n;
    this.inv.set(id, next);
    // A brand-new item drops onto the first free hotbar slot so it's usable
    // straight away rather than buried in the pack.
    if (!this.hotbar.includes(id)) {
      const free = this.hotbar.indexOf(null);
      if (free >= 0) this.hotbar[free] = id;
    }
    return next;
  }

  take(id, n = 1) {
    const have = this.count(id);
    if (have < n) return false;
    const left = have - n;
    if (left <= 0 && !this.isTool(id)) {
      this.inv.delete(id);
      // Keep the slot rather than reshuffling the bar under the player's thumb.
      const slot = this.hotbar.indexOf(id);
      if (slot >= 0) this.hotbar[slot] = null;
    } else {
      this.inv.set(id, left);
    }
    return true;
  }

  /** Stacks worth showing in the pack, tools first then everything else. */
  stacks() {
    const items = this.rules.items;
    const out = [];
    for (const [id, n] of this.inv) {
      const def = items[id];
      if (!def) continue;
      if (def.kind !== 'tool' && n <= 0) continue;
      out.push({ id, count: n, def });
    }
    const order = this.rules.stackOrder || ['tool', 'seed', 'sapling'];
    const rank = (s) => {
      const at = order.indexOf(s.def.kind);
      return at < 0 ? order.length : at;
    };
    out.sort((a, b) => rank(a) - rank(b) || a.def.name.localeCompare(b.def.name));
    return out;
  }

  get held() {
    return this.hotbar[this.selected];
  }

  get heldDef() {
    const id = this.held;
    return id ? this.rules.items[id] : null;
  }

  select(index) {
    this.selected = ((index % HOTBAR_SLOTS) + HOTBAR_SLOTS) % HOTBAR_SLOTS;
  }

  cycle(dir) {
    this.select(this.selected + dir);
  }

  assignToHotbar(id) {
    const existing = this.hotbar.indexOf(id);
    if (existing >= 0) {
      this.selected = existing;
      return existing;
    }
    const slot = this.hotbar.indexOf(null);
    const target = slot >= 0 ? slot : this.selected;
    this.hotbar[target] = id;
    this.selected = target;
    return target;
  }

  // --- persistence ---------------------------------------------------------

  serialize() {
    return {
      seed: this.seed,
      character: this.character,
      day: this.day,
      time: this.time,
      weather: this.weather,
      gold: this.gold,
      energy: this.energy,
      reserve: this.reserve,
      inv: Array.from(this.inv.entries()),
      hotbar: this.hotbar.slice(),
      selected: this.selected,
      upgrades: Array.from(this.upgrades),
      shipped: Array.from(this.shipped.entries()),
      settings: { ...this.settings },
      stats: { ...this.stats },
    };
  }

  /**
   * `reserve` and the stat names were called `water`/`chopped`/`mined` before
   * the two games were split apart, so both spellings are accepted — an
   * in-progress farm shouldn't be the price of the refactor.
   */
  static deserialize(rules, data) {
    const state = new GameState(rules, data.seed);
    const items = rules.items;
    state.character = data.character ?? state.character;
    state.day = data.day ?? 1;
    state.time = data.time ?? rules.time.wakeHour;
    state.weather = data.weather ?? state.weather;
    state.gold = data.gold ?? rules.economy.startingGold;
    state.energy = data.energy ?? rules.player.maxEnergy;
    state.reserve = data.reserve ?? data.water ?? rules.reserveBase;
    state.inv = new Map((data.inv || []).filter(([id]) => items[id]));
    state.hotbar = Array.from({ length: HOTBAR_SLOTS }, (_, i) => {
      const id = data.hotbar?.[i];
      return id && items[id] ? id : null;
    });
    state.selected = data.selected ?? 0;
    state.upgrades = new Set((data.upgrades || []).filter((id) => rules.upgrades[id]));
    state.shipped = new Map((data.shipped || []).filter(([id]) => items[id]));
    Object.assign(state.settings, data.settings || {});
    Object.assign(state.stats, data.stats || {});
    if (data.stats) {
      state.stats.cleared = data.stats.cleared ?? data.stats.chopped ?? 0;
      state.stats.broken = data.stats.broken ?? data.stats.mined ?? 0;
    }
    return state;
  }
}

/** Defaults a game's rules block is filled out against. */
export const RULE_DEFAULTS = {
  time: TIME,
  player: PLAYER,
  economy: ECONOMY,
  reserveBase: 20,
};
