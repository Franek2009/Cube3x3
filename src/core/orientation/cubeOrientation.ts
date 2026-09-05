import type { Move } from '../moves/moves.ts';

export const CUBE_FACES = Object.freeze(['U', 'D', 'L', 'R', 'F', 'B'] as const);

export type CubeFace = (typeof CUBE_FACES)[number];

export const CUBE_ROTATIONS = Object.freeze([
  'x', "x'", 'x2',
  'y', "y'", 'y2',
  'z', "z'", 'z2'
] as const);

export type CubeRotation = (typeof CUBE_ROTATIONS)[number];

export interface CubeOrientation {
  readonly userToBase: Readonly<Record<CubeFace, CubeFace>>;
}

const IDENTITY_FACE_MAPPING: Readonly<Record<CubeFace, CubeFace>> = {
  U: 'U',
  D: 'D',
  L: 'L',
  R: 'R',
  F: 'F',
  B: 'B'
};

const QUARTER_ROTATION_SOURCE_BY_DESTINATION: Readonly<
  Record<'x' | 'y' | 'z', Readonly<Record<CubeFace, CubeFace>>>
> = {
  x: { U: 'F', D: 'B', L: 'L', R: 'R', F: 'D', B: 'U' },
  y: { U: 'U', D: 'D', L: 'F', R: 'B', F: 'R', B: 'L' },
  z: { U: 'L', D: 'R', L: 'D', R: 'U', F: 'F', B: 'B' }
};

function freezeOrientation(
  userToBase: Record<CubeFace, CubeFace>
): CubeOrientation {
  return Object.freeze({ userToBase: Object.freeze(userToBase) });
}

function applyQuarterRotation(
  orientation: CubeOrientation,
  axis: 'x' | 'y' | 'z'
): CubeOrientation {
  const sourceByDestination = QUARTER_ROTATION_SOURCE_BY_DESTINATION[axis];
  const userToBase = {} as Record<CubeFace, CubeFace>;

  for (const destination of CUBE_FACES) {
    userToBase[destination] = orientation.userToBase[sourceByDestination[destination]];
  }

  return freezeOrientation(userToBase);
}

function rotationQuarterTurns(rotation: CubeRotation): number {
  if (rotation.endsWith("'")) return 3;
  if (rotation.endsWith('2')) return 2;
  return 1;
}

function withMappedFace(move: Move, face: CubeFace): Move {
  return `${face}${move.slice(1)}` as Move;
}

export function createDefaultCubeOrientation(): CubeOrientation {
  return freezeOrientation({ ...IDENTITY_FACE_MAPPING });
}

export function rotateCubeOrientation(
  orientation: CubeOrientation,
  rotation: CubeRotation
): CubeOrientation {
  const axis = rotation[0] as 'x' | 'y' | 'z';
  let result = orientation;

  for (let turn = 0; turn < rotationQuarterTurns(rotation); turn += 1) {
    result = applyQuarterRotation(result, axis);
  }

  return result;
}

export function mapUserFaceToBase(
  orientation: CubeOrientation,
  face: CubeFace
): CubeFace {
  return orientation.userToBase[face];
}

export function mapBaseFaceToUser(
  orientation: CubeOrientation,
  face: CubeFace
): CubeFace {
  for (const userFace of CUBE_FACES) {
    if (orientation.userToBase[userFace] === face) return userFace;
  }

  throw new Error(`Cube orientation does not contain base face ${face}`);
}

export function mapUserMoveToBase(
  orientation: CubeOrientation,
  move: Move
): Move {
  return withMappedFace(move, mapUserFaceToBase(orientation, move[0] as CubeFace));
}

export function mapBaseMoveToUser(
  orientation: CubeOrientation,
  move: Move
): Move {
  return withMappedFace(move, mapBaseFaceToUser(orientation, move[0] as CubeFace));
}
