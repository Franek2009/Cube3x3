import { solvedState, type CubeState } from '../cube/CubeState.ts';
import type { Move } from '../moves/moves.ts';

export class CubeSession {
  #state: CubeState;
  readonly #moveHistory: Move[] = [];

  constructor(initialState: CubeState = solvedState()) {
    this.#state = initialState;
  }

  getState(): CubeState {
    return this.#state;
  }

  getMoveHistory(): Move[] {
    return [...this.#moveHistory];
  }

  applyMove(move: Move): CubeState {
    this.#state = this.#state.applyMove(move);
    this.#moveHistory.push(move);

    return this.#state;
  }

  applyMoves(moves: readonly Move[]): CubeState {
    this.#state = this.#state.applyMoves(moves);
    this.#moveHistory.push(...moves);

    return this.#state;
  }

  applyScramble(moves: readonly Move[]): CubeState {
    this.#state = this.#state.applyMoves(moves);

    return this.#state;
  }

  reset(): CubeState {
    this.#state = solvedState();
    this.#moveHistory.length = 0;

    return this.#state;
  }

  isSolved(): boolean {
    return this.#state.isSolved();
  }
}
