import * as THREE from 'three';
import { CAMERA } from './config.js';

const DEG = Math.PI / 180;

/**
 * Orthographic isometric rig.
 *
 * The camera orbits a focus point at a fixed pitch, snapping to four yaw
 * positions so the world always reads as a clean isometric grid. Being
 * orthographic, distance only affects clipping — the zoom level is the
 * frustum half-height.
 */
export class IsoCamera {
  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, CAMERA.far);

    this.focus = new THREE.Vector3(0, 0, 0);
    this.desiredFocus = this.focus.clone();

    this.yawStep = 0;
    this.yaw = 45 * DEG;
    this.targetYaw = this.yaw;
    this.pitch = CAMERA.pitch;

    this.viewSize = CAMERA.zoom;
    this.targetViewSize = this.viewSize;

    /**
     * Pull-back from the focus. Orthographic projection ignores it for scale,
     * but it sets how deep the world sits in view space — which is what fog and
     * the far clip are measured against. Kept well inside CAMERA.far so the sky
     * dome's far wall never clips.
     */
    this.distance = 120;
    this.aspect = 1;
    /** Extra offset applied by screen shake. */
    this.shake = new THREE.Vector3();
    this._shakeMag = 0;
    this._shakeTime = 0;

    this.apply();
  }

  onResize(w, h) {
    this.aspect = w / h;
    this.apply();
  }

  /** Rotate by whole quarter-turns. dir is +1 or -1. */
  rotate(dir) {
    this.yawStep = (this.yawStep + dir) % CAMERA.yawSteps;
    this.targetYaw = 45 * DEG + this.yawStep * (Math.PI / 2);
  }

  zoomBy(delta) {
    this.targetViewSize = THREE.MathUtils.clamp(
      this.targetViewSize * (1 + delta),
      CAMERA.zoomMin,
      CAMERA.zoomMax
    );
  }

  setFocus(x, z, immediate = false) {
    this.desiredFocus.set(x, 0, z);
    if (immediate) this.focus.copy(this.desiredFocus);
  }

  addShake(magnitude, duration = 0.3) {
    this._shakeMag = Math.max(this._shakeMag, magnitude);
    this._shakeTime = Math.max(this._shakeTime, duration);
  }

  /**
   * Screen-space right/forward vectors on the ground plane, so WASD moves the
   * player relative to how the world currently looks rather than world axes.
   */
  groundBasis(outRight, outForward) {
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    // Camera looks from (s, _, c) toward the focus, so forward is its negation.
    outForward.set(-s, 0, -c).normalize();
    outRight.set(c, 0, -s).normalize();
  }

  update(dt) {
    // Critically-damped-ish smoothing; frame-rate independent.
    const k = 1 - Math.exp(-dt * 9);

    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * (1 - Math.exp(-dt * 7));

    this.viewSize += (this.targetViewSize - this.viewSize) * k;
    this.focus.lerp(this.desiredFocus, k);

    if (this._shakeTime > 0) {
      this._shakeTime -= dt;
      const falloff = Math.max(0, this._shakeTime) * this._shakeMag;
      this.shake.set(
        (Math.random() - 0.5) * falloff,
        (Math.random() - 0.5) * falloff,
        (Math.random() - 0.5) * falloff
      );
      if (this._shakeTime <= 0) {
        this._shakeMag = 0;
        this.shake.set(0, 0, 0);
      }
    }

    this.apply();
  }

  apply() {
    const cam = this.camera;
    const half = this.viewSize;
    cam.left = -half * this.aspect;
    cam.right = half * this.aspect;
    cam.top = half;
    cam.bottom = -half;
    cam.updateProjectionMatrix();

    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    cam.position.set(
      this.focus.x + Math.sin(this.yaw) * cp * this.distance + this.shake.x,
      this.focus.y + sp * this.distance + this.shake.y,
      this.focus.z + Math.cos(this.yaw) * cp * this.distance + this.shake.z
    );
    cam.lookAt(this.focus.x + this.shake.x, this.focus.y + this.shake.y, this.focus.z + this.shake.z);
    cam.updateMatrixWorld();
  }
}
