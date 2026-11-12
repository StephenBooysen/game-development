import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _euler = new THREE.Euler();

/**
 * Instanced scenery.
 *
 * A farm has hundreds of tufts of grass, flowers, fence posts and trees. Drawn
 * as individual meshes that's a thousand draw calls; pooled per model it's a
 * few dozen. Instances can be removed at runtime (a chopped tree) via a
 * swap-with-last, which keeps the buffer contiguous.
 */
class InstancePool {
  constructor(geometry, material, { wind = false, capacity = 64, castShadow = true } = {}) {
    this.geometry = geometry;
    this.material = wind ? material.clone() : material;
    this.wind = wind;
    this.records = [];
    this.castShadow = castShadow;
    this.dirty = false;
    this.uniforms = { uTime: { value: 0 } };

    if (wind) this.applyWind(this.material);
    this.mesh = null;
    this.grow(capacity);
  }

  /** Bends geometry above the base, amount scaled by world position for variety. */
  applyWind(material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nuniform float uTime;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 swayOrigin = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          #else
            vec3 swayOrigin = vec3(0.0);
          #endif
          float swayPhase = uTime * 1.7 + swayOrigin.x * 0.55 + swayOrigin.z * 0.42;
          float swayAmount = sin(swayPhase) * 0.5 + sin(swayPhase * 2.3) * 0.5;
          float stiffness = max(transformed.y, 0.0);
          transformed.x += swayAmount * 0.035 * stiffness;
          transformed.z += swayAmount * 0.022 * stiffness;`
        );
    };
    material.needsUpdate = true;
  }

  grow(capacity) {
    const old = this.mesh;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = true;
    // The pool spans the whole map; per-instance culling isn't worth the cost.
    mesh.frustumCulled = false;
    mesh.count = this.records.length;
    this.capacity = capacity;
    this.mesh = mesh;

    if (old) {
      if (old.parent) old.parent.add(mesh);
      old.removeFromParent();
      old.dispose();
    }
    for (let i = 0; i < this.records.length; i++) this.write(i);
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  write(i) {
    const r = this.records[i];
    _euler.set(r.rx || 0, r.ry || 0, r.rz || 0);
    _q.setFromEuler(_euler);
    _p.set(r.x, r.y, r.z);
    _s.set(r.sx, r.sy, r.sz);
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(i, _m);
  }

  add(record) {
    if (this.records.length >= this.capacity) this.grow(Math.ceil(this.capacity * 1.8) + 8);
    record.index = this.records.length;
    record.pool = this;
    this.records.push(record);
    this.mesh.count = this.records.length;
    this.write(record.index);
    this.dirty = true;
    return record;
  }

  remove(record) {
    if (record.pool !== this || record.index < 0) return;
    const last = this.records.length - 1;
    const i = record.index;
    if (i !== last) {
      const moved = this.records[last];
      this.records[i] = moved;
      moved.index = i;
      this.write(i);
    }
    this.records.pop();
    record.index = -1;
    record.pool = null;
    this.mesh.count = this.records.length;
    this.dirty = true;
  }

  commit() {
    if (!this.dirty) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.dirty = false;
  }
}

export class PropLayer {
  constructor(assets, scene) {
    this.assets = assets;
    this.scene = scene;
    /** @type {Map<string, InstancePool>} */
    this.pools = new Map();
    this.group = new THREE.Group();
    this.group.name = 'props';
    scene.add(this.group);
    this.time = 0;
  }

  poolFor(kit, name, opts = {}) {
    const key = `${kit}/${name}`;
    let pool = this.pools.get(key);
    if (pool) return pool;

    const src = this.assets.toInstanceSource(kit, name);
    if (!src) return null;
    pool = new InstancePool(src.geometry, src.material, opts);
    this.pools.set(key, pool);
    this.group.add(pool.mesh);
    return pool;
  }

  /**
   * @param {object} o placement — x/z are tile coords, y defaults to the kit's
   *   0.05 base inset so geometry sits exactly on the ground plane.
   */
  add(kit, name, o = {}) {
    const pool = this.poolFor(kit, name, { wind: o.wind, castShadow: o.castShadow !== false });
    if (!pool) return null;
    const scale = o.scale ?? 1;
    return pool.add({
      x: o.x ?? 0,
      y: o.y ?? 0.05,
      z: o.z ?? 0,
      rx: o.rx ?? 0,
      ry: o.ry ?? 0,
      rz: o.rz ?? 0,
      sx: o.sx ?? scale,
      sy: o.sy ?? scale,
      sz: o.sz ?? scale,
      index: -1,
      pool: null,
    });
  }

  remove(record) {
    if (record?.pool) record.pool.remove(record);
  }

  update(dt) {
    this.time += dt;
    for (const pool of this.pools.values()) {
      if (pool.wind) pool.uniforms.uTime.value = this.time;
      pool.commit();
    }
  }

  clear() {
    for (const pool of this.pools.values()) {
      pool.mesh.removeFromParent();
      pool.mesh.dispose();
    }
    this.pools.clear();
  }
}
