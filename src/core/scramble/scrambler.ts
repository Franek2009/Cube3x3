import { ALL_MOVES, type Move } from '../moves/moves.ts';

const DEFAULT_SCRAMBLE_LENGTH = 25;

type Axis = 'UD' | 'LR' | 'FB';

function face(move: Move): string {
  return move[0];
}

function axis(move: Move): Axis {
  switch (face(move)) {
    case 'U':
    case 'D':
      return 'UD';
    case 'L':
    case 'R':
      return 'LR';
    case 'F':
    case 'B':
      return 'FB';
  }

  throw new Error(`Unknown move: ${move}`);
}

function randomIndex(length: number, random: () => number): number {
  const value = random();

  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('Random source must return a number in [0, 1)');
  }

  return Math.floor(value * length);
}

export function generateScramble(
  length = DEFAULT_SCRAMBLE_LENGTH,
  random: () => number = Math.random
): Move[] {
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new RangeError('Scramble length must be a positive safe integer');
  }

  const scramble: Move[] = [];

  while (scramble.length < length) {
    const previous = scramble.at(-1);
    const beforePrevious = scramble.at(-2);
    const blockedAxis =
      previous !== undefined &&
      beforePrevious !== undefined &&
      axis(previous) === axis(beforePrevious)
        ? axis(previous)
        : undefined;
    const candidates = ALL_MOVES.filter(
      (move) =>
        (previous === undefined || face(move) !== face(previous)) &&
        (blockedAxis === undefined || axis(move) !== blockedAxis)
    );

    scramble.push(candidates[randomIndex(candidates.length, random)]);
  }

  return scramble;
}
