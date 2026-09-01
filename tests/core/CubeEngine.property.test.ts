import { describe, expect, it } from 'vitest';

import { CubeState, solvedState } from '../../src/core/cube/CubeState.ts';
import {
  deserializeCubeState,
  serializeCubeState
} from '../../src/core/cube/serialization.ts';
import { validateCubeState } from '../../src/core/cube/validation.ts';
import { ALL_MOVES, inverseMove, type Move } from '../../src/core/moves/moves.ts';

const QUARTER_TURNS = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
const STRESS_SEEDS = [
  0x00000001,
  0x12345678,
  0x9abcdef0,
  0xdeadbeef,
  0xc0ffee00,
  0xffffffff,
  0x31415926,
  0x27182818
] as const;

function createPrng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function generateMoves(seed: number, length: number): Move[] {
  const next = createPrng(seed);

  return Array.from({ length }, () => ALL_MOVES[next() % ALL_MOVES.length]);
}

function inverseSequence(moves: readonly Move[]): Move[] {
  return [...moves].reverse().map(inverseMove);
}

function permutationParity(permutation: readonly number[]): 0 | 1 {
  let parity: 0 | 1 = 0;

  for (let left = 0; left < permutation.length; left += 1) {
    for (let right = left + 1; right < permutation.length; right += 1) {
      if (permutation[left] > permutation[right]) {
        parity = parity === 0 ? 1 : 0;
      }
    }
  }

  return parity;
}

function expectPermutation(values: readonly number[], size: number): void {
  expect([...values].sort((left, right) => left - right)).toEqual(
    Array.from({ length: size }, (_, index) => index)
  );
}

function expectCubeInvariants(state: CubeState): void {
  const cornerPermutation = state.cornerPermutation;
  const cornerOrientation = state.cornerOrientation;
  const edgePermutation = state.edgePermutation;
  const edgeOrientation = state.edgeOrientation;

  expectPermutation(cornerPermutation, 8);
  expectPermutation(edgePermutation, 12);
  expect(cornerOrientation).toHaveLength(8);
  expect(edgeOrientation).toHaveLength(12);
  expect(cornerOrientation.every((value) => Number.isInteger(value) && value >= 0 && value <= 2)).toBe(true);
  expect(edgeOrientation.every((value) => Number.isInteger(value) && value >= 0 && value <= 1)).toBe(true);
  expect(cornerOrientation.reduce((sum, value) => sum + value, 0) % 3).toBe(0);
  expect(edgeOrientation.reduce((sum, value) => sum + value, 0) % 2).toBe(0);
  expect(permutationParity(cornerPermutation)).toBe(permutationParity(edgePermutation));
  expect(validateCubeState(state)).toEqual({ valid: true });
}

describe('Cube Engine deterministic properties', () => {
  it('generates repeatable move sequences for a fixed seed', () => {
    expect(generateMoves(0x12345678, 100)).toEqual(generateMoves(0x12345678, 100));
    expect(generateMoves(0x12345678, 100)).not.toEqual(generateMoves(0x12345679, 100));
  });

  it.each(STRESS_SEEDS)('preserves legality through 1,000 moves for seed %i', (seed) => {
    const moves = generateMoves(seed, 1_000);
    let state = solvedState();

    for (const move of moves) {
      const previous = state;
      const snapshot = previous.clone();
      state = previous.applyMove(move);

      expect(previous.equals(snapshot)).toBe(true);
      expectCubeInvariants(state);
    }

    expect(state.applyMoves(inverseSequence(moves)).isSolved()).toBe(true);
  });

  it.each(STRESS_SEEDS)('applyMoves matches repeated applyMove for seed %i', (seed) => {
    const moves = generateMoves(seed ^ 0xa5a5a5a5, 500);
    const manual = moves.reduce((state, move) => state.applyMove(move), solvedState());

    expect(solvedState().applyMoves(moves).equals(manual)).toBe(true);
  });

  it.each(STRESS_SEEDS)('round-trips a long reachable state for seed %i', (seed) => {
    const state = solvedState().applyMoves(generateMoves(seed ^ 0x5a5a5a5a, 500));
    const restored = deserializeCubeState(serializeCubeState(state));

    expect(restored.equals(state)).toBe(true);
    expectCubeInvariants(restored);
  });

  it.each(ALL_MOVES)('move %s and its inverse cancel on arbitrary reachable states', (move) => {
    for (const seed of STRESS_SEEDS) {
      const state = solvedState().applyMoves(generateMoves(seed, 200));

      expect(state.applyMove(move).applyMove(inverseMove(move)).equals(state)).toBe(true);
    }
  });

  it.each(QUARTER_TURNS)('four %s quarter-turns restore arbitrary reachable states', (move) => {
    for (const seed of STRESS_SEEDS) {
      const state = solvedState().applyMoves(generateMoves(seed, 200));
      const moved = state.applyMoves([move, move, move, move]);

      expect(moved.equals(state)).toBe(true);
    }
  });
});
