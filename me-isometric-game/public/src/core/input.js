import * as THREE from 'three';

/**
 * Pointer + keyboard, and the ground-plane pick that turns a cursor position
 * into a tile coordinate.
 *
 * Picking against the y=0 plane analytically is both cheaper and steadier than
 * raycasting scene meshes: the tile under the cursor never flickers because a
 * crop model happened to be in the way.
 */
export class Input {
  constructor(canvas, isoCamera) {
    this.canvas = canvas;
    this.iso = isoCamera;

    this.keys = new Set();
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerInside = false;
    /** World-space point under the cursor on the ground plane. */
    this.groundPoint = new THREE.Vector3();
    /** Tile coordinate under the cursor, or null when off-plane. */
    this.hover = null;

    this.primaryDown = false;
    this.secondaryDown = false;
    this.dragging = false;

    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._listeners = { primary: [], secondary: [], wheel: [], key: [], keyup: [], pan: [] };
    this._dragStart = new THREE.Vector2();
    /** Set by attachGrid so press handlers can pick before emitting. */
    this._grid = null;

    this.bind();
  }

  attachGrid(grid) {
    this._grid = grid;
  }

  on(event, fn) {
    this._listeners[event].push(fn);
    return this;
  }

  emit(event, ...args) {
    for (const fn of this._listeners[event]) fn(...args);
  }

  /** True while any modal/inspector has focus — game input should stand down. */
  get blocked() {
    return document.body.dataset.modal === 'open';
  }

  bind() {
    const c = this.canvas;

    c.addEventListener('contextmenu', (e) => e.preventDefault());

    // Actions fire on press rather than on click: it feels markedly more
    // responsive, and holding the button then drag-paints via the frame poll.
    c.addEventListener('pointerdown', (e) => {
      // Capture is a nicety for drag-painting; if the browser refuses it the
      // click must still register, so it can't be allowed to throw out of here.
      try { c.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      this.updatePointer(e);
      this._dragStart.set(e.clientX, e.clientY);
      if (e.button === 1) {
        this.dragging = true;
        c.classList.add('is-panning');
        e.preventDefault();
        return;
      }
      if (this.blocked) return;
      this.updatePick(this._grid);
      if (e.button === 0) {
        this.primaryDown = true;
        this.emit('primary', this.hover, e);
      }
      if (e.button === 2) {
        this.secondaryDown = true;
        this.emit('secondary', this.hover, e);
      }
    });

    c.addEventListener('pointermove', (e) => {
      this.updatePointer(e);
      if (this.dragging) {
        // Middle-drag pans the focus point across the ground plane.
        const dx = e.movementX || 0;
        const dy = e.movementY || 0;
        const scale = (this.iso.viewSize * 2) / innerHeight;
        const right = new THREE.Vector3();
        const fwd = new THREE.Vector3();
        this.iso.groundBasis(right, fwd);
        const f = this.iso.desiredFocus;
        f.addScaledVector(right, -dx * scale);
        f.addScaledVector(fwd, -dy * scale / Math.sin(this.iso.pitch));
        this.emit('pan');
      }
    });

    c.addEventListener('pointerup', (e) => {
      this.updatePointer(e);
      if (e.button === 0) this.primaryDown = false;
      if (e.button === 2) this.secondaryDown = false;
      if (e.button === 1) {
        this.dragging = false;
        c.classList.remove('is-panning');
      }
      try { c.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    });

    c.addEventListener('pointerleave', () => {
      this.pointerInside = false;
      this.hover = null;
    });
    c.addEventListener('pointerenter', () => { this.pointerInside = true; });

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.emit('wheel', Math.sign(e.deltaY), e);
    }, { passive: false });

    addEventListener('keydown', (e) => {
      const code = e.code;
      if (e.repeat) { this.emit('key', code, e, true); return; }
      this.keys.add(code);
      this.emit('key', code, e, false);
    });

    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.emit('keyup', e.code, e);
    });

    // Losing focus mid-keypress otherwise leaves the player walking forever.
    addEventListener('blur', () => {
      this.keys.clear();
      this.primaryDown = false;
      this.secondaryDown = false;
      this.dragging = false;
    });
  }

  updatePointer(e) {
    this.pointer.x = (e.clientX / innerWidth) * 2 - 1;
    this.pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    this.pointerInside = true;
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  /** Recompute the ground pick. Call once per frame after the camera updates. */
  updatePick(grid = this._grid) {
    if (!grid || !this.pointerInside) {
      this.hover = null;
      return;
    }
    this._raycaster.setFromCamera(this.pointer, this.iso.camera);
    const hit = this._raycaster.ray.intersectPlane(this._plane, this.groundPoint);
    if (!hit) {
      this.hover = null;
      return;
    }
    const tx = Math.floor(this.groundPoint.x + 0.5);
    const tz = Math.floor(this.groundPoint.z + 0.5);
    this.hover = grid.inBounds(tx, tz) ? { x: tx, z: tz } : null;
  }
}
