import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  CUBE_FACES,
  CUBE_ROTATIONS,
  createDefaultCubeOrientation,
  mapBaseFaceToUser,
  rotateCubeOrientation,
  type CubeFace,
  type CubeOrientation,
  type CubeRotation
} from '../../src/core/orientation/cubeOrientation.ts';
import {
  cubeOrientationToQuaternion,
  getCubeRotationAnimationSpec
} from '../../src/renderer/orientationAnimation.ts';

const FACE_VECTORS: Readonly<Record<CubeFace, THREE.Vector3>> = {
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1)
};

function enumerateOrientations(): CubeOrientation[] {
  const pending = [createDefaultCubeOrientation()];
  const found = new Map<string, CubeOrientation>();

  while (pending.length > 0) {
    const orientation = pending.shift();
    if (orientation === undefined) break;
    const key = CUBE_FACES.map((face) => orientation.userToBase[face]).join('');
    if (found.has(key)) continue;
    found.set(key, orientation);
    for (const rotation of ['x', 'y', 'z'] as const) {
      pending.push(rotateCubeOrientation(orientation, rotation));
    }
  }

  return [...found.values()];
}

describe('cube orientation animation geometry', () => {
  it('maps identity to the identity quaternion', () => {
    const quaternion = cubeOrientationToQuaternion(createDefaultCubeOrientation());

    expect(quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0, 10);
  });

  it.each(enumerateOrientations())('maps every base face to its user direction', (orientation) => {
    const quaternion = cubeOrientationToQuaternion(orientation);

    for (const baseFace of CUBE_FACES) {
      const actual = FACE_VECTORS[baseFace].clone().applyQuaternion(quaternion);
      const expected = FACE_VECTORS[mapBaseFaceToUser(orientation, baseFace)];
      expect(actual.distanceTo(expected)).toBeCloseTo(0, 10);
    }
  });

  it('points base R toward user F after y', () => {
    const orientation = rotateCubeOrientation(createDefaultCubeOrientation(), 'y');
    const actual = FACE_VECTORS.R.clone().applyQuaternion(
      cubeOrientationToQuaternion(orientation)
    );

    expect(actual.distanceTo(FACE_VECTORS.F)).toBeCloseTo(0, 10);
  });

  it.each(CUBE_ROTATIONS)('defines axis, angle and duration for %s', (rotation) => {
    const spec = getCubeRotationAnimationSpec(rotation);
    const axis = rotation[0];
    const magnitude = rotation.endsWith('2') ? Math.PI : Math.PI / 2;
    const sign = rotation.endsWith("'") ? 1 : -1;

    expect(spec).toEqual({
      axis,
      angle: sign * magnitude,
      durationMs: rotation.endsWith('2') ? 280 : 200
    });
  });

  it('makes every animated delta match the model target in every orientation', () => {
    for (const orientation of enumerateOrientations()) {
      const start = cubeOrientationToQuaternion(orientation);

      for (const rotation of CUBE_ROTATIONS) {
        const spec = getCubeRotationAnimationSpec(rotation);
        const axis = spec.axis === 'x'
          ? new THREE.Vector3(1, 0, 0)
          : spec.axis === 'y'
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(0, 0, 1);
        const animatedTarget = new THREE.Quaternion()
          .setFromAxisAngle(axis, spec.angle)
          .multiply(start);
        const modelTarget = cubeOrientationToQuaternion(
          rotateCubeOrientation(orientation, rotation)
        );

        expect(animatedTarget.angleTo(modelTarget)).toBeLessThan(1e-6);
      }
    }
  });

  it.each(['x', 'y', 'z'] as const)(
    'four animated %s deltas return to identity',
    (rotation) => {
      const spec = getCubeRotationAnimationSpec(rotation as CubeRotation);
      const axis = rotation === 'x'
        ? new THREE.Vector3(1, 0, 0)
        : rotation === 'y'
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
      const result = new THREE.Quaternion();
      const delta = new THREE.Quaternion().setFromAxisAngle(axis, spec.angle);
      for (let index = 0; index < 4; index += 1) result.premultiply(delta);

      expect(result.angleTo(new THREE.Quaternion())).toBeCloseTo(0, 10);
    }
  );
});
