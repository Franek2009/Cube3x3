import { describe, expect, it } from 'vitest';

import { CubeState, solvedState } from '../../src/core/cube/CubeState.ts';
import { ALL_MOVES, type Move } from '../../src/core/moves/moves.ts';
import { solveCube, type SolveResult } from '../../src/core/solver/solver.ts';

function expectSolved(state: CubeState, result: SolveResult): asserts result is Extract<
  SolveResult,
  { solved: true }
> {
  expect(result.solved).toBe(true);

  if (!result.solved) throw new Error(`Expected a solution, got ${result.reason}`);

  expect(state.applyMoves(result.moves).isSolved()).toBe(true);
  expect(result.depth).toBe(result.moves.length);
}

describe('solveCube', () => {
  it('returns an empty depth-zero solution for a solved state', () => {
    const result = solveCube(solvedState(), { maxDepth: 0 });

    expect(result).toEqual({ solved: true, moves: [], depth: 0 });
    if (result.solved) expect(Object.isFrozen(result.moves)).toBe(true);
  });

  it.each(ALL_MOVES)('solves the state after one %s move at depth one', (move) => {
    const state = solvedState().applyMove(move);
    const result = solveCube(state, { maxDepth: 1 });

    expectSolved(state, result);
    expect(result.depth).toBe(1);
  });

  it('solves every two-move sequence within depth two', () => {
    for (const first of ALL_MOVES) {
      for (const second of ALL_MOVES) {
        const state = solvedState().applyMoves([first, second]);
        const result = solveCube(state, { maxDepth: 2 });

        expectSolved(state, result);
        expect(result.depth).toBeLessThanOrEqual(2);
      }
    }
  });

  it.each([
    [['R', 'U', 'F'], 3],
    [['R', 'U', 'F', 'L'], 4],
    [['R', 'U', 'F', 'L', 'B'], 5]
  ] as const)('solves the sequence %j within depth %i', (moves, maxDepth) => {
    const state = solvedState().applyMoves(moves);
    const result = solveCube(state, { maxDepth });

    expectSolved(state, result);
    expect(result.depth).toBeLessThanOrEqual(maxDepth);
  });

  it('returns depth-limit when the limit is too small and solves at the exact depth', () => {
    const state = solvedState().applyMoves(['R', 'U', 'F']);

    expect(solveCube(state, { maxDepth: 2 })).toEqual({
      solved: false,
      reason: 'depth-limit'
    });

    const result = solveCube(state, { maxDepth: 3 });
    expectSolved(state, result);
    expect(result.depth).toBe(3);
  });

  it('returns deterministic output', () => {
    const state = solvedState().applyMoves(['R', 'U', 'F']);

    expect(solveCube(state, { maxDepth: 3 })).toEqual(solveCube(state, { maxDepth: 3 }));
  });

  it('solves commuting opposite faces despite canonical ordering pruning', () => {
    const state = solvedState().applyMoves(['D', 'U']);
    const result = solveCube(state, { maxDepth: 2 });

    expectSolved(state, result);
    expect(result.depth).toBe(2);
  });

  it('returns depth-limit for an unsolved state at depth zero', () => {
    expect(solveCube(solvedState().applyMove('R'), { maxDepth: 0 })).toEqual({
      solved: false,
      reason: 'depth-limit'
    });
  });

  it('returns invalid-state for an illegally flipped edge', () => {
    const state = new CubeState(
      [0, 1, 2, 3, 4, 5, 6, 7],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    );

    expect(solveCube(state)).toEqual({
      solved: false,
      reason: 'invalid-state',
      validationError: 'invalid-edge-orientation-sum'
    });
  });

  it('returns invalid-state for a permutation parity mismatch', () => {
    const state = new CubeState(
      [1, 0, 2, 3, 4, 5, 6, 7],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    );

    expect(solveCube(state)).toEqual({
      solved: false,
      reason: 'invalid-state',
      validationError: 'permutation-parity-mismatch'
    });
  });

  it('does not mutate the input state during successful or failed searches', () => {
    const state = solvedState().applyMoves(['R', 'U', 'F']);
    const snapshot = state.clone();

    solveCube(state, { maxDepth: 3 });
    expect(state.equals(snapshot)).toBe(true);

    solveCube(state, { maxDepth: 2 });
    expect(state.equals(snapshot)).toBe(true);
  });

  it('does not expose an internal mutable path', () => {
    const state = solvedState().applyMoves(['R', 'U']);
    const first = solveCube(state, { maxDepth: 2 });
    expectSolved(state, first);
    expect(Object.isFrozen(first.moves)).toBe(true);

    expect(() => (first.moves as Move[]).push('F')).toThrow(TypeError);

    const second = solveCube(state, { maxDepth: 2 });
    expect(second).toEqual(first);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 7])(
    'rejects invalid maxDepth %s',
    (maxDepth) => {
      expect(() => solveCube(solvedState(), { maxDepth })).toThrow(RangeError);
    }
  );
});
