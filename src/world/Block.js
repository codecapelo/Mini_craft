import { TILE } from '../assets/textures.js';

// ── Registro de tipos de bloco ───────────────────────────────────────────────
// `opaque` controla o face culling entre vizinhos (faces entre dois blocos
// opacos nunca são geradas); `solid` controla colisão e raycast; `liquid`
// manda o bloco para a malha transparente do chunk.

export const BlockId = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WOOD: 5,
  LEAVES: 6,
  WATER: 7,
};

export const BLOCKS = [
  { id: 0, name: 'Ar', solid: false, opaque: false, liquid: false, tiles: null },
  {
    id: 1, name: 'Grama', solid: true, opaque: true, liquid: false,
    tiles: { top: TILE.GRASS_TOP, bottom: TILE.DIRT, side: TILE.GRASS_SIDE },
  },
  {
    id: 2, name: 'Terra', solid: true, opaque: true, liquid: false,
    tiles: { top: TILE.DIRT, bottom: TILE.DIRT, side: TILE.DIRT },
  },
  {
    id: 3, name: 'Pedra', solid: true, opaque: true, liquid: false,
    tiles: { top: TILE.STONE, bottom: TILE.STONE, side: TILE.STONE },
  },
  {
    id: 4, name: 'Areia', solid: true, opaque: true, liquid: false,
    tiles: { top: TILE.SAND, bottom: TILE.SAND, side: TILE.SAND },
  },
  {
    id: 5, name: 'Madeira', solid: true, opaque: true, liquid: false,
    tiles: { top: TILE.WOOD_TOP, bottom: TILE.WOOD_TOP, side: TILE.WOOD_SIDE },
  },
  {
    // folhas não são opacas: as faces dos blocos encostados nelas continuam
    // visíveis, o que dá o aspecto "fofo" da copa
    id: 6, name: 'Folhas', solid: true, opaque: false, liquid: false,
    tiles: { top: TILE.LEAVES, bottom: TILE.LEAVES, side: TILE.LEAVES },
  },
  {
    id: 7, name: 'Água', solid: false, opaque: false, liquid: true,
    tiles: { top: TILE.WATER, bottom: TILE.WATER, side: TILE.WATER },
  },
];

// blocos disponíveis na hotbar, na ordem dos slots
export const PLACEABLE = [1, 2, 3, 4, 5, 6, 7];

export function isSolid(id) { return BLOCKS[id].solid; }
export function isOpaque(id) { return BLOCKS[id].opaque; }
export function faceTile(id, face) { return BLOCKS[id].tiles[face]; }
