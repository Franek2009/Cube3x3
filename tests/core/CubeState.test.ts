import { describe, expect, it } from 'vitest';

import { CubeState, solvedState } from '../../src/core/cube/CubeState.ts';

describe('CubeState', () => {
  it('creates the solved representation', () => {
    const state = solvedState();

    expect(state.cornerPermutation).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(state.cornerOrientation).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(state.edgePermutation).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(state.edgeOrientation).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('recognizes the solved state', () => {
    expect(solvedState().isSolved()).toBe(true);
  });

  it('compares independently created solved states by value', () => {
    const first = solvedState();
    const second = solvedState();

    expect(first).not.toBe(second);
    expect(first.equals(second)).toBe(true);
  });

  it('compares all four state representations', () => {
    const solved = solvedState();

    expect(new CubeState([1, 0, 2, 3, 4, 5, 6, 7], solved.cornerOrientation, solved.edgePermutation, solved.edgeOrientation).equals(solved)).toBe(false);
    expect(new CubeState(solved.cornerPermutation, [1, 0, 0, 0, 0, 0, 0, 0], solved.edgePermutation, solved.edgeOrientation).equals(solved)).toBe(false);
    expect(new CubeState(solved.cornerPermutation, solved.cornerOrientation, [1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], solved.edgeOrientation).equals(solved)).toBe(false);
    expect(new CubeState(solved.cornerPermutation, solved.cornerOrientation, solved.edgePermutation, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).equals(solved)).toBe(false);
  });

  it('clones to an independent object with equal value', () => {
    const original = solvedState();
    const clone = original.clone();

    expect(clone).not.toBe(original);
    expect(clone.equals(original)).toBe(true);
  });

  it('does not expose mutable internal arrays', () => {
    const state = solvedState();
    const exposedCornerPermutation = state.cornerPermutation as number[];
    const exposedCornerOrientation = state.cornerOrientation as number[];
    const exposedEdgePermutation = state.edgePermutation as number[];
    const exposedEdgeOrientation = state.edgeOrientation as number[];

    exposedCornerPermutation[0] = 7;
    exposedCornerOrientation[0] = 1;
    exposedEdgePermutation[0] = 11;
    exposedEdgeOrientation[0] = 1;

    expect(state.isSolved()).toBe(true);
    expect(state.cornerPermutation[0]).toBe(0);
    expect(state.cornerOrientation[0]).toBe(0);
    expect(state.edgePermutation[0]).toBe(0);
    expect(state.edgeOrientation[0]).toBe(0);
  });

  it('copies constructor inputs', () => {
    const cornerPermutation = [0, 1, 2, 3, 4, 5, 6, 7];
    const cornerOrientation = [0, 0, 0, 0, 0, 0, 0, 0];
    const edgePermutation = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const edgeOrientation = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const state = new CubeState(
      cornerPermutation,
      cornerOrientation,
      edgePermutation,
      edgeOrientation
    );

    cornerPermutation[0] = 7;
    cornerOrientation[0] = 1;
    edgePermutation[0] = 11;
    edgeOrientation[0] = 1;

    expect(state.isSolved()).toBe(true);
  });
});
