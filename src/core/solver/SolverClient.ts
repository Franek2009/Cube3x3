import type { CubeState } from '../cube/CubeState.ts';
import type { SolveOptions, SolveResult } from './solver.ts';
import {
  cubeStateToData,
  deserializeWorkerError,
  isSolverWorkerResponse,
  type SolverWorkerRequest,
  type SolverWorkerResponse
} from './solverWorkerProtocol.ts';

interface WorkerMessageEvent {
  readonly data: unknown;
}

interface WorkerErrorEvent {
  readonly error?: unknown;
  readonly message?: string;
}

export interface WorkerLike {
  onmessage: ((event: WorkerMessageEvent) => void) | null;
  onerror: ((event: WorkerErrorEvent) => void) | null;
  onmessageerror: ((event: WorkerErrorEvent) => void) | null;
  postMessage(message: SolverWorkerRequest): void;
  terminate(): void;
}

export interface SolverClientOptions {
  readonly workerFactory?: () => WorkerLike;
}

type PendingRequest =
  | {
      readonly kind: 'init';
      readonly resolve: () => void;
      readonly reject: (error: Error) => void;
    }
  | {
      readonly kind: 'solve';
      readonly resolve: (result: SolveResult) => void;
      readonly reject: (error: Error) => void;
    };

type ClientState = 'active' | 'failed' | 'disposed';

function createDefaultWorker(): WorkerLike {
  return new Worker(
    new URL('./solverWorker.ts', import.meta.url),
    { type: 'module' }
  ) as unknown as WorkerLike;
}

function eventError(event: WorkerErrorEvent, fallback: string): Error {
  if (event.error instanceof Error) return event.error;
  return new Error(event.message ?? fallback);
}

function normalizeResult(result: SolveResult): SolveResult {
  if (result.solved) {
    return {
      solved: true,
      moves: Object.freeze([...result.moves]),
      depth: result.depth
    };
  }

  if (result.reason === 'depth-limit') {
    return { solved: false, reason: 'depth-limit' };
  }

  return {
    solved: false,
    reason: 'invalid-state',
    validationError: result.validationError
  };
}

export class SolverClient {
  readonly #worker: WorkerLike;
  readonly #pending = new Map<number, PendingRequest>();
  #nextRequestId = 1;
  #state: ClientState = 'active';
  #terminalError: Error | undefined;
  #prewarmPromise: Promise<void> | undefined;
  #workerTerminated = false;

  constructor(options: SolverClientOptions = {}) {
    this.#worker = (options.workerFactory ?? createDefaultWorker)();
    this.#worker.onmessage = (event) => this.#handleMessage(event.data);
    this.#worker.onerror = (event) => {
      this.#fail(eventError(event, 'Solver worker crashed'));
    };
    this.#worker.onmessageerror = (event) => {
      this.#fail(eventError(event, 'Solver worker message could not be decoded'));
    };
  }

  prewarm(): Promise<void> {
    const unavailable = this.#unavailableError();
    if (unavailable !== undefined) return Promise.reject(unavailable);
    if (this.#prewarmPromise !== undefined) return this.#prewarmPromise;

    const id = this.#allocateRequestId();
    this.#prewarmPromise = new Promise<void>((resolve, reject) => {
      this.#pending.set(id, { kind: 'init', resolve, reject });
      this.#post({ type: 'init', id });
    });
    return this.#prewarmPromise;
  }

  solve(state: CubeState, options?: SolveOptions): Promise<SolveResult> {
    const stateData = cubeStateToData(state);

    return this.prewarm().then(() => {
      const unavailable = this.#unavailableError();
      if (unavailable !== undefined) throw unavailable;

      const id = this.#allocateRequestId();
      return new Promise<SolveResult>((resolve, reject) => {
        this.#pending.set(id, { kind: 'solve', resolve, reject });
        this.#post(options === undefined
          ? { type: 'solve', id, state: stateData }
          : { type: 'solve', id, state: stateData, options });
      });
    });
  }

  dispose(): void {
    if (this.#state === 'disposed') return;
    this.#state = 'disposed';
    const error = new Error('SolverClient has been disposed');
    this.#terminalError = error;
    this.#terminateWorker();
    this.#rejectPending(error);
  }

  #post(request: SolverWorkerRequest): void {
    try {
      this.#worker.postMessage(request);
    } catch (error) {
      this.#fail(error instanceof Error ? error : new Error(String(error)));
    }
  }

  #allocateRequestId(): number {
    const startingId = this.#nextRequestId;

    do {
      const id = this.#nextRequestId;
      this.#nextRequestId = id === Number.MAX_SAFE_INTEGER ? 1 : id + 1;
      if (!this.#pending.has(id)) return id;
    } while (this.#nextRequestId !== startingId);

    throw new Error('No solver worker request IDs are available');
  }

  #handleMessage(data: unknown): void {
    if (this.#state !== 'active') return;

    if (!isSolverWorkerResponse(data)) {
      this.#fail(new Error('Solver worker returned an invalid response'));
      return;
    }

    const responseId = data.id;

    if (data.type === 'error' && responseId === null) {
      this.#fail(deserializeWorkerError(data.error));
      return;
    }

    if (responseId === null) {
      this.#fail(new Error('Solver worker returned an invalid response ID'));
      return;
    }

    const pending = this.#pending.get(responseId);
    if (pending === undefined) {
      this.#fail(new Error(`Solver worker returned an unknown request ID: ${responseId}`));
      return;
    }

    if (data.type === 'error') {
      const error = deserializeWorkerError(data.error);
      if (pending.kind === 'init') {
        this.#fail(error);
      } else {
        this.#pending.delete(responseId);
        pending.reject(error);
      }
      return;
    }

    if (data.type === 'ready' && pending.kind === 'init') {
      this.#pending.delete(responseId);
      pending.resolve();
      return;
    }

    if (data.type === 'result' && pending.kind === 'solve') {
      this.#pending.delete(responseId);
      pending.resolve(normalizeResult(data.result));
      return;
    }

    this.#fail(new Error(`Solver worker response type does not match request ${responseId}`));
  }

  #fail(error: Error): void {
    if (this.#state !== 'active') return;
    this.#state = 'failed';
    this.#terminalError = error;
    this.#terminateWorker();
    this.#rejectPending(error);
  }

  #rejectPending(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }

  #unavailableError(): Error | undefined {
    if (this.#state === 'active') return undefined;
    return this.#terminalError ?? new Error('SolverClient is unavailable');
  }

  #terminateWorker(): void {
    if (this.#workerTerminated) return;
    this.#workerTerminated = true;
    this.#worker.terminate();
  }
}
