import { describe, expect, it, vi } from 'vitest';

import { CubeState, solvedState } from '../../src/core/cube/CubeState.ts';
import { handleSolverWorkerRequest } from '../../src/core/solver/solverWorkerHandler.ts';
import {
  cubeStateToData,
  type CubeStateData
} from '../../src/core/solver/solverWorkerProtocol.ts';

describe('solver worker request handler', () => {
  it('initializes dependencies and returns ready', () => {
    const initialize = vi.fn();
    const solve = vi.fn();

    expect(handleSolverWorkerRequest(
      { type: 'init', id: 7 },
      { initialize, solve }
    )).toEqual({ type: 'ready', id: 7 });
    expect(initialize).toHaveBeenCalledOnce();
    expect(solve).not.toHaveBeenCalled();
  });

  it('supports repeated idempotent init requests', () => {
    const initialize = vi.fn();
    const dependencies = { initialize, solve: vi.fn() };

    expect(handleSolverWorkerRequest({ type: 'init', id: 1 }, dependencies).type)
      .toBe('ready');
    expect(handleSolverWorkerRequest({ type: 'init', id: 2 }, dependencies).type)
      .toBe('ready');
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it('passes copied state data and options to solve', () => {
    const state = cubeStateToData(solvedState().applyMove('R'));
    const solve = vi.fn((_state: CubeStateData) => ({
      solved: false as const,
      reason: 'depth-limit' as const
    }));

    const response = handleSolverWorkerRequest(
      { type: 'solve', id: 4, state, options: { maxDepth: 0 } },
      { initialize: vi.fn(), solve }
    );

    expect(response).toEqual({
      type: 'result',
      id: 4,
      result: { solved: false, reason: 'depth-limit' }
    });
    expect(solve).toHaveBeenCalledWith(state, { maxDepth: 0 });
  });

  it('keeps invalid-state as a normal result response', () => {
    const result = {
      solved: false as const,
      reason: 'invalid-state' as const,
      validationError: 'invalid-edge-orientation-sum' as const
    };
    const response = handleSolverWorkerRequest(
      { type: 'solve', id: 5, state: cubeStateToData(solvedState()) },
      { initialize: vi.fn(), solve: () => result }
    );

    expect(response).toEqual({ type: 'result', id: 5, result });
  });

  it('serializes solve and initialization exceptions', () => {
    const solveResponse = handleSolverWorkerRequest(
      { type: 'solve', id: 8, state: cubeStateToData(solvedState()) },
      {
        initialize: vi.fn(),
        solve: () => { throw new RangeError('invalid depth'); }
      }
    );
    const initResponse = handleSolverWorkerRequest(
      { type: 'init', id: 9 },
      {
        initialize: () => { throw new Error('table failure'); },
        solve: vi.fn()
      }
    );

    expect(solveResponse).toMatchObject({
      type: 'error',
      id: 8,
      error: { name: 'RangeError', message: 'invalid depth' }
    });
    expect(initResponse).toMatchObject({
      type: 'error',
      id: 9,
      error: { name: 'Error', message: 'table failure' }
    });
  });

  it('correlates malformed requests when possible', () => {
    expect(handleSolverWorkerRequest({ type: 'unknown', id: 12 })).toMatchObject({
      type: 'error',
      id: 12,
      error: { name: 'TypeError', message: 'Invalid solver worker request' }
    });
    expect(handleSolverWorkerRequest({ type: 'unknown', id: 0 })).toMatchObject({
      type: 'error',
      id: null
    });
  });

  it('integrates with solveCube for solved and invalid states without table generation', () => {
    expect(handleSolverWorkerRequest({
      type: 'solve',
      id: 20,
      state: cubeStateToData(solvedState()),
      options: { maxDepth: 0 }
    })).toEqual({
      type: 'result',
      id: 20,
      result: { solved: true, moves: [], depth: 0 }
    });

    const invalid = new CubeState(
      [0, 1, 2, 3, 4, 5, 6, 7],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    );
    expect(handleSolverWorkerRequest({
      type: 'solve',
      id: 21,
      state: cubeStateToData(invalid)
    })).toEqual({
      type: 'result',
      id: 21,
      result: {
        solved: false,
        reason: 'invalid-state',
        validationError: 'invalid-edge-orientation-sum'
      }
    });
  });

  it('serializes the real maxDepth RangeError', () => {
    expect(handleSolverWorkerRequest({
      type: 'solve',
      id: 22,
      state: cubeStateToData(solvedState()),
      options: { maxDepth: Number.NaN }
    })).toMatchObject({
      type: 'error',
      id: 22,
      error: {
        name: 'RangeError',
        message: 'maxDepth must be a finite non-negative integer'
      }
    });
  });
});
