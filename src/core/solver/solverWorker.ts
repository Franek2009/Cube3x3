import { handleSolverWorkerRequest } from './solverWorkerHandler.ts';

interface SolverWorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void
  ): void;
  postMessage(message: unknown): void;
}

const workerScope = globalThis as unknown as SolverWorkerScope;

workerScope.addEventListener('message', (event) => {
  workerScope.postMessage(handleSolverWorkerRequest(event.data));
});
