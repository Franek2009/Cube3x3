import { describe, expect, it } from 'vitest';

import { solvedState } from '../../src/core/cube/CubeState.ts';
import { ALL_MOVES, type Move } from '../../src/core/moves/moves.ts';
import { mapCubeStateToCubies, type Position3D } from '../../src/renderer/cubieMapping.ts';
import {
  getAffectedCubieIds,
  getMoveAnimationSpec,
  type MoveAnimationSpec
} from '../../src/renderer/moveAnimation.ts';

const EXPECTED_SPECS: Readonly<Record<Move, MoveAnimationSpec>> = {
  U: { axis: 'y', layer: 1, angle: -Math.PI / 2, durationMs: 200 },
  "U'": { axis: 'y', layer: 1, angle: Math.PI / 2, durationMs: 200 },
  U2: { axis: 'y', layer: 1, angle: -Math.PI, durationMs: 280 },
  D: { axis: 'y', layer: -1, angle: Math.PI / 2, durationMs: 200 },
  "D'": { axis: 'y', layer: -1, angle: -Math.PI / 2, durationMs: 200 },
  D2: { axis: 'y', layer: -1, angle: Math.PI, durationMs: 280 },
  L: { axis: 'x', layer: -1, angle: Math.PI / 2, durationMs: 200 },
  "L'": { axis: 'x', layer: -1, angle: -Math.PI / 2, durationMs: 200 },
  L2: { axis: 'x', layer: -1, angle: Math.PI, durationMs: 280 },
  R: { axis: 'x', layer: 1, angle: -Math.PI / 2, durationMs: 200 },
  "R'": { axis: 'x', layer: 1, angle: Math.PI / 2, durationMs: 200 },
  R2: { axis: 'x', layer: 1, angle: -Math.PI, durationMs: 280 },
  F: { axis: 'z', layer: 1, angle: -Math.PI / 2, durationMs: 200 },
  "F'": { axis: 'z', layer: 1, angle: Math.PI / 2, durationMs: 200 },
  F2: { axis: 'z', layer: 1, angle: -Math.PI, durationMs: 280 },
  B: { axis: 'z', layer: -1, angle: Math.PI / 2, durationMs: 200 },
  "B'": { axis: 'z', layer: -1, angle: -Math.PI / 2, durationMs: 200 },
  B2: { axis: 'z', layer: -1, angle: Math.PI, durationMs: 280 }
};

function rotate(position: Position3D, spec: MoveAnimationSpec): Position3D {
  const cosine = Math.round(Math.cos(spec.angle));
  const sine = Math.round(Math.sin(spec.angle));

  let rotated: Position3D;

  switch (spec.axis) {
    case 'x':
      rotated = { x: position.x, y: cosine * position.y - sine * position.z, z: sine * position.y + cosine * position.z };
      break;
    case 'y':
      rotated = { x: cosine * position.x + sine * position.z, y: position.y, z: -sine * position.x + cosine * position.z };
      break;
    case 'z':
      rotated = { x: cosine * position.x - sine * position.y, y: sine * position.x + cosine * position.y, z: position.z };
      break;
  }

  return {
    x: rotated.x === 0 ? 0 : rotated.x,
    y: rotated.y === 0 ? 0 : rotated.y,
    z: rotated.z === 0 ? 0 : rotated.z
  };
}

describe('move animation geometry', () => {
  it.each(ALL_MOVES)('defines the approved axis, layer, angle and duration for %s', (move) => {
    expect(getMoveAnimationSpec(move)).toEqual(EXPECTED_SPECS[move]);
  });

  it.each(['U', 'D', 'L', 'R', 'F', 'B'] as const)(
    'uses opposite angle signs for %s and its prime variant',
    (face) => {
      const quarter = getMoveAnimationSpec(face);
      const prime = getMoveAnimationSpec(`${face}'` as Move);
      expect(prime.angle).toBe(-quarter.angle);
      expect(Math.abs(quarter.angle)).toBe(Math.PI / 2);
    }
  );

  it.each(ALL_MOVES)('selects exactly the nine physical cubies in the %s layer', (move) => {
    const ids = getAffectedCubieIds(move, solvedState());
    expect(ids).toHaveLength(9);
    expect(new Set(ids).size).toBe(9);
    expect(ids).toContain(`center-${move[0]}`);
  });

  it.each(['U', 'D', 'L', 'R', 'F', 'B'] as const)(
    'selects the same %s layer for quarter, prime and double variants',
    (face) => {
      const state = solvedState().applyMoves(['R', 'U', 'F2', "L'", 'D']);
      const selections = [face, `${face}'`, `${face}2`].map((move) =>
        [...getAffectedCubieIds(move as Move, state)].sort()
      );
      expect(selections[1]).toEqual(selections[0]);
      expect(selections[2]).toEqual(selections[0]);
    }
  );

  it.each(ALL_MOVES)(
    'rotating selected positions for %s matches the target CubeState mapping',
    (move) => {
      const fromState = solvedState().applyMoves(['R', 'U', 'F2', "L'", 'D', 'B']);
      const toState = fromState.applyMove(move);
      const fromById = new Map(mapCubeStateToCubies(fromState).map((cubie) => [cubie.id, cubie]));
      const toById = new Map(mapCubeStateToCubies(toState).map((cubie) => [cubie.id, cubie]));
      const affectedIds = new Set(getAffectedCubieIds(move, fromState));
      const spec = getMoveAnimationSpec(move);

      for (const [id, fromCubie] of fromById) {
        const expectedPosition = affectedIds.has(id)
          ? rotate(fromCubie.position, spec)
          : fromCubie.position;
        expect(toById.get(id)?.position).toEqual(expectedPosition);
      }
    }
  );
});
