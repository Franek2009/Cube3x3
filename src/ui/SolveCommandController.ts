import type { CubeState } from '../core/cube/CubeState.ts';
import type { Move } from '../core/moves/moves.ts';
import type { SolveResult } from '../core/solver/solver.ts';
import type { SolverServiceUiState, SolverUiState } from './solverStatus.ts';

export interface AsyncSolverClient {
  solve(state: CubeState): Promise<SolveResult>;
}

export interface SolveCommandCallbacks {
  readonly onStateChange: (state: SolverUiState) => void;
  readonly onResultChange: (result: SolveResult | undefined) => void;
  readonly reportError: (error: unknown) => void;
}

export class SolveCommandController {
  readonly #client: AsyncSolverClient;
  readonly #callbacks: SolveCommandCallbacks;
  #state: SolverUiState = 'preparing';
  #cubeGeneration = 0;
  #nextRequestId = 0;
  #activeRequestId: number | undefined;
  #currentSolution: readonly Move[] | undefined;

  constructor(client: AsyncSolverClient, callbacks: SolveCommandCallbacks) {
    this.#client = client;
    this.#callbacks = callbacks;
  }

  setServiceState(state: SolverServiceUiState): void {
    this.#state = state;
    this.#callbacks.onStateChange(state);
  }

  async solve(snapshot: CubeState): Promise<void> {
    if (this.#state !== 'ready') return;

    const requestId = ++this.#nextRequestId;
    const solveGeneration = this.#cubeGeneration;
    this.#activeRequestId = requestId;
    this.#currentSolution = undefined;
    this.#callbacks.onResultChange(undefined);
    this.#setState('solving');

    try {
      const result = await this.#client.solve(snapshot);

      if (!this.#isCurrentRequest(requestId, solveGeneration)) return;

      this.#activeRequestId = undefined;
      this.#currentSolution = result.solved ? result.moves : undefined;
      this.#callbacks.onResultChange(result);
      this.#setState('ready');
    } catch (error) {
      if (!this.#isCurrentRequest(requestId, solveGeneration)) return;

      this.#activeRequestId = undefined;
      this.#currentSolution = undefined;
      this.#callbacks.onResultChange(undefined);
      this.#setState('error');
      this.#callbacks.reportError(error);
    }
  }

  invalidateCubeState(): void {
    this.#cubeGeneration += 1;
    this.#activeRequestId = undefined;
    this.#currentSolution = undefined;
    this.#callbacks.onResultChange(undefined);

    if (this.#state === 'solving') {
      this.#setState('ready');
    }
  }

  getCurrentSolution(): readonly Move[] | undefined {
    return this.#currentSolution;
  }

  #isCurrentRequest(requestId: number, generation: number): boolean {
    return (
      this.#activeRequestId === requestId &&
      this.#cubeGeneration === generation
    );
  }

  #setState(state: SolverUiState): void {
    this.#state = state;
    this.#callbacks.onStateChange(state);
  }
}
