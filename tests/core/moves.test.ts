import { describe, expect, it } from 'vitest';

import { ALL_MOVES, inverseMove } from '../../src/core/moves/moves.ts';

describe('moves', () => {
  it('contains exactly the 18 supported moves', () => {
    expect(ALL_MOVES).toEqual([
      'U',
      "U'",
      'U2',
      'D',
      "D'",
      'D2',
      'L',
      "L'",
      'L2',
      'R',
      "R'",
      'R2',
      'F',
      "F'",
      'F2',
      'B',
      "B'",
      'B2'
    ]);
    expect(new Set(ALL_MOVES).size).toBe(18);
  });

  it.each([
    ['U', "U'"],
    ['D', "D'"],
    ['L', "L'"],
    ['R', "R'"],
    ['F', "F'"],
    ['B', "B'"]
  ] as const)('inverts quarter turn %s to %s', (move, inverse) => {
    expect(inverseMove(move)).toBe(inverse);
  });

  it.each([
    ["U'", 'U'],
    ["D'", 'D'],
    ["L'", 'L'],
    ["R'", 'R'],
    ["F'", 'F'],
    ["B'", 'B']
  ] as const)('inverts prime turn %s to %s', (move, inverse) => {
    expect(inverseMove(move)).toBe(inverse);
  });

  it.each(['U2', 'D2', 'L2', 'R2', 'F2', 'B2'] as const)(
    'keeps double turn %s unchanged',
    (move) => {
      expect(inverseMove(move)).toBe(move);
    }
  );

  it.each(ALL_MOVES)('is an involution for %s', (move) => {
    expect(inverseMove(inverseMove(move))).toBe(move);
  });
});
