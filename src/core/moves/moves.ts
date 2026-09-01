export const ALL_MOVES = [
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
] as const;

export type Move = (typeof ALL_MOVES)[number];

const MOVE_SET: ReadonlySet<string> = new Set(ALL_MOVES);

export function isMove(value: string): value is Move {
  return MOVE_SET.has(value);
}

const INVERSE_MOVES: Record<Move, Move> = {
  U: "U'",
  "U'": 'U',
  U2: 'U2',
  D: "D'",
  "D'": 'D',
  D2: 'D2',
  L: "L'",
  "L'": 'L',
  L2: 'L2',
  R: "R'",
  "R'": 'R',
  R2: 'R2',
  F: "F'",
  "F'": 'F',
  F2: 'F2',
  B: "B'",
  "B'": 'B',
  B2: 'B2'
};

export function inverseMove(move: Move): Move {
  return INVERSE_MOVES[move];
}
