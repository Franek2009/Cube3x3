import { getMoveTables } from './moveTables.ts';
import { getPruningTables } from './pruningTables.ts';
import { solveCube, type SolveOptions, type SolveResult } from './solver.ts';
import {
  cubeStateFromData,
  isSolverWorkerRequest,
  serializeWorkerError,
  type CubeStateData,
  type SolverWorkerResponse
} from './solverWorkerProtocol.ts';

export interface SolverWorkerHandlerDependencies {
  readonly initialize: () => void;
  readonly solve: (state: CubeStateData, options?: SolveOptions) => SolveResult;
}

const DEFAULT_DEPENDENCIES: SolverWorkerHandlerDependencies = {
  initialize() {
    getMoveTables();
    getPruningTables();
  },
  solve(state, options) {
    return solveCube(cubeStateFromData(state), options);
  }
};

function recoverRequestId(request: unknown): number | null {
  if (
    typeof request === 'object' &&
    request !== null &&
    Object.hasOwn(request, 'id') &&
    Number.isSafeInteger((request as { id?: unknown }).id) &&
    ((request as { id: number }).id > 0)
  ) {
    return (request as { id: number }).id;
  }

  return null;
}

export function handleSolverWorkerRequest(
  request: unknown,
  dependencies: SolverWorkerHandlerDependencies = DEFAULT_DEPENDENCIES
): SolverWorkerResponse {
  const id = recoverRequestId(request);

  try {
    if (!isSolverWorkerRequest(request)) {
      throw new TypeError('Invalid solver worker request');
    }

    if (request.type === 'init') {
      dependencies.initialize();
      return { type: 'ready', id: request.id };
    }

    return {
      type: 'result',
      id: request.id,
      result: dependencies.solve(request.state, request.options)
    };
  } catch (error) {
    return {
      type: 'error',
      id,
      error: serializeWorkerError(error)
    };
  }
}
