import {
  getMoveTables,
  PHASE1_MOVE_COUNT,
  PHASE2_MOVE_COUNT,
  type SolverMoveTables
} from './moveTables.ts';
import {
  CORNER_ORIENTATION_COUNT,
  CORNER_PERMUTATION_COUNT,
  EDGE_ORIENTATION_COUNT,
  SLICE_COMBINATION_COUNT,
  SLICE_EDGE_PERMUTATION_COUNT,
  UD_EDGE_PERMUTATION_COUNT
} from './coordinates.ts';

export const UNVISITED_PRUNING_DEPTH = 0xff;

export interface SolverPruningTables {
  readonly cornerOrientationSlice: Uint8Array;
  readonly edgeOrientationSlice: Uint8Array;
  readonly cornerPermutationSlice: Uint8Array;
  readonly udEdgePermutationSlice: Uint8Array;
}

function buildPairPruningTable(
  coordinateACount: number,
  coordinateBCount: number,
  moveCount: number,
  coordinateAMoves: Uint16Array,
  coordinateBMoves: Uint16Array,
  queue: Uint32Array
): Uint8Array {
  const entryCount = coordinateACount * coordinateBCount;
  if (coordinateAMoves.length !== coordinateACount * moveCount) {
    throw new Error('Coordinate A move table has an unexpected length');
  }
  if (coordinateBMoves.length !== coordinateBCount * moveCount) {
    throw new Error('Coordinate B move table has an unexpected length');
  }
  if (queue.length < entryCount) {
    throw new Error('Pruning table queue is too small');
  }

  const pruning = new Uint8Array(entryCount);
  pruning.fill(UNVISITED_PRUNING_DEPTH);
  pruning[0] = 0;

  let head = 0;
  let tail = 1;
  queue[0] = 0;

  while (head < tail) {
    const index = queue[head++];
    const depth = pruning[index];
    if (depth === UNVISITED_PRUNING_DEPTH) {
      throw new Error('Pruning queue contains an unvisited entry');
    }
    if (depth >= UNVISITED_PRUNING_DEPTH - 1) {
      throw new Error('Pruning depth exceeds Uint8 sentinel capacity');
    }

    const coordinateA = Math.floor(index / coordinateBCount);
    const coordinateB = index % coordinateBCount;

    for (let moveIndex = 0; moveIndex < moveCount; moveIndex += 1) {
      const nextA = coordinateAMoves[coordinateA * moveCount + moveIndex];
      const nextB = coordinateBMoves[coordinateB * moveCount + moveIndex];
      const nextIndex = nextA * coordinateBCount + nextB;

      if (pruning[nextIndex] === UNVISITED_PRUNING_DEPTH) {
        pruning[nextIndex] = depth + 1;
        queue[tail++] = nextIndex;
      }
    }
  }

  return pruning;
}

export function buildPruningTables(moveTables: SolverMoveTables): SolverPruningTables {
  const queue = new Uint32Array(CORNER_ORIENTATION_COUNT * SLICE_COMBINATION_COUNT);

  return {
    cornerOrientationSlice: buildPairPruningTable(
      CORNER_ORIENTATION_COUNT,
      SLICE_COMBINATION_COUNT,
      PHASE1_MOVE_COUNT,
      moveTables.cornerOrientation,
      moveTables.sliceCombination,
      queue
    ),
    edgeOrientationSlice: buildPairPruningTable(
      EDGE_ORIENTATION_COUNT,
      SLICE_COMBINATION_COUNT,
      PHASE1_MOVE_COUNT,
      moveTables.edgeOrientation,
      moveTables.sliceCombination,
      queue
    ),
    cornerPermutationSlice: buildPairPruningTable(
      CORNER_PERMUTATION_COUNT,
      SLICE_EDGE_PERMUTATION_COUNT,
      PHASE2_MOVE_COUNT,
      moveTables.cornerPermutation,
      moveTables.sliceEdgePermutation,
      queue
    ),
    udEdgePermutationSlice: buildPairPruningTable(
      UD_EDGE_PERMUTATION_COUNT,
      SLICE_EDGE_PERMUTATION_COUNT,
      PHASE2_MOVE_COUNT,
      moveTables.udEdgePermutation,
      moveTables.sliceEdgePermutation,
      queue
    )
  };
}

let cachedPruningTables: SolverPruningTables | undefined;

export function getPruningTables(): SolverPruningTables {
  cachedPruningTables ??= buildPruningTables(getMoveTables());
  return cachedPruningTables;
}
