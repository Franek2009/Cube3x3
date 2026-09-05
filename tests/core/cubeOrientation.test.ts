import { describe, expect, it } from 'vitest';

import { ALL_MOVES, type Move } from '../../src/core/moves/moves.ts';
import {
  CUBE_FACES,
  CUBE_ROTATIONS,
  createDefaultCubeOrientation,
  mapBaseFaceToUser,
  mapBaseMoveToUser,
  mapUserFaceToBase,
  mapUserMoveToBase,
  rotateCubeOrientation,
  type CubeFace,
  type CubeOrientation,
  type CubeRotation
} from '../../src/core/orientation/cubeOrientation.ts';

const EXPECTED_ROTATIONS: Readonly<
  Record<CubeRotation, Readonly<Record<CubeFace, CubeFace>>>
> = {
  x: { U: 'F', D: 'B', L: 'L', R: 'R', F: 'D', B: 'U' },
  "x'": { U: 'B', D: 'F', L: 'L', R: 'R', F: 'U', B: 'D' },
  x2: { U: 'D', D: 'U', L: 'L', R: 'R', F: 'B', B: 'F' },
  y: { U: 'U', D: 'D', L: 'F', R: 'B', F: 'R', B: 'L' },
  "y'": { U: 'U', D: 'D', L: 'B', R: 'F', F: 'L', B: 'R' },
  y2: { U: 'U', D: 'D', L: 'R', R: 'L', F: 'B', B: 'F' },
  z: { U: 'L', D: 'R', L: 'D', R: 'U', F: 'F', B: 'B' },
  "z'": { U: 'R', D: 'L', L: 'U', R: 'D', F: 'F', B: 'B' },
  z2: { U: 'D', D: 'U', L: 'R', R: 'L', F: 'F', B: 'B' }
};

function orientationKey(orientation: CubeOrientation): string {
  return CUBE_FACES.map((face) => orientation.userToBase[face]).join('');
}

function rotateAll(
  orientation: CubeOrientation,
  rotations: readonly CubeRotation[]
): CubeOrientation {
  return rotations.reduce(rotateCubeOrientation, orientation);
}

function enumerateCubeOrientations(): readonly CubeOrientation[] {
  const pending = [createDefaultCubeOrientation()];
  const orientations = new Map<string, CubeOrientation>();

  while (pending.length > 0) {
    const orientation = pending.shift();
    if (orientation === undefined) break;
    const key = orientationKey(orientation);
    if (orientations.has(key)) continue;
    orientations.set(key, orientation);

    for (const rotation of ['x', 'y', 'z'] as const) {
      pending.push(rotateCubeOrientation(orientation, rotation));
    }
  }

  return [...orientations.values()];
}

describe('cube orientation', () => {
  it('creates the frozen identity orientation', () => {
    const orientation = createDefaultCubeOrientation();

    expect(orientation.userToBase).toEqual({
      U: 'U', D: 'D', L: 'L', R: 'R', F: 'F', B: 'B'
    });
    expect(Object.isFrozen(orientation)).toBe(true);
    expect(Object.isFrozen(orientation.userToBase)).toBe(true);
    expect(ALL_MOVES.map((move) => mapUserMoveToBase(orientation, move))).toEqual(ALL_MOVES);
  });

  it('freezes the exported face and rotation constants at runtime', () => {
    expect(Object.isFrozen(CUBE_FACES)).toBe(true);
    expect(Object.isFrozen(CUBE_ROTATIONS)).toBe(true);
  });

  it.each(CUBE_ROTATIONS)('implements the exact %s mapping', (rotation) => {
    const result = rotateCubeOrientation(createDefaultCubeOrientation(), rotation);

    expect(result.userToBase).toEqual(EXPECTED_ROTATIONS[rotation]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.userToBase)).toBe(true);
  });

  it.each([
    ['x', "x'"],
    ['y', "y'"],
    ['z', "z'"]
  ] as const)('%s followed by %s returns to identity', (rotation, inverse) => {
    const result = rotateAll(createDefaultCubeOrientation(), [rotation, inverse]);

    expect(result).toEqual(createDefaultCubeOrientation());
  });

  it.each(['x', 'y', 'z'] as const)('four %s quarter rotations return to identity', (rotation) => {
    const result = rotateAll(createDefaultCubeOrientation(), [
      rotation, rotation, rotation, rotation
    ]);

    expect(result).toEqual(createDefaultCubeOrientation());
  });

  it.each(['x2', 'y2', 'z2'] as const)('two %s rotations return to identity', (rotation) => {
    const result = rotateAll(createDefaultCubeOrientation(), [rotation, rotation]);

    expect(result).toEqual(createDefaultCubeOrientation());
  });

  it('composes y then x in application order', () => {
    const result = rotateAll(createDefaultCubeOrientation(), ['y', 'x']);

    expect(result.userToBase).toEqual({
      U: 'R', D: 'L', L: 'F', R: 'B', F: 'D', B: 'U'
    });
  });

  it('has exactly 24 unique valid orientations', () => {
    const orientations = enumerateCubeOrientations();

    expect(orientations).toHaveLength(24);
    for (const orientation of orientations) {
      expect(new Set(Object.values(orientation.userToBase))).toEqual(new Set(CUBE_FACES));
    }
  });

  it('maps user and base faces and moves as exact inverses in every orientation', () => {
    for (const orientation of enumerateCubeOrientations()) {
      for (const face of CUBE_FACES) {
        const baseFace = mapUserFaceToBase(orientation, face);
        expect(mapBaseFaceToUser(orientation, baseFace)).toBe(face);
      }

      for (const move of ALL_MOVES) {
        const baseMove = mapUserMoveToBase(orientation, move);
        expect(mapBaseMoveToUser(orientation, baseMove)).toBe(move);
      }
    }
  });

  it.each([
    ['F', 'R'],
    ["F'", "R'"],
    ['F2', 'R2']
  ] as const)('preserves the suffix when mapping %s to %s after y', (move, expected) => {
    const orientation = rotateCubeOrientation(createDefaultCubeOrientation(), 'y');

    expect(mapUserMoveToBase(orientation, move as Move)).toBe(expected);
  });

  it('does not mutate an input orientation and returns independent results', () => {
    const input = createDefaultCubeOrientation();
    const first = rotateCubeOrientation(input, 'x');
    const second = rotateCubeOrientation(input, 'y');

    expect(input).toEqual(createDefaultCubeOrientation());
    expect(first).not.toBe(second);
    expect(first.userToBase).not.toBe(second.userToBase);
    expect(first.userToBase).toEqual(EXPECTED_ROTATIONS.x);
    expect(second.userToBase).toEqual(EXPECTED_ROTATIONS.y);
  });
});
