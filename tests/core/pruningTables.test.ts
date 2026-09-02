import { beforeAll, describe, expect, it } from 'vitest';

import {
  CORNER_ORIENTATION_COUNT,
  CORNER_PERMUTATION_COUNT,
  EDGE_ORIENTATION_COUNT,
  SLICE_COMBINATION_COUNT,
  SLICE_EDGE_PERMUTATION_COUNT,
  UD_EDGE_PERMUTATION_COUNT
} from '../../src/core/solver/coordinates.ts';
import {
  getMoveTables,
  PHASE1_MOVE_COUNT,
  PHASE2_MOVE_COUNT,
  type SolverMoveTables
} from '../../src/core/solver/moveTables.ts';
import {
  getPruningTables,
  UNVISITED_PRUNING_DEPTH,
  type SolverPruningTables
} from '../../src/core/solver/pruningTables.ts';

interface PruningCase {
  readonly name: string;
  readonly pruning: Uint8Array;
  readonly coordinateACount: number;
  readonly coordinateBCount: number;
  readonly moveCount: number;
  readonly coordinateAMoves: Uint16Array;
  readonly coordinateBMoves: Uint16Array;
  readonly expectedMaxDepth: number;
}

function buildCases(
  pruningTables: SolverPruningTables,
  moveTables: SolverMoveTables
): readonly PruningCase[] {
  return [
    {
      name: 'cornerOrientationSlice',
      pruning: pruningTables.cornerOrientationSlice,
      coordinateACount: CORNER_ORIENTATION_COUNT,
      coordinateBCount: SLICE_COMBINATION_COUNT,
      moveCount: PHASE1_MOVE_COUNT,
      coordinateAMoves: moveTables.cornerOrientation,
      coordinateBMoves: moveTables.sliceCombination,
      expectedMaxDepth: 9
    },
    {
      name: 'edgeOrientationSlice',
      pruning: pruningTables.edgeOrientationSlice,
      coordinateACount: EDGE_ORIENTATION_COUNT,
      coordinateBCount: SLICE_COMBINATION_COUNT,
      moveCount: PHASE1_MOVE_COUNT,
      coordinateAMoves: moveTables.edgeOrientation,
      coordinateBMoves: moveTables.sliceCombination,
      expectedMaxDepth: 9
    },
    {
      name: 'cornerPermutationSlice',
      pruning: pruningTables.cornerPermutationSlice,
      coordinateACount: CORNER_PERMUTATION_COUNT,
      coordinateBCount: SLICE_EDGE_PERMUTATION_COUNT,
      moveCount: PHASE2_MOVE_COUNT,
      coordinateAMoves: moveTables.cornerPermutation,
      coordinateBMoves: moveTables.sliceEdgePermutation,
      expectedMaxDepth: 14
    },
    {
      name: 'udEdgePermutationSlice',
      pruning: pruningTables.udEdgePermutationSlice,
      coordinateACount: UD_EDGE_PERMUTATION_COUNT,
      coordinateBCount: SLICE_EDGE_PERMUTATION_COUNT,
      moveCount: PHASE2_MOVE_COUNT,
      coordinateAMoves: moveTables.udEdgePermutation,
      coordinateBMoves: moveTables.sliceEdgePermutation,
      expectedMaxDepth: 12
    }
  ];
}

function nextIndex(currentIndex: number, moveIndex: number, testCase: PruningCase): number {
  const coordinateA = Math.floor(currentIndex / testCase.coordinateBCount);
  const coordinateB = currentIndex % testCase.coordinateBCount;
  const nextA = testCase.coordinateAMoves[coordinateA * testCase.moveCount + moveIndex];
  const nextB = testCase.coordinateBMoves[coordinateB * testCase.moveCount + moveIndex];
  return nextA * testCase.coordinateBCount + nextB;
}

describe('solver pruning tables', () => {
  let moveTables: SolverMoveTables;
  let pruningTables: SolverPruningTables;
  let cases: readonly PruningCase[];

  beforeAll(() => {
    moveTables = getMoveTables();
    pruningTables = getPruningTables();
    cases = buildCases(pruningTables, moveTables);
  });

  it('builds fully covered Uint8 tables with the expected depths', () => {
    for (const testCase of cases) {
      expect(testCase.pruning).toBeInstanceOf(Uint8Array);
      expect(testCase.pruning).toHaveLength(
        testCase.coordinateACount * testCase.coordinateBCount
      );
      expect(testCase.pruning[0]).toBe(0);

      const histogram: number[] = [];
      for (const depth of testCase.pruning) {
        histogram[depth] = (histogram[depth] ?? 0) + 1;
      }

      expect(histogram[UNVISITED_PRUNING_DEPTH] ?? 0).toBe(0);
      expect(histogram[0]).toBe(1);
      expect(histogram.length - 1).toBe(testCase.expectedMaxDepth);
      expect(histogram.reduce((sum, count = 0) => sum + count, 0)).toBe(
        testCase.pruning.length
      );
      for (let depth = 0; depth <= testCase.expectedMaxDepth; depth += 1) {
        expect(histogram[depth]).toBeGreaterThan(0);
      }
    }
  });

  it('caches the lazy singleton', () => {
    expect(getPruningTables()).toBe(getPruningTables());
  });

  it('matches an independent breadth-first discovery through depth five', () => {
    for (const testCase of cases) {
      const discovered = new Map<number, number>([[0, 0]]);
      let frontier = [0];

      for (let depth = 0; depth < 5; depth += 1) {
        const nextFrontier: number[] = [];
        for (const index of frontier) {
          for (let moveIndex = 0; moveIndex < testCase.moveCount; moveIndex += 1) {
            const next = nextIndex(index, moveIndex, testCase);
            if (!discovered.has(next)) {
              discovered.set(next, depth + 1);
              nextFrontier.push(next);
            }
          }
        }
        frontier = nextFrontier;
      }

      let failure: string | undefined;
      for (const [index, depth] of discovered) {
        if (testCase.pruning[index] !== depth) {
          failure = `${testCase.name}: index ${index}, expected ${depth}, got ${testCase.pruning[index]}`;
          break;
        }
      }
      expect(failure, failure).toBeUndefined();
    }
  });

  it('is consistent and gives every non-solved entry a depth-minus-one predecessor', () => {
    let failure: string | undefined;

    for (const testCase of cases) {
      for (let index = 0; index < testCase.pruning.length; index += 1) {
        const depth = testCase.pruning[index];
        let hasPredecessor = depth === 0;

        for (let moveIndex = 0; moveIndex < testCase.moveCount; moveIndex += 1) {
          const next = nextIndex(index, moveIndex, testCase);
          const nextDepth = testCase.pruning[next];

          if (depth > nextDepth + 1) {
            failure = `${testCase.name}: index ${index}, depth ${depth}, move ${moveIndex}, next depth ${nextDepth}`;
            break;
          }
          if (depth > 0 && nextDepth === depth - 1) hasPredecessor = true;
        }

        if (failure !== undefined) break;
        if (!hasPredecessor) {
          const coordinateA = Math.floor(index / testCase.coordinateBCount);
          const coordinateB = index % testCase.coordinateBCount;
          failure = `${testCase.name}: index ${index} (${coordinateA}, ${coordinateB}), depth ${depth}, no depth-minus-one predecessor`;
          break;
        }
      }
      if (failure !== undefined) break;
    }

    expect(failure, failure).toBeUndefined();
  });
});
