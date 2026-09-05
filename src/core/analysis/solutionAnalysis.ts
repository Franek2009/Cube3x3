import type { Move } from '../moves/moves.ts';

export const SOLUTION_FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;

export type SolutionFace = (typeof SOLUTION_FACES)[number];

export interface SolutionAnalysis {
  readonly htm: number;
  readonly qtm: number;
  readonly quarterTurns: number;
  readonly halfTurns: number;
  readonly faceUsage: Readonly<Record<SolutionFace, number>>;
}

export function analyzeSolution(moves: readonly Move[]): SolutionAnalysis {
  const faceUsage: Record<SolutionFace, number> = {
    U: 0,
    D: 0,
    L: 0,
    R: 0,
    F: 0,
    B: 0
  };
  let quarterTurns = 0;
  let halfTurns = 0;

  for (const move of moves) {
    const face = move[0] as SolutionFace;
    faceUsage[face] += 1;

    if (move.endsWith('2')) {
      halfTurns += 1;
    } else {
      quarterTurns += 1;
    }
  }

  return Object.freeze({
    htm: moves.length,
    qtm: quarterTurns + halfTurns * 2,
    quarterTurns,
    halfTurns,
    faceUsage: Object.freeze(faceUsage)
  });
}
