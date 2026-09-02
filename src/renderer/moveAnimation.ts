import type { CubeState } from '../core/cube/CubeState.ts';
import type { Move } from '../core/moves/moves.ts';
import { mapCubeStateToCubies } from './cubieMapping.ts';

export type RotationAxis = 'x' | 'y' | 'z';

export interface MoveAnimationSpec {
  readonly axis: RotationAxis;
  readonly layer: -1 | 1;
  readonly angle: number;
  readonly durationMs: number;
}

const FACE_SPECS = {
  U: { axis: 'y', layer: 1, clockwiseSign: -1 },
  D: { axis: 'y', layer: -1, clockwiseSign: 1 },
  L: { axis: 'x', layer: -1, clockwiseSign: 1 },
  R: { axis: 'x', layer: 1, clockwiseSign: -1 },
  F: { axis: 'z', layer: 1, clockwiseSign: -1 },
  B: { axis: 'z', layer: -1, clockwiseSign: 1 }
} as const;

export function getMoveAnimationSpec(move: Move): MoveAnimationSpec {
  const face = move.charAt(0) as keyof typeof FACE_SPECS;
  const faceSpec = FACE_SPECS[face];
  const isDouble = move.endsWith('2');
  const direction = move.endsWith("'") ? -faceSpec.clockwiseSign : faceSpec.clockwiseSign;

  return {
    axis: faceSpec.axis,
    layer: faceSpec.layer,
    angle: direction * (isDouble ? Math.PI : Math.PI / 2),
    durationMs: isDouble ? 280 : 200
  };
}

export function getAffectedCubieIds(move: Move, state: CubeState): string[] {
  const { axis, layer } = getMoveAnimationSpec(move);

  return mapCubeStateToCubies(state)
    .filter((cubie) => cubie.position[axis] === layer)
    .map((cubie) => cubie.id);
}
