import { describe, expect, it, vi } from 'vitest';

import { inverseMove, type Move } from '../../src/core/moves/moves.ts';
import { CubeSession } from '../../src/core/session/CubeSession.ts';
import { createAnimationTransitionSettlement } from '../../src/ui/animationTransition.ts';
import {
  SolutionPlaybackController,
  type SolutionPlaybackDependencies,
  type SolutionPlaybackState
} from '../../src/ui/SolutionPlaybackController.ts';

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

function createHarness(applyMove: SolutionPlaybackDependencies['applyMove']) {
  const states: SolutionPlaybackState[] = [];
  const onComplete = vi.fn();
  const reportError = vi.fn();
  const controller = new SolutionPlaybackController({
    applyMove,
    onStateChange: (state) => states.push(state),
    onComplete,
    reportError
  });

  return { controller, states, onComplete, reportError };
}

describe('SolutionPlaybackController', () => {
  it('plays moves in order and waits for each animation', async () => {
    const first = deferred();
    const second = deferred();
    const applyMove = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockResolvedValueOnce(undefined);
    const harness = createHarness(applyMove);
    const completion = harness.controller.play(['R', 'U', 'F']);

    expect(applyMove.mock.calls).toEqual([['R']]);
    first.resolve();
    await Promise.resolve();
    expect(applyMove.mock.calls).toEqual([['R'], ['U']]);
    second.resolve();
    await completion;

    expect(applyMove.mock.calls).toEqual([['R'], ['U'], ['F']]);
    expect(harness.states).toEqual(['playing', 'idle']);
    expect(harness.onComplete).toHaveBeenCalledOnce();
  });

  it.each([undefined, [] as readonly Move[]])('does not start without playable moves', async (solution) => {
    const applyMove = vi.fn(() => Promise.resolve());
    const harness = createHarness(applyMove);

    await expect(harness.controller.play(solution)).resolves.toBe(false);

    expect(applyMove).not.toHaveBeenCalled();
    expect(harness.states).toEqual([]);
  });

  it('does not overlap a second playback', async () => {
    const pending = deferred();
    const applyMove = vi.fn(() => pending.promise);
    const harness = createHarness(applyMove);
    const first = harness.controller.play(['R']);

    await expect(harness.controller.play(['U'])).resolves.toBe(false);
    pending.resolve();
    await first;

    expect(applyMove).toHaveBeenCalledOnce();
    expect(applyMove).toHaveBeenCalledWith('R');
  });

  it.each(['manual move', 'reset', 'new scramble'])('stops future moves after %s cancellation', async () => {
    const pending = deferred();
    const applyMove = vi.fn(() => pending.promise);
    const harness = createHarness(applyMove);
    const completion = harness.controller.play(['R', 'U']);

    harness.controller.cancel();
    pending.resolve();
    await expect(completion).resolves.toBe(false);

    expect(applyMove).toHaveBeenCalledOnce();
    expect(harness.controller.getState()).toBe('idle');
    expect(harness.onComplete).not.toHaveBeenCalled();
  });

  it('does not report a stale animation rejection after cancellation', async () => {
    const pending = deferred();
    const harness = createHarness(() => pending.promise);
    const completion = harness.controller.play(['R', 'U']);

    harness.controller.cancel();
    pending.reject(new Error('cancelled animation'));
    await completion;

    expect(harness.reportError).not.toHaveBeenCalled();
    expect(harness.states).toEqual(['playing', 'idle']);
  });

  it('settles an active cancelled transition and ignores its later renderer outcome', async () => {
    const transition = createAnimationTransitionSettlement();
    const applyMove = vi.fn(() => transition.promise);
    const harness = createHarness(applyMove);
    const completion = harness.controller.play(['R', 'U']);

    harness.controller.cancel();
    transition.cancel();
    await expect(completion).resolves.toBe(false);

    transition.complete();
    transition.fail(new Error('late renderer rejection'));
    await Promise.resolve();

    expect(applyMove.mock.calls).toEqual([['R']]);
    expect(harness.controller.getState()).toBe('idle');
    expect(harness.reportError).not.toHaveBeenCalled();
  });

  it('uses a private snapshot of the solution', async () => {
    const source: Move[] = ['R', 'U'];
    const played: Move[] = [];
    const harness = createHarness(async (move) => {
      played.push(move);
      if (move === 'R') source.splice(0);
    });

    await harness.controller.play(source);

    expect(played).toEqual(['R', 'U']);
  });

  it('returns to idle and reports a current playback error', async () => {
    const error = new Error('animation failed');
    const harness = createHarness(() => Promise.reject(error));

    await expect(harness.controller.play(['R'])).resolves.toBe(false);

    expect(harness.controller.getState()).toBe('idle');
    expect(harness.states).toEqual(['playing', 'idle']);
    expect(harness.reportError).toHaveBeenCalledOnce();
    expect(harness.reportError).toHaveBeenCalledWith(error);
    expect(harness.onComplete).not.toHaveBeenCalled();
  });

  it('solves a cube without adding playback moves to user history', async () => {
    const scramble = ['R', 'U', 'F2'] as const;
    const session = new CubeSession();
    session.applyScramble(scramble);
    const harness = createHarness(async (move) => {
      session.applyMove(move, { recordHistory: false });
    });

    const solution = [...scramble].reverse().map(inverseMove);
    await harness.controller.play(solution);

    expect(session.isSolved()).toBe(true);
    expect(session.getMoveHistory()).toEqual([]);
    expect(harness.onComplete).toHaveBeenCalledOnce();
  });
});
