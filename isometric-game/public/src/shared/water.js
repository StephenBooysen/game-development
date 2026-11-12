import * as THREE from 'three';

/**
 * A liquid surface: one merged mesh over every tile of a given terrain kind,
 * with a vertex ripple and a moving glint. Standard material, so it picks up
 * the same day/night lighting as everything else.
 *
 * Which terrain kind counts as liquid — and what colour it is — comes in from
 * the game, so the same mesh builder does a farm pond and a crater of meltwater.
 */
export class Water {
  /**
   * @param {Grid} grid
   * @param {object} opts
   * @param {number} opts.kind terrain kind to cover
   * @param {number} [opts.color]
   * @param {number} [opts.opacity]
   * @param {number} [opts.amplitude] ripple height
   * @param {[number,number,number]} [opts.glint] additive highlight colour
   */
  constructor(grid, { kind, color = 0x3d8fc4, opacity = 0.86, amplitude = 1, glint = [0.30, 0.42, 0.46] } = {}) {
    this.grid = grid;
    this.kind = kind;
    this.opts = { color, opacity, amplitude, glint };
    this.uniforms = { uTime: { value: 0 } };
    this.mesh = this.build();
  }

  build() {
    const g = this.grid;
    const tiles = [];
    for (let z = 0; z < g.size; z++) {
      for (let x = 0; x < g.size; x++) {
        if (g.terrain[g.idx(x, z)] === this.kind) tiles.push([x, z]);
      }
    }

    // Subdivide each tile so the ripple has vertices to move.
    const SUB = 2;
    const quads = tiles.length * SUB * SUB;
    const position = new Float32Array(quads * 4 * 3);
    const normal = new Float32Array(quads * 4 * 3);
    const uv = new Float32Array(quads * 4 * 2);
    const index = new Uint32Array(quads * 6);

    let q = 0;
    for (const [tx, tz] of tiles) {
      for (let sz = 0; sz < SUB; sz++) {
        for (let sx = 0; sx < SUB; sx++) {
          const step = 1 / SUB;
          const x0 = tx - 0.5 + sx * step;
          const z0 = tz - 0.5 + sz * step;
          const x1 = x0 + step;
          const z1 = z0 + step;
          const v = q * 4;
          const p = v * 3;
          position[p + 0] = x0; position[p + 1] = 0; position[p + 2] = z0;
          position[p + 3] = x1; position[p + 4] = 0; position[p + 5] = z0;
          position[p + 6] = x1; position[p + 7] = 0; position[p + 8] = z1;
          position[p + 9] = x0; position[p + 10] = 0; position[p + 11] = z1;
          for (let k = 0; k < 4; k++) normal[p + k * 3 + 1] = 1;

          const u = v * 2;
          uv[u + 0] = x0; uv[u + 1] = z0;
          uv[u + 2] = x1; uv[u + 3] = z0;
          uv[u + 4] = x1; uv[u + 5] = z1;
          uv[u + 6] = x0; uv[u + 7] = z1;

          const o = q * 6;
          index[o + 0] = v + 0; index[o + 1] = v + 2; index[o + 2] = v + 1;
          index[o + 3] = v + 0; index[o + 4] = v + 3; index[o + 5] = v + 2;
          q++;
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeBoundingSphere();

    const mat = new THREE.MeshStandardMaterial({
      color: this.opts.color,
      transparent: true,
      opacity: this.opts.opacity,
      roughness: 0.12,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const amp = this.opts.amplitude;
    const [gr, gg, gb] = this.opts.glint;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vRipple;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float w1 = sin(position.x * 2.2 + uTime * 1.7) * 0.5 + sin(position.z * 1.7 - uTime * 1.3) * 0.5;
           float w2 = sin((position.x + position.z) * 3.4 + uTime * 2.6);
           transformed.y += (w1 * 0.035 + w2 * 0.012) * ${amp.toFixed(3)};
           vRipple = vec2(w1, w2);`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vRipple;')
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
           // Bright crests read as light glinting off the surface.
           float glint = smoothstep(0.72, 1.0, vRipple.x) + smoothstep(0.86, 1.0, vRipple.y) * 0.6;
           gl_FragColor.rgb += vec3(${gr.toFixed(3)}, ${gg.toFixed(3)}, ${gb.toFixed(3)}) * glint;`
        );
    };

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = -0.04;
    mesh.receiveShadow = true;
    mesh.name = 'water';
    return mesh;
  }

  update(dt) {
    this.uniforms.uTime.value += dt;
  }
}
