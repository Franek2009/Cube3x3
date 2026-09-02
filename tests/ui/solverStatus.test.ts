import { describe, expect, it, vi } from 'vitest';

import {
  prewarmSolverForApp,
  type SolverUiState
} from '../../src/ui/solverStatus.ts';

function deferred(): {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
} {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('prewarmSolverForApp', () => {
  it('emits preparing immediately and calls prewarm exactly once', () => {
    const pending = deferred();
    const prewarm = vi.fn(() => pending.promise);
    const states: SolverUiState[] = [];

    void prewarmSolverForApp({ prewarm }, (state) => states.push(state));

    expect(states).toEqual(['preparing']);
    expect(prewarm).toHaveBeenCalledOnce();
  });

  it('transitions from preparing to ready after prewarm resolves', async () => {
    const states: SolverUiState[] = [];

    await prewarmSolverForApp(
      { prewarm: () => Promise.resolve() },
      (state) => states.push(state)
    );

    expect(states).toEqual(['preparing', 'ready']);
  });

  it('transitions from preparing to error and reports the original failure once', async () => {
    const error = new Error('worker unavailable');
    const states: SolverUiState[] = [];
    const reportError = vi.fn();

    await expect(prewarmSolverForApp(
      { prewarm: () => Promise.reject(error) },
      (state) => states.push(state),
      reportError
    )).resolves.toBeUndefined();

    expect(states).toEqual(['preparing', 'error']);
    expect(states).not.toContain('ready');
    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith(error);
  });

  it('remains preparing while prewarm is pending', async () => {
    const pending = deferred();
    const states: SolverUiState[] = [];
    const completion = prewarmSolverForApp(
      { prewarm: () => pending.promise },
      (state) => states.push(state)
    );

    await Promise.resolve();
    expect(states).toEqual(['preparing']);

    pending.resolve();
    await completion;
    expect(states).toEqual(['preparing', 'ready']);
  });
});
