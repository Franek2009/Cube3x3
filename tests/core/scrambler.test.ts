import { describe, expect, it } from 'vitest';

import { solvedState } from '../../src/core/cube/CubeState.ts';
import { validateCubeState } from '../../src/core/cube/validation.ts';
import { ALL_MOVES, type Move } from '../../src/core/moves/moves.ts';
import { generateScramble } from '../../src/core/scramble/scrambler.ts';

function face(move: Move): string {
  return move[0];
}

function axis(move: Move): string {
  if (move[0] === 'U' || move[0] === 'D') {
    return 'UD';
  }

  if (move[0] === 'L' || move[0] === 'R') {
    return 'LR';
  }

  return 'FB';
}

function createPrng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

describe('generateScramble', () => {
  it('generates 25 moves by default', () => {
    expect(generateScramble(undefined, () => 0)).toHaveLength(25);
  });

  it.each([1, 20, 25, 100])('generates an explicit length of %i', (length) => {
    expect(generateScramble(length, () => 0)).toHaveLength(length);
  });

  it('uses only supported moves', () => {
    const scramble = generateScramble(500, createPrng(0x12345678));

    expect(scramble.every((move) => ALL_MOVES.includes(move))).toBe(true);
  });

  it('never places the same face twice in a row', () => {
    const scramble = generateScramble(500, createPrng(0x9abcdef0));

    for (let index = 1; index < scramble.length; index += 1) {
      expect(face(scramble[index])).not.toBe(face(scramble[index - 1]));
    }
  });

  it('never places three consecutive moves on the same axis', () => {
    const scramble = generateScramble(500, createPrng(0xdeadbeef));

    for (let index = 2; index < scramble.length; index += 1) {
      const currentAxis = axis(scramble[index]);

      expect(
        currentAxis === axis(scramble[index - 1]) &&
          currentAxis === axis(scramble[index - 2])
      ).toBe(false);
    }
  });

  it('allows opposite faces on the same axis but prevents an axis-local third move', () => {
    expect(generateScramble(3, () => 0)).toEqual(['U', 'D', 'L']);
  });

  it('is deterministic for a deterministic random source', () => {
    expect(generateScramble(100, createPrng(0xc0ffee00))).toEqual(
      generateScramble(100, createPrng(0xc0ffee00))
    );
  });

  it('produces different scrambles for different random sources', () => {
    expect(generateScramble(25, () => 0)).not.toEqual(generateScramble(25, () => 0.999));
  });

  it('does not retain mutable state between calls', () => {
    const first = generateScramble(25, createPrng(0x31415926));
    const expected = generateScramble(25, createPrng(0x31415926));

    first[0] = 'F2';

    expect(generateScramble(25, createPrng(0x31415926))).toEqual(expected);
  });

  it('produces a legal cube state when applied', () => {
    const scramble = generateScramble(1_000, createPrng(0x27182818));
    const state = solvedState().applyMoves(scramble);

    expect(validateCubeState(state)).toEqual({ valid: true });
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid length %s',
    (length) => {
      expect(() => generateScramble(length)).toThrow(
        new RangeError('Scramble length must be a positive safe integer')
      );
    }
  );

  it.each([-0.1, 1, NaN, Infinity])('rejects invalid random value %s', (value) => {
    expect(() => generateScramble(1, () => value)).toThrow(
      new RangeError('Random source must return a number in [0, 1)')
    );
  });
});
