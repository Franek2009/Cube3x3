import { describe, expect, it } from 'vitest';

import { CubeState, solvedState } from '../../src/core/cube/CubeState.ts';
import { ALL_MOVES, type Move } from '../../src/core/moves/moves.ts';
import { generateScramble } from '../../src/core/scramble/scrambler.ts';
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

function createPrng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

describe('solveCube', () => {
  it('returns a frozen empty depth-zero solution for a solved state', () => {
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

  it('treats maxDepth as a total Phase 1 plus Phase 2 limit', () => {
    const state = solvedState().applyMove('R');

    expect(solveCube(state, { maxDepth: 0 })).toEqual({
      solved: false,
      reason: 'depth-limit'
    });

    const result = solveCube(state, { maxDepth: 1 });
    expectSolved(state, result);
    expect(result.depth).toBe(1);
  });

  it.each([
    [10, 0x0000_0001],
    [20, 0x1234_5678],
    [25, 0xdead_beef],
    [25, 0xcafe_babe]
  ] as const)('solves a deterministic %i-move scramble (seed %i)', (length, seed) => {
    const scramble = generateScramble(length, createPrng(seed));
    const state = solvedState().applyMoves(scramble);
    const result = solveCube(state, { maxDepth: 30 });

    expectSolved(state, result);
    expect(result.depth).toBeLessThanOrEqual(30);
  });

  it('returns deterministic output', () => {
    const scramble = generateScramble(20, createPrng(0x3141_5926));
    const state = solvedState().applyMoves(scramble);

    expect(solveCube(state)).toEqual(solveCube(state));
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

    solveCube(state, { maxDepth: 10 });
    expect(state.equals(snapshot)).toBe(true);

    solveCube(state, { maxDepth: 0 });
    expect(state.equals(snapshot)).toBe(true);
  });

  it('returns a frozen solution that does not alias phase paths', () => {
    const state = solvedState().applyMoves(['R', 'U']);
    const first = solveCube(state, { maxDepth: 10 });
    expectSolved(state, first);
    expect(Object.isFrozen(first.moves)).toBe(true);

    expect(() => (first.moves as Move[]).push('F')).toThrow(TypeError);

    const second = solveCube(state, { maxDepth: 10 });
    expect(second).toEqual(first);
  });

  it('accepts limits above the F7 cap and above the default', () => {
    expectSolved(solvedState().applyMove('R'), solveCube(solvedState().applyMove('R'), {
      maxDepth: 7
    }));
    expectSolved(solvedState().applyMove('R'), solveCube(solvedState().applyMove('R'), {
      maxDepth: 31
    }));
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid maxDepth %s',
    (maxDepth) => {
      expect(() => solveCube(solvedState(), { maxDepth })).toThrow(RangeError);
    }
  );
});
