import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// ── Câmera em primeira pessoa ────────────────────────────────────────────────
// PointerLockControls cuida da rotação (mouse); aqui derivamos a direção de
// movimento WASD no plano XZ relativa ao olhar da câmera.

const UP = new THREE.Vector3(0, 1, 0);

export class Controls {
  constructor(camera, domElement, input) {
    this.camera = camera;
    this.input = input;
    this.plc = new PointerLockControls(camera, domElement);
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._euler = new THREE.Euler();
  }

  get isLocked() { return this.plc.isLocked; }
  lock() { this.plc.lock(); }
  unlock() { this.plc.unlock(); }
  on(event, cb) { this.plc.addEventListener(event, cb); }

  // direção desejada (normalizada, só XZ) a partir de WASD + olhar
  moveDir() {
    const f = this._forward;
    this.camera.getWorldDirection(f);
    f.y = 0;
    if (f.lengthSq() < 1e-8) {
      // olhando reto p/ cima/baixo: o vetor achatado degenera, mas o yaw
      // continua bem definido no quaternion da câmera — recupera dele
      const e = this._euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      f.set(-Math.sin(e.y), 0, -Math.cos(e.y));
    }
    f.normalize();
    const r = this._right.crossVectors(f, UP).normalize();

    const dir = this._dir.set(0, 0, 0);
    if (this.input.isDown('KeyW')) dir.add(f);
    if (this.input.isDown('KeyS')) dir.sub(f);
    if (this.input.isDown('KeyD')) dir.add(r);
    if (this.input.isDown('KeyA')) dir.sub(r);
    if (dir.lengthSq() > 0) dir.normalize();
    return dir;
  }
}
