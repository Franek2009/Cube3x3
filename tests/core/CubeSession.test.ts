import { describe, expect, it } from 'vitest';

import { solvedState } from '../../src/core/cube/CubeState.ts';
import { inverseMove, type Move } from '../../src/core/moves/moves.ts';
import { generateScramble } from '../../src/core/scramble/scrambler.ts';
import { CubeSession } from '../../src/core/session/CubeSession.ts';

describe('CubeSession', () => {
  it('starts solved by default', () => {
    const session = new CubeSession();

    expect(session.getState().isSolved()).toBe(true);
    expect(session.getMoveHistory()).toEqual([]);
  });

  it('respects the initial state', () => {
    const initialState = solvedState().applyMoves(['R', 'U']);
    const session = new CubeSession(initialState);

    expect(session.getState().equals(initialState)).toBe(true);
    expect(session.getMoveHistory()).toEqual([]);
  });

  it('does not mutate the initial state', () => {
    const initialState = solvedState().applyMove('F');
    const snapshot = initialState.clone();
    const session = new CubeSession(initialState);

    session.applyMove('R');

    expect(initialState.equals(snapshot)).toBe(true);
  });

  it('applyMove changes the current state and returns it', () => {
    const session = new CubeSession();
    const state = session.applyMove('R');

    expect(state.equals(solvedState())).toBe(false);
    expect(session.getState()).toBe(state);
  });

  it('applyMove appends the move to history', () => {
    const session = new CubeSession();

    session.applyMove('R');
    session.applyMove("U'");

    expect(session.getMoveHistory()).toEqual(['R', "U'"]);
  });

  it('applyMoves applies moves from left to right', () => {
    const session = new CubeSession();
    const state = session.applyMoves(['R', 'U', "R'"]);
    const expected = solvedState().applyMove('R').applyMove('U').applyMove("R'");

    expect(state.equals(expected)).toBe(true);
  });

  it('applyMoves appends the whole sequence to history in order', () => {
    const session = new CubeSession();

    session.applyMove('F');
    session.applyMoves(['R', 'U2', "L'"]);

    expect(session.getMoveHistory()).toEqual(['F', 'R', 'U2', "L'"]);
  });

  it('applyMoves with an empty sequence changes nothing', () => {
    const session = new CubeSession();
    const before = session.getState();
    const result = session.applyMoves([]);

    expect(result).toBe(before);
    expect(session.getMoveHistory()).toEqual([]);
  });

  it('applyScramble applies the sequence to the current state', () => {
    const initialState = solvedState().applyMove('F');
    const session = new CubeSession(initialState);
    const scramble = ['R', 'U', 'B2'] as const;

    expect(session.applyScramble(scramble).equals(initialState.applyMoves(scramble))).toBe(true);
  });

  it('applyScramble does not append moves to existing history', () => {
    const session = new CubeSession();

    session.applyMove('F');
    session.applyScramble(['R', 'U']);

    expect(session.getMoveHistory()).toEqual(['F']);
  });

  it('keeps history empty after scrambling a new session', () => {
    const session = new CubeSession();

    session.applyScramble(['R', 'U', 'F2']);

    expect(session.getMoveHistory()).toEqual([]);
  });

  it('records only user moves after scramble', () => {
    const session = new CubeSession();

    session.applyScramble(['R', 'U', 'F2']);
    session.applyMoves(['L', "D'"]);

    expect(session.getMoveHistory()).toEqual(['L', "D'"]);
  });

  it('reset returns a solved state', () => {
    const session = new CubeSession();
    session.applyMoves(['R', 'U', 'F']);

    const state = session.reset();

    expect(state.isSolved()).toBe(true);
    expect(session.getState()).toBe(state);
  });

  it('reset clears move history', () => {
    const session = new CubeSession();
    session.applyMoves(['R', 'U']);

    session.reset();

    expect(session.getMoveHistory()).toEqual([]);
  });

  it('isSolved reflects the current state', () => {
    const session = new CubeSession();

    expect(session.isSolved()).toBe(true);
    session.applyMove('R');
    expect(session.isSolved()).toBe(false);
    session.reset();
    expect(session.isSolved()).toBe(true);
  });

  it('recognizes solved after a move and its inverse', () => {
    const session = new CubeSession();
    const move = 'B' as const;

    session.applyMoves([move, inverseMove(move)]);

    expect(session.isSolved()).toBe(true);
  });

  it('getMoveHistory returns a new array on every call', () => {
    const session = new CubeSession();
    session.applyMove('R');

    expect(session.getMoveHistory()).not.toBe(session.getMoveHistory());
  });

  it('mutating returned history does not change the session', () => {
    const session = new CubeSession();
    session.applyMoves(['R', 'U']);
    const exposedHistory = session.getMoveHistory();

    exposedHistory[0] = 'F';
    exposedHistory.push('B');

    expect(session.getMoveHistory()).toEqual(['R', 'U']);
  });

  it('does not retain the input array passed to applyMoves', () => {
    const session = new CubeSession();
    const moves: Move[] = ['R', 'U'];

    session.applyMoves(moves);
    moves[0] = 'F';
    moves.push('B');

    expect(session.getMoveHistory()).toEqual(['R', 'U']);
  });

  it('does not retain the input array passed to applyScramble', () => {
    const session = new CubeSession();
    const moves: Move[] = ['R', 'U'];
    const expected = solvedState().applyMoves(moves);

    session.applyScramble(moves);
    moves[0] = 'F';
    moves.push('B');

    expect(session.getState().equals(expected)).toBe(true);
    expect(session.getMoveHistory()).toEqual([]);
  });

  it('getState does not expose mutable CubeState internals', () => {
    const session = new CubeSession();
    const first = session.getState();
    const exposedPermutation = first.cornerPermutation as number[];

    exposedPermutation[0] = 7;

    expect(session.getState().isSolved()).toBe(true);
    expect(session.getState().cornerPermutation[0]).toBe(0);
  });

  it('applies a sequence produced by generateScramble', () => {
    const session = new CubeSession();
    const scramble = generateScramble(25, () => 0);
    const expected = solvedState().applyMoves(scramble);

    expect(session.applyScramble(scramble).equals(expected)).toBe(true);
    expect(session.getMoveHistory()).toEqual([]);
  });

  it('matches CubeState.applyMoves for a solved session', () => {
    const session = new CubeSession();
    const sequence = ['R', 'U', "R'", "U'", 'F2', 'D'] as const;

    expect(session.applyMoves(sequence).equals(solvedState().applyMoves(sequence))).toBe(true);
  });
});
