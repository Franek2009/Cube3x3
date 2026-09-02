import { beforeAll, describe, expect, it } from 'vitest';

import { solvedState } from '../../src/core/cube/CubeState.ts';
import { ALL_MOVES, inverseMove, type Move } from '../../src/core/moves/moves.ts';
import {
  CORNER_ORIENTATION_COUNT,
  CORNER_PERMUTATION_COUNT,
  EDGE_ORIENTATION_COUNT,
  encodeCornerOrientation,
  encodeCornerPermutation,
  encodeEdgeOrientation,
  encodeSliceCombination,
  encodeSliceEdgePermutation,
  encodeUdEdgePermutation,
  SLICE_COMBINATION_COUNT,
  SLICE_EDGE_PERMUTATION_COUNT,
  toSolverCubieState,
  UD_EDGE_PERMUTATION_COUNT
} from '../../src/core/solver/coordinates.ts';
import {
  getMoveTables,
  PHASE1_MOVE_COUNT,
  PHASE2_MOVE_COUNT,
  PHASE2_MOVES,
  type SolverMoveTables
} from '../../src/core/solver/moveTables.ts';

function generateMoves(seed: number, length: number, moves: readonly Move[]): Move[] {
  let value = seed >>> 0;
  return Array.from({ length }, () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return moves[(value >>> 0) % moves.length];
  });
}

function lookup(
  table: Uint16Array,
  coordinate: number,
  moveIndex: number,
  moveCount: number
): number {
  return table[coordinate * moveCount + moveIndex];
}

describe('solver coordinate move tables', () => {
  let tables: SolverMoveTables;

  beforeAll(() => {
    tables = getMoveTables();
  });

  it('uses the explicit Phase 2 move order', () => {
    expect(PHASE2_MOVES).toEqual([
      'U', "U'", 'U2', 'D', "D'", 'D2', 'L2', 'R2', 'F2', 'B2'
    ]);
    for (const move of PHASE2_MOVES) expect(ALL_MOVES).toContain(move);
  });

  it('caches lazily generated tables', () => {
    expect(getMoveTables()).toBe(getMoveTables());
  });

  it('matches CubeState transitions from the solved coordinate', () => {
    ALL_MOVES.forEach((move, moveIndex) => {
      const after = toSolverCubieState(solvedState().applyMove(move));
      expect(lookup(tables.cornerOrientation, 0, moveIndex, PHASE1_MOVE_COUNT)).toBe(encodeCornerOrientation(after));
      expect(lookup(tables.edgeOrientation, 0, moveIndex, PHASE1_MOVE_COUNT)).toBe(encodeEdgeOrientation(after));
      expect(lookup(tables.sliceCombination, 0, moveIndex, PHASE1_MOVE_COUNT)).toBe(encodeSliceCombination(after));
    });

    PHASE2_MOVES.forEach((move, moveIndex) => {
      const after = toSolverCubieState(solvedState().applyMove(move));
      expect(lookup(tables.cornerPermutation, 0, moveIndex, PHASE2_MOVE_COUNT)).toBe(encodeCornerPermutation(after));
      expect(lookup(tables.udEdgePermutation, 0, moveIndex, PHASE2_MOVE_COUNT)).toBe(encodeUdEdgePermutation(after));
      expect(lookup(tables.sliceEdgePermutation, 0, moveIndex, PHASE2_MOVE_COUNT)).toBe(encodeSliceEdgePermutation(after));
    });
  });

  it('builds all six tables with exact lengths and in-range entries', () => {
    const cases: readonly [Uint16Array, number, number][] = [
      [tables.cornerOrientation, CORNER_ORIENTATION_COUNT, PHASE1_MOVE_COUNT],
      [tables.edgeOrientation, EDGE_ORIENTATION_COUNT, PHASE1_MOVE_COUNT],
      [tables.sliceCombination, SLICE_COMBINATION_COUNT, PHASE1_MOVE_COUNT],
      [tables.cornerPermutation, CORNER_PERMUTATION_COUNT, PHASE2_MOVE_COUNT],
      [tables.udEdgePermutation, UD_EDGE_PERMUTATION_COUNT, PHASE2_MOVE_COUNT],
      [tables.sliceEdgePermutation, SLICE_EDGE_PERMUTATION_COUNT, PHASE2_MOVE_COUNT]
    ];

    for (const [table, coordinateCount, moveCount] of cases) {
      expect(table).toBeInstanceOf(Uint16Array);
      expect(table).toHaveLength(coordinateCount * moveCount);
      let entriesAreInRange = true;
      for (const value of table) {
        if (value >= coordinateCount) {
          entriesAreInRange = false;
          break;
        }
      }
      expect(entriesAreInRange).toBe(true);
    }
  });

  it('matches CubeState Phase 1 transitions for seeded reachable states and every move', () => {
    for (const seed of [7, 0x12345678, 0xdeadbeef]) {
      let state = solvedState();
      for (const setupMove of generateMoves(seed, 40, ALL_MOVES)) {
        state = state.applyMove(setupMove);
        const before = toSolverCubieState(state);

        ALL_MOVES.forEach((move, moveIndex) => {
          const after = toSolverCubieState(state.applyMove(move));
          expect(lookup(tables.cornerOrientation, encodeCornerOrientation(before), moveIndex, PHASE1_MOVE_COUNT)).toBe(encodeCornerOrientation(after));
          expect(lookup(tables.edgeOrientation, encodeEdgeOrientation(before), moveIndex, PHASE1_MOVE_COUNT)).toBe(encodeEdgeOrientation(after));
          expect(lookup(tables.sliceCombination, encodeSliceCombination(before), moveIndex, PHASE1_MOVE_COUNT)).toBe(encodeSliceCombination(after));
        });
      }
    }
  });

  it('matches CubeState Phase 2 transitions for seeded subgroup states and every move', () => {
    for (const seed of [11, 0x87654321, 0xcafebabe]) {
      let state = solvedState();
      for (const setupMove of generateMoves(seed, 40, PHASE2_MOVES)) {
        state = state.applyMove(setupMove);
        const before = toSolverCubieState(state);

        PHASE2_MOVES.forEach((move, moveIndex) => {
          const after = toSolverCubieState(state.applyMove(move));
          expect(lookup(tables.cornerPermutation, encodeCornerPermutation(before), moveIndex, PHASE2_MOVE_COUNT)).toBe(encodeCornerPermutation(after));
          expect(lookup(tables.udEdgePermutation, encodeUdEdgePermutation(before), moveIndex, PHASE2_MOVE_COUNT)).toBe(encodeUdEdgePermutation(after));
          expect(lookup(tables.sliceEdgePermutation, encodeSliceEdgePermutation(before), moveIndex, PHASE2_MOVE_COUNT)).toBe(encodeSliceEdgePermutation(after));
        });
      }
    }
  });

  it('returns every coordinate after a move followed by its inverse', () => {
    const cases: readonly [Uint16Array, number, readonly Move[]][] = [
      [tables.cornerOrientation, CORNER_ORIENTATION_COUNT, ALL_MOVES],
      [tables.edgeOrientation, EDGE_ORIENTATION_COUNT, ALL_MOVES],
      [tables.sliceCombination, SLICE_COMBINATION_COUNT, ALL_MOVES],
      [tables.cornerPermutation, CORNER_PERMUTATION_COUNT, PHASE2_MOVES],
      [tables.udEdgePermutation, UD_EDGE_PERMUTATION_COUNT, PHASE2_MOVES],
      [tables.sliceEdgePermutation, SLICE_EDGE_PERMUTATION_COUNT, PHASE2_MOVES]
    ];

    for (const [table, coordinateCount, moves] of cases) {
      let inverseTransitionsAreCorrect = true;
      for (let coordinate = 0; coordinate < coordinateCount; coordinate += 1) {
        for (let moveIndex = 0; moveIndex < moves.length; moveIndex += 1) {
          const move = moves[moveIndex];
          const inverseIndex = moves.indexOf(inverseMove(move));
          const moved = lookup(table, coordinate, moveIndex, moves.length);
          if (lookup(table, moved, inverseIndex, moves.length) !== coordinate) {
            inverseTransitionsAreCorrect = false;
            break;
          }
        }
        if (!inverseTransitionsAreCorrect) break;
      }
      expect(inverseTransitionsAreCorrect).toBe(true);
    }
  });

  it('returns every coordinate after each move completes its full cycle', () => {
    const phase1Cases: readonly [string, Uint16Array, number][] = [
      ['cornerOrientation', tables.cornerOrientation, CORNER_ORIENTATION_COUNT],
      ['edgeOrientation', tables.edgeOrientation, EDGE_ORIENTATION_COUNT],
      ['sliceCombination', tables.sliceCombination, SLICE_COMBINATION_COUNT]
    ];
    const phase2Cases: readonly [string, Uint16Array, number][] = [
      ['cornerPermutation', tables.cornerPermutation, CORNER_PERMUTATION_COUNT],
      ['udEdgePermutation', tables.udEdgePermutation, UD_EDGE_PERMUTATION_COUNT],
      ['sliceEdgePermutation', tables.sliceEdgePermutation, SLICE_EDGE_PERMUTATION_COUNT]
    ];
    let failure: string | undefined;

    for (const [tableName, table, coordinateCount] of phase1Cases) {
      for (let coordinate = 0; coordinate < coordinateCount; coordinate += 1) {
        for (const move of ['U', 'D', 'L', 'R', 'F', 'B'] as const) {
          const moveIndex = ALL_MOVES.indexOf(move);
          let result = coordinate;
          for (let turn = 0; turn < 4; turn += 1) {
            result = lookup(table, result, moveIndex, PHASE1_MOVE_COUNT);
          }
          if (result !== coordinate) {
            failure = `${tableName}: coordinate ${coordinate}, move ${move}, result ${result}`;
            break;
          }
        }
        if (failure !== undefined) break;
      }
      if (failure !== undefined) break;
    }

    if (failure === undefined) {
      const phase2Cycles: readonly [Move, number][] = [
        ['U', 4],
        ['D', 4],
        ['U2', 2],
        ['D2', 2],
        ['L2', 2],
        ['R2', 2],
        ['F2', 2],
        ['B2', 2]
      ];

      for (const [tableName, table, coordinateCount] of phase2Cases) {
        for (let coordinate = 0; coordinate < coordinateCount; coordinate += 1) {
          for (const [move, repetitions] of phase2Cycles) {
            const moveIndex = PHASE2_MOVES.indexOf(move as (typeof PHASE2_MOVES)[number]);
            let result = coordinate;
            for (let turn = 0; turn < repetitions; turn += 1) {
              result = lookup(table, result, moveIndex, PHASE2_MOVE_COUNT);
            }
            if (result !== coordinate) {
              failure = `${tableName}: coordinate ${coordinate}, move ${move}, result ${result}`;
              break;
            }
          }
          if (failure !== undefined) break;
        }
        if (failure !== undefined) break;
      }
    }

    expect(failure, failure).toBeUndefined();
  });
});
