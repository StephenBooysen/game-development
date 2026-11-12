import * as THREE from 'three';
import { findPath } from './path.js';

const SCALE = 1.35;
/** Kenney's mini characters face +Z — confirmed against the sprint lean and
 *  the seated poses, both of which pitch toward +Z. */
const FORWARD_YAW = 0;
const RADIUS = 0.3;
const STEP_DISTANCE = 0.62;

/**
 * The character: movement, animation, and whatever is currently in their hand.
 *
 * Movement is either direct (WASD, camera-relative) or a path queued by a
 * right-click. Collision is a swept box test against tile walkability done one
 * axis at a time, which lets the player slide along a fence instead of sticking
 * to it.
 *
 * Which model hangs off the hand for a given item is a game's business, so it
 * arrives as a lookup rather than an import.
 */
export class Player {
  constructor({ assets, scene, grid, state, sfx, modelName, toolModel }) {
    this.grid = grid;
    this.state = state;
    this.sfx = sfx;
    this.toolModel = toolModel || (() => null);

    this.group = new THREE.Group();
    this.group.name = 'player';
    this.model = assets.clone('chars', modelName);
    this.model.scale.setScalar(SCALE);
    this.group.add(this.model);
    scene.add(this.group);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of assets.getClips('chars', modelName)) {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    }
    this.current = null;

    // Held tools hang off the right-arm bone, so they inherit the swing for free.
    this.hand = new THREE.Group();
    this.hand.position.set(0, -0.17, 0.03);
    this.hand.rotation.set(0.42, 0, 0.14);
    (this.model.getObjectByName('arm-right') || this.model).add(this.hand);
    this.assets = assets;
    this.heldId = null;

    this.pos = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.facing = 0;
    this.targetFacing = 0;
    this.path = [];
    this.busy = 0;
    this.speed = 0;
    this._stepAccum = 0;
    this._right = new THREE.Vector3();
    this._fwd = new THREE.Vector3();

    this.play('idle');
  }

  // --- placement -----------------------------------------------------------

  spawn(x, z) {
    const tile = this.grid.nearestWalkable(Math.round(x), Math.round(z), 14);
    this.pos.set(tile.x, 0, tile.z);
    this.path.length = 0;
    this.group.position.copy(this.pos);
  }

  get tile() {
    return { x: Math.round(this.pos.x), z: Math.round(this.pos.z) };
  }

  distanceToTile(x, z) {
    return Math.hypot(this.pos.x - x, this.pos.z - z);
  }

  // --- held item -----------------------------------------------------------

  setHeld(itemId) {
    if (this.heldId === itemId) return;
    this.heldId = itemId;
    this.hand.clear();
    const model = this.toolModel(itemId);
    if (!model) return;
    const mesh = this.assets.clone(model[0], model[1]);
    mesh.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    this.hand.add(mesh);
  }

  // --- animation -----------------------------------------------------------

  play(name, { once = false, fade = 0.16, timeScale = 1 } = {}) {
    const next = this.actions[name];
    if (!next || (this.current === name && !once)) return;
    const prev = this.actions[this.current];

    next.reset();
    next.setEffectiveTimeScale(timeScale);
    next.setEffectiveWeight(1);
    if (once) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    }
    next.fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    this.current = name;
  }

  /**
   * Plays a one-shot and holds locomotion off until it's done.
   * @param {'swing'|'reach'|'gather'|'sleep'|'faint'} kind
   */
  act(kind) {
    const map = {
      swing: ['attack-melee-right', 0.55, 1.5],
      reach: ['interact-right', 0.5, 1.6],
      gather: ['pick-up', 0.6, 1.4],
      sleep: ['sit', 1.2, 1],
      faint: ['die', 1.4, 1],
    };
    const [clip, duration, timeScale] = map[kind] || map.reach;
    this.busy = duration;
    this.play(clip, { once: true, fade: 0.08, timeScale });
  }

  faceTile(x, z) {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    if (Math.abs(dx) + Math.abs(dz) < 0.01) return;
    this.targetFacing = Math.atan2(dx, dz) + FORWARD_YAW;
  }

  // --- movement ------------------------------------------------------------

  walkTo(x, z) {
    const path = findPath(this.grid, this.tile, { x, z });
    this.path = path;
    return path.length > 0;
  }

  free(x, z) {
    for (const [ox, oz] of [[-RADIUS, -RADIUS], [RADIUS, -RADIUS], [-RADIUS, RADIUS], [RADIUS, RADIUS]]) {
      if (!this.grid.walkable(Math.round(x + ox), Math.round(z + oz))) return false;
    }
    return true;
  }

  step(dx, dz) {
    if (dx && this.free(this.pos.x + dx, this.pos.z)) this.pos.x += dx;
    if (dz && this.free(this.pos.x, this.pos.z + dz)) this.pos.z += dz;
  }

  update(dt, { input, iso, frozen = false }) {
    this.mixer.update(dt);
    if (this.busy > 0) this.busy -= dt;

    let vx = 0;
    let vz = 0;

    if (!frozen && !input.blocked) {
      iso.groundBasis(this._right, this._fwd);
      let ix = 0;
      let iz = 0;
      if (input.down('KeyW', 'ArrowUp')) iz += 1;
      if (input.down('KeyS', 'ArrowDown')) iz -= 1;
      if (input.down('KeyD', 'ArrowRight')) ix += 1;
      if (input.down('KeyA', 'ArrowLeft')) ix -= 1;

      if (ix || iz) {
        this.path.length = 0;
        const len = Math.hypot(ix, iz) || 1;
        vx = (this._right.x * ix + this._fwd.x * iz) / len;
        vz = (this._right.z * ix + this._fwd.z * iz) / len;
      } else if (this.path.length) {
        const next = this.path[0];
        const dx = next.x - this.pos.x;
        const dz = next.z - this.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.14) {
          this.path.shift();
        } else {
          vx = dx / dist;
          vz = dz / dist;
        }
      }
    }

    const running = input.down('ShiftLeft', 'ShiftRight') && this.state.energy > 8;
    const speed = running ? this.state.runSpeed : this.state.moveSpeed;
    const moving = (vx || vz) && !frozen;

    if (moving) {
      this.step(vx * speed * dt, vz * speed * dt);
      this.targetFacing = Math.atan2(vx, vz) + FORWARD_YAW;
      this.speed = speed;

      // Running burns a little stamina; walking is free.
      if (running) this.state.energy = Math.max(0, this.state.energy - dt * 0.9);

      this._stepAccum += speed * dt;
      if (this._stepAccum >= STEP_DISTANCE) {
        this._stepAccum = 0;
        this.sfx.play('step');
      }
    } else {
      this.speed = 0;
      this._stepAccum = STEP_DISTANCE * 0.5;
    }

    // Shortest-way-round yaw smoothing.
    let dy = this.targetFacing - this.facing;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.facing += dy * (1 - Math.exp(-dt * 14));

    this.group.position.copy(this.pos);
    this.model.rotation.y = this.facing;

    if (this.busy <= 0) {
      if (frozen || !moving) this.play('idle');
      else this.play(running ? 'sprint' : 'walk');
    }
  }
}
