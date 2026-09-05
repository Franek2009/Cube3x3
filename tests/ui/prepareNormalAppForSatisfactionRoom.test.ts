import { describe, expect, it, vi } from 'vitest';
import { CubeSession } from '../../src/core/session/CubeSession.ts';
import type { SolveResult } from '../../src/core/solver/solver.ts';
import { rotateCubeOrientation, createDefaultCubeOrientation } from '../../src/core/orientation/cubeOrientation.ts';
import { prepareNormalAppForSatisfactionRoom } from '../../src/ui/satisfactionRoom/prepareNormalAppForSatisfactionRoom.ts';
import { SolveCommandController } from '../../src/ui/SolveCommandController.ts';
import { SolutionPlaybackController } from '../../src/ui/SolutionPlaybackController.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe('prepareNormalAppForSatisfactionRoom', () => {
  it('invalidates normal playback, solve, and transitions without resetting user state', async () => {
    const session = new CubeSession();
    session.applyMove('R');
    const orientation = rotateCubeOrientation(createDefaultCubeOrientation(), 'y');
    const playbackStep = deferred<void>();
    const applyPlaybackMove = vi.fn(() => playbackStep.promise);
    const playback = new SolutionPlaybackController({
      applyMove: applyPlaybackMove,
      onStateChange: vi.fn(),
      onComplete: vi.fn(),
      reportError: vi.fn()
    });
    const playbackPromise = playback.play(['U', 'F']);

    const solveRequest = deferred<SolveResult>();
    const onResultChange = vi.fn();
    const solver = new SolveCommandController(
      { solve: vi.fn(() => solveRequest.promise) },
      { onStateChange: vi.fn(), onResultChange, reportError: vi.fn() }
    );
    solver.setServiceState('ready');
    const solvePromise = solver.solve(session.getState());
    const stateBeforeEntry = session.getState();
    const historyBeforeEntry = session.getMoveHistory();
    const cancelTransitions = vi.fn();
    const synchronizeRenderer = vi.fn();

    prepareNormalAppForSatisfactionRoom({
      cancelPlayback: () => playback.cancel(),
      cancelVisualTransitions: cancelTransitions,
      invalidateSolver: () => solver.invalidateCubeState(),
      synchronizeRenderer
    });

    playbackStep.resolve();
    solveRequest.resolve({ solved: true, moves: Object.freeze(["R'"]), depth: 1 });
    await Promise.all([playbackPromise, solvePromise]);
    await flush();

    expect(playback.getState()).toBe('idle');
    expect(applyPlaybackMove).toHaveBeenCalledTimes(1);
    expect(cancelTransitions).toHaveBeenCalledOnce();
    expect(synchronizeRenderer).toHaveBeenCalledOnce();
    expect(solver.getCurrentSolution()).toBeUndefined();
    expect(onResultChange).not.toHaveBeenCalledWith(expect.objectContaining({ solved: true }));
    expect(session.getState()).toBe(stateBeforeEntry);
    expect(session.getMoveHistory()).toEqual(historyBeforeEntry);
    expect(orientation).toEqual(rotateCubeOrientation(createDefaultCubeOrientation(), 'y'));
  });
});
