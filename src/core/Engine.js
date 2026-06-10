import * as THREE from 'three';

// ── Núcleo de renderização ───────────────────────────────────────────────────
// Cena, câmera, renderer e render loop. A iluminação é "fake" (brilho por face
// embutido nas cores de vértice das malhas), então não há luzes na cena.

export class Engine {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false }); // estética pixelada
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.skyColor = new THREE.Color(0x87b9e6);
    this.scene.background = this.skyColor;
    this.scene.fog = new THREE.Fog(this.skyColor, 40, 120);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.clock = new THREE.Clock();
  }

  // névoa casada com a render distance — esconde o "pop" de chunks na borda
  setViewDistance(meters) {
    this.scene.fog.near = meters * 0.45;
    this.scene.fog.far = meters * 0.98;
    this.camera.far = meters * 2;
    this.camera.updateProjectionMatrix();
  }

  start(update) {
    // frustum culling por chunk é automático no three.js (mesh.frustumCulled)
    this.renderer.setAnimationLoop(() => {
      const dt = this.clock.getDelta();
      update(dt);
      this.renderer.render(this.scene, this.camera);
    });
  }
}
