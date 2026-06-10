import * as THREE from 'three';
import { BLOCKS, BlockId, faceTile } from './Block.js';
import { tileUV } from '../assets/textures.js';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;

// Tabela das 6 faces do cubo: direção, cantos (posição + uv dentro do tile) e
// um brilho "fake" por orientação — iluminação direcional simples embutida na
// cor dos vértices, no estilo clássico de jogos voxel.
const FACES = [
  {
    name: 'side', dir: [-1, 0, 0], brightness: 0.8,
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  {
    name: 'side', dir: [1, 0, 0], brightness: 0.8,
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  {
    name: 'bottom', dir: [0, -1, 0], brightness: 0.5,
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  {
    name: 'top', dir: [0, 1, 0], brightness: 1.0,
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  {
    name: 'side', dir: [0, 0, -1], brightness: 0.65,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
  {
    name: 'side', dir: [0, 0, 1], brightness: 0.65,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
];

function makeGeometry(buf) {
  if (buf.indices.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
  geo.setIndex(new THREE.Uint32BufferAttribute(buf.indices, 1));
  geo.computeBoundingSphere(); // necessário p/ frustum culling por chunk
  return geo;
}

export class Chunk {
  constructor(world, cx, cz) {
    this.world = world;
    this.cx = cx;
    this.cz = cz;
    this.data = null;      // Uint8Array preenchido pelo World/TerrainGenerator
    this.solidMesh = null; // blocos opacos + folhas
    this.waterMesh = null; // líquidos (malha transparente separada)
    this.meshBuilt = false;
  }

  index(x, y, z) {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  // Gera uma BufferGeometry mesclada com apenas as faces visíveis do chunk
  // (faces entre dois blocos opacos são descartadas).
  // TODO: greedy meshing — fundir faces coplanares adjacentes do mesmo tile
  // reduziria bastante o número de vértices por chunk.
  buildMesh(scene, materials) {
    this.disposeMeshes(scene);

    const solid = { positions: [], normals: [], colors: [], uvs: [], indices: [] };
    const water = { positions: [], normals: [], colors: [], uvs: [], indices: [] };
    const x0 = this.cx * CHUNK_SIZE;
    const z0 = this.cz * CHUNK_SIZE;

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = this.data[this.index(x, y, z)];
          if (id === BlockId.AIR) continue;
          const def = BLOCKS[id];
          const target = def.liquid ? water : solid;

          for (const face of FACES) {
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];
            let nid;
            if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE && ny >= 0 && ny < CHUNK_HEIGHT) {
              nid = this.data[this.index(nx, ny, nz)];
            } else {
              // vizinho em outro chunk: o World garante os dados gerados
              nid = this.world.getBlock(x0 + nx, ny, z0 + nz);
            }
            if (BLOCKS[nid].opaque) continue; // face escondida por bloco opaco
            if (nid === id) continue;         // sem faces internas entre transparentes iguais

            const tile = faceTile(id, face.name);
            const base = target.positions.length / 3;
            for (const c of face.corners) {
              target.positions.push(x + c.pos[0], y + c.pos[1], z + c.pos[2]);
              target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
              const [u, v] = tileUV(tile, c.uv[0], c.uv[1]);
              target.uvs.push(u, v);
              target.colors.push(face.brightness, face.brightness, face.brightness);
            }
            target.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }
      }
    }

    const solidGeo = makeGeometry(solid);
    if (solidGeo) {
      this.solidMesh = new THREE.Mesh(solidGeo, materials.solid);
      this.solidMesh.position.set(x0, 0, z0);
      this.solidMesh.matrixAutoUpdate = false;
      this.solidMesh.updateMatrix();
      scene.add(this.solidMesh);
    }
    const waterGeo = makeGeometry(water);
    if (waterGeo) {
      this.waterMesh = new THREE.Mesh(waterGeo, materials.water);
      this.waterMesh.position.set(x0, 0, z0);
      this.waterMesh.matrixAutoUpdate = false;
      this.waterMesh.updateMatrix();
      this.waterMesh.renderOrder = 1; // água por último, depois dos opacos
      scene.add(this.waterMesh);
    }
    this.meshBuilt = true;
  }

  disposeMeshes(scene) {
    if (this.solidMesh) {
      scene.remove(this.solidMesh);
      this.solidMesh.geometry.dispose();
      this.solidMesh = null;
    }
    if (this.waterMesh) {
      scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
    this.meshBuilt = false;
  }
}
