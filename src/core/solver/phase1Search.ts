import { ALL_MOVES, type Move } from '../moves/moves.ts';
import {
  encodeCornerOrientation,
  encodeEdgeOrientation,
  encodeSliceCombination,
  SLICE_COMBINATION_COUNT,
  type SolverCubieState
} from './coordinates.ts';
import { applySolverMoveEffect, getSolverMoveEffect } from './moveEffects.ts';
import {
  getMoveTables,
  PHASE1_MOVE_COUNT,
  type SolverMoveTables
} from './moveTables.ts';
import {
  getPruningTables,
  UNVISITED_PRUNING_DEPTH,
  type SolverPruningTables
} from './pruningTables.ts';

export const DEFAULT_PHASE1_MAX_DEPTH = 12;

export interface Phase1Candidate {
  readonly terminalState: SolverCubieState;
  readonly depth: number;
}

export type Phase1CandidateHandler = (candidate: Phase1Candidate) => boolean;

export interface Phase1SearchDependencies {
  readonly moveTables: SolverMoveTables;
  readonly pruningTables: SolverPruningTables;
}

export interface Phase1SearchOptions {
  readonly maxDepth?: number;
  readonly onCandidate?: Phase1CandidateHandler;
  readonly dependencies?: Phase1SearchDependencies;
}

export interface Phase1SearchResult {
  readonly moves: readonly Move[];
  readonly depth: number;
}

type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

const MOVE_FACES: readonly Face[] = ALL_MOVES.map((move) => move[0] as Face);

function shouldPrune(previousFace: Face | undefined, nextFace: Face): boolean {
  if (previousFace === nextFace) return true;

  return (
    (previousFace === 'D' && nextFace === 'U') ||
    (previousFace === 'R' && nextFace === 'L') ||
    (previousFace === 'B' && nextFace === 'F')
  );
}

function resolveMaxDepth(value: number | undefined): number {
  const maxDepth = value ?? DEFAULT_PHASE1_MAX_DEPTH;
  if (!Number.isFinite(maxDepth) || !Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new RangeError('maxDepth must be a finite non-negative integer');
  }
  return maxDepth;
}

function cloneSolverState(state: SolverCubieState): SolverCubieState {
  return {
    cornerPermutation: state.cornerPermutation.slice(),
    cornerOrientation: state.cornerOrientation.slice(),
    edgePermutation: state.edgePermutation.slice(),
    edgeOrientation: state.edgeOrientation.slice()
  };
}

function reconstructCandidateState(
  startState: SolverCubieState,
  pathMoveIndices: Uint8Array,
  depth: number
): SolverCubieState {
  let state = cloneSolverState(startState);

  for (let pathIndex = 0; pathIndex < depth; pathIndex += 1) {
    const move = ALL_MOVES[pathMoveIndices[pathIndex]];
    state = applySolverMoveEffect(state, getSolverMoveEffect(move));
  }

  return state;
}

function phase1Heuristic(
  cornerOrientation: number,
  edgeOrientation: number,
  sliceCombination: number,
  pruningTables: SolverPruningTables
): number {
  const cornerDepth = pruningTables.cornerOrientationSlice[
    cornerOrientation * SLICE_COMBINATION_COUNT + sliceCombination
  ];
  const edgeDepth = pruningTables.edgeOrientationSlice[
    edgeOrientation * SLICE_COMBINATION_COUNT + sliceCombination
  ];

  if (
    cornerDepth === UNVISITED_PRUNING_DEPTH ||
    edgeDepth === UNVISITED_PRUNING_DEPTH
  ) {
    throw new Error('Phase 1 pruning table contains an unvisited entry');
  }

  return Math.max(cornerDepth, edgeDepth);
}

export function searchPhase1(
  startState: SolverCubieState,
  options?: Phase1SearchOptions
): Phase1SearchResult | undefined {
  const maxDepth = resolveMaxDepth(options?.maxDepth);
  const moveTables = options?.dependencies?.moveTables ?? getMoveTables();
  const pruningTables = options?.dependencies?.pruningTables ?? getPruningTables();
  const onCandidate = options?.onCandidate ?? (() => true);
  const startCornerOrientation = encodeCornerOrientation(startState);
  const startEdgeOrientation = encodeEdgeOrientation(startState);
  const startSliceCombination = encodeSliceCombination(startState);
  const initialBound = phase1Heuristic(
    startCornerOrientation,
    startEdgeOrientation,
    startSliceCombination,
    pruningTables
  );

  if (initialBound > maxDepth) return undefined;

  const pathMoveIndices = new Uint8Array(maxDepth);

  function depthFirstSearch(
    cornerOrientation: number,
    edgeOrientation: number,
    sliceCombination: number,
    depth: number,
    bound: number,
    previousFace: Face | undefined
  ): boolean {
    const remainingDepth = bound - depth;
    const heuristic = phase1Heuristic(
      cornerOrientation,
      edgeOrientation,
      sliceCombination,
      pruningTables
    );

    if (heuristic > remainingDepth) return false;

    if (depth === bound) {
      if (
        cornerOrientation !== 0 ||
        edgeOrientation !== 0 ||
        sliceCombination !== 0
      ) {
        return false;
      }

      return onCandidate({
        terminalState: reconstructCandidateState(startState, pathMoveIndices, depth),
        depth
      });
    }

    for (let moveIndex = 0; moveIndex < PHASE1_MOVE_COUNT; moveIndex += 1) {
      const face = MOVE_FACES[moveIndex];
      if (shouldPrune(previousFace, face)) continue;

      pathMoveIndices[depth] = moveIndex;
      const nextCornerOrientation = moveTables.cornerOrientation[
        cornerOrientation * PHASE1_MOVE_COUNT + moveIndex
      ];
      const nextEdgeOrientation = moveTables.edgeOrientation[
        edgeOrientation * PHASE1_MOVE_COUNT + moveIndex
      ];
      const nextSliceCombination = moveTables.sliceCombination[
        sliceCombination * PHASE1_MOVE_COUNT + moveIndex
      ];

      if (
        depthFirstSearch(
          nextCornerOrientation,
          nextEdgeOrientation,
          nextSliceCombination,
          depth + 1,
          bound,
          face
        )
      ) {
        return true;
      }
    }

    return false;
  }

  for (let bound = initialBound; bound <= maxDepth; bound += 1) {
    if (
      depthFirstSearch(
        startCornerOrientation,
        startEdgeOrientation,
        startSliceCombination,
        0,
        bound,
        undefined
      )
    ) {
      const moves = Object.freeze(
        Array.from(pathMoveIndices.slice(0, bound), (moveIndex) => ALL_MOVES[moveIndex])
      );
      return { moves, depth: bound };
    }
  }

  return undefined;
}
