import type { CubeState } from '../cube/CubeState.ts';
import {
  validateCubeState,
  type CubeValidationError
} from '../cube/validation.ts';
import type { Move } from '../moves/moves.ts';
import { toSolverCubieState } from './coordinates.ts';
import { getMoveTables } from './moveTables.ts';
import { searchPhase1 } from './phase1Search.ts';
import { searchPhase2, type Phase2SearchResult } from './phase2Search.ts';
import { getPruningTables } from './pruningTables.ts';

const DEFAULT_MAX_DEPTH = 30;

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

  if (!Number.isFinite(maxDepth) || !Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new RangeError('maxDepth must be a finite non-negative integer');
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

  if (state.isSolved()) {
    return {
      solved: true,
      moves: Object.freeze([]),
      depth: 0
    };
  }

  const moveTables = getMoveTables();
  const pruningTables = getPruningTables();
  const dependencies = { moveTables, pruningTables };
  const solverState = toSolverCubieState(state);
  let acceptedPhase2: Phase2SearchResult | undefined;

  const phase1 = searchPhase1(solverState, {
    maxDepth,
    dependencies,
    onCandidate(candidate) {
      const remainingDepth = maxDepth - candidate.depth;
      const phase2 = searchPhase2(candidate.terminalState, {
        maxDepth: remainingDepth,
        dependencies
      });

      if (phase2 === undefined) return false;

      acceptedPhase2 = phase2;
      return true;
    }
  });

  if (phase1 === undefined || acceptedPhase2 === undefined) {
    return { solved: false, reason: 'depth-limit' };
  }

  const phase2: Phase2SearchResult = acceptedPhase2;
  const moves = Object.freeze([...phase1.moves, ...phase2.moves]);
  const depth = phase1.depth + phase2.depth;

  if (moves.length !== depth || depth > maxDepth) {
    throw new Error('Two-Phase solver returned an invalid solution depth');
  }

  if (!state.applyMoves(moves).isSolved()) {
    throw new Error('Two-Phase solver returned a path that does not solve the cube');
  }

  return {
    solved: true,
    moves,
    depth
  };
}
