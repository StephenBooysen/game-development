import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const BASE = './assets/models/';

/**
 * Loads Kenney GLB kits and hands out clones.
 *
 * Kit conventions this relies on (verified against the packs):
 *  - nature kit: 1x1 tile footprint, origin centred, geometry base at y = -0.05
 *  - town kit:   1x1x1 cell, floor at y = 0, wall panels on the +X cell edge
 *  - characters: feet at y = 0, with a full named animation set
 *
 * The library holds no opinion about what the models are *for*. The one thing
 * a game does get to say is its palette — the re-grade applied to untextured
 * kit materials — which is why it arrives through `setPalette` rather than an
 * import. The same rock model is warm granite in one game and cold basalt in
 * the other, and neither game should have to know the other exists.
 */
export class AssetLibrary {
  constructor(palette = {}, kitGrades = {}) {
    this.loader = new GLTFLoader();
    /** @type {Map<string, THREE.Object3D>} prototype scenes, never added to the world */
    this.models = new Map();
    /** @type {Map<string, THREE.AnimationClip[]>} */
    this.clips = new Map();
    /** Graded colormaps, one per kit — every model in a kit shares one image. */
    this.textureCache = new Map();
    this.palette = palette;
    this.kitGrades = kitGrades;
  }

  /**
   * Material-name → colour overrides for untextured kit materials, and
   * whole-kit grades for the textured ones. Must be set before `loadManifest`;
   * both are applied at load time.
   */
  setPalette(palette, kitGrades) {
    this.palette = palette || {};
    if (kitGrades) this.kitGrades = kitGrades;
  }

  /**
   * Re-grades a textured kit's shared colormap.
   *
   * An untextured kit can be re-coloured per material name, which is how the
   * two games get different rock out of the same pack. A textured kit can't:
   * every model in it samples one atlas, so there is no per-model handle to
   * pull. Multiplying the material colour doesn't help either — that can darken
   * or tint, but never desaturate, so the survival kit's timber stays timber
   * and merely turns maroon.
   *
   * So the atlas itself is graded once, on a canvas: pull the saturation down,
   * then multiply through the tint. One image per kit, cached, and every model
   * in the kit picks it up for free.
   */
  gradeTexture(kit, texture) {
    const grade = this.kitGrades[kit];
    if (!grade || !texture?.image) return texture;

    const cached = this.textureCache.get(kit);
    if (cached) return cached;

    const { width, height } = texture.image;
    if (!width || !height) return texture;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(texture.image, 0, 0);

    const saturation = grade.saturation ?? 1;
    const tint = grade.tint !== undefined ? new THREE.Color(grade.tint) : null;
    const data = ctx.getImageData(0, 0, width, height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      let r = px[i];
      let g = px[i + 1];
      let b = px[i + 2];
      // Rec. 709 luma, so the grade preserves how light each swatch reads.
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = luma + (r - luma) * saturation;
      g = luma + (g - luma) * saturation;
      b = luma + (b - luma) * saturation;
      if (tint) {
        r *= tint.r;
        g *= tint.g;
        b *= tint.b;
      }
      px[i] = Math.max(0, Math.min(255, r));
      px[i + 1] = Math.max(0, Math.min(255, g));
      px[i + 2] = Math.max(0, Math.min(255, b));
    }
    ctx.putImageData(data, 0, 0);

    const graded = new THREE.CanvasTexture(canvas);
    // glTF ships textures unflipped; CanvasTexture defaults the other way.
    graded.flipY = false;
    graded.colorSpace = THREE.SRGBColorSpace;
    graded.magFilter = THREE.NearestFilter;
    graded.minFilter = THREE.LinearMipmapLinearFilter;
    graded.anisotropy = 4;
    graded.needsUpdate = true;
    this.textureCache.set(kit, graded);
    return graded;
  }

  key(kit, name) {
    return `${kit}/${name}`;
  }

  /**
   * @param {Array<[kit: string, names: string[]]>} manifest
   * @param {(loaded: number, total: number, label: string) => void} onProgress
   */
  async loadManifest(manifest, onProgress) {
    const jobs = [];
    for (const [kit, names] of manifest) {
      for (const name of names) jobs.push({ kit, name });
    }

    let done = 0;
    const total = jobs.length;
    // A modest concurrency cap keeps the browser from opening 600 sockets at once.
    const CONCURRENCY = 24;
    let cursor = 0;
    const failures = [];

    const worker = async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++];
        try {
          await this.load(job.kit, job.name);
        } catch (err) {
          failures.push(`${job.kit}/${job.name}: ${err.message}`);
        }
        done++;
        if (onProgress) onProgress(done, total, job.name);
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

    if (failures.length) {
      console.warn(`[assets] ${failures.length} model(s) failed to load:\n` + failures.join('\n'));
    }
    return { total, failures };
  }

  async load(kit, name) {
    const key = this.key(kit, name);
    if (this.models.has(key)) return this.models.get(key);

    const gltf = await this.loader.loadAsync(`${BASE}${kit}/${name}.glb`);
    const root = gltf.scene;

    root.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      // Kenney kits ship a shared palette texture; nearest filtering keeps the
      // flat-shaded look crisp instead of smearing neighbouring swatches.
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of mats) {
        if (!mat) continue;
        if (mat.map) {
          mat.map.magFilter = THREE.NearestFilter;
          mat.map.minFilter = THREE.LinearMipmapLinearFilter;
          mat.map.anisotropy = 4;
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.map.needsUpdate = true;
          mat.map = this.gradeTexture(kit, mat.map);
        }
        // Untextured kit materials are re-graded to the game's palette. The
        // kit stores plain sRGB swatches in baseColorFactor, which glTF defines
        // as linear — taken at face value the whole pack renders as washed-out
        // pastel, so unmapped names still get the sRGB reading they were drawn
        // with.
        if (!mat.map && mat.color) {
          const graded = this.palette[mat.name];
          if (graded !== undefined) mat.color.setHex(graded);
          else mat.color.convertSRGBToLinear();
        }
        mat.metalness = 0;
        mat.roughness = 0.85;
        mat.side = THREE.FrontSide;
      }
    });

    if (gltf.animations?.length) this.clips.set(key, gltf.animations);
    this.models.set(key, root);
    return root;
  }

  has(kit, name) {
    return this.models.has(this.key(kit, name));
  }

  /** A fresh, independent copy safe to place in the scene. */
  clone(kit, name) {
    const proto = this.models.get(this.key(kit, name));
    if (!proto) {
      console.warn(`[assets] missing model ${kit}/${name}`);
      return new THREE.Group();
    }
    const clips = this.clips.get(this.key(kit, name));
    // Skinned meshes need SkeletonUtils so the clone gets its own bones.
    const copy = clips?.length ? cloneSkinned(proto) : proto.clone(true);
    copy.userData.clips = clips || null;
    return copy;
  }

  getClips(kit, name) {
    return this.clips.get(this.key(kit, name)) || [];
  }

  /**
   * Collapses a model into a single (geometry, material) pair suitable for an
   * InstancedMesh. Returns null when the model has no static geometry.
   *
   * Kit models are *not* single-material: the nature pack colours a tree with a
   * separate untextured material per part (woodBark, leafsGreen, …), so keeping
   * only the first material would draw every tree solid brown. Each material's
   * base colour is therefore baked into a vertex-colour attribute and the merged
   * mesh draws with one `vertexColors` material — one draw call, right colours.
   * The textured kits (town/food/survival/chars) carry a white base colour, so
   * the same path leaves their shared colormap untouched.
   */
  toInstanceSource(kit, name) {
    const proto = this.models.get(this.key(kit, name));
    if (!proto) return null;

    const meshes = [];
    proto.updateWorldMatrix(true, true);
    proto.traverse((n) => {
      if (n.isMesh && !n.isSkinnedMesh) meshes.push(n);
    });
    if (meshes.length === 0) return null;

    const parts = [];
    let map = null;
    let transparent = false;
    for (const mesh of meshes) {
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      // Bake the mesh's place in the hierarchy into a copy of its geometry.
      const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrixWorld);
      parts.push({ geo, color: mat?.color ?? WHITE });
      if (!map && mat?.map) map = mat.map;
      if (mat?.transparent) transparent = true;
    }

    const geometry = mergeParts(parts);
    if (!geometry) return null;

    const material = new THREE.MeshStandardMaterial({
      map,
      vertexColors: true,
      metalness: 0,
      roughness: 0.85,
      transparent,
    });
    return { geometry, material };
  }
}

const WHITE = new THREE.Color(1, 1, 1);

/**
 * Merges pre-transformed parts into one geometry, writing each part's material
 * colour into a per-vertex colour. Attributes are read through the accessor API
 * so interleaved buffers merge correctly too.
 */
function mergeParts(parts) {
  let total = 0;
  for (const part of parts) total += part.geo.attributes.position.count;
  if (total === 0) return null;

  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const color = new Float32Array(total * 3);
  let missingNormals = false;

  let offset = 0;
  for (const { geo, color: tint } of parts) {
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const tex = geo.attributes.uv;
    if (!nrm) missingNormals = true;

    for (let i = 0; i < pos.count; i++) {
      const v = offset + i;
      position[v * 3 + 0] = pos.getX(i);
      position[v * 3 + 1] = pos.getY(i);
      position[v * 3 + 2] = pos.getZ(i);
      if (nrm) {
        normal[v * 3 + 0] = nrm.getX(i);
        normal[v * 3 + 1] = nrm.getY(i);
        normal[v * 3 + 2] = nrm.getZ(i);
      }
      if (tex) {
        uv[v * 2 + 0] = tex.getX(i);
        uv[v * 2 + 1] = tex.getY(i);
      }
      color[v * 3 + 0] = tint.r;
      color[v * 3 + 1] = tint.g;
      color[v * 3 + 2] = tint.b;
    }

    offset += pos.count;
    geo.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(color, 3));
  if (missingNormals) out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}
