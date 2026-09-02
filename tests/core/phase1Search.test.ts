import { beforeAll, describe, expect, it } from 'vitest';

import { solvedState, type CubeState } from '../../src/core/cube/CubeState.ts';
import { ALL_MOVES, type Move } from '../../src/core/moves/moves.ts';
import {
  EDGE_ORIENTATION_COUNT,
  encodeCornerOrientation,
  encodeEdgeOrientation,
  encodeSliceCombination,
  SLICE_COMBINATION_COUNT,
  toSolverCubieState,
  type SolverCubieState
} from '../../src/core/solver/coordinates.ts';
import {
  getMoveTables,
  PHASE1_MOVE_COUNT,
  PHASE2_MOVES,
  type SolverMoveTables
} from '../../src/core/solver/moveTables.ts';
import {
  DEFAULT_PHASE1_MAX_DEPTH,
  searchPhase1,
  type Phase1SearchDependencies,
  type Phase1SearchResult
} from '../../src/core/solver/phase1Search.ts';
import {
  getPruningTables,
  UNVISITED_PRUNING_DEPTH,
  type SolverPruningTables
} from '../../src/core/solver/pruningTables.ts';

function expectInG1(state: CubeState): void {
  const solverState = toSolverCubieState(state);
  expect(encodeCornerOrientation(solverState)).toBe(0);
  expect(encodeEdgeOrientation(solverState)).toBe(0);
  expect(encodeSliceCombination(solverState)).toBe(0);
}

function expectPathReachesG1(start: CubeState, result: Phase1SearchResult | undefined): void {
  expect(result).toBeDefined();
  if (result === undefined) throw new Error('Expected a Phase 1 path');
  expectInG1(start.applyMoves(result.moves));
  expect(result.depth).toBe(result.moves.length);
}

function coordinateKey(co: number, eo: number, slice: number): number {
  return (co * EDGE_ORIENTATION_COUNT + eo) * SLICE_COMBINATION_COUNT + slice;
}

function findIndependentMinimumDepth(
  state: SolverCubieState,
  maxDepth: number,
  moveTables: SolverMoveTables
): number | undefined {
  const startCo = encodeCornerOrientation(state);
  const startEo = encodeEdgeOrientation(state);
  const startSlice = encodeSliceCombination(state);
  if (startCo === 0 && startEo === 0 && startSlice === 0) return 0;

  let frontier: Array<readonly [number, number, number]> = [[startCo, startEo, startSlice]];
  const visited = new Set([coordinateKey(startCo, startEo, startSlice)]);

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const nextFrontier: Array<readonly [number, number, number]> = [];
    for (const [co, eo, slice] of frontier) {
      for (let moveIndex = 0; moveIndex < PHASE1_MOVE_COUNT; moveIndex += 1) {
        const nextCo = moveTables.cornerOrientation[co * PHASE1_MOVE_COUNT + moveIndex];
        const nextEo = moveTables.edgeOrientation[eo * PHASE1_MOVE_COUNT + moveIndex];
        const nextSlice = moveTables.sliceCombination[
          slice * PHASE1_MOVE_COUNT + moveIndex
        ];
        if (nextCo === 0 && nextEo === 0 && nextSlice === 0) return depth;

        const key = coordinateKey(nextCo, nextEo, nextSlice);
        if (!visited.has(key)) {
          visited.add(key);
          nextFrontier.push([nextCo, nextEo, nextSlice]);
        }
      }
    }
    frontier = nextFrontier;
  }

  return undefined;
}

describe('Phase 1 IDA* search', () => {
  let moveTables: SolverMoveTables;
  let pruningTables: SolverPruningTables;
  let dependencies: Phase1SearchDependencies;

  beforeAll(() => {
    moveTables = getMoveTables();
    pruningTables = getPruningTables();
    dependencies = { moveTables, pruningTables };
  });

  it('returns a depth-zero path for solved and every Phase 2 move state', () => {
    for (const moves of [[], ...PHASE2_MOVES.map((move) => [move])] as readonly Move[][]) {
      const state = solvedState().applyMoves(moves);
      const result = searchPhase1(toSolverCubieState(state), { dependencies });

      expect(result).toEqual({ moves: [], depth: 0 });
      expect(Object.isFrozen(result?.moves)).toBe(true);
    }
  });

  it.each(['L', 'R', 'F', 'B'] as const)('brings a state after %s into G1', (move) => {
    const state = solvedState().applyMove(move);
    const result = searchPhase1(toSolverCubieState(state), { dependencies });

    expectPathReachesG1(state, result);
    expect(result?.depth).toBe(1);
  });

  it.each([
    ['R', 'U', 'F'],
    ['F', 'R', 'U', 'L'],
    ['R', 'U', 'F', 'L', 'B']
  ] as const)('finds a Phase 1 path for %j', (...moves) => {
    const state = solvedState().applyMoves(moves);
    const result = searchPhase1(toSolverCubieState(state), {
      maxDepth: moves.length,
      dependencies
    });

    expectPathReachesG1(state, result);
  });

  it('matches an independent minimum-depth search through depth four', () => {
    for (const moves of [
      ['R'],
      ['R', 'U'],
      ['R', 'U', 'F'],
      ['F', 'R', 'U', 'L']
    ] as const) {
      const state = toSolverCubieState(solvedState().applyMoves(moves));
      const expectedDepth = findIndependentMinimumDepth(state, 4, moveTables);
      const result = searchPhase1(state, { maxDepth: 4, dependencies });

      expect(expectedDepth).toBeDefined();
      expect(result?.depth).toBe(expectedDepth);
    }
  });

  it('continues after a rejected candidate and accepts the next candidate', () => {
    const start = solvedState().applyMove('R');
    const candidates: SolverCubieState[] = [];
    const result = searchPhase1(toSolverCubieState(start), {
      maxDepth: 1,
      dependencies,
      onCandidate: ({ terminalState, depth }) => {
        expect(depth).toBe(1);
        candidates.push(terminalState);
        return candidates.length === 2;
      }
    });

    expect(candidates).toHaveLength(2);
    for (const candidate of candidates) {
      expect(encodeCornerOrientation(candidate)).toBe(0);
      expect(encodeEdgeOrientation(candidate)).toBe(0);
      expect(encodeSliceCombination(candidate)).toBe(0);
    }
    expectPathReachesG1(start, result);
    expect(result?.depth).toBe(1);
  });

  it('does not call the candidate handler below the initial heuristic', () => {
    const state = toSolverCubieState(solvedState().applyMoves(['R', 'U', 'F']));
    const co = encodeCornerOrientation(state);
    const eo = encodeEdgeOrientation(state);
    const slice = encodeSliceCombination(state);
    const heuristic = Math.max(
      pruningTables.cornerOrientationSlice[co * SLICE_COMBINATION_COUNT + slice],
      pruningTables.edgeOrientationSlice[eo * SLICE_COMBINATION_COUNT + slice]
    );
    let callbackCount = 0;

    expect(searchPhase1(state, {
      maxDepth: heuristic - 1,
      dependencies,
      onCandidate: () => {
        callbackCount += 1;
        return true;
      }
    })).toBeUndefined();
    expect(callbackCount).toBe(0);
  });

  it('fails one level below the minimum and succeeds at the exact depth', () => {
    const cubeState = solvedState().applyMoves(['R', 'U', 'F']);
    const state = toSolverCubieState(cubeState);
    const minimum = findIndependentMinimumDepth(state, 4, moveTables);
    expect(minimum).toBeDefined();
    if (minimum === undefined) throw new Error('Expected a minimum depth');

    expect(searchPhase1(state, { maxDepth: minimum - 1, dependencies })).toBeUndefined();
    expectPathReachesG1(
      cubeState,
      searchPhase1(state, { maxDepth: minimum, dependencies })
    );
  });

  it('throws when a pruning lookup contains the unvisited sentinel', () => {
    const state = toSolverCubieState(solvedState().applyMove('R'));
    const corruptedCornerPruning = pruningTables.cornerOrientationSlice.slice();
    const index =
      encodeCornerOrientation(state) * SLICE_COMBINATION_COUNT +
      encodeSliceCombination(state);
    corruptedCornerPruning[index] = UNVISITED_PRUNING_DEPTH;

    expect(() => searchPhase1(state, {
      dependencies: {
        moveTables,
        pruningTables: {
          ...pruningTables,
          cornerOrientationSlice: corruptedCornerPruning
        }
      }
    })).toThrow('Phase 1 pruning table contains an unvisited entry');
  });

  it('accepts maxDepth above the default and rejects invalid depths', () => {
    expect(searchPhase1(toSolverCubieState(solvedState()), {
      maxDepth: DEFAULT_PHASE1_MAX_DEPTH + 1,
      dependencies
    })).toEqual({ moves: [], depth: 0 });

    for (const maxDepth of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => searchPhase1(toSolverCubieState(solvedState()), {
        maxDepth,
        dependencies
      })).toThrow(RangeError);
    }
  });

  it('is deterministic and returns a frozen path independent from its internal buffer', () => {
    const state = toSolverCubieState(solvedState().applyMoves(['R', 'U', 'F']));
    const first = searchPhase1(state, { maxDepth: 5, dependencies });
    const second = searchPhase1(state, { maxDepth: 5, dependencies });

    expect(first).toEqual(second);
    expect(Object.isFrozen(first?.moves)).toBe(true);
    expect(() => (first?.moves as Move[]).push('U')).toThrow(TypeError);
    expect(searchPhase1(state, { maxDepth: 5, dependencies })).toEqual(first);
  });

  it('does not mutate the input and gives a depth-zero callback a fresh state', () => {
    const input = toSolverCubieState(solvedState());
    const snapshot = {
      cornerPermutation: input.cornerPermutation.slice(),
      cornerOrientation: input.cornerOrientation.slice(),
      edgePermutation: input.edgePermutation.slice(),
      edgeOrientation: input.edgeOrientation.slice()
    };
    let candidate: SolverCubieState | undefined;

    searchPhase1(input, {
      maxDepth: 0,
      dependencies,
      onCandidate: ({ terminalState }) => {
        candidate = terminalState;
        terminalState.cornerPermutation[0] = 7;
        terminalState.edgePermutation[0] = 11;
        return true;
      }
    });

    expect(candidate?.cornerPermutation).not.toBe(input.cornerPermutation);
    expect(candidate?.cornerOrientation).not.toBe(input.cornerOrientation);
    expect(candidate?.edgePermutation).not.toBe(input.edgePermutation);
    expect(candidate?.edgeOrientation).not.toBe(input.edgeOrientation);
    expect(input.cornerPermutation).toEqual(snapshot.cornerPermutation);
    expect(input.cornerOrientation).toEqual(snapshot.cornerOrientation);
    expect(input.edgePermutation).toEqual(snapshot.edgePermutation);
    expect(input.edgeOrientation).toEqual(snapshot.edgeOrientation);
  });
});
