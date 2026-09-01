import { describe, expect, it } from 'vitest';

import { keyboardEventToMove } from '../../src/ui/keyboard.ts';

describe('keyboardEventToMove', () => {
  it.each([
    ['u', 'U'],
    ['d', 'D'],
    ['l', 'L'],
    ['r', 'R'],
    ['f', 'F'],
    ['b', 'B']
  ] as const)('maps %s to %s', (key, move) => {
    expect(keyboardEventToMove(key, false)).toBe(move);
  });

  it.each([
    ['u', "U'"],
    ['d', "D'"],
    ['l', "L'"],
    ['r', "R'"],
    ['f', "F'"],
    ['b', "B'"]
  ] as const)('maps Shift+%s to %s', (key, move) => {
    expect(keyboardEventToMove(key, true)).toBe(move);
  });

  it.each([
    ['U', "U'"],
    ['D', "D'"],
    ['L', "L'"],
    ['R', "R'"],
    ['F', "F'"],
    ['B', "B'"]
  ] as const)('maps uppercase %s to %s', (key, move) => {
    expect(keyboardEventToMove(key, false)).toBe(move);
  });

  it.each(['x', '1', '2', ' ', 'ArrowUp', 'Enter', 'Shift'])(
    'ignores unsupported key %j',
    (key) => {
      expect(keyboardEventToMove(key, false)).toBeUndefined();
    }
  );

  it('never maps a keyboard shortcut to a double move', () => {
    const mappedMoves = ['u', 'd', 'l', 'r', 'f', 'b'].flatMap((key) => [
      keyboardEventToMove(key, false),
      keyboardEventToMove(key, true)
    ]);

    expect(mappedMoves.every((move) => move !== undefined && !move.endsWith('2'))).toBe(true);
  });
});
