import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const SHADOW_SIZES = { off: 0, medium: 2048, high: 4096 };

/**
 * Renderer, scene graph, lighting rig and frame loop.
 * Deliberately owns no game state — systems register update callbacks.
 */
export class Engine {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xa8c8d8, 40, 130);

    // --- lighting rig -----------------------------------------------------
    // Sun: the only shadow caster. Its shadow frustum is kept small and moved
    // with the camera focus so texel density stays high across a large map.
    this.sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.035;
    this.setShadowExtent(34);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Hemisphere fill gives the flat-shaded kit models their soft sky bounce.
    this.hemi = new THREE.HemisphereLight(0xbfe0ff, 0x5a6b3a, 1.1);
    this.scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(this.ambient);

    // Warm bounce from the ground, keeps shadowed sides from going flat grey.
    this.bounce = new THREE.DirectionalLight(0xffd9a0, 0.35);
    this.bounce.position.set(-6, 4, -8);
    this.scene.add(this.bounce);

    this.clock = new THREE.Clock();
    this.updaters = [];
    this.composer = null;
    this.bloomPass = null;
    this.usePost = true;
    this.frame = 0;
    this.fps = 60;
    this._fpsAccum = 0;
    this._fpsFrames = 0;

    addEventListener('resize', () => this.resize());
    // Pausing on tab-hide avoids a huge delta spike on return.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.clock.getDelta();
    });
  }

  /** Half-width of the sun's orthographic shadow frustum, in world units. */
  setShadowExtent(extent) {
    const cam = this.sun.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.updateProjectionMatrix();
  }

  /** Accepts either a THREE camera or a rig that owns one (see IsoCamera). */
  attachCamera(camera) {
    this.camera = camera;
    this.buildComposer();
    this.resize();
  }

  get threeCamera() {
    return this.camera?.camera ?? this.camera;
  }

  buildComposer() {
    if (this.composer) this.composer.dispose();
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.threeCamera));
    this.bloomPass = new UnrealBloomPass(size, 0.32, 0.62, 0.86);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  setBloomEnabled(on) {
    this.usePost = !!on;
    if (this.bloomPass) this.bloomPass.enabled = !!on;
  }

  /** Night-time lamps deserve more glow than a noon field. */
  setBloomStrength(strength) {
    if (this.bloomPass) this.bloomPass.strength = strength;
  }

  setShadowQuality(quality) {
    const size = SHADOW_SIZES[quality] ?? SHADOW_SIZES.medium;
    if (size === 0) {
      this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
    } else {
      this.renderer.shadowMap.enabled = true;
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  onUpdate(fn) {
    this.updaters.push(fn);
    return () => {
      const i = this.updaters.indexOf(fn);
      if (i >= 0) this.updaters.splice(i, 1);
    };
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
    if (this.camera?.onResize) this.camera.onResize(w, h);
  }

  start() {
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      // Clamp so a stall (alt-tab, GC pause) can't teleport the simulation.
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this.frame++;

      this._fpsAccum += dt;
      this._fpsFrames++;
      if (this._fpsAccum >= 0.5) {
        this.fps = this._fpsFrames / this._fpsAccum;
        this._fpsAccum = 0;
        this._fpsFrames = 0;
      }

      for (const fn of this.updaters) fn(dt, this.clock.elapsedTime);

      if (this.usePost && this.composer) this.composer.render(dt);
      else this.renderer.render(this.scene, this.threeCamera);
    };
    this.clock.getDelta();
    loop();
  }

  stop() {
    cancelAnimationFrame(this._raf);
  }
}
