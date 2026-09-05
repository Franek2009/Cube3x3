import { solvedState, type CubeState } from '../../core/cube/CubeState.ts';
import type { Move } from '../../core/moves/moves.ts';
import { createDefaultCubeOrientation } from '../../core/orientation/cubeOrientation.ts';
import { generateScramble } from '../../core/scramble/scrambler.ts';
import { CubeSession } from '../../core/session/CubeSession.ts';
import { SolverClient } from '../../core/solver/SolverClient.ts';
import type { SolveResult } from '../../core/solver/solver.ts';
import { CubeRenderer } from '../../renderer/CubeRenderer.ts';
import {
  createSatisfactionRoomView,
  type SatisfactionRoomStatus,
  type SatisfactionRoomView
} from './satisfactionRoomView.ts';

export type SatisfactionRoomState = 'closed' | SatisfactionRoomStatus;

export interface SatisfactionRoomSession {
  getState(): CubeState;
  applyMove(move: Move, options?: { readonly recordHistory?: boolean }): CubeState;
  isSolved(): boolean;
}

export interface SatisfactionRoomRenderer {
  renderState(state: CubeState, orientation: ReturnType<typeof createDefaultCubeOrientation>): void;
  animateMove(
    move: Move,
    fromState: CubeState,
    toState: CubeState,
    orientation: ReturnType<typeof createDefaultCubeOrientation>
  ): Promise<void>;
  dispose(): void;
}

export interface SatisfactionRoomSolver {
  solve(state: CubeState): Promise<SolveResult>;
  dispose(): void;
}

interface RoomResources {
  readonly session: SatisfactionRoomSession;
  readonly renderer: SatisfactionRoomRenderer;
  readonly solver: SatisfactionRoomSolver;
  readonly view: SatisfactionRoomView;
}

export interface SatisfactionRoomControllerOptions {
  readonly createView?: () => SatisfactionRoomView;
  readonly createSession?: () => SatisfactionRoomSession;
  readonly createRenderer?: (container: HTMLElement) => SatisfactionRoomRenderer;
  readonly createSolver?: () => SatisfactionRoomSolver;
  readonly createScramble?: () => readonly Move[];
  readonly reportError?: (error: unknown) => void;
}

export class SatisfactionRoomController {
  readonly #options: Required<SatisfactionRoomControllerOptions>;
  #state: SatisfactionRoomState = 'closed';
  #generation = 0;
  #resources: RoomResources | undefined;
  #delayId: ReturnType<typeof setTimeout> | undefined;
  #resolveDelay: (() => void) | undefined;
  #disposed = false;

  constructor(options: SatisfactionRoomControllerOptions = {}) {
    this.#options = {
      createView: options.createView ?? (() => createSatisfactionRoomView()),
      createSession: options.createSession ?? (() => new CubeSession()),
      createRenderer: options.createRenderer ?? ((container) => new CubeRenderer(container)),
      createSolver: options.createSolver ?? (() => new SolverClient()),
      createScramble: options.createScramble ?? (() => generateScramble()),
      reportError: options.reportError ?? ((error) => console.error('Satisfaction Room failed', error))
    };
  }

  open(): void {
    if (this.#disposed || this.#resources !== undefined) return;
    let view: SatisfactionRoomView | undefined;
    let renderer: SatisfactionRoomRenderer | undefined;
    let solver: SatisfactionRoomSolver | undefined;
    try {
      view = this.#options.createView();
      const session = this.#options.createSession();
      renderer = this.#options.createRenderer(view.rendererContainer);
      solver = this.#options.createSolver();
      const resources = { session, renderer, solver, view };
      this.#resources = resources;
      const generation = ++this.#generation;
      renderer.renderState(solvedState(), createDefaultCubeOrientation());
      void this.#runLoop(generation, resources);
    } catch (error) {
      try { solver?.dispose(); } catch (disposeError) { this.#options.reportError(disposeError); }
      try { renderer?.dispose(); } catch (disposeError) { this.#options.reportError(disposeError); }
      try { view?.dispose(); } catch (disposeError) { this.#options.reportError(disposeError); }
      this.#resources = undefined;
      this.#state = 'closed';
      this.#options.reportError(error);
    }
  }

  close(): void {
    const resources = this.#resources;
    if (resources === undefined) return;
    this.#generation += 1;
    this.#cancelDelay();
    this.#resources = undefined;
    this.#state = 'closed';
    resources.solver.dispose();
    resources.renderer.dispose();
    resources.view.dispose();
  }

  toggle(): void {
    if (this.isOpen()) this.close();
    else this.open();
  }

  isOpen(): boolean {
    return this.#resources !== undefined;
  }

  getState(): SatisfactionRoomState {
    return this.#state;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.close();
    this.#disposed = true;
  }

  async #runLoop(generation: number, resources: RoomResources): Promise<void> {
    try {
      while (this.#isCurrent(generation, resources)) {
        this.#setStatus('scrambling', resources);
        for (const move of this.#options.createScramble()) {
          if (!this.#isCurrent(generation, resources)) return;
          await this.#applyAnimatedMove(move, resources);
        }
        if (!this.#isCurrent(generation, resources)) return;

        this.#setStatus('solving', resources);
        const result = await resources.solver.solve(resources.session.getState());
        if (!this.#isCurrent(generation, resources)) return;
        if (!result.solved) throw new Error(`Solver did not solve the room cube: ${result.reason}`);

        for (const move of result.moves) {
          if (!this.#isCurrent(generation, resources)) return;
          await this.#applyAnimatedMove(move, resources);
        }
        if (!this.#isCurrent(generation, resources)) return;
        if (!resources.session.isSolved()) {
          throw new Error('Satisfaction Room solution did not solve the cube');
        }

        this.#setStatus('solved', resources);
        await this.#waitAfterSolved();
      }
    } catch (error) {
      if (!this.#isCurrent(generation, resources)) return;
      this.#setStatus('error', resources);
      this.#options.reportError(error);
    }
  }

  async #applyAnimatedMove(move: Move, resources: RoomResources): Promise<void> {
    const fromState = resources.session.getState();
    const toState = resources.session.applyMove(move, { recordHistory: false });
    await resources.renderer.animateMove(
      move,
      fromState,
      toState,
      createDefaultCubeOrientation()
    );
  }

  #setStatus(status: SatisfactionRoomStatus, resources: RoomResources): void {
    this.#state = status;
    resources.view.setStatus(status);
  }

  #isCurrent(generation: number, resources: RoomResources): boolean {
    return this.#generation === generation && this.#resources === resources;
  }

  #waitAfterSolved(): Promise<void> {
    return new Promise((resolve) => {
      this.#resolveDelay = resolve;
      this.#delayId = setTimeout(() => {
        this.#delayId = undefined;
        this.#resolveDelay = undefined;
        resolve();
      }, 1000);
    });
  }

  #cancelDelay(): void {
    if (this.#delayId !== undefined) clearTimeout(this.#delayId);
    this.#delayId = undefined;
    const resolve = this.#resolveDelay;
    this.#resolveDelay = undefined;
    resolve?.();
  }
}
