/**
 * The modal layer: pack, store, field guide, map and settings.
 *
 * Panels are rendered on open rather than kept live — nothing behind them
 * changes while they're up (the world is paused), so there's no reason to pay
 * for continuous updates.
 *
 * Every panel here is the same in both games: a grid of stacks, a list of rows
 * with a price and a button, a table of economics, a top-down canvas. What
 * differs is the words and the palette, and both arrive in the game's rules.
 */
export class Panels {
  constructor({ state, sfx, hud, grid, player, world, growth, rules, on }) {
    this.state = state;
    this.sfx = sfx;
    this.hud = hud;
    this.grid = grid;
    this.player = player;
    this.world = world;
    this.growth = growth;
    this.rules = rules;
    this.vocab = rules.vocab;
    this.on = on;

    this.root = document.getElementById('modal-root');
    this.sections = new Map();
    for (const el of this.root.querySelectorAll('[data-modal]')) {
      this.sections.set(el.dataset.modal, el);
    }
    this.railButtons = Array.from(document.querySelectorAll('.rail-btn'));
    this.open = null;
    this.shopTab = 'grow';

    this.applyVocab();
    this.bind();
  }

  /** Panel titles and tab labels are the game's, the markup is not. */
  applyVocab() {
    const p = this.vocab.panels;
    for (const [key, el] of this.sections) {
      const h = el.querySelector('.modal-head h2');
      if (h && p.titles[key]) h.textContent = p.titles[key];
    }
    for (const tab of this.root.querySelectorAll('[data-shop-tab]')) {
      const label = p.shopTabs[tab.dataset.shopTab];
      if (label) tab.textContent = label;
    }
    const foot = document.getElementById('map-foot');
    if (foot) foot.innerHTML = p.mapFoot;
    const invFoot = document.getElementById('inv-foot');
    if (invFoot) invFoot.textContent = p.invFoot;
  }

  bind() {
    for (const btn of this.railButtons) {
      btn.addEventListener('click', () => this.toggle(btn.dataset.panel));
    }
    for (const el of this.root.querySelectorAll('[data-close]')) {
      el.addEventListener('click', () => this.close());
    }
    for (const tab of this.root.querySelectorAll('[data-shop-tab]')) {
      tab.addEventListener('click', () => {
        this.shopTab = tab.dataset.shopTab;
        for (const other of this.root.querySelectorAll('[data-shop-tab]')) {
          other.classList.toggle('is-active', other === tab);
        }
        this.sfx.play('ui');
        this.renderShop();
      });
    }

    this.bindSettings();
  }

  bindSettings() {
    const volume = document.getElementById('set-volume');
    const shadows = document.getElementById('set-shadows');
    const bloom = document.getElementById('set-bloom');
    const dayLength = document.getElementById('set-daylength');

    volume.value = String(Math.round(this.state.settings.volume * 100));
    shadows.value = this.state.settings.shadows;
    bloom.checked = this.state.settings.bloom;
    dayLength.value = String(this.state.settings.dayLength);

    volume.addEventListener('input', () => {
      this.state.settings.volume = Number(volume.value) / 100;
      this.on.setting('volume', this.state.settings.volume);
    });
    shadows.addEventListener('change', () => {
      this.state.settings.shadows = shadows.value;
      this.on.setting('shadows', shadows.value);
    });
    bloom.addEventListener('change', () => {
      this.state.settings.bloom = bloom.checked;
      this.on.setting('bloom', bloom.checked);
    });
    dayLength.addEventListener('change', () => {
      this.state.settings.dayLength = Number(dayLength.value);
      this.on.setting('dayLength', this.state.settings.dayLength);
    });

    const menu = this.vocab.panels.menu;
    const save = document.getElementById('btn-save');
    const sleep = document.getElementById('btn-sleep');
    const quit = document.getElementById('btn-quit');
    save.textContent = menu.save;
    sleep.textContent = menu.sleep;
    quit.textContent = menu.quit;

    save.addEventListener('click', () => this.on.save());
    sleep.addEventListener('click', () => {
      this.close();
      this.on.sleep();
    });
    quit.addEventListener('click', () => this.on.quit());
    document.getElementById('btn-lobby').addEventListener('click', () => this.on.lobby());
  }

  note(message) {
    document.getElementById('save-note').textContent = message;
  }

  // --- open / close --------------------------------------------------------

  get isOpen() {
    return this.open !== null;
  }

  toggle(name) {
    if (this.open === name) this.close();
    else this.show(name);
  }

  show(name) {
    const section = this.sections.get(name);
    if (!section) return;
    for (const [key, el] of this.sections) el.hidden = key !== name;
    this.root.hidden = false;
    document.body.dataset.modal = 'open';
    this.open = name;
    for (const btn of this.railButtons) btn.classList.toggle('is-open', btn.dataset.panel === name);
    this.sfx.play('ui');
    this.render(name);
  }

  close() {
    if (!this.open) return;
    this.root.hidden = true;
    delete document.body.dataset.modal;
    for (const [, el] of this.sections) el.hidden = true;
    for (const btn of this.railButtons) btn.classList.remove('is-open');
    this.open = null;
    this.sfx.play('ui');
  }

  render(name) {
    if (name === 'inventory') this.renderInventory();
    if (name === 'shop') this.renderShop();
    if (name === 'almanac') this.renderAlmanac();
    if (name === 'map') this.drawMap();
    if (name === 'menu') this.note('');
  }

  // --- inventory -----------------------------------------------------------

  renderInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';
    const stacks = this.state.stacks();

    for (const { id, count, def } of stacks) {
      const cell = document.createElement('button');
      cell.className = 'inv-cell';
      cell.type = 'button';
      cell.title = def.desc ? `${def.name} — ${def.desc}` : def.name;
      cell.innerHTML = `
        <span class="inv-icon">${def.icon}</span>
        <span class="inv-name"></span>
        <span class="inv-count">${def.kind === 'tool' ? '' : count}</span>`;
      cell.querySelector('.inv-name').textContent = def.name;
      cell.addEventListener('click', (e) => {
        if (e.shiftKey && def.kind !== 'tool') {
          this.state.take(id, count);
          this.sfx.play('ui');
          this.renderInventory();
          this.on.refresh();
          return;
        }
        this.state.assignToHotbar(id);
        this.sfx.play('ui');
        this.on.refresh();
        this.renderInventory();
      });
      grid.append(cell);
    }

    // Pad the grid so it doesn't collapse to one ragged row.
    for (let i = stacks.length; i < 18; i++) {
      const cell = document.createElement('div');
      cell.className = 'inv-cell is-empty';
      grid.append(cell);
    }
  }

  // --- shop ----------------------------------------------------------------

  renderShop() {
    const list = document.getElementById('shop-list');
    list.innerHTML = '';
    const rows = this.shopTab === 'grow' ? this.growRows()
      : this.shopTab === 'perennial' ? this.perennialRows()
        : this.shopTab === 'upgrade' ? this.upgradeRows()
          : this.sellRows();

    if (rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shop-empty';
      empty.textContent = this.shopTab === 'sell'
        ? this.vocab.panels.nothingToSell
        : this.vocab.panels.nothingToBuy;
      list.append(empty);
      return;
    }
    for (const row of rows) list.append(row);
  }

  row({ icon, name, desc, price, action, label, disabled, locked }) {
    const el = document.createElement('div');
    el.className = `shop-row${locked ? ' is-locked' : ''}`;
    el.innerHTML = `
      <div class="shop-icon">${icon}</div>
      <div>
        <div class="shop-name"></div>
        <div class="shop-desc"></div>
      </div>
      <div style="text-align:right">
        <div class="shop-price">${price}</div>
        <button class="shop-buy" type="button">${label}</button>
      </div>`;
    el.querySelector('.shop-name').textContent = name;
    el.querySelector('.shop-desc').textContent = desc;
    const button = el.querySelector('.shop-buy');
    button.disabled = !!disabled;
    button.addEventListener('click', (e) => action(e));
    return el;
  }

  growRows() {
    const p = this.vocab.panels;
    const cur = this.state.phase.key;
    const cash = this.vocab.hud.currency;
    return Object.entries(this.rules.growables).map(([id, def]) => {
      const inPhase = def.phases.includes(cur);
      const price = def.seedPrice;
      const days = this.growth.totalDays(def);
      const sells = this.state.sellValue(def.item);
      return this.row({
        icon: def.icon,
        name: this.rules.items[this.rules.seedIdFor(id)].name,
        desc: `${def.phases.map((k) => this.phaseName(k)).join(' / ')} · ${days} ${p.dayUnit} · ${p.sellsFor} ${sells}${cash}`,
        price: `${price}${cash}`,
        label: p.buy,
        locked: !inPhase,
        disabled: !inPhase || this.state.gold < price,
        action: (e) => this.buy(this.rules.seedIdFor(id), price, e.shiftKey ? 5 : 1),
      });
    });
  }

  perennialRows() {
    const p = this.vocab.panels;
    const cash = this.vocab.hud.currency;
    return Object.entries(this.rules.perennials).map(([id, def]) => this.row({
      icon: def.icon,
      name: def.name,
      desc: p.perennialDesc(def, def.phases.map((k) => this.phaseName(k)).join(' / ')),
      price: `${def.price}${cash}`,
      label: p.buy,
      disabled: this.state.gold < def.price,
      action: () => this.buy(this.rules.saplingIdFor(id), def.price, 1),
    }));
  }

  upgradeRows() {
    const p = this.vocab.panels;
    const cash = this.vocab.hud.currency;
    return Object.entries(this.rules.upgrades)
      .filter(([id]) => !this.state.upgrades.has(id))
      .map(([id, up]) => this.row({
        icon: up.icon,
        name: up.name,
        desc: up.desc,
        price: `${up.price}${cash}`,
        label: p.buy,
        disabled: this.state.gold < up.price,
        action: () => {
          if (!this.state.spend(up.price)) return this.deny();
          this.state.upgrades.add(id);
          this.sfx.play('levelup');
          this.hud.toast(p.acquired(up.name), 'cash');
          this.on.refresh();
          this.renderShop();
        },
      }));
  }

  sellRows() {
    const p = this.vocab.panels;
    const cash = this.vocab.hud.currency;
    return this.state.stacks()
      .filter((s) => s.def.kind !== 'tool' && this.state.sellValue(s.id) > 0 && s.count > 0)
      .map(({ id, count, def }) => this.row({
        icon: def.icon,
        name: def.name,
        desc: p.sellDesc(count),
        price: `${this.state.sellValue(id)}${cash} ${p.each}`,
        label: p.sell,
        action: (e) => {
          const qty = e.shiftKey ? count : 1;
          if (!this.state.take(id, qty)) return this.deny();
          const gained = this.state.sellValue(id) * qty;
          this.state.earn(gained);
          this.sfx.play('coin');
          this.hud.toast(p.sold(qty, def.name, gained), 'cash');
          this.on.refresh();
          this.renderShop();
        },
      }));
  }

  buy(itemId, price, qty) {
    const total = price * qty;
    if (!this.state.spend(total)) return this.deny();
    this.state.add(itemId, qty);
    this.sfx.play('buy');
    this.hud.toast(this.vocab.panels.bought(qty, this.rules.items[itemId].name, total), 'info');
    this.on.refresh();
    this.renderShop();
  }

  deny() {
    this.sfx.play('deny');
    this.hud.toast(this.vocab.panels.cantAfford, 'bad');
  }

  phaseName(key) {
    return this.rules.phases.find((p) => p.key === key)?.name ?? key;
  }

  // --- field guide ---------------------------------------------------------

  renderAlmanac() {
    const body = document.getElementById('almanac-body');
    const p = this.vocab.panels;
    const cash = this.vocab.hud.currency;
    body.innerHTML = '';

    for (const def of Object.values(this.rules.growables)) {
      const days = this.growth.totalDays(def);
      const sells = this.state.sellValue(def.item);
      const revenue = sells * ((def.yield[0] + def.yield[1]) / 2);
      const perDay = Math.round((revenue - def.seedPrice) / days);
      const card = document.createElement('article');
      card.className = 'almanac-card';
      card.innerHTML = `
        <h3><span>${def.icon}</span><span></span></h3>
        <dl>
          <dt>${p.guide.stock}</dt><dd>${def.seedPrice}${cash}</dd>
          <dt>${p.guide.sells}</dt><dd>${sells}${cash}</dd>
          <dt>${p.guide.takes}</dt><dd>${days} ${p.dayUnit}</dd>
          <dt>${p.guide.yield}</dt><dd>${def.yield[0]}–${def.yield[1]}</dd>
          ${def.regrow ? `<dt>${p.guide.regrow}</dt><dd>${def.regrow} ${p.dayUnit}</dd>` : ''}
          <dt>${p.guide.perDay}</dt><dd>${perDay}${cash}</dd>
        </dl>
        <div class="almanac-seasons">
          ${this.rules.phases.map((s) =>
            `<span class="${def.phases.includes(s.key) ? 'on' : ''}">${s.short}</span>`).join('')}
        </div>`;
      card.querySelector('h3 span:last-child').textContent = def.name;
      body.append(card);
    }

    const stats = document.createElement('article');
    stats.className = 'almanac-card';
    stats.innerHTML = `
      <h3><span>📓</span><span>${p.guide.ledger}</span></h3>
      <dl>
        ${p.ledger.map(([label, key]) => {
          const value = key === 'day' ? this.state.day
            : key === 'year' ? this.state.year
              : this.state.stats[key] ?? 0;
          return `<dt>${label}</dt><dd>${value}${key === 'earned' ? cash : ''}</dd>`;
        }).join('')}
      </dl>`;
    body.append(stats);
  }

  // --- map -----------------------------------------------------------------

  drawMap() {
    const canvas = document.getElementById('map-canvas');
    const ctx = canvas.getContext('2d');
    const g = this.grid;
    const map = this.rules.map;
    const cell = canvas.width / g.size;

    ctx.fillStyle = map.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tint = this.state.phase.tint;
    for (let z = 0; z < g.size; z++) {
      for (let x = 0; x < g.size; x++) {
        const i = g.idx(x, z);
        const kind = g.terrain[i];
        let colour;
        if (g.prepared[i]) {
          colour = g.charge[i] > 0 ? map.preparedCharged : map.prepared;
        } else if (map.tinted.includes(kind)) {
          colour = hex(tint);
          const scale = map.tintScale?.[kind];
          if (scale !== undefined) colour = shade(colour, scale);
        } else {
          colour = hex(map.colors[kind] ?? 0x808080);
        }
        ctx.fillStyle = colour;
        ctx.fillRect(x * cell, z * cell, cell + 0.5, cell + 0.5);
      }
    }

    // Anything the player put there, drawn on top.
    for (const [i, plot] of g.plots) {
      const def = this.rules.growables[plot.id];
      ctx.fillStyle = def && this.growth.isMature(def, plot.stage) ? map.plotReady : map.plotGrowing;
      ctx.fillRect(g.xOf(i) * cell + cell * 0.25, g.zOf(i) * cell + cell * 0.25, cell * 0.5, cell * 0.5);
    }
    for (const [i, obj] of g.objects) {
      const colour = map.marks[obj.kind];
      if (!colour) continue;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc((g.xOf(i) + 0.5) * cell, (g.zOf(i) + 0.5) * cell, cell * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // The border, so the playable area reads at a glance.
    const b = this.rules.world.border;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b * cell, b * cell, (g.size - b * 2) * cell, (g.size - b * 2) * cell);

    ctx.beginPath();
    ctx.arc((this.player.pos.x + 0.5) * cell, (this.player.pos.z + 0.5) * cell, cell * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = map.player;
    ctx.fill();
    ctx.strokeStyle = map.playerOutline;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function hex(n) {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function shade(colour, factor) {
  const n = parseInt(colour.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `rgb(${r},${g},${b})`;
}
