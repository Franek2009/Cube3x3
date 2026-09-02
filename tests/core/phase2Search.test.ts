import { beforeAll, describe, expect, it } from 'vitest';

import { solvedState, type CubeState } from '../../src/core/cube/CubeState.ts';
import type { Move } from '../../src/core/moves/moves.ts';
import {
  CORNER_PERMUTATION_COUNT,
  encodeCornerOrientation,
  encodeCornerPermutation,
  encodeEdgeOrientation,
  encodeSliceCombination,
  encodeSliceEdgePermutation,
  encodeUdEdgePermutation,
  SLICE_EDGE_PERMUTATION_COUNT,
  toSolverCubieState,
  UD_EDGE_PERMUTATION_COUNT,
  type SolverCubieState
} from '../../src/core/solver/coordinates.ts';
import {
  getMoveTables,
  PHASE2_MOVE_COUNT,
  PHASE2_MOVES,
  type SolverMoveTables
} from '../../src/core/solver/moveTables.ts';
import {
  DEFAULT_PHASE2_MAX_DEPTH,
  searchPhase2,
  type Phase2SearchDependencies,
  type Phase2SearchResult
} from '../../src/core/solver/phase2Search.ts';
import {
  getPruningTables,
  UNVISITED_PRUNING_DEPTH,
  type SolverPruningTables
} from '../../src/core/solver/pruningTables.ts';

function expectSolved(start: CubeState, result: Phase2SearchResult | undefined): void {
  expect(result).toBeDefined();
  if (result === undefined) throw new Error('Expected a Phase 2 path');
  expect(start.applyMoves(result.moves).isSolved()).toBe(true);
  expect(result.depth).toBe(result.moves.length);
  for (const move of result.moves) expect(PHASE2_MOVES).toContain(move);
}

function coordinateKey(cp: number, ud: number, slice: number): number {
  return (cp * UD_EDGE_PERMUTATION_COUNT + ud) * SLICE_EDGE_PERMUTATION_COUNT + slice;
}

function findIndependentMinimumDepth(
  state: SolverCubieState,
  maxDepth: number,
  moveTables: SolverMoveTables
): number | undefined {
  const startCp = encodeCornerPermutation(state);
  const startUd = encodeUdEdgePermutation(state);
  const startSlice = encodeSliceEdgePermutation(state);
  if (startCp === 0 && startUd === 0 && startSlice === 0) return 0;

  let frontier: Array<readonly [number, number, number]> = [[startCp, startUd, startSlice]];
  const visited = new Set([coordinateKey(startCp, startUd, startSlice)]);

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const nextFrontier: Array<readonly [number, number, number]> = [];
    for (const [cp, ud, slice] of frontier) {
      for (let moveIndex = 0; moveIndex < PHASE2_MOVE_COUNT; moveIndex += 1) {
        const nextCp = moveTables.cornerPermutation[cp * PHASE2_MOVE_COUNT + moveIndex];
        const nextUd = moveTables.udEdgePermutation[ud * PHASE2_MOVE_COUNT + moveIndex];
        const nextSlice = moveTables.sliceEdgePermutation[
          slice * PHASE2_MOVE_COUNT + moveIndex
        ];
        if (nextCp === 0 && nextUd === 0 && nextSlice === 0) return depth;

        const key = coordinateKey(nextCp, nextUd, nextSlice);
        if (!visited.has(key)) {
          visited.add(key);
          nextFrontier.push([nextCp, nextUd, nextSlice]);
        }
      }
    }
    frontier = nextFrontier;
  }

  return undefined;
}

function generateMoves(seed: number, length: number): Move[] {
  let value = seed >>> 0;
  return Array.from({ length }, () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return PHASE2_MOVES[(value >>> 0) % PHASE2_MOVES.length];
  });
}

describe('Phase 2 IDA* search', () => {
  let moveTables: SolverMoveTables;
  let pruningTables: SolverPruningTables;
  let dependencies: Phase2SearchDependencies;

  beforeAll(() => {
    moveTables = getMoveTables();
    pruningTables = getPruningTables();
    dependencies = { moveTables, pruningTables };
  });

  it('returns a frozen depth-zero path for solved', () => {
    const result = searchPhase2(toSolverCubieState(solvedState()), { dependencies });

    expect(result).toEqual({ moves: [], depth: 0 });
    expect(Object.isFrozen(result?.moves)).toBe(true);
  });

  it.each(PHASE2_MOVES)('solves a state after one %s move at depth one', (move) => {
    const state = solvedState().applyMove(move);
    const result = searchPhase2(toSolverCubieState(state), {
      maxDepth: 1,
      dependencies
    });

    expectSolved(state, result);
    expect(result?.depth).toBe(1);
  });

  it.each([
    ['U', 'D2'],
    ['L2', 'U', 'R2'],
    ['F2', 'U', 'R2', 'D'],
    ['U', 'R2', 'F2', 'D', 'L2']
  ] as const)('solves the Phase 2 sequence %j', (...moves) => {
    const state = solvedState().applyMoves(moves);
    const result = searchPhase2(toSolverCubieState(state), {
      maxDepth: moves.length,
      dependencies
    });

    expectSolved(state, result);
  });

  it('matches an independent minimum-depth search through depth four', () => {
    for (const moves of [
      ['U'],
      ['U', 'D2'],
      ['L2', 'U', 'R2'],
      ['F2', 'U', 'R2', 'D']
    ] as const) {
      const state = toSolverCubieState(solvedState().applyMoves(moves));
      const expectedDepth = findIndependentMinimumDepth(state, 4, moveTables);
      const result = searchPhase2(state, { maxDepth: 4, dependencies });

      expect(expectedDepth).toBeDefined();
      expect(result?.depth).toBe(expectedDepth);
    }
  });

  it.each(['R', 'F'] as const)('rejects a non-G1 state after %s before Phase 2 encoding', (move) => {
    expect(() => searchPhase2(toSolverCubieState(solvedState().applyMove(move)), {
      dependencies
    })).toThrow('Phase 2 search requires a G1 state');
  });

  it('throws when a pruning lookup contains the unvisited sentinel', () => {
    const state = toSolverCubieState(solvedState().applyMove('U'));
    const corruptedCornerPruning = pruningTables.cornerPermutationSlice.slice();
    const index =
      encodeCornerPermutation(state) * SLICE_EDGE_PERMUTATION_COUNT +
      encodeSliceEdgePermutation(state);
    corruptedCornerPruning[index] = UNVISITED_PRUNING_DEPTH;

    expect(() => searchPhase2(state, {
      dependencies: {
        moveTables,
        pruningTables: {
          ...pruningTables,
          cornerPermutationSlice: corruptedCornerPruning
        }
      }
    })).toThrow('Phase 2 pruning table contains an unvisited entry');
  });

  it('fails below the heuristic and does not search beyond maxDepth', () => {
    const cubeState = solvedState().applyMoves(['L2', 'U', 'R2']);
    const state = toSolverCubieState(cubeState);
    const cp = encodeCornerPermutation(state);
    const ud = encodeUdEdgePermutation(state);
    const slice = encodeSliceEdgePermutation(state);
    const heuristic = Math.max(
      pruningTables.cornerPermutationSlice[cp * SLICE_EDGE_PERMUTATION_COUNT + slice],
      pruningTables.udEdgePermutationSlice[ud * SLICE_EDGE_PERMUTATION_COUNT + slice]
    );
    const minimum = findIndependentMinimumDepth(state, 4, moveTables);
    expect(minimum).toBeDefined();
    if (minimum === undefined) throw new Error('Expected a minimum depth');

    if (heuristic > 0) {
      expect(searchPhase2(state, { maxDepth: heuristic - 1, dependencies })).toBeUndefined();
    }
    expect(searchPhase2(state, { maxDepth: minimum - 1, dependencies })).toBeUndefined();
    expectSolved(cubeState, searchPhase2(state, { maxDepth: minimum, dependencies }));
  });

  it('accepts maxDepth above the default and rejects invalid depths', () => {
    expect(searchPhase2(toSolverCubieState(solvedState()), {
      maxDepth: DEFAULT_PHASE2_MAX_DEPTH + 1,
      dependencies
    })).toEqual({ moves: [], depth: 0 });

    for (const maxDepth of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => searchPhase2(toSolverCubieState(solvedState()), {
        maxDepth,
        dependencies
      })).toThrow(RangeError);
    }
  });

  it('preserves G1 for seeded states and every Phase 2 move', () => {
    for (const seed of [1, 0x12345678, 0xdeadbeef]) {
      let state = solvedState();
      for (const setupMove of generateMoves(seed, 40)) {
        state = state.applyMove(setupMove);
        for (const move of PHASE2_MOVES) {
          const moved = toSolverCubieState(state.applyMove(move));
          expect(encodeCornerOrientation(moved)).toBe(0);
          expect(encodeEdgeOrientation(moved)).toBe(0);
          expect(encodeSliceCombination(moved)).toBe(0);
        }
      }
    }
  });

  it('solves deterministic seeded reachable G1 states', () => {
    for (const seed of [7, 0x87654321, 0xcafebabe]) {
      const moves = generateMoves(seed, 10);
      const state = solvedState().applyMoves(moves);
      const result = searchPhase2(toSolverCubieState(state), {
        maxDepth: 12,
        dependencies
      });
      expectSolved(state, result);
    }
  });

  it('is deterministic, immutable, and returns an independent frozen path', () => {
    const input = toSolverCubieState(solvedState().applyMoves(['L2', 'U', 'R2', 'F2']));
    const snapshot = {
      cornerPermutation: input.cornerPermutation.slice(),
      cornerOrientation: input.cornerOrientation.slice(),
      edgePermutation: input.edgePermutation.slice(),
      edgeOrientation: input.edgeOrientation.slice()
    };
    const first = searchPhase2(input, { maxDepth: 8, dependencies });
    const second = searchPhase2(input, { maxDepth: 8, dependencies });

    expect(first).toEqual(second);
    expect(Object.isFrozen(first?.moves)).toBe(true);
    expect(() => (first?.moves as Move[]).push('U')).toThrow(TypeError);
    expect(searchPhase2(input, { maxDepth: 8, dependencies })).toEqual(first);
    expect(input.cornerPermutation).toEqual(snapshot.cornerPermutation);
    expect(input.cornerOrientation).toEqual(snapshot.cornerOrientation);
    expect(input.edgePermutation).toEqual(snapshot.edgePermutation);
    expect(input.edgeOrientation).toEqual(snapshot.edgeOrientation);
  });
});
