import type { CubeState } from '../cube/CubeState.ts';
import {
  validateCubeState,
  type CubeValidationError
} from '../cube/validation.ts';
import type { Move } from '../moves/moves.ts';
import { findSolution } from './search.ts';

const DEFAULT_MAX_DEPTH = 5;
const MAX_PROTOTYPE_DEPTH = 6;

export interface SolveOptions {
  readonly maxDepth?: number;
}

export type SolveResult =
  | {
      readonly solved: true;
      readonly moves: readonly Move[];
      readonly depth: number;
    }
  | {
      readonly solved: false;
      readonly reason: 'depth-limit';
    }
  | {
      readonly solved: false;
      readonly reason: 'invalid-state';
      readonly validationError: CubeValidationError;
    };

function resolveMaxDepth(options: SolveOptions | undefined): number {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;

  if (
    !Number.isInteger(maxDepth) ||
    maxDepth < 0 ||
    maxDepth > MAX_PROTOTYPE_DEPTH
  ) {
    throw new RangeError(
      `maxDepth must be an integer between 0 and ${MAX_PROTOTYPE_DEPTH}`
    );
  }

  return maxDepth;
}

export function solveCube(state: CubeState, options?: SolveOptions): SolveResult {
  const validation = validateCubeState(state);

  if (!validation.valid) {
    return {
      solved: false,
      reason: 'invalid-state',
      validationError: validation.reason
    };
  }

  const maxDepth = resolveMaxDepth(options);
  const moves = findSolution(state, maxDepth);

  if (moves === undefined) {
    return { solved: false, reason: 'depth-limit' };
  }

  return {
    solved: true,
    moves,
    depth: moves.length
  };
}
