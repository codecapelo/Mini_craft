import { BLOCKS, PLACEABLE } from '../world/Block.js';
import { getAtlasCanvas, TILE_PX, ATLAS_COLS } from '../assets/textures.js';

// ── Hotbar ───────────────────────────────────────────────────────────────────
// Slots com ícones recortados do próprio texture atlas (tile lateral de cada
// bloco). Seleção por teclas 1–9 e scroll do mouse (ligados no main.js).

export class Hotbar {
  constructor(rootEl, labelEl) {
    this.root = rootEl;
    this.label = labelEl;
    this.items = [...PLACEABLE];
    this.selected = 0;
    this.slots = [];

    const atlas = getAtlasCanvas();
    this.items.forEach((id, i) => {
      const def = BLOCKS[id];
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';

      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(i + 1);

      const icon = document.createElement('canvas');
      icon.width = TILE_PX;
      icon.height = TILE_PX;
      const ctx = icon.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const tile = def.tiles.side;
      const sx = (tile % ATLAS_COLS) * TILE_PX;
      const sy = Math.floor(tile / ATLAS_COLS) * TILE_PX;
      ctx.drawImage(atlas, sx, sy, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX);

      slot.append(num, icon);
      this.root.append(slot);
      this.slots.push(slot);
    });

    this.select(0);
  }

  select(i) {
    const n = this.items.length;
    this.selected = ((i % n) + n) % n;
    this.slots.forEach((s, j) => s.classList.toggle('selected', j === this.selected));
    this.label.textContent = BLOCKS[this.selectedBlock].name;
  }

  next() { this.select(this.selected + 1); }
  prev() { this.select(this.selected - 1); }

  get selectedBlock() { return this.items[this.selected]; }
}
