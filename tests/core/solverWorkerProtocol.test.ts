import { describe, expect, it } from 'vitest';

import { solvedState } from '../../src/core/cube/CubeState.ts';
import {
  cubeStateFromData,
  cubeStateToData,
  deserializeWorkerError,
  isCubeStateData,
  isSolverWorkerRequest,
  isSolverWorkerResponse,
  serializeWorkerError
} from '../../src/core/solver/solverWorkerProtocol.ts';

describe('solver worker protocol', () => {
  it('round-trips a cube through independent plain arrays', () => {
    const state = solvedState().applyMoves(['R', 'U', 'F2']);
    const data = cubeStateToData(state);

    expect(cubeStateFromData(data).equals(state)).toBe(true);
    expect(data.cornerPermutation).not.toBe(state.cornerPermutation);

    const mutable = data.cornerPermutation as number[];
    mutable[0] = 99;
    expect(state.cornerPermutation[0]).not.toBe(99);
  });

  it('validates CubeState transport shape without validating cube legality', () => {
    const data = cubeStateToData(solvedState());

    expect(isCubeStateData(data)).toBe(true);
    expect(isCubeStateData({ ...data, cornerPermutation: [0, 0] })).toBe(true);
    expect(isCubeStateData({ ...data, cornerPermutation: ['0'] })).toBe(false);
    expect(isCubeStateData({ ...data, extra: [] })).toBe(false);
  });

  it('validates init and solve request envelopes', () => {
    const state = cubeStateToData(solvedState());

    expect(isSolverWorkerRequest({ type: 'init', id: 1 })).toBe(true);
    expect(isSolverWorkerRequest({ type: 'solve', id: 2, state })).toBe(true);
    expect(isSolverWorkerRequest({ type: 'solve', id: 2, state, options: {} })).toBe(true);
    expect(isSolverWorkerRequest({
      type: 'solve',
      id: 3,
      state,
      options: { maxDepth: Number.NaN }
    })).toBe(true);

    expect(isSolverWorkerRequest({ type: 'init', id: 0 })).toBe(false);
    expect(isSolverWorkerRequest({ type: 'solve', id: 2, state: {} })).toBe(false);
    expect(isSolverWorkerRequest({ type: 'solve', id: 2, state, extra: true })).toBe(false);
  });

  it('validates every response variant and rejects malformed results', () => {
    expect(isSolverWorkerResponse({ type: 'ready', id: 1 })).toBe(true);
    expect(isSolverWorkerResponse({
      type: 'result',
      id: 2,
      result: { solved: true, moves: ["R'"], depth: 1 }
    })).toBe(true);
    expect(isSolverWorkerResponse({
      type: 'result',
      id: 3,
      result: { solved: false, reason: 'depth-limit' }
    })).toBe(true);
    expect(isSolverWorkerResponse({
      type: 'error',
      id: null,
      error: { name: 'Error', message: 'bad request' }
    })).toBe(true);

    expect(isSolverWorkerResponse({
      type: 'result',
      id: 2,
      result: { solved: true, moves: ['invalid'], depth: 1 }
    })).toBe(false);
    expect(isSolverWorkerResponse({ type: 'ready', id: 1, extra: true })).toBe(false);
  });

  it('serializes and restores standard error kinds', () => {
    for (const error of [
      new Error('invariant'),
      new RangeError('range'),
      new TypeError('type')
    ]) {
      const serialized = serializeWorkerError(error);
      const restored = deserializeWorkerError(serialized);

      expect(restored.name).toBe(error.name);
      expect(restored.message).toBe(error.message);
      expect(restored.stack).toBe(error.stack);
      if (error instanceof RangeError) expect(restored).toBeInstanceOf(RangeError);
      if (error instanceof TypeError) expect(restored).toBeInstanceOf(TypeError);
    }
  });

  it('serializes non-Error throws deterministically', () => {
    expect(serializeWorkerError('failure')).toEqual({
      name: 'Error',
      message: 'failure'
    });
  });
});
