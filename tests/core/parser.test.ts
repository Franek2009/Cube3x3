import { describe, expect, it } from 'vitest';

import { ALL_MOVES } from '../../src/core/moves/moves.ts';
import { parseMoves } from '../../src/core/moves/parser.ts';

describe('parseMoves', () => {
  it.each(ALL_MOVES)('parses supported move %s', (move) => {
    expect(parseMoves(move)).toEqual([move]);
  });

  it('parses a sequence from left to right', () => {
    expect(parseMoves("R U R' U2 F")).toEqual(['R', 'U', "R'", 'U2', 'F']);
  });

  it.each([
    ['', []],
    ['   ', []],
    ['  R   U  ', ['R', 'U']],
    ['R\tU', ['R', 'U']],
    ['R\nU', ['R', 'U']],
    [' \tR\n  U\r\nF2 ', ['R', 'U', 'F2']]
  ] as const)('handles whitespace in %j', (input, expected) => {
    expect(parseMoves(input)).toEqual(expected);
  });

  it.each(['X', 'R3', 'RR', "R2'", "R'2", 'R,U', 'foo']) (
    'rejects invalid token %s',
    (token) => {
      expect(() => parseMoves(token)).toThrow(`Invalid move token: ${JSON.stringify(token)}`);
    }
  );

  it('fails on the first invalid token', () => {
    expect(() => parseMoves('R X foo U')).toThrow('Invalid move token: "X"');
  });

  it('reports an invalid token at the end of a sequence', () => {
    expect(() => parseMoves('R U foo')).toThrow('Invalid move token: "foo"');
  });

  it('does not retain mutable state between calls', () => {
    const firstResult = parseMoves('R U');
    firstResult[0] = 'F';

    expect(parseMoves('R U')).toEqual(['R', 'U']);
  });
});
