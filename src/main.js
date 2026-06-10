import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { World } from './world/World.js';
import { TerrainGenerator } from './world/TerrainGenerator.js';
import { CHUNK_SIZE } from './world/Chunk.js';
import { BlockId, BLOCKS } from './world/Block.js';
import { Player } from './player/Player.js';
import { Controls } from './player/Controls.js';
import { BlockRaycaster } from './interaction/Raycaster.js';
import { Hotbar } from './ui/Hotbar.js';
import { Crosshair } from './ui/Crosshair.js';
import { DebugHUD } from './ui/DebugHUD.js';

// ── Configuração ─────────────────────────────────────────────────────────────
export const GAME_NAME = 'Voxelania'; // nome original do jogo — troque à vontade
const SAVE_KEY = 'voxelania-save-v1';
const DEFAULT_SEED = 20260610;

// ── Save/load (localStorage) ─────────────────────────────────────────────────
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const saved = loadSave();

// ── Bootstrap ────────────────────────────────────────────────────────────────
const engine = new Engine(document.getElementById('app'));
const input = new Input();
const generator = new TerrainGenerator(saved?.seed ?? DEFAULT_SEED);
const world = new World(engine.scene, generator);
// edições salvas precisam estar no World ANTES de qualquer geração de chunk
world.loadEdits(saved?.edits);
engine.setViewDistance(world.renderDistance * CHUNK_SIZE);

const controls = new Controls(engine.camera, engine.renderer.domElement, input);
const player = new Player(world, engine.camera, controls, input);

// spawn no topo do terreno em (8, 8), ou na posição salva
player.spawnPoint.set(8.5, world.getSpawnY(8, 8), 8.5);
if (saved?.player) {
  player.pos.set(saved.player.x, saved.player.y, saved.player.z);
  player.flying = !!saved.player.flying;
  engine.camera.quaternion.setFromEuler(
    new THREE.Euler(saved.player.pitch ?? 0, saved.player.yaw ?? 0, 0, 'YXZ')
  );
} else {
  player.pos.copy(player.spawnPoint);
}
// se o save deixou o jogador dentro de um bloco (ex.: edits mudaram), sobe
if (player.collides()) {
  player.pos.y = world.getSpawnY(Math.floor(player.pos.x), Math.floor(player.pos.z));
}
player.syncCamera();

const ray = new BlockRaycaster(world, engine.camera, engine.scene);
const hotbar = new Hotbar(document.getElementById('hotbar'), document.getElementById('hotbar-label'));
if (saved?.hotbar != null) hotbar.select(saved.hotbar);
const crosshair = new Crosshair(document.getElementById('crosshair'));
const hud = new DebugHUD(document.getElementById('debug'), GAME_NAME);
const overlay = document.getElementById('overlay');
const underwater = document.getElementById('underwater');

document.title = GAME_NAME;
document.querySelector('#overlay h1').textContent = GAME_NAME.toUpperCase();
crosshair.setVisible(false);

// ── Overlay / pointer lock ───────────────────────────────────────────────────
document.getElementById('btn-play').addEventListener('click', () => controls.lock());
document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('Apagar o mundo salvo e gerar um novo?')) {
    window.removeEventListener('beforeunload', saveGame);
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  }
});
controls.on('lock', () => {
  overlay.style.display = 'none';
  crosshair.setVisible(true);
});
controls.on('unlock', () => {
  overlay.style.display = 'flex';
  crosshair.setVisible(false);
});
// ambientes embutidos (iframes sem allow="pointer-lock") bloqueiam a API —
// avisa em vez de falhar silenciosamente
document.addEventListener('pointerlockerror', () => {
  showToast('Pointer lock indisponível aqui — abra o jogo numa aba do navegador');
});

// ── Interação ────────────────────────────────────────────────────────────────
input.onMouseDown(0, () => { if (controls.isLocked) ray.breakBlock(); });
input.onMouseDown(2, () => { if (controls.isLocked) ray.placeBlock(hotbar.selectedBlock, player); });
input.onKeyDown('KeyF', () => { if (controls.isLocked) player.toggleFly(); });
input.onKeyDown('KeyP', () => { saveGame(); showToast('Mundo salvo ✓'); });
for (let i = 1; i <= 9; i++) {
  input.onKeyDown('Digit' + i, () => {
    if (controls.isLocked && i <= hotbar.items.length) hotbar.select(i - 1);
  });
}
input.onWheel((dir) => { if (controls.isLocked) (dir > 0 ? hotbar.next() : hotbar.prev()); });

// ── Persistência ─────────────────────────────────────────────────────────────
function saveGame() {
  const e = new THREE.Euler().setFromQuaternion(engine.camera.quaternion, 'YXZ');
  const data = {
    seed: generator.seed,
    edits: world.serializeEdits(),
    player: {
      x: player.pos.x, y: player.pos.y, z: player.pos.z,
      yaw: e.y, pitch: e.x, flying: player.flying,
    },
    hotbar: hotbar.selected,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Falha ao salvar o mundo:', err);
  }
}
// além da tecla P, salva ao fechar/recarregar a página
window.addEventListener('beforeunload', saveGame);

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ── Loop principal ───────────────────────────────────────────────────────────
engine.start((dt) => {
  world.update(player.pos.x, player.pos.z);

  // física pausada com o menu aberto (estilo pause de single player)
  if (controls.isLocked) player.update(dt);
  else player.syncCamera();

  ray.update(controls.isLocked);

  // overlay azul quando a câmera está dentro d'água
  const head = world.getBlock(
    Math.floor(engine.camera.position.x),
    Math.floor(engine.camera.position.y),
    Math.floor(engine.camera.position.z)
  );
  underwater.style.display = head === BlockId.WATER ? 'block' : 'none';

  hud.tick(dt, {
    pos: player.pos,
    chunks: world.loadedChunkCount,
    total: world.chunks.size,
    flying: player.flying,
    block: BLOCKS[hotbar.selectedBlock].name,
  });
});
