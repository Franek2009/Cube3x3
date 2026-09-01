import { describe, expect, it } from 'vitest';

import { CubeState, solvedState } from '../../src/core/cube/CubeState.ts';
import {
  isValidCubeState,
  validateCubeState,
  type CubeValidationError
} from '../../src/core/cube/validation.ts';
import { ALL_MOVES, type Move } from '../../src/core/moves/moves.ts';

const SOLVED_CP = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const SOLVED_CO = [0, 0, 0, 0, 0, 0, 0, 0] as const;
const SOLVED_EP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const SOLVED_EO = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as const;

function stateWith(overrides: {
  cornerPermutation?: readonly number[];
  cornerOrientation?: readonly number[];
  edgePermutation?: readonly number[];
  edgeOrientation?: readonly number[];
}): CubeState {
  return new CubeState(
    overrides.cornerPermutation ?? SOLVED_CP,
    overrides.cornerOrientation ?? SOLVED_CO,
    overrides.edgePermutation ?? SOLVED_EP,
    overrides.edgeOrientation ?? SOLVED_EO
  );
}

function expectInvalid(state: CubeState, reason: CubeValidationError): void {
  expect(validateCubeState(state)).toEqual({ valid: false, reason });
  expect(isValidCubeState(state)).toBe(false);
}

describe('CubeState validation', () => {
  describe('valid states', () => {
    it('accepts the solved state', () => {
      expect(validateCubeState(solvedState())).toEqual({ valid: true });
      expect(isValidCubeState(solvedState())).toBe(true);
    });

    it.each(ALL_MOVES)('accepts solved state after %s', (move) => {
      expect(validateCubeState(solvedState().applyMove(move))).toEqual({ valid: true });
    });

    it('accepts a state produced by a long mixed sequence', () => {
      const sequence: readonly Move[] = [
        'R', 'U', 'F2', "L'", 'D', 'B2', "R'", 'F', 'U2', 'L', "B'", 'D2',
        'F2', 'R', "U'", 'B', 'L2', "D'"
      ];

      expect(validateCubeState(solvedState().applyMoves(sequence))).toEqual({ valid: true });
    });

    it('accepts matching odd corner and edge permutations', () => {
      const state = stateWith({
        cornerPermutation: [1, 0, 2, 3, 4, 5, 6, 7],
        edgePermutation: [1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      });

      expect(validateCubeState(state)).toEqual({ valid: true });
    });
  });

  describe('array lengths', () => {
    it.each([
      [[0, 1, 2, 3, 4, 5, 6], 'invalid-corner-permutation-length'],
      [[0, 1, 2, 3, 4, 5, 6, 7, 8], 'invalid-corner-permutation-length']
    ] as const)('rejects corner permutation length %#', (values, reason) => {
      expectInvalid(stateWith({ cornerPermutation: values }), reason);
    });

    it.each([
      [[0, 0, 0, 0, 0, 0, 0], 'invalid-corner-orientation-length'],
      [[0, 0, 0, 0, 0, 0, 0, 0, 0], 'invalid-corner-orientation-length']
    ] as const)('rejects corner orientation length %#', (values, reason) => {
      expectInvalid(stateWith({ cornerOrientation: values }), reason);
    });

    it.each([
      [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'invalid-edge-permutation-length'],
      [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'invalid-edge-permutation-length']
    ] as const)('rejects edge permutation length %#', (values, reason) => {
      expectInvalid(stateWith({ edgePermutation: values }), reason);
    });

    it.each([
      [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'invalid-edge-orientation-length'],
      [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'invalid-edge-orientation-length']
    ] as const)('rejects edge orientation length %#', (values, reason) => {
      expectInvalid(stateWith({ edgeOrientation: values }), reason);
    });
  });

  describe('permutations', () => {
    it.each([
      [0, 0, 2, 3, 4, 5, 6, 7],
      [-1, 1, 2, 3, 4, 5, 6, 7],
      [8, 1, 2, 3, 4, 5, 6, 7],
      [0.5, 1, 2, 3, 4, 5, 6, 7],
      [NaN, 1, 2, 3, 4, 5, 6, 7],
      [Infinity, 1, 2, 3, 4, 5, 6, 7]
    ])('rejects invalid corner permutation %#', (...values) => {
      expectInvalid(stateWith({ cornerPermutation: values }), 'invalid-corner-permutation');
    });

    it.each([
      [0, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [-1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [NaN, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [Infinity, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    ])('rejects invalid edge permutation %#', (...values) => {
      expectInvalid(stateWith({ edgePermutation: values }), 'invalid-edge-permutation');
    });
  });

  describe('orientations', () => {
    it.each([-1, 3, 0.5, NaN, Infinity])('rejects corner orientation value %s', (value) => {
      expectInvalid(
        stateWith({ cornerOrientation: [value, 0, 0, 0, 0, 0, 0, 0] }),
        'invalid-corner-orientation-value'
      );
    });

    it.each([-1, 2, 0.5, NaN, Infinity])('rejects edge orientation value %s', (value) => {
      expectInvalid(
        stateWith({ edgeOrientation: [value, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }),
        'invalid-edge-orientation-value'
      );
    });

    it('rejects an invalid corner orientation sum', () => {
      expectInvalid(
        stateWith({ cornerOrientation: [1, 0, 0, 0, 0, 0, 0, 0] }),
        'invalid-corner-orientation-sum'
      );
    });

    it('rejects an invalid edge orientation sum', () => {
      expectInvalid(
        stateWith({ edgeOrientation: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }),
        'invalid-edge-orientation-sum'
      );
    });
  });

  describe('permutation parity', () => {
    it('rejects a corner-only swap', () => {
      expectInvalid(
        stateWith({ cornerPermutation: [1, 0, 2, 3, 4, 5, 6, 7] }),
        'permutation-parity-mismatch'
      );
    });

    it('rejects an edge-only swap', () => {
      expectInvalid(
        stateWith({ edgePermutation: [1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }),
        'permutation-parity-mismatch'
      );
    });
  });

  it('returns the first error in the documented validation order', () => {
    const state = new CubeState([0], [4], [0], [3]);

    expect(validateCubeState(state)).toEqual({
      valid: false,
      reason: 'invalid-corner-permutation-length'
    });
  });
});
