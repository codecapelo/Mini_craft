import * as THREE from 'three';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';
import { BlockId, isSolid } from './Block.js';
import { createAtlasTexture } from '../assets/textures.js';

// ── Gerência de chunks ───────────────────────────────────────────────────────
// Carrega/descarrega chunks ao redor do jogador conforme a render distance.
// Os DADOS de um chunk são gerados sob demanda (inclusive p/ vizinhos ainda
// não visíveis, evitando costuras nas bordas); a MALHA só existe dentro da
// render distance. Modificações do jogador ficam em `edits` p/ persistência.

export class World {
  constructor(scene, generator) {
    this.scene = scene;
    this.generator = generator;
    this.chunks = new Map(); // "cx,cz" → Chunk
    this.edits = new Map();  // "cx,cz" → Map("lx,y,lz" → blockId)
    this.renderDistance = 5; // em chunks
    this.buildPerFrame = 2;  // limita o custo de geração de malha por frame
    this.queue = [];
    this.lastPcx = Infinity;
    this.lastPcz = Infinity;

    const atlas = createAtlasTexture();
    this.materials = {
      solid: new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true }),
      water: new THREE.MeshBasicMaterial({
        map: atlas,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        side: THREE.DoubleSide, // visível também por dentro (mergulho)
      }),
    };
  }

  key(cx, cz) { return cx + ',' + cz; }

  ensureChunk(cx, cz) {
    const k = this.key(cx, cz);
    let chunk = this.chunks.get(k);
    if (chunk) return chunk;
    chunk = new Chunk(this, cx, cz);
    chunk.data = this.generator.generateChunkData(cx, cz);
    const ed = this.edits.get(k);
    if (ed) {
      for (const [pos, id] of ed) {
        const [lx, ly, lz] = pos.split(',').map(Number);
        chunk.data[chunk.index(lx, ly, lz)] = id;
      }
    }
    this.chunks.set(k, chunk);
    return chunk;
  }

  getBlock(x, y, z) {
    if (y < 0) return BlockId.STONE; // o "fundo do mundo" conta como sólido
    if (y >= CHUNK_HEIGHT) return BlockId.AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.ensureChunk(cx, cz);
    return chunk.data[chunk.index(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)];
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    const chunk = this.ensureChunk(cx, cz);
    chunk.data[chunk.index(lx, y, lz)] = id;

    // registra a edição p/ persistência e reaplicação após unload
    const k = this.key(cx, cz);
    if (!this.edits.has(k)) this.edits.set(k, new Map());
    this.edits.get(k).set(`${lx},${y},${lz}`, id);

    this.rebuildChunk(cx, cz);
    // bloco na borda → a face exposta do chunk vizinho também muda
    if (lx === 0) this.rebuildChunk(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.rebuildChunk(cx + 1, cz);
    if (lz === 0) this.rebuildChunk(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.rebuildChunk(cx, cz + 1);
  }

  rebuildChunk(cx, cz) {
    const chunk = this.chunks.get(this.key(cx, cz));
    if (chunk && chunk.meshBuilt) chunk.buildMesh(this.scene, this.materials);
  }

  update(px, pz) {
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    if (pcx !== this.lastPcx || pcz !== this.lastPcz) {
      this.lastPcx = pcx;
      this.lastPcz = pcz;
      this.refreshQueue(pcx, pcz);
      this.unloadFar(pcx, pcz);
    }

    let built = 0;
    while (built < this.buildPerFrame && this.queue.length > 0) {
      const { cx, cz } = this.queue.shift();
      const existing = this.chunks.get(this.key(cx, cz));
      if (existing && existing.meshBuilt) continue;
      const chunk = this.ensureChunk(cx, cz);
      chunk.buildMesh(this.scene, this.materials);
      built++;
    }
  }

  refreshQueue(pcx, pcz) {
    const R = this.renderDistance;
    const r2 = (R + 0.5) * (R + 0.5);
    this.queue.length = 0;
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        const chunk = this.chunks.get(this.key(cx, cz));
        if (!chunk || !chunk.meshBuilt) this.queue.push({ cx, cz, d2 });
      }
    }
    this.queue.sort((a, b) => a.d2 - b.d2); // mais próximos primeiro
  }

  unloadFar(pcx, pcz) {
    for (const [k, chunk] of this.chunks) {
      const d = Math.max(Math.abs(chunk.cx - pcx), Math.abs(chunk.cz - pcz));
      if (d > this.renderDistance + 1 && chunk.meshBuilt) chunk.disposeMeshes(this.scene);
      // bem longe: descarta também os dados (edições ficam salvas em `edits`)
      if (d > this.renderDistance + 4) this.chunks.delete(k);
    }
  }

  get loadedChunkCount() {
    let n = 0;
    for (const c of this.chunks.values()) if (c.meshBuilt) n++;
    return n;
  }

  // topo sólido de uma coluna — usado p/ spawn seguro
  getSpawnY(x, z) {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (isSolid(this.getBlock(x, y, z))) return y + 1;
    }
    return CHUNK_HEIGHT;
  }

  serializeEdits() {
    const out = {};
    for (const [k, m] of this.edits) {
      out[k] = {};
      for (const [pos, id] of m) out[k][pos] = id;
    }
    return out;
  }

  loadEdits(obj) {
    if (!obj) return;
    for (const k of Object.keys(obj)) {
      const m = new Map();
      for (const pos of Object.keys(obj[k])) m.set(pos, obj[k][pos]);
      this.edits.set(k, m);
    }
  }
}
