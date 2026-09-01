import { describe, expect, it } from 'vitest';

import { CubeState, solvedState } from '../../src/core/cube/CubeState.ts';
import {
  deserializeCubeState,
  serializeCubeState
} from '../../src/core/cube/serialization.ts';
import { ALL_MOVES, type Move } from '../../src/core/moves/moves.ts';

const SOLVED_SERIALIZED =
  '{"cornerPermutation":[0,1,2,3,4,5,6,7],"cornerOrientation":[0,0,0,0,0,0,0,0],"edgePermutation":[0,1,2,3,4,5,6,7,8,9,10,11],"edgeOrientation":[0,0,0,0,0,0,0,0,0,0,0,0]}';

const SOLVED_DATA = {
  cornerPermutation: [0, 1, 2, 3, 4, 5, 6, 7],
  cornerOrientation: [0, 0, 0, 0, 0, 0, 0, 0],
  edgePermutation: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  edgeOrientation: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};

function serializedWith(overrides: Partial<typeof SOLVED_DATA>): string {
  return JSON.stringify({ ...SOLVED_DATA, ...overrides });
}

describe('CubeState serialization', () => {
  describe('serializeCubeState', () => {
    it('serializes solved state to the exact deterministic format', () => {
      expect(serializeCubeState(solvedState())).toBe(SOLVED_SERIALIZED);
    });

    it('serializes a legal scrambled state deterministically', () => {
      const state = solvedState().applyMoves(['R', 'U', 'F2', "L'", 'D', 'B2']);

      expect(serializeCubeState(state)).toBe(serializeCubeState(state));
      expect(JSON.parse(serializeCubeState(state))).toEqual({
        cornerPermutation: state.cornerPermutation,
        cornerOrientation: state.cornerOrientation,
        edgePermutation: state.edgePermutation,
        edgeOrientation: state.edgeOrientation
      });
    });

    it('does not mutate the state', () => {
      const state = solvedState().applyMoves(['F', 'R', 'U']);
      const snapshot = state.clone();

      serializeCubeState(state);

      expect(state.equals(snapshot)).toBe(true);
    });

    it('rejects an illegal state with its validation reason', () => {
      const state = new CubeState(
        [1, 0, 2, 3, 4, 5, 6, 7],
        SOLVED_DATA.cornerOrientation,
        SOLVED_DATA.edgePermutation,
        SOLVED_DATA.edgeOrientation
      );

      expect(() => serializeCubeState(state)).toThrow(
        'Cannot serialize invalid cube state: permutation-parity-mismatch'
      );
    });

    it('rejects non-finite values before JSON.stringify can convert them to null', () => {
      const state = new CubeState(
        SOLVED_DATA.cornerPermutation,
        [Infinity, 0, 0, 0, 0, 0, 0, 0],
        SOLVED_DATA.edgePermutation,
        SOLVED_DATA.edgeOrientation
      );

      expect(() => serializeCubeState(state)).toThrow(
        'Cannot serialize invalid cube state: invalid-corner-orientation-value'
      );
    });
  });

  describe('round trips', () => {
    it('round-trips solved state', () => {
      const state = solvedState();

      expect(deserializeCubeState(serializeCubeState(state)).equals(state)).toBe(true);
    });

    it.each(ALL_MOVES)('round-trips solved state after %s', (move) => {
      const state = solvedState().applyMove(move);

      expect(deserializeCubeState(serializeCubeState(state)).equals(state)).toBe(true);
    });

    it('round-trips a state from a long mixed sequence', () => {
      const sequence: readonly Move[] = [
        'R', 'U', 'F2', "L'", 'D', 'B2', "R'", 'F', 'U2', 'L', "B'", 'D2',
        'F2', 'R', "U'", 'B', 'L2', "D'"
      ];
      const state = solvedState().applyMoves(sequence);

      expect(deserializeCubeState(serializeCubeState(state)).equals(state)).toBe(true);
    });
  });

  describe('invalid JSON', () => {
    it.each(['', '{', 'foo', '{"cornerPermutation":'])('rejects %j', (input) => {
      expect(() => deserializeCubeState(input)).toThrow(
        'Invalid serialized cube state: invalid JSON'
      );
    });
  });

  describe('invalid shape', () => {
    it.each(['null', '123', '"text"', '[]', 'true'])('rejects root %s', (input) => {
      expect(() => deserializeCubeState(input)).toThrow(
        'Invalid serialized cube state: invalid shape'
      );
    });

    it.each([
      'cornerPermutation',
      'cornerOrientation',
      'edgePermutation',
      'edgeOrientation'
    ] as const)('rejects missing field %s', (field) => {
      const data: Record<string, unknown> = { ...SOLVED_DATA };
      delete data[field];

      expect(() => deserializeCubeState(JSON.stringify(data))).toThrow(
        'Invalid serialized cube state: invalid shape'
      );
    });

    it.each([
      ['cornerPermutation', {}],
      ['cornerOrientation', 'invalid'],
      ['edgePermutation', 123],
      ['edgeOrientation', null]
    ] as const)('rejects invalid type for %s', (field, value) => {
      const input = JSON.stringify({ ...SOLVED_DATA, [field]: value });

      expect(() => deserializeCubeState(input)).toThrow(
        'Invalid serialized cube state: invalid shape'
      );
    });

    it.each([
      ['cornerPermutation', [null, 1, 2, 3, 4, 5, 6, 7]],
      ['cornerOrientation', ['0', 0, 0, 0, 0, 0, 0, 0]],
      ['edgePermutation', [false, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]],
      ['edgeOrientation', [{}, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
    ] as const)('rejects invalid element type in %s', (field, value) => {
      const input = JSON.stringify({ ...SOLVED_DATA, [field]: value });

      expect(() => deserializeCubeState(input)).toThrow(
        'Invalid serialized cube state: invalid shape'
      );
    });

    it('rejects extra fields', () => {
      const input = JSON.stringify({ ...SOLVED_DATA, version: 1 });

      expect(() => deserializeCubeState(input)).toThrow(
        'Invalid serialized cube state: invalid shape'
      );
    });
  });

  describe('structurally correct but illegal states', () => {
    it.each([
      [
        serializedWith({ cornerPermutation: [0, 1, 2, 3, 4, 5, 6] }),
        'Invalid cube state: invalid-corner-permutation-length'
      ],
      [
        serializedWith({ cornerPermutation: [0, 0, 2, 3, 4, 5, 6, 7] }),
        'Invalid cube state: invalid-corner-permutation'
      ],
      [
        serializedWith({ cornerOrientation: [1, 0, 0, 0, 0, 0, 0, 0] }),
        'Invalid cube state: invalid-corner-orientation-sum'
      ],
      [
        serializedWith({ cornerPermutation: [1, 0, 2, 3, 4, 5, 6, 7] }),
        'Invalid cube state: permutation-parity-mismatch'
      ]
    ] as const)('rejects illegal state %#', (input, message) => {
      expect(() => deserializeCubeState(input)).toThrow(message);
    });
  });
});
