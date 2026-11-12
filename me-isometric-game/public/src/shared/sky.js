import * as THREE from 'three';

/**
 * Sky dome and the lighting that follows the clock.
 *
 * A day is described as a handful of colour stops on a 24-hour line; the
 * renderer's sun, hemisphere fill, fog and background are all interpolated from
 * the two stops bracketing the current hour. One source of truth means the sky
 * and the ground light can never disagree.
 *
 * The stops themselves belong to a game — an afternoon on a farm and an
 * afternoon on the Moon share a mechanism and nothing else. One switch covers
 * the rest of the difference:
 *
 *   airless    no scattering. The sun is a hard-edged coin with no glow bleeding
 *              off it, the horizon lift is suppressed, and fog is pushed past
 *              the far clip so nothing hazes with distance.
 *
 * A warning about what this dome can and cannot show. The camera rig is
 * orthographic and pitched down, so *every* ray through the scene is parallel
 * and points below the horizontal — which means the inside face of the dome a
 * fragment lands on is always the lower hemisphere, and `vDir.y` is always
 * negative. Anything drawn above the horizon (the star field below, a planet,
 * a moon) is therefore unreachable: it renders, but no camera angle can look at
 * it. The dome earns its place as the background colour and as the single
 * source of the sun vector that the lighting rig reads. Don't put a body in it
 * without moving the rig to a perspective camera first.
 */

const GROUND_TINT = new THREE.Color(0x5a6b3a);

export class Sky {
  /**
   * @param {Engine} engine
   * @param {object} opts
   * @param {Array} opts.stops hour/colour/intensity keyframes, ascending by `h`
   * @param {boolean} [opts.airless] no atmosphere: hard sun, no fog
   * @param {number} [opts.radius]
   * @param {number} [opts.starDensity]
   */
  constructor(engine, { stops, airless = false, radius = 240, starDensity = 190, groundTint = GROUND_TINT } = {}) {
    this.engine = engine;
    this.stops = stops;
    this.airless = airless;
    this.groundTint = new THREE.Color(groundTint);

    /**
     * How far the camera sits from what it's looking at. Fog is measured in
     * view space, so under an orthographic rig the whole world sits at roughly
     * this depth and the fog band has to be offset to match — otherwise every
     * object is past the far plane and renders as flat fog colour.
     */
    this.depthOffset = 0;

    this.uniforms = {
      uZenith: { value: new THREE.Color(0x74b4ee) },
      uHorizon: { value: new THREE.Color(0xdcf0ff) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(0xffffff) },
      uNight: { value: 0 },
    };

    const geo = new THREE.SphereGeometry(radius, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      defines: {
        AIRLESS: airless ? 1 : 0,
        STAR_DENSITY: starDensity.toFixed(1),
      },
      uniforms: this.uniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uNight;
        varying vec3 vDir;

        // cheap hash for star field
        float hash(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
          // Bias the gradient so the horizon band stays tight and readable.
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));

          vec3 sunDir = normalize(uSunDir);
          float sd = max(dot(dir, sunDir), 0.0);

          #if AIRLESS
            // No air to scatter through: the disc is a hard white coin with a
            // tight corona and no glow bleeding across the sky.
            col += uSunColor * smoothstep(0.9994, 0.9997, sd) * 3.4;
            col += uSunColor * pow(sd, 900.0) * 0.55;
          #else
            col += uSunColor * pow(sd, 220.0) * 2.4;          // disc
            col += uSunColor * pow(sd, 6.0) * 0.16;           // bloom around it
          #endif

          // stars
          #if AIRLESS
            float starLight = 1.0;
          #else
            float starLight = uNight;
          #endif
          if (starLight > 0.01 && dir.y > 0.02) {
            vec3 cell = floor(dir * STAR_DENSITY);
            float s = hash(cell);
            float star = smoothstep(0.9965, 1.0, s);
            float twinkle = 0.65 + 0.35 * sin(s * 90.0);
            col += vec3(star * twinkle * starLight * 1.5);
          }

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    engine.scene.add(this.mesh);

    this._zenith = new THREE.Color();
    this._horizon = new THREE.Color();
    this._sun = new THREE.Color();
    this._fog = new THREE.Color();
    this._tmp = new THREE.Color();
    this.nightFactor = 0;
  }

  lerpStops(hour) {
    const stops = this.stops;
    const h = ((hour % 24) + 24) % 24;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (h >= stops[i].h && h <= stops[i + 1].h) {
        a = stops[i];
        b = stops[i + 1];
        break;
      }
    }
    const span = b.h - a.h || 1;
    const t = THREE.MathUtils.clamp((h - a.h) / span, 0, 1);
    // Smoothstep keeps dawn from arriving as a hard ramp.
    const k = t * t * (3 - 2 * t);
    return { a, b, k };
  }

  /** @param {number} hour 0..24 */
  update(hour) {
    const { a, b, k } = this.lerpStops(hour);

    this._zenith.setHex(a.zenith).lerp(this._tmp.setHex(b.zenith), k);
    this._horizon.setHex(a.horizon).lerp(this._tmp.setHex(b.horizon), k);
    this._sun.setHex(a.sun).lerp(this._tmp.setHex(b.sun), k);
    this._fog.setHex(a.fog).lerp(this._tmp.setHex(b.fog), k);
    const sunI = THREE.MathUtils.lerp(a.sunI, b.sunI, k);
    const hemiI = THREE.MathUtils.lerp(a.hemiI, b.hemiI, k);
    const ambI = THREE.MathUtils.lerp(a.ambI, b.ambI, k);

    // Sun tracks 6am on the east horizon to 6pm on the west; after dark the
    // same light source doubles as the moon, dimmed and cooled by the stops.
    const dayT = (hour - 6) / 12;
    const angle = dayT * Math.PI;
    const elev = Math.sin(angle);
    const dir = new THREE.Vector3(
      Math.cos(angle) * 0.75,
      Math.max(elev, -0.35),
      0.42 + Math.cos(angle) * 0.2
    ).normalize();

    this.uniforms.uZenith.value.copy(this._zenith);
    this.uniforms.uHorizon.value.copy(this._horizon);
    this.uniforms.uSunColor.value.copy(this._sun);
    this.uniforms.uSunDir.value.copy(dir);

    this.nightFactor = THREE.MathUtils.clamp(1 - Math.max(elev, 0) * 3.2, 0, 1);
    this.uniforms.uNight.value = this.nightFactor;

    const e = this.engine;
    e.sun.color.copy(this._sun);
    e.sun.intensity = sunI;
    e.sun.position.copy(dir).multiplyScalar(70);
    e.hemi.intensity = hemiI;
    e.hemi.color.copy(this._horizon);
    e.hemi.groundColor.copy(this.groundTint).lerp(this._fog, 0.35);
    e.ambient.intensity = ambI;
    e.ambient.color.copy(this._horizon).lerp(this._tmp.setHex(0xffffff), 0.5);
    e.bounce.intensity = 0.1 + (1 - this.nightFactor) * 0.28;

    if (this.airless) {
      // Vacuum: nothing between the camera and the horizon. The fog is kept
      // alive but pushed past the far clip so shadows and depth stay untouched.
      e.scene.fog.color.copy(this._fog);
      e.scene.fog.near = this.depthOffset + 400;
      e.scene.fog.far = this.depthOffset + 800;
    } else {
      e.scene.fog.color.copy(this._fog);
      // Night closes the world in a little; daytime opens it up. Both bounds
      // ride on the camera's pull-back, so only the back of the view hazes.
      e.scene.fog.near = this.depthOffset + 6 - this.nightFactor * 4;
      e.scene.fog.far = this.depthOffset + 64 - this.nightFactor * 24;
    }
    e.setBloomStrength(0.22 + this.nightFactor * 0.5);
  }

  /** Keep the dome centred on the viewer so it never clips. */
  follow(x, z) {
    this.mesh.position.set(x, 0, z);
  }
}
