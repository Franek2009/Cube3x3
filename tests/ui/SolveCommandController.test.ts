import { describe, expect, it, vi } from 'vitest';

import { solvedState, type CubeState } from '../../src/core/cube/CubeState.ts';
import type { SolveResult } from '../../src/core/solver/solver.ts';
import {
  SolveCommandController,
  type AsyncSolverClient
} from '../../src/ui/SolveCommandController.ts';
import type { SolverUiState } from '../../src/ui/solverStatus.ts';

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createHarness(client: AsyncSolverClient) {
  const states: SolverUiState[] = [];
  const results: Array<SolveResult | undefined> = [];
  const reportError = vi.fn();
  const controller = new SolveCommandController(client, {
    onStateChange: (state) => states.push(state),
    onResultChange: (result) => results.push(result),
    reportError
  });

  return { controller, states, results, reportError };
}

describe('SolveCommandController', () => {
  it('solves the exact snapshot and accepts the current result', async () => {
    const snapshot = solvedState().applyMove('R');
    const solution: SolveResult = {
      solved: true,
      moves: Object.freeze(["R'"]),
      depth: 1
    };
    const solve = vi.fn((_state: CubeState) => Promise.resolve(solution));
    const harness = createHarness({ solve });
    harness.controller.setServiceState('ready');

    await harness.controller.solve(snapshot);

    expect(solve).toHaveBeenCalledOnce();
    expect(solve).toHaveBeenCalledWith(snapshot);
    expect(harness.states).toEqual(['ready', 'solving', 'ready']);
    expect(harness.results).toEqual([undefined, solution]);
    expect(harness.controller.getCurrentSolution()).toBe(solution.moves);
  });

  it('does not start requests while preparing, solving, or unavailable', async () => {
    const pending = deferred<SolveResult>();
    const solve = vi.fn(() => pending.promise);
    const harness = createHarness({ solve });

    await harness.controller.solve(solvedState());
    harness.controller.setServiceState('error');
    await harness.controller.solve(solvedState());
    harness.controller.setServiceState('ready');
    const active = harness.controller.solve(solvedState());
    await harness.controller.solve(solvedState());

    expect(solve).toHaveBeenCalledOnce();
    pending.resolve({ solved: true, moves: Object.freeze([]), depth: 0 });
    await active;
  });

  it.each([
    { solved: false as const, reason: 'depth-limit' as const },
    {
      solved: false as const,
      reason: 'invalid-state' as const,
      validationError: 'permutation-parity-mismatch' as const
    }
  ])('handles $reason as a normal result', async (result) => {
    const harness = createHarness({ solve: () => Promise.resolve(result) });
    harness.controller.setServiceState('ready');

    await expect(harness.controller.solve(solvedState())).resolves.toBeUndefined();

    expect(harness.results.at(-1)).toEqual(result);
    expect(harness.states.at(-1)).toBe('ready');
    expect(harness.controller.getCurrentSolution()).toBeUndefined();
    expect(harness.reportError).not.toHaveBeenCalled();
  });

  it('keeps the accepted empty solution for an already solved cube', async () => {
    const moves = Object.freeze([]);
    const harness = createHarness({
      solve: () => Promise.resolve({ solved: true, moves, depth: 0 })
    });
    harness.controller.setServiceState('ready');

    await harness.controller.solve(solvedState());

    expect(harness.controller.getCurrentSolution()).toBe(moves);
  });

  it('turns a current rejection into unavailable without propagating it', async () => {
    const error = new Error('worker crashed');
    const harness = createHarness({ solve: () => Promise.reject(error) });
    harness.controller.setServiceState('ready');

    await expect(harness.controller.solve(solvedState())).resolves.toBeUndefined();

    expect(harness.states.at(-1)).toBe('error');
    expect(harness.results.at(-1)).toBeUndefined();
    expect(harness.reportError).toHaveBeenCalledOnce();
    expect(harness.reportError).toHaveBeenCalledWith(error);
  });

  it('immediately invalidates a pending request and ignores its eventual result', async () => {
    const pending = deferred<SolveResult>();
    const harness = createHarness({ solve: () => pending.promise });
    harness.controller.setServiceState('ready');
    const completion = harness.controller.solve(solvedState().applyMove('R'));

    harness.controller.invalidateCubeState();
    expect(harness.states.at(-1)).toBe('ready');
    expect(harness.results.at(-1)).toBeUndefined();

    pending.resolve({ solved: true, moves: Object.freeze(["R'"]), depth: 1 });
    await completion;

    expect(harness.states.at(-1)).toBe('ready');
    expect(harness.results.at(-1)).toBeUndefined();
    expect(harness.controller.getCurrentSolution()).toBeUndefined();
  });

  it('ignores a stale rejection after cube invalidation', async () => {
    const pending = deferred<SolveResult>();
    const harness = createHarness({ solve: () => pending.promise });
    harness.controller.setServiceState('ready');
    const completion = harness.controller.solve(solvedState());

    harness.controller.invalidateCubeState();
    pending.reject(new Error('old failure'));
    await completion;

    expect(harness.states.at(-1)).toBe('ready');
    expect(harness.reportError).not.toHaveBeenCalled();
  });

  it('prevents an old request from overwriting a newer request or solution', async () => {
    const first = deferred<SolveResult>();
    const second = deferred<SolveResult>();
    const solve = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const harness = createHarness({ solve });
    harness.controller.setServiceState('ready');
    const firstCompletion = harness.controller.solve(solvedState().applyMove('R'));
    harness.controller.invalidateCubeState();
    const secondCompletion = harness.controller.solve(solvedState().applyMove('U'));

    first.resolve({ solved: true, moves: Object.freeze(["R'"]), depth: 1 });
    await firstCompletion;
    expect(harness.states.at(-1)).toBe('solving');
    expect(harness.controller.getCurrentSolution()).toBeUndefined();

    const currentMoves = Object.freeze(["U'"] as const);
    second.resolve({ solved: true, moves: currentMoves, depth: 1 });
    await secondCompletion;
    expect(harness.states.at(-1)).toBe('ready');
    expect(harness.controller.getCurrentSolution()).toBe(currentMoves);
    expect(harness.results.at(-1)).toEqual({
      solved: true,
      moves: currentMoves,
      depth: 1
    });
  });

  it('clears an accepted solution when the cube changes', async () => {
    const moves = Object.freeze(["R'"] as const);
    const harness = createHarness({
      solve: () => Promise.resolve({ solved: true, moves, depth: 1 })
    });
    harness.controller.setServiceState('ready');
    await harness.controller.solve(solvedState().applyMove('R'));

    harness.controller.invalidateCubeState();

    expect(harness.controller.getCurrentSolution()).toBeUndefined();
    expect(harness.results.at(-1)).toBeUndefined();
    expect(harness.states.at(-1)).toBe('ready');
  });
});
