import { isMove, type Move } from './moves.ts';

export function parseMoves(input: string): Move[] {
  const trimmedInput = input.trim();

  if (trimmedInput === '') {
    return [];
  }

  const moves: Move[] = [];

  for (const token of trimmedInput.split(/\s+/)) {
    if (!isMove(token)) {
      throw new Error(`Invalid move token: ${JSON.stringify(token)}`);
    }

    moves.push(token);
  }

  return moves;
}
