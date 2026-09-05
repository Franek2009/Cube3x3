import { afterEach, describe, expect, it, vi } from 'vitest';
import { inverseMove, type Move } from '../../src/core/moves/moves.ts';
import { CubeSession } from '../../src/core/session/CubeSession.ts';
import type { SolveResult } from '../../src/core/solver/solver.ts';
import {
  SatisfactionRoomController,
  type SatisfactionRoomRenderer,
  type SatisfactionRoomSolver
} from '../../src/ui/satisfactionRoom/SatisfactionRoomController.ts';
import type { SatisfactionRoomStatus, SatisfactionRoomView } from '../../src/ui/satisfactionRoom/satisfactionRoomView.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flush(count = 12): Promise<void> {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
}

function createView() {
  const statuses: SatisfactionRoomStatus[] = [];
  const view: SatisfactionRoomView = {
    rendererContainer: {} as HTMLElement,
    setStatus: (status) => statuses.push(status),
    dispose: vi.fn()
  };
  return { view, statuses };
}

afterEach(() => vi.useRealTimers());

describe('SatisfactionRoomController', () => {
  it('animates scramble, solves its exact state, waits 1000 ms, then repeats', async () => {
    vi.useFakeTimers();
    const scramble = ['R', 'U'] as const;
    const views: ReturnType<typeof createView>[] = [];
    const animated: Move[] = [];
    const renderer: SatisfactionRoomRenderer = {
      renderState: vi.fn(),
      animateMove: async (move) => { animated.push(move); },
      dispose: vi.fn()
    };
    const solve = vi.fn(async (state): Promise<SolveResult> => ({
      solved: true,
      moves: Object.freeze([...scramble].reverse().map(inverseMove)),
      depth: 2
    }));
    const solver: SatisfactionRoomSolver = { solve, dispose: vi.fn() };
    const createScramble = vi.fn(() => scramble);
    const controller = new SatisfactionRoomController({
      createView: () => { const created = createView(); views.push(created); return created.view; },
      createSession: () => new CubeSession(),
      createRenderer: () => renderer,
      createSolver: () => solver,
      createScramble
    });

    controller.open();
    await flush();
    expect(animated).toEqual(['R', 'U', "U'", "R'"]);
    expect(solve).toHaveBeenCalledOnce();
    expect((solve.mock.calls[0]?.[0]).isSolved()).toBe(false);
    expect(controller.getState()).toBe('solved');
    expect(views[0]?.statuses).toEqual(['scrambling', 'solving', 'solved']);
    expect(createScramble).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(999);
    expect(createScramble).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(createScramble).toHaveBeenCalledTimes(2);
    controller.close();
  });

  it('cancels an active scramble animation and ignores its stale completion', async () => {
    const animation = deferred<void>();
    const created = createView();
    const renderer: SatisfactionRoomRenderer = {
      renderState: vi.fn(),
      animateMove: vi.fn(() => animation.promise),
      dispose: vi.fn(() => animation.resolve())
    };
    const solver: SatisfactionRoomSolver = { solve: vi.fn(), dispose: vi.fn() };
    const controller = new SatisfactionRoomController({
      createView: () => created.view,
      createSession: () => new CubeSession(),
      createRenderer: () => renderer,
      createSolver: () => solver,
      createScramble: () => ['R', 'U']
    });
    controller.open();
    controller.close();
    await flush();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(solver.dispose).toHaveBeenCalledOnce();
    expect(created.view.dispose).toHaveBeenCalledOnce();
    expect(solver.solve).not.toHaveBeenCalled();
    expect(controller.getState()).toBe('closed');
  });

  it('ignores a stale solver result after close and creates fresh resources on reopen', async () => {
    const firstPending = deferred<SolveResult>();
    const secondPending = deferred<SolveResult>();
    const solvers: SatisfactionRoomSolver[] = [];
    const sessions: CubeSession[] = [];
    const renderers: SatisfactionRoomRenderer[] = [];
    const views: SatisfactionRoomView[] = [];
    const controller = new SatisfactionRoomController({
      createView: () => { const view = createView().view; views.push(view); return view; },
      createSession: () => { const session = new CubeSession(); sessions.push(session); return session; },
      createRenderer: () => {
        const renderer = { renderState: vi.fn(), animateMove: vi.fn(() => Promise.resolve()), dispose: vi.fn() };
        renderers.push(renderer);
        return renderer;
      },
      createSolver: () => {
        const request = solvers.length === 0 ? firstPending : secondPending;
        const solver = { solve: vi.fn(() => request.promise), dispose: vi.fn() };
        solvers.push(solver);
        return solver;
      },
      createScramble: () => ['R']
    });
    controller.open();
    await flush();
    expect(controller.getState()).toBe('solving');
    controller.close();
    controller.open();
    await flush();
    expect(sessions).toHaveLength(2);
    expect(solvers).toHaveLength(2);
    expect(renderers).toHaveLength(2);
    expect(views).toHaveLength(2);
    firstPending.resolve({ solved: true, moves: Object.freeze(["R'"]), depth: 1 });
    await flush();
    expect(controller.getState()).toBe('solving');
    expect(renderers[1]?.animateMove).toHaveBeenCalledTimes(1);
    controller.close();
    secondPending.resolve({ solved: true, moves: Object.freeze(["R'"]), depth: 1 });
    await flush();
  });

  it('ignores a stale solver rejection after close', async () => {
    const pending = deferred<SolveResult>();
    const reportError = vi.fn();
    const renderer: SatisfactionRoomRenderer = {
      renderState: vi.fn(),
      animateMove: vi.fn(() => Promise.resolve()),
      dispose: vi.fn()
    };
    const controller = new SatisfactionRoomController({
      createView: () => createView().view,
      createSession: () => new CubeSession(),
      createRenderer: () => renderer,
      createSolver: () => ({ solve: vi.fn(() => pending.promise), dispose: vi.fn() }),
      createScramble: () => ['R'],
      reportError
    });
    controller.open();
    await flush();
    controller.close();
    pending.reject(new Error('stale solver failure'));
    await flush();
    expect(reportError).not.toHaveBeenCalled();
    expect(renderer.animateMove).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toBe('closed');
  });

  it('reports current solver failures without retrying', async () => {
    vi.useFakeTimers();
    const error = new Error('solver failed');
    const reportError = vi.fn();
    const created = createView();
    const controller = new SatisfactionRoomController({
      createView: () => created.view,
      createSession: () => new CubeSession(),
      createRenderer: () => ({ renderState: vi.fn(), animateMove: vi.fn(() => Promise.resolve()), dispose: vi.fn() }),
      createSolver: () => ({ solve: vi.fn(() => Promise.reject(error)), dispose: vi.fn() }),
      createScramble: () => ['R'],
      reportError
    });
    controller.open();
    await flush();
    expect(controller.getState()).toBe('error');
    expect(created.statuses.at(-1)).toBe('error');
    expect(reportError).toHaveBeenCalledWith(error);
    await vi.advanceTimersByTimeAsync(5000);
    expect(created.statuses.filter((status) => status === 'scrambling')).toHaveLength(1);
    controller.close();
  });

  it('cancels a real solved delay without starting another cycle', async () => {
    vi.useFakeTimers();
    const createScramble = vi.fn(() => ['R'] as const);
    const controller = new SatisfactionRoomController({
      createView: () => createView().view,
      createSession: () => new CubeSession(),
      createRenderer: () => ({ renderState: vi.fn(), animateMove: vi.fn(() => Promise.resolve()), dispose: vi.fn() }),
      createSolver: () => ({
        solve: vi.fn(async (): Promise<SolveResult> => ({
          solved: true, moves: Object.freeze(["R'"]), depth: 1
        })),
        dispose: vi.fn()
      }),
      createScramble
    });
    controller.open();
    await flush();
    expect(controller.getState()).toBe('solved');
    controller.close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(createScramble).toHaveBeenCalledOnce();
    expect(controller.getState()).toBe('closed');
  });

  it('does not continue solution playback after close during a solution animation', async () => {
    const solutionAnimation = deferred<void>();
    const animateMove = vi.fn((move: Move) => move === "R'" ? solutionAnimation.promise : Promise.resolve());
    const renderer: SatisfactionRoomRenderer = {
      renderState: vi.fn(),
      animateMove,
      dispose: vi.fn(() => solutionAnimation.resolve())
    };
    const controller = new SatisfactionRoomController({
      createView: () => createView().view,
      createSession: () => new CubeSession(),
      createRenderer: () => renderer,
      createSolver: () => ({
        solve: vi.fn(async (): Promise<SolveResult> => ({
          solved: true, moves: Object.freeze(["R'", 'U']), depth: 2
        })),
        dispose: vi.fn()
      }),
      createScramble: () => ['R']
    });
    controller.open();
    await flush();
    expect(animateMove.mock.calls.map(([move]) => move)).toEqual(['R', "R'"]);
    controller.close();
    await flush();
    expect(animateMove.mock.calls.map(([move]) => move)).toEqual(['R', "R'"]);
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(controller.getState()).toBe('closed');
  });

  it('turns an animation rejection into a controlled room error', async () => {
    const error = new Error('animation failed');
    const reportError = vi.fn();
    const createScramble = vi.fn(() => ['R'] as const);
    const controller = new SatisfactionRoomController({
      createView: () => createView().view,
      createSession: () => new CubeSession(),
      createRenderer: () => ({ renderState: vi.fn(), animateMove: vi.fn(() => Promise.reject(error)), dispose: vi.fn() }),
      createSolver: () => ({ solve: vi.fn(), dispose: vi.fn() }),
      createScramble,
      reportError
    });
    controller.open();
    await flush();
    expect(controller.getState()).toBe('error');
    expect(reportError).toHaveBeenCalledWith(error);
    expect(createScramble).toHaveBeenCalledOnce();
    controller.close();
  });

  it('turns a non-solved solver result into a controlled room error', async () => {
    const reportError = vi.fn();
    const createScramble = vi.fn(() => ['R'] as const);
    const controller = new SatisfactionRoomController({
      createView: () => createView().view,
      createSession: () => new CubeSession(),
      createRenderer: () => ({ renderState: vi.fn(), animateMove: vi.fn(() => Promise.resolve()), dispose: vi.fn() }),
      createSolver: () => ({
        solve: vi.fn(async (): Promise<SolveResult> => ({ solved: false, reason: 'depth-limit' })),
        dispose: vi.fn()
      }),
      createScramble,
      reportError
    });
    controller.open();
    await flush();
    expect(controller.getState()).toBe('error');
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Solver did not solve the room cube: depth-limit'
    }));
    expect(createScramble).toHaveBeenCalledOnce();
    controller.close();
  });

  it('contains view creation failures and remains closed', () => {
    const error = new Error('view failed');
    const reportError = vi.fn();
    const controller = new SatisfactionRoomController({
      createView: () => { throw error; },
      reportError
    });
    expect(() => controller.open()).not.toThrow();
    expect(controller.isOpen()).toBe(false);
    expect(controller.getState()).toBe('closed');
    expect(reportError).toHaveBeenCalledWith(error);
  });

  it('cleans initialized view and renderer when solver construction fails', () => {
    const error = new Error('worker construction failed');
    const reportError = vi.fn();
    const created = createView();
    const renderer: SatisfactionRoomRenderer = {
      renderState: vi.fn(),
      animateMove: vi.fn(),
      dispose: vi.fn()
    };
    const controller = new SatisfactionRoomController({
      createView: () => created.view,
      createRenderer: () => renderer,
      createSolver: () => { throw error; },
      reportError
    });
    expect(() => controller.open()).not.toThrow();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(created.view.dispose).toHaveBeenCalledOnce();
    expect(controller.isOpen()).toBe(false);
    expect(reportError).toHaveBeenCalledWith(error);
  });
});
