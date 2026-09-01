import { CubeState } from './CubeState.ts';
import { validateCubeState } from './validation.ts';

interface SerializedCubeState {
  cornerPermutation: number[];
  cornerOrientation: number[];
  edgePermutation: number[];
  edgeOrientation: number[];
}

const SERIALIZED_FIELDS = [
  'cornerPermutation',
  'cornerOrientation',
  'edgePermutation',
  'edgeOrientation'
] as const;

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((element) => typeof element === 'number');
}

function isSerializedCubeState(value: unknown): value is SerializedCubeState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (
    keys.length !== SERIALIZED_FIELDS.length ||
    !SERIALIZED_FIELDS.every((field) => Object.hasOwn(value, field))
  ) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return SERIALIZED_FIELDS.every((field) => isNumberArray(candidate[field]));
}

export function serializeCubeState(state: CubeState): string {
  const validation = validateCubeState(state);

  if (!validation.valid) {
    throw new Error(`Cannot serialize invalid cube state: ${validation.reason}`);
  }

  const serialized: SerializedCubeState = {
    cornerPermutation: [...state.cornerPermutation],
    cornerOrientation: [...state.cornerOrientation],
    edgePermutation: [...state.edgePermutation],
    edgeOrientation: [...state.edgeOrientation]
  };

  return JSON.stringify(serialized);
}

export function deserializeCubeState(input: string): CubeState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('Invalid serialized cube state: invalid JSON');
  }

  if (!isSerializedCubeState(parsed)) {
    throw new Error('Invalid serialized cube state: invalid shape');
  }

  const state = new CubeState(
    parsed.cornerPermutation,
    parsed.cornerOrientation,
    parsed.edgePermutation,
    parsed.edgeOrientation
  );
  const validation = validateCubeState(state);

  if (!validation.valid) {
    throw new Error(`Invalid cube state: ${validation.reason}`);
  }

  return state;
}
