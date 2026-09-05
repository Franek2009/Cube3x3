import * as THREE from 'three';

import {
  mapBaseFaceToUser,
  type CubeFace,
  type CubeOrientation,
  type CubeRotation
} from '../core/orientation/cubeOrientation.ts';
import type { RotationAxis } from './moveAnimation.ts';

export interface CubeRotationAnimationSpec {
  readonly axis: RotationAxis;
  readonly angle: number;
  readonly durationMs: number;
}

const FACE_VECTORS: Readonly<Record<CubeFace, readonly [number, number, number]>> = {
  R: [1, 0, 0],
  L: [-1, 0, 0],
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1]
};

const QUARTER_ANGLES: Readonly<Record<'x' | 'y' | 'z', number>> = {
  x: -Math.PI / 2,
  y: -Math.PI / 2,
  z: -Math.PI / 2
};

export function getCubeRotationAnimationSpec(
  rotation: CubeRotation
): CubeRotationAnimationSpec {
  const axis = rotation[0] as 'x' | 'y' | 'z';
  const isDouble = rotation.endsWith('2');
  const direction = rotation.endsWith("'") ? -1 : 1;

  return {
    axis,
    angle: QUARTER_ANGLES[axis] * direction * (isDouble ? 2 : 1),
    durationMs: isDouble ? 280 : 200
  };
}

function userVectorForBaseFace(
  orientation: CubeOrientation,
  baseFace: CubeFace
): THREE.Vector3 {
  return new THREE.Vector3(...FACE_VECTORS[mapBaseFaceToUser(orientation, baseFace)]);
}

export function cubeOrientationToQuaternion(
  orientation: CubeOrientation
): THREE.Quaternion {
  const matrix = new THREE.Matrix4().makeBasis(
    userVectorForBaseFace(orientation, 'R'),
    userVectorForBaseFace(orientation, 'U'),
    userVectorForBaseFace(orientation, 'F')
  );

  return new THREE.Quaternion().setFromRotationMatrix(matrix).normalize();
}
