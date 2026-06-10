// ── Mira central ─────────────────────────────────────────────────────────────
// O desenho fica no CSS (#crosshair em index.html); aqui só controlamos a
// visibilidade — escondida enquanto o menu/overlay está aberto.

export class Crosshair {
  constructor(el) {
    this.el = el;
  }

  setVisible(v) {
    this.el.style.display = v ? 'block' : 'none';
  }
}
