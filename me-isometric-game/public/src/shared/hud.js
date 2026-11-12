import * as THREE from 'three';

const TOAST_ICONS = { info: '◆', warn: '⚠️', bad: '✖', cash: '◉' };
const _v = new THREE.Vector3();

/**
 * Everything on the glass: the clock dial, the wallet, the hotbar, and the
 * floating "+3 Turnip" text that makes a harvest feel like it landed.
 *
 * The HUD reads game state, it never writes it. Per-frame work is kept to
 * string compares against the last value written, so a steady frame does almost
 * no DOM work at all.
 *
 * Wording comes from the game's vocab — the same meter is Energy on a farm and
 * Suit O₂ on the Moon — but the widgets themselves never change.
 */
export class Hud {
  constructor(vocab) {
    this.vocab = vocab;
    this.el = {
      boot: document.getElementById('boot'),
      bootFill: document.getElementById('boot-fill'),
      bootStatus: document.getElementById('boot-status'),
      bootError: document.getElementById('boot-error'),
      bootTitle: document.getElementById('boot-title'),
      bootMark: document.getElementById('boot-mark'),
      bootTag: document.getElementById('boot-tag'),

      hud: document.getElementById('hud'),
      dial: document.getElementById('clock-dial'),
      clockTime: document.getElementById('clock-time'),
      clockDay: document.getElementById('clock-day'),
      phaseIcon: document.getElementById('phase-icon'),
      phaseName: document.getElementById('phase-name'),
      phaseDay: document.getElementById('phase-day'),

      gold: document.getElementById('gold-value'),
      goldUnit: document.getElementById('gold-unit'),
      energyLabel: document.getElementById('energy-label'),
      energyFill: document.getElementById('energy-fill'),
      energyValue: document.getElementById('energy-value'),
      reserveLabel: document.getElementById('reserve-label'),
      reserveFill: document.getElementById('reserve-fill'),
      reserveValue: document.getElementById('reserve-value'),

      readout: document.getElementById('tile-readout'),
      toasts: document.getElementById('toasts'),
      floaters: document.getElementById('floaters'),
      hotbar: document.getElementById('hotbar'),
      heldLabel: document.getElementById('held-label'),

      daybreak: document.getElementById('daybreak'),
      daybreakTitle: document.getElementById('daybreak-title'),
      daybreakSub: document.getElementById('daybreak-sub'),
      daybreakLog: document.getElementById('daybreak-log'),
    };

    this.dialCtx = this.el.dial.getContext('2d');
    this.slots = [];
    this.camera = null;
    this.time = null;
    this._last = {};
    this._onSlot = null;

    this.applyVocab();
    this.buildHotbar();
  }

  applyVocab() {
    const v = this.vocab.hud;
    this.el.energyLabel.textContent = v.energy;
    this.el.reserveLabel.textContent = v.reserve;
    this.el.goldUnit.textContent = v.currency;
    this.el.hud.dataset.game = this.vocab.id;
  }

  setCamera(camera) {
    this.camera = camera;
  }

  /** The clock dial needs to know where the waking day starts and ends. */
  setClock(time) {
    this.time = time;
  }

  onSlotClick(fn) {
    this._onSlot = fn;
  }

  // --- boot ----------------------------------------------------------------

  showBoot({ name, icon, tagline }) {
    this.el.boot.hidden = false;
    this.el.bootTitle.textContent = name;
    this.el.bootMark.textContent = icon;
    this.el.bootTag.textContent = tagline;
    this.el.bootError.hidden = true;
  }

  progress(fraction, label) {
    this.el.bootFill.style.width = `${Math.round(fraction * 100)}%`;
    if (label) this.el.bootStatus.textContent = label;
  }

  bootError(message) {
    this.el.bootError.hidden = false;
    this.el.bootError.textContent = message;
  }

  enterGame() {
    this.el.boot.hidden = true;
    this.el.hud.hidden = false;
  }

  // --- hotbar --------------------------------------------------------------

  buildHotbar() {
    this.el.hotbar.innerHTML = '';
    this.slots = [];
    for (let i = 0; i < 8; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot is-empty';
      slot.innerHTML = `<span class="slot-key">${i + 1}</span><span class="slot-icon">·</span><span class="slot-count"></span>`;
      slot.addEventListener('click', () => this._onSlot?.(i));
      this.el.hotbar.append(slot);
      this.slots.push({
        root: slot,
        icon: slot.querySelector('.slot-icon'),
        count: slot.querySelector('.slot-count'),
      });
    }
  }

  refreshHotbar(state) {
    for (let i = 0; i < this.slots.length; i++) {
      const id = state.hotbar[i];
      const def = id ? state.def(id) : null;
      const slot = this.slots[i];
      const count = id ? state.count(id) : 0;

      slot.root.classList.toggle('is-empty', !def);
      slot.root.classList.toggle('is-active', i === state.selected);
      slot.icon.textContent = def ? def.icon : '·';
      slot.count.textContent = def && def.kind !== 'tool' ? String(count) : '';
      slot.root.title = def ? `${def.name}${def.desc ? ` — ${def.desc}` : ''}` : 'Empty slot';
    }
    this.el.heldLabel.textContent = state.heldDef?.name ?? this.vocab.hud.emptyHand;
  }

  // --- per-frame -----------------------------------------------------------

  update(state, nightFactor) {
    const v = this.vocab.hud;
    const clock = state.clockLabel;
    if (clock !== this._last.clock) {
      this.el.clockTime.textContent = clock;
      this._last.clock = clock;
    }
    if (state.day !== this._last.day) {
      this.el.clockDay.textContent = `${v.dayWord} ${state.day}`;
      this.el.phaseIcon.textContent = state.phase.icon;
      this.el.phaseName.textContent = state.phase.name;
      this.el.phaseDay.textContent =
        `${v.dayWord.toLowerCase()} ${state.dayOfPhase} of ${state.rules.time.daysPerPhase}`;
      this._last.day = state.day;
    }

    if (state.gold !== this._last.gold) {
      this.el.gold.textContent = String(state.gold);
      if (this._last.gold !== undefined) {
        this.el.gold.classList.remove('is-bump');
        void this.el.gold.offsetWidth; // restart the animation
        this.el.gold.classList.add('is-bump');
      }
      this._last.gold = state.gold;
    }

    const energy = Math.round(state.energy);
    if (energy !== this._last.energy) {
      const pct = (energy / state.maxEnergy) * 100;
      this.el.energyFill.style.width = `${pct}%`;
      this.el.energyValue.textContent = String(energy);
      this.el.energyFill.parentElement.classList.toggle('is-low', pct < 20);
      this._last.energy = energy;
    }

    if (state.reserve !== this._last.reserve) {
      const pct = (state.reserve / state.reserveMax) * 100;
      this.el.reserveFill.style.width = `${pct}%`;
      this.el.reserveValue.textContent = String(state.reserve);
      this.el.reserveFill.parentElement.classList.toggle('is-low', state.reserve === 0);
      this._last.reserve = state.reserve;
    }

    this.drawDial(state, nightFactor);
  }

  /** The dial: one sweep from waking up to falling over. */
  drawDial(state, nightFactor) {
    const p = Math.max(0, Math.min(1, state.dayProgress));
    const key = `${p.toFixed(3)}|${nightFactor.toFixed(2)}`;
    if (key === this._last.dial) return;
    this._last.dial = key;

    const dial = this.vocab.dial;
    const ctx = this.dialCtx;
    const size = this.el.dial.width;
    const c = size / 2;
    const r = c - 12;
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.strokeStyle = dial.track;
    ctx.lineWidth = 10;
    ctx.stroke();

    // Hour ticks every three hours of the waking day.
    const hours = this.time.collapseHour - this.time.wakeHour;
    for (let h = 0; h <= hours; h += 3) {
      const a = -Math.PI / 2 + (h / hours) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * (r - 7), c + Math.sin(a) * (r - 7));
      ctx.lineTo(c + Math.cos(a) * (r + 6), c + Math.sin(a) * (r + 6));
      ctx.strokeStyle = dial.ticks;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const end = -Math.PI / 2 + p * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(c, c, r, -Math.PI / 2, end);
    ctx.strokeStyle = nightFactor > 0.5 ? dial.nightArc : dial.dayArc;
    ctx.lineWidth = 10;
    ctx.stroke();

    // The head of the sweep is the sun until dusk, then the night marker.
    ctx.beginPath();
    ctx.arc(c + Math.cos(end) * r, c + Math.sin(end) * r, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = nightFactor > 0.5 ? dial.nightHead : dial.dayHead;
    ctx.fill();
    ctx.strokeStyle = dial.outline;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  setReadout(html) {
    const el = this.el.readout;
    if (!html) {
      if (!el.hidden) el.hidden = true;
      return;
    }
    if (html !== this._last.readout) {
      el.innerHTML = html;
      this._last.readout = html;
    }
    el.hidden = false;
  }

  // --- messages ------------------------------------------------------------

  toast(message, tone = 'info') {
    const icons = { ...TOAST_ICONS, info: this.vocab.hud.toastIcon || TOAST_ICONS.info };
    const el = document.createElement('div');
    el.className = `toast tone-${tone}`;
    el.innerHTML = `<span class="toast-icon">${icons[tone] || icons.info}</span><span></span>`;
    el.lastElementChild.textContent = message;
    this.el.toasts.append(el);

    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 320);
    }, 3200);

    // Never let a burst of messages push the oldest off screen.
    while (this.el.toasts.childElementCount > 4) this.el.toasts.firstElementChild.remove();
  }

  /** World-space text that rises and fades — the reward beat. */
  floater(worldX, worldZ, text, tone = 'good', height = 1.1) {
    if (!this.camera) return;
    _v.set(worldX, height, worldZ).project(this.camera);
    if (_v.z > 1) return;

    const el = document.createElement('div');
    el.className = `floater tone-${tone}`;
    el.textContent = text;
    el.style.left = `${(_v.x * 0.5 + 0.5) * 100}%`;
    el.style.top = `${(-_v.y * 0.5 + 0.5) * 100}%`;
    this.el.floaters.append(el);
    setTimeout(() => el.remove(), 1250);
  }

  // --- day transition ------------------------------------------------------

  /**
   * Fades the world out, shows the morning card, and resolves once it's gone.
   * @returns {Promise<void>}
   */
  async daybreak({ title, sub, lines }, holdMs = 2200) {
    const el = this.el.daybreak;
    this.el.daybreakTitle.textContent = title;
    this.el.daybreakSub.textContent = sub;
    this.el.daybreakLog.innerHTML = '';
    for (const line of lines.slice(0, 5)) {
      const li = document.createElement('li');
      li.textContent = line;
      this.el.daybreakLog.append(li);
    }
    el.classList.remove('is-out');
    el.hidden = false;

    await wait(holdMs);
    el.classList.add('is-out');
    await wait(480);
    el.hidden = true;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
