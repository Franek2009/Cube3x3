import type { CubeState } from '../cube/CubeState.ts';
import { ALL_MOVES, type Move } from '../moves/moves.ts';

type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

function getFace(move: Move): Face {
  return move[0] as Face;
}

function shouldPrune(previousFace: Face | undefined, nextFace: Face): boolean {
  if (previousFace === nextFace) return true;

  return (
    (previousFace === 'D' && nextFace === 'U') ||
    (previousFace === 'R' && nextFace === 'L') ||
    (previousFace === 'B' && nextFace === 'F')
  );
}

function depthLimitedSearch(
  state: CubeState,
  remainingDepth: number,
  previousFace: Face | undefined,
  path: Move[]
): boolean {
  if (state.isSolved()) return true;
  if (remainingDepth === 0) return false;

  for (const move of ALL_MOVES) {
    const face = getFace(move);
    if (shouldPrune(previousFace, face)) continue;

    path.push(move);

    if (depthLimitedSearch(state.applyMove(move), remainingDepth - 1, face, path)) {
      return true;
    }

    path.pop();
  }

  return false;
}

export function findSolution(state: CubeState, maxDepth: number): readonly Move[] | undefined {
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const path: Move[] = [];

    if (depthLimitedSearch(state, depth, undefined, path)) {
      return Object.freeze([...path]);
    }
  }

  return undefined;
}
