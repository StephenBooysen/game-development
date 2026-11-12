import * as THREE from 'three';

const BOX = { w: 46, h: 22, d: 46 };
const MAX_STREAKS = 1200;
const MAX_POINTS = 1400;

/**
 * Falling-particle weather, drawn as one buffer per shape and followed around
 * by the camera focus.
 *
 * Both shapes are a box of particles that wrap when they leave the bottom, so
 * the cost is fixed no matter how long the storm lasts. Streaks are line
 * segments because a streak reads as rain — or as a meteor — from an isometric
 * angle where a dot does not; points carry snow and blowing dust.
 *
 * The buffers are allocated once at their maximum and the draw range is moved
 * to whatever the current mode asks for, so switching weather costs nothing.
 *
 * A mode looks like:
 *   { kind:'streak'|'point', count, color, opacity, speed:[min,max],
 *     wind:[x,z], sway, streak, slant, size }
 */
export class ParticleWeather {
  /**
   * @param {THREE.Scene} scene
   * @param {Record<string, object>} modes named weather definitions
   * @param {string[]} [charging] modes that top up every plot overnight
   */
  constructor(scene, modes, charging = []) {
    this.scene = scene;
    this.modes = modes;
    this.charging = new Set(charging);
    this.mode = 'clear';
    this.def = null;
    this.focus = new THREE.Vector3();
    this.time = 0;

    this.streaks = this.buildStreaks();
    this.points = this.buildPoints();
    scene.add(this.streaks, this.points);
    this.streaks.visible = false;
    this.points.visible = false;
  }

  buildStreaks() {
    const positions = new Float32Array(MAX_STREAKS * 2 * 3);
    // x, y, z, speed
    this.streakSeeds = new Float32Array(MAX_STREAKS * 4);
    for (let i = 0; i < MAX_STREAKS; i++) this.seedStreak(i, true);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xbcd8ef, transparent: true, opacity: 0.5, fog: false,
    });
    const mesh = new THREE.LineSegments(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 900;
    return mesh;
  }

  buildPoints() {
    const positions = new Float32Array(MAX_POINTS * 3);
    // x, y, z, speed, phase
    this.pointSeeds = new Float32Array(MAX_POINTS * 5);
    for (let i = 0; i < MAX_POINTS; i++) this.seedPoint(i, true);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.12, transparent: true, opacity: 0.9,
      sizeAttenuation: true, fog: false, depthWrite: false,
    });
    const mesh = new THREE.Points(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 900;
    return mesh;
  }

  seedStreak(i, initial) {
    const s = i * 4;
    const [lo, hi] = this.def?.speed || [22, 34];
    this.streakSeeds[s + 0] = (Math.random() - 0.5) * BOX.w;
    this.streakSeeds[s + 1] = initial ? Math.random() * BOX.h : BOX.h;
    this.streakSeeds[s + 2] = (Math.random() - 0.5) * BOX.d;
    this.streakSeeds[s + 3] = lo + Math.random() * (hi - lo);
  }

  seedPoint(i, initial) {
    const s = i * 5;
    const [lo, hi] = this.def?.speed || [1.1, 2.4];
    this.pointSeeds[s + 0] = (Math.random() - 0.5) * BOX.w;
    this.pointSeeds[s + 1] = initial ? Math.random() * BOX.h : BOX.h;
    this.pointSeeds[s + 2] = (Math.random() - 0.5) * BOX.d;
    this.pointSeeds[s + 3] = lo + Math.random() * (hi - lo);
    this.pointSeeds[s + 4] = Math.random() * Math.PI * 2;
  }

  setMode(mode) {
    this.mode = mode;
    this.def = this.modes[mode] || null;
    this.time = 0;

    const def = this.def;
    const streaking = def?.kind === 'streak';
    const pointing = def?.kind === 'point';
    this.streaks.visible = streaking;
    this.points.visible = pointing;

    if (streaking) {
      const n = Math.min(def.count ?? 900, MAX_STREAKS);
      this.streaks.geometry.setDrawRange(0, n * 2);
      this.streaks.material.color.setHex(def.color ?? 0xbcd8ef);
      this.streaks.material.opacity = def.opacity ?? 0.5;
      for (let i = 0; i < n; i++) this.seedStreak(i, true);
    }
    if (pointing) {
      const n = Math.min(def.count ?? 900, MAX_POINTS);
      this.points.geometry.setDrawRange(0, n);
      this.points.material.color.setHex(def.color ?? 0xffffff);
      this.points.material.opacity = def.opacity ?? 0.9;
      this.points.material.size = def.size ?? 0.12;
      for (let i = 0; i < n; i++) this.seedPoint(i, true);
    }
  }

  /** True when this weather tops up every plot for you overnight. */
  charges(mode) {
    return this.charging.has(mode);
  }

  update(dt, focus) {
    this.focus.copy(focus);
    this.time += dt;
    if (this.streaks.visible) this.stepStreaks(dt);
    if (this.points.visible) this.stepPoints(dt);
  }

  stepStreaks(dt) {
    const def = this.def;
    const n = Math.min(def.count ?? 900, MAX_STREAKS);
    const arr = this.streaks.geometry.attributes.position.array;
    const len = def.streak ?? 0.55;
    const slant = def.slant ?? 1.4;
    const [wx, wz] = def.wind || [0, 0];

    for (let i = 0; i < n; i++) {
      const s = i * 4;
      const speed = this.streakSeeds[s + 3];
      this.streakSeeds[s + 1] -= speed * dt;
      this.streakSeeds[s + 0] += wx * dt;
      this.streakSeeds[s + 2] += wz * dt;
      if (this.streakSeeds[s + 1] < 0) this.seedStreak(i, false);

      const x = this.focus.x + this.streakSeeds[s + 0];
      const y = this.streakSeeds[s + 1];
      const z = this.focus.z + this.streakSeeds[s + 2];
      const p = i * 6;
      arr[p + 0] = x;
      arr[p + 1] = y;
      arr[p + 2] = z;
      arr[p + 3] = x - slant * len;
      arr[p + 4] = y + len;
      arr[p + 5] = z - slant * len * 0.35;
    }
    this.streaks.geometry.attributes.position.needsUpdate = true;
  }

  stepPoints(dt) {
    const def = this.def;
    const n = Math.min(def.count ?? 900, MAX_POINTS);
    const arr = this.points.geometry.attributes.position.array;
    const sway = def.sway ?? 0.6;
    const [wx, wz] = def.wind || [0, 0];

    for (let i = 0; i < n; i++) {
      const s = i * 5;
      this.pointSeeds[s + 1] -= this.pointSeeds[s + 3] * dt;
      this.pointSeeds[s + 0] += wx * dt;
      this.pointSeeds[s + 2] += wz * dt;
      // Wrap laterally too, or a windy mode blows the whole field off-screen.
      if (this.pointSeeds[s + 0] > BOX.w * 0.5) this.pointSeeds[s + 0] -= BOX.w;
      if (this.pointSeeds[s + 0] < -BOX.w * 0.5) this.pointSeeds[s + 0] += BOX.w;
      if (this.pointSeeds[s + 2] > BOX.d * 0.5) this.pointSeeds[s + 2] -= BOX.d;
      if (this.pointSeeds[s + 2] < -BOX.d * 0.5) this.pointSeeds[s + 2] += BOX.d;
      if (this.pointSeeds[s + 1] < 0) this.seedPoint(i, false);

      const drift = Math.sin(this.time * 0.8 + this.pointSeeds[s + 4]) * sway;
      const p = i * 3;
      arr[p + 0] = this.focus.x + this.pointSeeds[s + 0] + drift;
      arr[p + 1] = this.pointSeeds[s + 1];
      arr[p + 2] = this.focus.z + this.pointSeeds[s + 2] + drift * 0.4;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
