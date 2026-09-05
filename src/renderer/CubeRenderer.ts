import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { solvedState, type CubeState } from '../core/cube/CubeState.ts';
import type { Move } from '../core/moves/moves.ts';
import { mapCubeStateToCubies, type CubieRenderData, type Face } from './cubieMapping.ts';
import { getAffectedCubieIds, getMoveAnimationSpec } from './moveAnimation.ts';

const FACE_COLORS: Readonly<Record<Face, number>> = {
  U: 0xffffff, D: 0xffd500, F: 0x19a55a, B: 0x2563eb, R: 0xdc2626, L: 0xf97316
};
const MATERIAL_DIRECTIONS: readonly Face[] = ['R', 'L', 'U', 'D', 'F', 'B'];
const PLASTIC_COLOR = 0x111318;

type CubieMesh = THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial[]>;

interface ActiveAnimation {
  frameId: number;
  readonly pivot: THREE.Group;
  readonly meshes: readonly CubieMesh[];
  readonly resolve: () => void;
}

export class CubeRenderer {
  readonly #container: HTMLElement;
  readonly #scene = new THREE.Scene();
  readonly #camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  readonly #renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  readonly #controls: OrbitControls;
  readonly #cubeGroup = new THREE.Group();
  readonly #geometry = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  readonly #resizeObserver: ResizeObserver;
  readonly #meshes = new Map<string, CubieMesh>();
  #activeAnimation: ActiveAnimation | undefined;
  #disposed = false;
  readonly #renderOnControlsChange = (): void => this.#render();

  constructor(container: HTMLElement) {
    this.#container = container;
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.#renderer.domElement.setAttribute('aria-label', '3D Rubik cube view');
    this.#container.append(this.#renderer.domElement);
    this.#camera.position.set(5.6, 4.5, 6.5);
    this.#camera.lookAt(0, 0, 0);
    this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement);
    this.#controls.target.set(0, 0, 0);
    this.#controls.enableRotate = true;
    this.#controls.enableZoom = true;
    this.#controls.enablePan = false;
    this.#controls.enableDamping = false;
    this.#controls.minDistance = 9;
    this.#controls.maxDistance = 16;
    this.#controls.minPolarAngle = 0.05;
    this.#controls.maxPolarAngle = Math.PI - 0.05;
    this.#controls.cursorStyle = 'grab';
    this.#controls.update();
    this.#controls.addEventListener('change', this.#renderOnControlsChange);
    this.#scene.add(this.#cubeGroup);
    this.#scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    this.#scene.add(new THREE.HemisphereLight(0xffffff, 0x40506a, 1.2));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(4, 7, 5);
    this.#scene.add(keyLight);

    this.#createMeshes();
    this.#syncState(solvedState());
    this.#resizeObserver = new ResizeObserver(() => this.resize());
    this.#resizeObserver.observe(this.#container);
    this.resize();
  }

  renderState(state: CubeState): void {
    this.#assertUsable();
    this.#cancelActiveAnimation();
    this.#syncState(state);
    this.#render();
  }

  animateMove(move: Move, fromState: CubeState, toState: CubeState): Promise<void> {
    this.#assertUsable();
    this.#cancelActiveAnimation();
    this.#syncState(fromState);

    const spec = getMoveAnimationSpec(move);
    const meshes = getAffectedCubieIds(move, fromState).map((id) => this.#getMesh(id));
    const pivot = new THREE.Group();
    this.#cubeGroup.add(pivot);
    this.#cubeGroup.updateMatrixWorld(true);
    for (const mesh of meshes) {
      pivot.attach(mesh);
    }

    return new Promise((resolve) => {
      const startedAt = performance.now();
      const animation: ActiveAnimation = { frameId: 0, pivot, meshes, resolve };
      this.#activeAnimation = animation;

      const step = (timestamp: number): void => {
        if (this.#activeAnimation !== animation) return;

        const progress = Math.min((timestamp - startedAt) / spec.durationMs, 1);
        const eased = progress * progress * (3 - 2 * progress);
        pivot.rotation[spec.axis] = spec.angle * eased;
        this.#render();

        if (progress < 1) {
          animation.frameId = requestAnimationFrame(step);
        } else {
          this.#completeAnimation(animation, toState);
        }
      };

      animation.frameId = requestAnimationFrame(step);
    });
  }

  resize(): void {
    if (this.#disposed) return;
    const width = Math.max(this.#container.clientWidth, 1);
    const height = Math.max(this.#container.clientHeight, 1);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setSize(width, height, false);
    this.#render();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#cancelActiveAnimation();
    this.#controls.removeEventListener('change', this.#renderOnControlsChange);
    this.#controls.dispose();
    this.#disposed = true;
    this.#resizeObserver.disconnect();
    for (const mesh of this.#meshes.values()) {
      for (const material of mesh.material) material.dispose();
    }
    this.#meshes.clear();
    this.#geometry.dispose();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }

  #createMeshes(): void {
    for (const cubie of mapCubeStateToCubies(solvedState())) {
      const materials = MATERIAL_DIRECTIONS.map(() => new THREE.MeshStandardMaterial({
        color: PLASTIC_COLOR, roughness: 0.48, metalness: 0.02
      }));
      const mesh = new THREE.Mesh(this.#geometry, materials);
      mesh.name = cubie.id;
      this.#meshes.set(cubie.id, mesh);
      this.#cubeGroup.add(mesh);
    }
  }

  #syncState(state: CubeState): void {
    for (const cubie of mapCubeStateToCubies(state)) {
      const mesh = this.#getMesh(cubie.id);
      mesh.position.set(cubie.position.x, cubie.position.y, cubie.position.z);
      mesh.quaternion.identity();
      mesh.scale.set(1, 1, 1);
      this.#updateMaterials(mesh, cubie);
    }
  }

  #updateMaterials(mesh: CubieMesh, cubie: CubieRenderData): void {
    const stickers = new Map(cubie.stickers.map((sticker) => [sticker.direction, sticker.face]));
    MATERIAL_DIRECTIONS.forEach((direction, index) => {
      const face = stickers.get(direction);
      mesh.material[index].color.set(face === undefined ? PLASTIC_COLOR : FACE_COLORS[face]);
    });
  }

  #getMesh(id: string): CubieMesh {
    const mesh = this.#meshes.get(id);
    if (mesh === undefined) throw new Error(`Missing persistent cubie mesh: ${id}`);
    return mesh;
  }

  #completeAnimation(animation: ActiveAnimation, state: CubeState): void {
    if (this.#activeAnimation !== animation) return;
    this.#reparentAnimatedMeshes(animation);
    this.#activeAnimation = undefined;
    this.#syncState(state);
    this.#render();
    animation.resolve();
  }

  #cancelActiveAnimation(): void {
    const animation = this.#activeAnimation;
    if (animation === undefined) return;
    cancelAnimationFrame(animation.frameId);
    this.#reparentAnimatedMeshes(animation);
    this.#activeAnimation = undefined;
    animation.resolve();
  }

  #reparentAnimatedMeshes(animation: ActiveAnimation): void {
    animation.pivot.updateMatrixWorld(true);
    for (const mesh of animation.meshes) this.#cubeGroup.attach(mesh);
    this.#cubeGroup.remove(animation.pivot);
  }

  #render(): void {
    this.#renderer.render(this.#scene, this.#camera);
  }

  #assertUsable(): void {
    if (this.#disposed) throw new Error('CubeRenderer has been disposed');
  }
}
