import { createNoise2D } from 'simplex-noise';
import { BlockId } from './Block.js';
import { CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';

// ── Geração procedural de terreno ────────────────────────────────────────────
// simplex-noise 2D com múltiplos octaves (fBm) para a altura; camadas
// grama → terra → pedra; água até o nível do mar; árvores determinísticas.

export const SEA_LEVEL = 28;
const BASE_HEIGHT = 30;
const AMPLITUDE = 16;
const NOISE_SCALE = 1 / 95;
const OCTAVES = 4;
const PERSISTENCE = 0.5;
const LACUNARITY = 2;
const TREE_MARGIN = 2;        // copas invadem até 2 blocos os chunks vizinhos
const TREE_THRESHOLD = 0.992; // densidade de árvores (maior = mais raro)

// PRNG p/ alimentar o simplex-noise com seed reproduzível
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TerrainGenerator {
  constructor(seed = 1337) {
    this.seed = seed | 0;
    this.noise2D = createNoise2D(mulberry32(this.seed));
    this.heightCache = new Map();
  }

  // hash inteiro determinístico → [0,1); usado p/ árvores e variações
  hash2(x, z) {
    let h = this.seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  hash3(x, y, z) {
    let h = this.seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 2246822519) ^ Math.imul(z | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // altura do terreno via fBm (fractal Brownian motion) de simplex 2D
  heightAt(x, z) {
    const key = x + ',' + z;
    const cached = this.heightCache.get(key);
    if (cached !== undefined) return cached;

    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < OCTAVES; o++) {
      sum += amp * this.noise2D(x * NOISE_SCALE * freq, z * NOISE_SCALE * freq);
      norm += amp;
      amp *= PERSISTENCE;
      freq *= LACUNARITY;
    }
    const n = sum / norm; // ≈ [-1, 1]
    let h = Math.round(BASE_HEIGHT + n * AMPLITUDE);
    h = Math.max(2, Math.min(CHUNK_HEIGHT - 12, h));

    if (this.heightCache.size > 200000) this.heightCache.clear();
    this.heightCache.set(key, h);
    return h;
  }

  // Uma coluna vira árvore se seu hash for o máximo local numa janela 5×5 e
  // passar do threshold — determinístico e com espaçamento mínimo garantido.
  treeAt(x, z, groundHeight) {
    if (groundHeight <= SEA_LEVEL + 1 || groundHeight + 8 >= CHUNK_HEIGHT) return null;
    const r = this.hash2(x, z);
    if (r < TREE_THRESHOLD) return null;
    for (let oz = -2; oz <= 2; oz++) {
      for (let ox = -2; ox <= 2; ox++) {
        if (ox === 0 && oz === 0) continue;
        if (this.hash2(x + ox, z + oz) > r) return null;
      }
    }
    return { height: 4 + Math.floor(this.hash2(x + 31, z - 17) * 3) }; // 4..6
  }

  generateChunkData(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;
    const M = TREE_MARGIN;
    const W = CHUNK_SIZE + 2 * M;

    // alturas pré-computadas com margem (necessárias p/ árvores vizinhas)
    const heights = new Int16Array(W * W);
    for (let dz = 0; dz < W; dz++) {
      for (let dx = 0; dx < W; dx++) {
        heights[dz * W + dx] = this.heightAt(x0 + dx - M, z0 + dz - M);
      }
    }

    const idx = (x, y, z) => x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
    const put = (lx, y, lz, id, force) => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
      const i = idx(lx, y, lz);
      if (force || data[i] === BlockId.AIR) data[i] = id;
    };

    // camadas de terreno + água até o nível do mar
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const h = heights[(z + M) * W + (x + M)];
        const beach = h <= SEA_LEVEL + 1; // topo submerso/na praia vira areia
        for (let y = 0; y <= Math.min(h, CHUNK_HEIGHT - 1); y++) {
          let id;
          if (y === h) id = beach ? BlockId.SAND : BlockId.GRASS;
          else if (y >= h - 3) id = beach ? BlockId.SAND : BlockId.DIRT;
          else id = BlockId.STONE;
          data[idx(x, y, z)] = id;
        }
        for (let y = h + 1; y <= SEA_LEVEL; y++) {
          data[idx(x, y, z)] = BlockId.WATER;
        }
      }
    }

    // árvores — inclui a margem p/ que copas de árvores de chunks vizinhos
    // entrem corretamente neste chunk (geração 100% determinística)
    for (let tz = -M; tz < CHUNK_SIZE + M; tz++) {
      for (let tx = -M; tx < CHUNK_SIZE + M; tx++) {
        const h = heights[(tz + M) * W + (tx + M)];
        const tree = this.treeAt(x0 + tx, z0 + tz, h);
        if (!tree) continue;
        const top = h + tree.height;

        // tronco
        for (let y = h + 1; y <= top; y++) put(tx, y, tz, BlockId.WOOD, true);

        // copa: duas camadas raio 2, uma raio 1 e um "chapéu" em cruz
        for (let ly = top - 2; ly <= top + 1; ly++) {
          const r = ly <= top - 1 ? 2 : 1;
          for (let ox = -r; ox <= r; ox++) {
            for (let oz = -r; oz <= r; oz++) {
              if (ox === 0 && oz === 0 && ly <= top) continue; // lugar do tronco
              if (Math.abs(ox) === r && Math.abs(oz) === r && (r === 2 || ly === top + 1)) {
                // poda determinística dos cantos p/ copa arredondada
                if (this.hash3(x0 + tx + ox, ly, z0 + tz + oz) < 0.6) continue;
              }
              put(tx + ox, ly, tz + oz, BlockId.LEAVES, false);
            }
          }
        }
      }
    }

    return data;
  }
}
