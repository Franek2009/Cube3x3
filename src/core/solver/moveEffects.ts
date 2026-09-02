import { solvedState } from '../cube/CubeState.ts';
import { ALL_MOVES, type Move } from '../moves/moves.ts';
import { toSolverCubieState, type SolverCubieState } from './coordinates.ts';

export interface SolverMoveEffect {
  readonly cornerSourceByDestination: Uint8Array;
  readonly cornerOrientationDelta: Uint8Array;
  readonly edgeSourceByDestination: Uint8Array;
  readonly edgeOrientationDelta: Uint8Array;
}

export function buildSolverMoveEffects(): readonly SolverMoveEffect[] {
  return ALL_MOVES.map((move) => {
    const moved = toSolverCubieState(solvedState().applyMove(move));

    return {
      cornerSourceByDestination: moved.cornerPermutation,
      cornerOrientationDelta: moved.cornerOrientation,
      edgeSourceByDestination: moved.edgePermutation,
      edgeOrientationDelta: moved.edgeOrientation
    };
  });
}

export function applySolverMoveEffect(
  state: SolverCubieState,
  effect: SolverMoveEffect
): SolverCubieState {
  const cornerPermutation = new Uint8Array(8);
  const cornerOrientation = new Uint8Array(8);
  const edgePermutation = new Uint8Array(12);
  const edgeOrientation = new Uint8Array(12);

  for (let destination = 0; destination < 8; destination += 1) {
    const source = effect.cornerSourceByDestination[destination];
    cornerPermutation[destination] = state.cornerPermutation[source];
    cornerOrientation[destination] =
      (state.cornerOrientation[source] + effect.cornerOrientationDelta[destination]) % 3;
  }

  for (let destination = 0; destination < 12; destination += 1) {
    const source = effect.edgeSourceByDestination[destination];
    edgePermutation[destination] = state.edgePermutation[source];
    edgeOrientation[destination] =
      (state.edgeOrientation[source] + effect.edgeOrientationDelta[destination]) % 2;
  }

  return { cornerPermutation, cornerOrientation, edgePermutation, edgeOrientation };
}

const MOVE_INDEX = new Map<Move, number>(ALL_MOVES.map((move, index) => [move, index]));
const SOLVER_MOVE_EFFECTS = buildSolverMoveEffects();

export function getSolverMoveEffect(move: Move): SolverMoveEffect {
  return SOLVER_MOVE_EFFECTS[MOVE_INDEX.get(move)!];
}
