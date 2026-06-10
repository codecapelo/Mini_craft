import * as THREE from 'three';

// ── Texture atlas 100% procedural ────────────────────────────────────────────
// Todas as texturas são desenhadas em canvas na inicialização: nenhum asset
// externo, nenhum material de terceiros. 4×4 tiles de 16px = atlas 64×64.

export const TILE_PX = 16;
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 4;

export const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WOOD_SIDE: 5,
  WOOD_TOP: 6,
  LEAVES: 7,
  WATER: 8,
};

// PRNG determinística — as texturas saem idênticas em qualquer load.
function makeRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function speckle(ctx, ox, oy, base, variants, density, rand) {
  ctx.fillStyle = base;
  ctx.fillRect(ox, oy, TILE_PX, TILE_PX);
  const count = Math.floor(TILE_PX * TILE_PX * density);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = variants[Math.floor(rand() * variants.length)];
    ctx.fillRect(ox + Math.floor(rand() * TILE_PX), oy + Math.floor(rand() * TILE_PX), 1, 1);
  }
}

const GREENS = ['#4c9434', '#63b846', '#549e38', '#6cc24e'];
const BROWNS = ['#6b4830', '#85603f', '#5f4029', '#8f6a45'];

function drawTile(ctx, tile, ox, oy) {
  const rand = makeRand(0xc0ffee + tile * 7919);
  switch (tile) {
    case TILE.GRASS_TOP:
      speckle(ctx, ox, oy, '#58a83c', GREENS, 0.7, rand);
      break;

    case TILE.GRASS_SIDE: {
      speckle(ctx, ox, oy, '#7a5436', BROWNS, 0.5, rand);
      // faixa de grama no topo com a borda inferior irregular
      for (let x = 0; x < TILE_PX; x++) {
        const depth = 2 + Math.floor(rand() * 3);
        for (let y = 0; y < depth; y++) {
          ctx.fillStyle = GREENS[Math.floor(rand() * GREENS.length)];
          ctx.fillRect(ox + x, oy + y, 1, 1);
        }
      }
      break;
    }

    case TILE.DIRT:
      speckle(ctx, ox, oy, '#7a5436', BROWNS, 0.55, rand);
      break;

    case TILE.STONE: {
      speckle(ctx, ox, oy, '#878787', ['#7a7a7a', '#929292', '#6f6f6f', '#9c9c9c'], 0.5, rand);
      // rachaduras: pequenos passeios aleatórios em pixels escuros
      ctx.fillStyle = '#5e5e5e';
      for (let i = 0; i < 3; i++) {
        let x = Math.floor(rand() * TILE_PX);
        let y = Math.floor(rand() * TILE_PX);
        const len = 3 + Math.floor(rand() * 4);
        for (let j = 0; j < len; j++) {
          ctx.fillRect(ox + x, oy + y, 1, 1);
          x = Math.min(TILE_PX - 1, x + (rand() < 0.6 ? 1 : 0));
          y = Math.min(TILE_PX - 1, Math.max(0, y + (rand() < 0.5 ? 1 : -1)));
        }
      }
      break;
    }

    case TILE.SAND:
      speckle(ctx, ox, oy, '#d9cf9b', ['#cdc28a', '#e4dcab', '#c2b67c', '#eee6b8'], 0.55, rand);
      break;

    case TILE.WOOD_SIDE: {
      // listras verticais de casca
      const stripes = ['#5c441f', '#74552c', '#684c26', '#74552c'];
      for (let x = 0; x < TILE_PX; x++) {
        ctx.fillStyle = stripes[x % stripes.length];
        ctx.fillRect(ox + x, oy, 1, TILE_PX);
      }
      ctx.fillStyle = '#4a361a';
      const count = Math.floor(TILE_PX * TILE_PX * 0.12);
      for (let i = 0; i < count; i++) {
        ctx.fillRect(ox + Math.floor(rand() * TILE_PX), oy + Math.floor(rand() * TILE_PX), 1, 1);
      }
      break;
    }

    case TILE.WOOD_TOP: {
      // anéis concêntricos de tronco cortado
      for (let ring = 0; ring < TILE_PX / 2; ring++) {
        ctx.fillStyle = ring % 2 ? '#5c441f' : '#8a6a3c';
        const size = TILE_PX - ring * 2;
        ctx.fillRect(ox + ring, oy + ring, size, 1);
        ctx.fillRect(ox + ring, oy + TILE_PX - ring - 1, size, 1);
        ctx.fillRect(ox + ring, oy + ring, 1, size);
        ctx.fillRect(ox + TILE_PX - ring - 1, oy + ring, 1, size);
      }
      break;
    }

    case TILE.LEAVES:
      speckle(ctx, ox, oy, '#3e7a28', ['#356b22', '#48902f', '#2f611d', '#52a338', '#244e15'], 1.2, rand);
      break;

    case TILE.WATER: {
      speckle(ctx, ox, oy, '#3f76e4', ['#3565c8', '#4a80ea'], 0.3, rand);
      // linhas horizontais tracejadas sugerindo ondulação
      ctx.fillStyle = '#5d8df0';
      for (let i = 0; i < 4; i++) {
        const y = (2 + i * 4 + Math.floor(rand() * 2)) % TILE_PX;
        for (let x = 0; x < TILE_PX; x++) {
          if ((x + i) % 4 !== 0) ctx.fillRect(ox + x, oy + y, 1, 1);
        }
      }
      break;
    }
  }
}

let _atlasCanvas = null;

export function getAtlasCanvas() {
  if (_atlasCanvas) return _atlasCanvas;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE_PX;
  canvas.height = ATLAS_ROWS * TILE_PX;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff00ff'; // magenta de "textura faltando" nos tiles não usados
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const tile of Object.values(TILE)) {
    const ox = (tile % ATLAS_COLS) * TILE_PX;
    const oy = Math.floor(tile / ATLAS_COLS) * TILE_PX;
    drawTile(ctx, tile, ox, oy);
  }
  _atlasCanvas = canvas;
  return canvas;
}

export function createAtlasTexture() {
  const tex = new THREE.CanvasTexture(getAtlasCanvas());
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// UV de um canto (u,v ∈ [0,1]) dentro de um tile. Meio texel de margem evita
// sangria de tiles vizinhos do atlas com NearestFilter.
export function tileUV(tile, u, v) {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const eps = 0.5 / TILE_PX;
  const uu = (col + eps + u * (1 - 2 * eps)) / ATLAS_COLS;
  const vv = 1 - (row + 1 - (eps + v * (1 - 2 * eps))) / ATLAS_ROWS;
  return [uu, vv];
}
