import * as THREE from 'three';
import { isSolid } from '../world/Block.js';

// ── Física do jogador ────────────────────────────────────────────────────────
// AABB 0.6×1.8×0.6 com resolução de colisão eixo a eixo contra a grade de
// voxels. `pos` é o centro da BASE do AABB (os pés); a câmera fica em
// pos.y + EYE. Substeps impedem atravessar blocos em quedas rápidas.

const HALF = 0.3;      // meia-largura do AABB
const HEIGHT = 1.8;    // altura do jogador
const EYE = 1.62;      // altura dos olhos
const EPS = 0.001;     // folga p/ não ficar exatamente rente ao bloco
const WALK_SPEED = 5.5;
const FLY_SPEED = 11;
const GRAVITY = 27;
const JUMP_SPEED = 8.8; // ≈ 1.4 blocos de altura de pulo
const MAX_FALL = 55;

export class Player {
  constructor(world, camera, controls, input) {
    this.world = world;
    this.camera = camera;
    this.controls = controls;
    this.input = input;
    this.pos = new THREE.Vector3(8.5, 40, 8.5);
    this.vel = new THREE.Vector3();
    this.spawnPoint = new THREE.Vector3(8.5, 40, 8.5);
    this.flying = false;
    this.onGround = false;
  }

  toggleFly() {
    this.flying = !this.flying;
    this.vel.y = 0;
  }

  update(dt) {
    dt = Math.min(dt, 0.05); // evita "explosão" de física após aba em segundo plano

    // aceleração horizontal em direção ao que o jogador pede
    const wish = this.controls.moveDir();
    const speed = this.flying ? FLY_SPEED : WALK_SPEED;
    const accel = this.onGround || this.flying ? 12 : 4; // menos controle no ar
    const t = Math.min(1, accel * dt);
    this.vel.x += (wish.x * speed - this.vel.x) * t;
    this.vel.z += (wish.z * speed - this.vel.z) * t;

    if (this.flying) {
      const up = (this.input.isDown('Space') ? 1 : 0) -
                 (this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight') ? 1 : 0);
      this.vel.y += (up * FLY_SPEED - this.vel.y) * Math.min(1, 12 * dt);
    } else {
      // usa o onGround do frame anterior (ainda não foi resetado)
      if (this.input.isDown('Space') && this.onGround) this.vel.y = JUMP_SPEED;
      this.vel.y -= GRAVITY * dt;
      if (this.vel.y < -MAX_FALL) this.vel.y = -MAX_FALL;
    }

    // integração com substeps por eixo p/ não atravessar blocos
    const dx = this.vel.x * dt;
    const dy = this.vel.y * dt;
    const dz = this.vel.z * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.4));
    this.onGround = false;
    for (let i = 0; i < steps; i++) {
      this.moveAxis('y', dy / steps);
      this.moveAxis('x', dx / steps);
      this.moveAxis('z', dz / steps);
    }

    if (this.pos.y < -16) this.respawn(); // caiu do mundo

    this.syncCamera();
  }

  syncCamera() {
    this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
  }

  respawn() {
    this.pos.copy(this.spawnPoint);
    this.vel.set(0, 0, 0);
  }

  // move num único eixo; se penetrou em algo sólido, recoloca rente à face
  // do bloco e zera a velocidade naquele eixo
  moveAxis(axis, d) {
    if (d === 0) return;
    this.pos[axis] += d;
    if (!this.collides()) return;
    if (axis === 'x') {
      this.pos.x = d > 0
        ? Math.floor(this.pos.x + HALF) - HALF - EPS
        : Math.floor(this.pos.x - HALF) + 1 + HALF + EPS;
      this.vel.x = 0;
    } else if (axis === 'z') {
      this.pos.z = d > 0
        ? Math.floor(this.pos.z + HALF) - HALF - EPS
        : Math.floor(this.pos.z - HALF) + 1 + HALF + EPS;
      this.vel.z = 0;
    } else {
      if (d > 0) {
        this.pos.y = Math.floor(this.pos.y + HEIGHT) - HEIGHT - EPS;
      } else {
        this.pos.y = Math.floor(this.pos.y) + 1 + EPS;
        this.onGround = true;
      }
      this.vel.y = 0;
    }
  }

  // AABB do jogador contra todos os blocos sólidos que ele toca
  collides() {
    const minX = Math.floor(this.pos.x - HALF), maxX = Math.floor(this.pos.x + HALF);
    const minY = Math.floor(this.pos.y),        maxY = Math.floor(this.pos.y + HEIGHT);
    const minZ = Math.floor(this.pos.z - HALF), maxZ = Math.floor(this.pos.z + HALF);
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (isSolid(this.world.getBlock(x, y, z))) return true;
        }
      }
    }
    return false;
  }

  // o bloco (bx,by,bz) sobrepõe o AABB do jogador? (impede se emparedar)
  intersectsBlock(bx, by, bz) {
    return bx + 1 > this.pos.x - HALF && bx < this.pos.x + HALF &&
           by + 1 > this.pos.y        && by < this.pos.y + HEIGHT &&
           bz + 1 > this.pos.z - HALF && bz < this.pos.z + HALF;
  }
}
