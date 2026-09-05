import type { Move } from '../core/moves/moves.ts';

export type SolutionPlaybackState = 'idle' | 'playing';

export interface SolutionPlaybackDependencies {
  readonly applyMove: (move: Move) => Promise<void>;
  readonly onStateChange: (state: SolutionPlaybackState) => void;
  readonly onComplete: () => void;
  readonly reportError: (error: unknown) => void;
}

export class SolutionPlaybackController {
  readonly #dependencies: SolutionPlaybackDependencies;
  #state: SolutionPlaybackState = 'idle';
  #generation = 0;

  constructor(dependencies: SolutionPlaybackDependencies) {
    this.#dependencies = dependencies;
  }

  getState(): SolutionPlaybackState {
    return this.#state;
  }

  async play(solution: readonly Move[] | undefined): Promise<boolean> {
    if (this.#state === 'playing' || solution === undefined || solution.length === 0) {
      return false;
    }

    const moves = Object.freeze([...solution]);
    const generation = ++this.#generation;
    this.#setState('playing');

    try {
      for (const move of moves) {
        if (generation !== this.#generation) return false;
        await this.#dependencies.applyMove(move);
        if (generation !== this.#generation) return false;
      }

      this.#setState('idle');
      this.#dependencies.onComplete();
      return true;
    } catch (error) {
      if (generation !== this.#generation) return false;

      this.#setState('idle');
      this.#dependencies.reportError(error);
      return false;
    }
  }

  cancel(): void {
    this.#generation += 1;
    if (this.#state === 'playing') {
      this.#setState('idle');
    }
  }

  #setState(state: SolutionPlaybackState): void {
    this.#state = state;
    this.#dependencies.onStateChange(state);
  }
}
