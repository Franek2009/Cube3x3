import * as THREE from 'three';

import type { CubeState } from '../core/cube/CubeState.ts';
import { mapCubeStateToCubies, type Face } from './cubieMapping.ts';

const FACE_COLORS: Readonly<Record<Face, number>> = {
  U: 0xffffff,
  D: 0xffd500,
  F: 0x19a55a,
  B: 0x2563eb,
  R: 0xdc2626,
  L: 0xf97316
};

const MATERIAL_DIRECTIONS: readonly Face[] = ['R', 'L', 'U', 'D', 'F', 'B'];
const PLASTIC_COLOR = 0x111318;

export class CubeRenderer {
  readonly #container: HTMLElement;
  readonly #scene = new THREE.Scene();
  readonly #camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  readonly #renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  readonly #cubeGroup = new THREE.Group();
  readonly #geometry = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  readonly #resizeObserver: ResizeObserver;
  #materials: THREE.Material[] = [];

  constructor(container: HTMLElement) {
    this.#container = container;
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.#renderer.domElement.setAttribute('aria-label', '3D Rubik cube view');
    this.#container.append(this.#renderer.domElement);

    this.#camera.position.set(5.6, 4.5, 6.5);
    this.#camera.lookAt(0, 0, 0);

    this.#scene.add(this.#cubeGroup);
    this.#scene.add(new THREE.HemisphereLight(0xffffff, 0x243047, 2.2));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(4, 7, 5);
    this.#scene.add(keyLight);

    this.#resizeObserver = new ResizeObserver(() => this.resize());
    this.#resizeObserver.observe(this.#container);
    this.resize();
  }

  renderState(state: CubeState): void {
    for (const material of this.#materials) {
      material.dispose();
    }
    this.#materials = [];
    this.#cubeGroup.clear();

    for (const cubie of mapCubeStateToCubies(state)) {
      const stickerByDirection = new Map(
        cubie.stickers.map((sticker) => [sticker.direction, sticker.face])
      );
      const materials = MATERIAL_DIRECTIONS.map((direction) => {
        const stickerFace = stickerByDirection.get(direction);
        const material = new THREE.MeshStandardMaterial({
          color: stickerFace === undefined ? PLASTIC_COLOR : FACE_COLORS[stickerFace],
          roughness: 0.48,
          metalness: 0.02
        });
        this.#materials.push(material);
        return material;
      });
      const mesh = new THREE.Mesh(this.#geometry, materials);
      mesh.position.set(cubie.position.x, cubie.position.y, cubie.position.z);
      mesh.name = cubie.id;
      this.#cubeGroup.add(mesh);
    }

    this.#renderer.render(this.#scene, this.#camera);
  }

  resize(): void {
    const width = Math.max(this.#container.clientWidth, 1);
    const height = Math.max(this.#container.clientHeight, 1);

    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setSize(width, height, false);
    this.#renderer.render(this.#scene, this.#camera);
  }

  dispose(): void {
    this.#resizeObserver.disconnect();
    for (const material of this.#materials) {
      material.dispose();
    }
    this.#materials = [];
    this.#geometry.dispose();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }
}
