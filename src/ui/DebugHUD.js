// ── HUD de debug ─────────────────────────────────────────────────────────────
// FPS (média de meia em meia segundo), posição do jogador, chunks carregados.

export class DebugHUD {
  constructor(el, title) {
    this.el = el;
    this.title = title;
    this.frames = 0;
    this.acc = 0;
    this.fps = 0;
  }

  tick(dt, info) {
    this.frames++;
    this.acc += dt;
    if (this.acc < 0.5) return;
    this.fps = Math.round(this.frames / this.acc);
    this.frames = 0;
    this.acc = 0;
    const p = info.pos;
    this.el.textContent =
      `${this.title} — ${this.fps} FPS\n` +
      `XYZ: ${p.x.toFixed(1)}  ${p.y.toFixed(1)}  ${p.z.toFixed(1)}\n` +
      `Chunks: ${info.chunks} visíveis (${info.total} em memória)\n` +
      `Modo: ${info.flying ? 'voo' : 'andar'}  ·  Bloco: ${info.block}`;
  }
}
