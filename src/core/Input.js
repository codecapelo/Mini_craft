// ── Entrada de teclado/mouse ─────────────────────────────────────────────────
// Mantém o conjunto de teclas pressionadas (consulta contínua p/ movimento) e
// despacha callbacks discretos (toggle de voo, salvar, hotbar, cliques).

export class Input {
  constructor() {
    this.keys = new Set();
    this.keyHandlers = new Map();   // e.code → [callbacks]
    this.mouseHandlers = new Map(); // botão → [callbacks]
    this.wheelHandlers = [];

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault(); // não rolar a página
      if (!e.repeat) {
        const hs = this.keyHandlers.get(e.code);
        if (hs) for (const h of hs) h();
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    // perdeu o foco → solta tudo (evita andar sozinho ao voltar p/ aba)
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousedown', (e) => {
      const hs = this.mouseHandlers.get(e.button);
      if (hs) for (const h of hs) h();
    });
    document.addEventListener('wheel', (e) => {
      const dir = Math.sign(e.deltaY);
      if (dir !== 0) for (const h of this.wheelHandlers) h(dir);
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(code) { return this.keys.has(code); }

  onKeyDown(code, cb) {
    if (!this.keyHandlers.has(code)) this.keyHandlers.set(code, []);
    this.keyHandlers.get(code).push(cb);
  }

  onMouseDown(button, cb) {
    if (!this.mouseHandlers.has(button)) this.mouseHandlers.set(button, []);
    this.mouseHandlers.get(button).push(cb);
  }

  onWheel(cb) { this.wheelHandlers.push(cb); }
}
