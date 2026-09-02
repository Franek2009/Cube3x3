import type { Move } from '../moves/moves.ts';
import {
  encodeCornerOrientation,
  encodeCornerPermutation,
  encodeEdgeOrientation,
  encodeSliceCombination,
  encodeSliceEdgePermutation,
  encodeUdEdgePermutation,
  SLICE_EDGE_PERMUTATION_COUNT,
  type SolverCubieState
} from './coordinates.ts';
import {
  getMoveTables,
  PHASE2_MOVE_COUNT,
  PHASE2_MOVES,
  type SolverMoveTables
} from './moveTables.ts';
import {
  getPruningTables,
  UNVISITED_PRUNING_DEPTH,
  type SolverPruningTables
} from './pruningTables.ts';

export const DEFAULT_PHASE2_MAX_DEPTH = 18;

export interface Phase2SearchDependencies {
  readonly moveTables: SolverMoveTables;
  readonly pruningTables: SolverPruningTables;
}

export interface Phase2SearchOptions {
  readonly maxDepth?: number;
  readonly dependencies?: Phase2SearchDependencies;
}

export interface Phase2SearchResult {
  readonly moves: readonly Move[];
  readonly depth: number;
}

type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

const MOVE_FACES: readonly Face[] = PHASE2_MOVES.map((move) => move[0] as Face);

function shouldPrune(previousFace: Face | undefined, nextFace: Face): boolean {
  if (previousFace === nextFace) return true;

  return (
    (previousFace === 'D' && nextFace === 'U') ||
    (previousFace === 'R' && nextFace === 'L') ||
    (previousFace === 'B' && nextFace === 'F')
  );
}

function resolveMaxDepth(value: number | undefined): number {
  const maxDepth = value ?? DEFAULT_PHASE2_MAX_DEPTH;
  if (!Number.isFinite(maxDepth) || !Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new RangeError('maxDepth must be a finite non-negative integer');
  }
  return maxDepth;
}

function assertG1(state: SolverCubieState): void {
  if (
    encodeCornerOrientation(state) !== 0 ||
    encodeEdgeOrientation(state) !== 0 ||
    encodeSliceCombination(state) !== 0
  ) {
    throw new Error('Phase 2 search requires a G1 state');
  }
}

function phase2Heuristic(
  cornerPermutation: number,
  udEdgePermutation: number,
  sliceEdgePermutation: number,
  pruningTables: SolverPruningTables
): number {
  const cornerDepth = pruningTables.cornerPermutationSlice[
    cornerPermutation * SLICE_EDGE_PERMUTATION_COUNT + sliceEdgePermutation
  ];
  const edgeDepth = pruningTables.udEdgePermutationSlice[
    udEdgePermutation * SLICE_EDGE_PERMUTATION_COUNT + sliceEdgePermutation
  ];

  if (
    cornerDepth === UNVISITED_PRUNING_DEPTH ||
    edgeDepth === UNVISITED_PRUNING_DEPTH
  ) {
    throw new Error('Phase 2 pruning table contains an unvisited entry');
  }

  return Math.max(cornerDepth, edgeDepth);
}

export function searchPhase2(
  startState: SolverCubieState,
  options?: Phase2SearchOptions
): Phase2SearchResult | undefined {
  const maxDepth = resolveMaxDepth(options?.maxDepth);
  assertG1(startState);

  const moveTables = options?.dependencies?.moveTables ?? getMoveTables();
  const pruningTables = options?.dependencies?.pruningTables ?? getPruningTables();
  const startCornerPermutation = encodeCornerPermutation(startState);
  const startUdEdgePermutation = encodeUdEdgePermutation(startState);
  const startSliceEdgePermutation = encodeSliceEdgePermutation(startState);
  const initialBound = phase2Heuristic(
    startCornerPermutation,
    startUdEdgePermutation,
    startSliceEdgePermutation,
    pruningTables
  );

  if (initialBound > maxDepth) return undefined;

  const pathMoveIndices = new Uint8Array(maxDepth);

  function depthFirstSearch(
    cornerPermutation: number,
    udEdgePermutation: number,
    sliceEdgePermutation: number,
    depth: number,
    bound: number,
    previousFace: Face | undefined
  ): boolean {
    const remainingDepth = bound - depth;
    const heuristic = phase2Heuristic(
      cornerPermutation,
      udEdgePermutation,
      sliceEdgePermutation,
      pruningTables
    );

    if (heuristic > remainingDepth) return false;

    if (depth === bound) {
      return (
        cornerPermutation === 0 &&
        udEdgePermutation === 0 &&
        sliceEdgePermutation === 0
      );
    }

    for (let moveIndex = 0; moveIndex < PHASE2_MOVE_COUNT; moveIndex += 1) {
      const face = MOVE_FACES[moveIndex];
      if (shouldPrune(previousFace, face)) continue;

      pathMoveIndices[depth] = moveIndex;
      const nextCornerPermutation = moveTables.cornerPermutation[
        cornerPermutation * PHASE2_MOVE_COUNT + moveIndex
      ];
      const nextUdEdgePermutation = moveTables.udEdgePermutation[
        udEdgePermutation * PHASE2_MOVE_COUNT + moveIndex
      ];
      const nextSliceEdgePermutation = moveTables.sliceEdgePermutation[
        sliceEdgePermutation * PHASE2_MOVE_COUNT + moveIndex
      ];

      if (
        depthFirstSearch(
          nextCornerPermutation,
          nextUdEdgePermutation,
          nextSliceEdgePermutation,
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
        startCornerPermutation,
        startUdEdgePermutation,
        startSliceEdgePermutation,
        0,
        bound,
        undefined
      )
    ) {
      const moves = Object.freeze(
        Array.from(pathMoveIndices.slice(0, bound), (moveIndex) => PHASE2_MOVES[moveIndex])
      );
      return { moves, depth: bound };
    }
  }

  return undefined;
}
