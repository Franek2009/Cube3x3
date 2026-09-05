import { describe, expect, it } from 'vitest';

import {
  analyzeSolution,
  SOLUTION_FACES
} from '../../src/core/analysis/solutionAnalysis.ts';
import { ALL_MOVES, type Move } from '../../src/core/moves/moves.ts';

const EMPTY_FACE_USAGE = {
  U: 0,
  D: 0,
  L: 0,
  R: 0,
  F: 0,
  B: 0
};

describe('analyzeSolution', () => {
  it('returns zero metrics for an empty solution', () => {
    expect(analyzeSolution([])).toEqual({
      htm: 0,
      qtm: 0,
      quarterTurns: 0,
      halfTurns: 0,
      faceUsage: EMPTY_FACE_USAGE
    });
  });

  it('counts a single quarter turn', () => {
    expect(analyzeSolution(['R'])).toEqual({
      htm: 1,
      qtm: 1,
      quarterTurns: 1,
      halfTurns: 0,
      faceUsage: { ...EMPTY_FACE_USAGE, R: 1 }
    });
  });

  it('counts a prime move as a quarter turn', () => {
    const analysis = analyzeSolution(["U'"]);

    expect(analysis.quarterTurns).toBe(1);
    expect(analysis.halfTurns).toBe(0);
    expect(analysis.qtm).toBe(1);
  });

  it('counts a double move as one half-turn token and two QTM', () => {
    const analysis = analyzeSolution(['F2']);

    expect(analysis.htm).toBe(1);
    expect(analysis.qtm).toBe(2);
    expect(analysis.quarterTurns).toBe(0);
    expect(analysis.halfTurns).toBe(1);
  });

  it('uses the number of move tokens as HTM', () => {
    const moves = ['R', 'U2', "F'", 'D', 'B2'] as const;

    expect(analyzeSolution(moves).htm).toBe(moves.length);
  });

  it('counts double moves twice in QTM', () => {
    expect(analyzeSolution(['R', 'U2', "F'", 'B2']).qtm).toBe(6);
  });

  it('ignores move suffixes when counting face usage', () => {
    const analysis = analyzeSolution(['R', "R'", 'R2']);

    expect(analysis.faceUsage).toEqual({ ...EMPTY_FACE_USAGE, R: 3 });
  });

  it('analyzes all 18 move tokens', () => {
    const analysis = analyzeSolution(ALL_MOVES);

    expect(analysis).toEqual({
      htm: 18,
      qtm: 24,
      quarterTurns: 12,
      halfTurns: 6,
      faceUsage: Object.fromEntries(SOLUTION_FACES.map((face) => [face, 3]))
    });
  });

  it('analyzes a mixed deterministic sequence', () => {
    expect(analyzeSolution(['R', "U'", 'F2', 'R2', 'B'])).toEqual({
      htm: 5,
      qtm: 7,
      quarterTurns: 3,
      halfTurns: 2,
      faceUsage: { U: 1, D: 0, L: 0, R: 2, F: 1, B: 1 }
    });
  });

  it('does not mutate the input sequence', () => {
    const moves: Move[] = ['R', 'U2', "F'"];
    const snapshot = [...moves];

    analyzeSolution(moves);

    expect(moves).toEqual(snapshot);
  });

  it('returns independent face usage objects', () => {
    const first = analyzeSolution(['R']);
    const second = analyzeSolution(['U']);

    expect(first.faceUsage).not.toBe(second.faceUsage);
    expect(first.faceUsage.R).toBe(1);
    expect(second.faceUsage.R).toBe(0);
  });

  it('freezes the result and face usage at runtime', () => {
    const analysis = analyzeSolution(['R']);

    expect(Object.isFrozen(analysis)).toBe(true);
    expect(Object.isFrozen(analysis.faceUsage)).toBe(true);
  });
});
