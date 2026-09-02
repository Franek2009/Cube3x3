import { CubeState } from '../cube/CubeState.ts';
import type { CubeValidationError } from '../cube/validation.ts';
import { isMove } from '../moves/moves.ts';
import type { SolveOptions, SolveResult } from './solver.ts';

export interface CubeStateData {
  readonly cornerPermutation: readonly number[];
  readonly cornerOrientation: readonly number[];
  readonly edgePermutation: readonly number[];
  readonly edgeOrientation: readonly number[];
}

export type SolverWorkerRequest =
  | {
      readonly type: 'init';
      readonly id: number;
    }
  | {
      readonly type: 'solve';
      readonly id: number;
      readonly state: CubeStateData;
      readonly options?: SolveOptions;
    };

export interface SerializedWorkerError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
}

export type SolverWorkerResponse =
  | {
      readonly type: 'ready';
      readonly id: number;
    }
  | {
      readonly type: 'result';
      readonly id: number;
      readonly result: SolveResult;
    }
  | {
      readonly type: 'error';
      readonly id: number | null;
      readonly error: SerializedWorkerError;
    };

const CUBE_STATE_FIELDS = [
  'cornerPermutation',
  'cornerOrientation',
  'edgePermutation',
  'edgeOrientation'
] as const;

const VALIDATION_ERRORS: ReadonlySet<CubeValidationError> = new Set([
  'invalid-corner-permutation-length',
  'invalid-corner-orientation-length',
  'invalid-edge-permutation-length',
  'invalid-edge-orientation-length',
  'invalid-corner-permutation',
  'invalid-edge-permutation',
  'invalid-corner-orientation-value',
  'invalid-edge-orientation-value',
  'invalid-corner-orientation-sum',
  'invalid-edge-orientation-sum',
  'permutation-parity-mismatch'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isRequestId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'number');
}

function isSolveOptions(value: unknown): value is SolveOptions {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return true;
  return hasExactKeys(value, ['maxDepth']) && typeof value.maxDepth === 'number';
}

function isSerializedWorkerError(value: unknown): value is SerializedWorkerError {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (!keys.every((key) => key === 'name' || key === 'message' || key === 'stack')) {
    return false;
  }
  if (!Object.hasOwn(value, 'name') || !Object.hasOwn(value, 'message')) return false;
  return (
    typeof value.name === 'string' &&
    typeof value.message === 'string' &&
    (value.stack === undefined || typeof value.stack === 'string')
  );
}

function isSolveResult(value: unknown): value is SolveResult {
  if (!isRecord(value) || typeof value.solved !== 'boolean') return false;

  if (value.solved) {
    return (
      hasExactKeys(value, ['solved', 'moves', 'depth']) &&
      Array.isArray(value.moves) &&
      value.moves.every((move) => typeof move === 'string' && isMove(move)) &&
      Number.isSafeInteger(value.depth) &&
      (value.depth as number) >= 0 &&
      value.depth === value.moves.length
    );
  }

  if (value.reason === 'depth-limit') {
    return hasExactKeys(value, ['solved', 'reason']);
  }

  return (
    value.reason === 'invalid-state' &&
    hasExactKeys(value, ['solved', 'reason', 'validationError']) &&
    typeof value.validationError === 'string' &&
    VALIDATION_ERRORS.has(value.validationError as CubeValidationError)
  );
}

export function cubeStateToData(state: CubeState): CubeStateData {
  return {
    cornerPermutation: state.cornerPermutation,
    cornerOrientation: state.cornerOrientation,
    edgePermutation: state.edgePermutation,
    edgeOrientation: state.edgeOrientation
  };
}

export function cubeStateFromData(data: CubeStateData): CubeState {
  return new CubeState(
    data.cornerPermutation,
    data.cornerOrientation,
    data.edgePermutation,
    data.edgeOrientation
  );
}

export function isCubeStateData(value: unknown): value is CubeStateData {
  if (!isRecord(value) || !hasExactKeys(value, CUBE_STATE_FIELDS)) return false;
  return CUBE_STATE_FIELDS.every((field) => isNumberArray(value[field]));
}

export function isSolverWorkerRequest(value: unknown): value is SolverWorkerRequest {
  if (!isRecord(value) || !isRequestId(value.id)) return false;

  if (value.type === 'init') {
    return hasExactKeys(value, ['type', 'id']);
  }

  if (value.type !== 'solve') return false;
  const hasOptions = Object.hasOwn(value, 'options');
  const keys = hasOptions ? ['type', 'id', 'state', 'options'] : ['type', 'id', 'state'];
  return (
    hasExactKeys(value, keys) &&
    isCubeStateData(value.state) &&
    (!hasOptions || value.options === undefined || isSolveOptions(value.options))
  );
}

export function isSolverWorkerResponse(value: unknown): value is SolverWorkerResponse {
  if (!isRecord(value)) return false;

  if (value.type === 'ready') {
    return hasExactKeys(value, ['type', 'id']) && isRequestId(value.id);
  }

  if (value.type === 'result') {
    return (
      hasExactKeys(value, ['type', 'id', 'result']) &&
      isRequestId(value.id) &&
      isSolveResult(value.result)
    );
  }

  if (value.type === 'error') {
    return (
      hasExactKeys(value, ['type', 'id', 'error']) &&
      (value.id === null || isRequestId(value.id)) &&
      isSerializedWorkerError(value.error)
    );
  }

  return false;
}

export function serializeWorkerError(error: unknown): SerializedWorkerError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack === undefined ? {} : { stack: error.stack })
    };
  }

  return {
    name: 'Error',
    message: String(error)
  };
}

export function deserializeWorkerError(error: SerializedWorkerError): Error {
  let restored: Error;

  if (error.name === 'RangeError') {
    restored = new RangeError(error.message);
  } else if (error.name === 'TypeError') {
    restored = new TypeError(error.message);
  } else {
    restored = new Error(error.message);
    restored.name = error.name;
  }

  if (error.stack !== undefined) restored.stack = error.stack;
  return restored;
}
