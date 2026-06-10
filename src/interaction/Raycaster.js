import * as THREE from 'three';
import { BlockId, isSolid } from '../world/Block.js';
import { CHUNK_HEIGHT } from '../world/Chunk.js';

// ── Mira e interação com blocos ──────────────────────────────────────────────
// Em vez de raycast contra as malhas, caminhamos célula a célula pela grade de
// voxels (DDA de Amanatides & Woo) — exato, barato e dá de graça a normal da
// face atingida (necessária p/ saber onde colocar o bloco novo).

const REACH = 6; // alcance em blocos

export class BlockRaycaster {
  constructor(world, camera, scene) {
    this.world = world;
    this.camera = camera;
    this.hit = null;
    this._dir = new THREE.Vector3();

    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8 })
    );
    this.highlight.visible = false;
    scene.add(this.highlight);
  }

  update(enabled) {
    this.hit = enabled ? this.cast() : null;
    if (this.hit) {
      this.highlight.position.set(this.hit.x + 0.5, this.hit.y + 0.5, this.hit.z + 0.5);
      this.highlight.visible = true;
    } else {
      this.highlight.visible = false;
    }
  }

  cast() {
    const o = this.camera.position;
    const d = this.camera.getWorldDirection(this._dir);

    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const stepX = d.x > 0 ? 1 : -1;
    const stepY = d.y > 0 ? 1 : -1;
    const stepZ = d.z > 0 ? 1 : -1;
    const tDeltaX = d.x !== 0 ? Math.abs(1 / d.x) : Infinity;
    const tDeltaY = d.y !== 0 ? Math.abs(1 / d.y) : Infinity;
    const tDeltaZ = d.z !== 0 ? Math.abs(1 / d.z) : Infinity;
    let tMaxX = d.x !== 0 ? (stepX > 0 ? x + 1 - o.x : o.x - x) * tDeltaX : Infinity;
    let tMaxY = d.y !== 0 ? (stepY > 0 ? y + 1 - o.y : o.y - y) * tDeltaY : Infinity;
    let tMaxZ = d.z !== 0 ? (stepZ > 0 ? z + 1 - o.z : o.z - z) * tDeltaZ : Infinity;

    let nx = 0, ny = 0, nz = 0;
    let t = 0;
    while (t <= REACH) {
      const id = this.world.getBlock(x, y, z);
      if (isSolid(id)) {
        if (y < 0) return null; // "chão fake" abaixo do mundo não é alvejável
        return { x, y, z, nx, ny, nz, id }; // água/ar são ignorados
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        t = tMaxX; tMaxX += tDeltaX; x += stepX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        t = tMaxY; tMaxY += tDeltaY; y += stepY; nx = 0; ny = -stepY; nz = 0;
      } else {
        t = tMaxZ; tMaxZ += tDeltaZ; z += stepZ; nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }

  breakBlock() {
    if (!this.hit) return;
    this.world.setBlock(this.hit.x, this.hit.y, this.hit.z, BlockId.AIR);
  }

  placeBlock(id, player) {
    if (!this.hit) return;
    const tx = this.hit.x + this.hit.nx;
    const ty = this.hit.y + this.hit.ny;
    const tz = this.hit.z + this.hit.nz;
    if (ty < 0 || ty >= CHUNK_HEIGHT) return;
    const existing = this.world.getBlock(tx, ty, tz);
    if (existing !== BlockId.AIR && existing !== BlockId.WATER) return; // só substitui ar/água
    if (isSolid(id) && player.intersectsBlock(tx, ty, tz)) return;      // não se emparedar
    this.world.setBlock(tx, ty, tz, id);
  }
}
