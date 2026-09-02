import type { CubeState } from '../cube/CubeState.ts';

export const CORNER_ORIENTATION_COUNT = 3 ** 7;
export const EDGE_ORIENTATION_COUNT = 2 ** 11;
export const SLICE_COMBINATION_COUNT = 495;
export const CORNER_PERMUTATION_COUNT = 40_320;
export const UD_EDGE_PERMUTATION_COUNT = 40_320;
export const SLICE_EDGE_PERMUTATION_COUNT = 24;

const SLICE_EDGE_IDS = new Set([8, 9, 10, 11]);

export interface SolverCubieState {
  readonly cornerPermutation: Uint8Array;
  readonly cornerOrientation: Uint8Array;
  readonly edgePermutation: Uint8Array;
  readonly edgeOrientation: Uint8Array;
}

export function toSolverCubieState(state: CubeState): SolverCubieState {
  return {
    cornerPermutation: Uint8Array.from(state.cornerPermutation),
    cornerOrientation: Uint8Array.from(state.cornerOrientation),
    edgePermutation: Uint8Array.from(state.edgePermutation),
    edgeOrientation: Uint8Array.from(state.edgeOrientation)
  };
}

function assertCoordinate(value: number, count: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= count) {
    throw new RangeError(`${name} must be an integer between 0 and ${count - 1}`);
  }
}

export function encodeCornerOrientation(state: SolverCubieState): number {
  let coordinate = 0;

  for (let position = 0; position < 7; position += 1) {
    coordinate = coordinate * 3 + state.cornerOrientation[position];
  }

  return coordinate;
}

/** Returns the corner-orientation component, not a complete cubie state. */
export function decodeCornerOrientation(coordinate: number): Uint8Array {
  assertCoordinate(coordinate, CORNER_ORIENTATION_COUNT, 'corner orientation coordinate');
  const orientations = new Uint8Array(8);
  let sum = 0;

  for (let position = 6; position >= 0; position -= 1) {
    orientations[position] = coordinate % 3;
    sum += orientations[position];
    coordinate = Math.floor(coordinate / 3);
  }

  orientations[7] = (3 - (sum % 3)) % 3;
  return orientations;
}

export function encodeEdgeOrientation(state: SolverCubieState): number {
  let coordinate = 0;

  for (let position = 0; position < 11; position += 1) {
    coordinate = coordinate * 2 + state.edgeOrientation[position];
  }

  return coordinate;
}

/** Returns the edge-orientation component, not a complete cubie state. */
export function decodeEdgeOrientation(coordinate: number): Uint8Array {
  assertCoordinate(coordinate, EDGE_ORIENTATION_COUNT, 'edge orientation coordinate');
  const orientations = new Uint8Array(12);
  let sum = 0;

  for (let position = 10; position >= 0; position -= 1) {
    orientations[position] = coordinate % 2;
    sum += orientations[position];
    coordinate = Math.floor(coordinate / 2);
  }

  orientations[11] = sum % 2;
  return orientations;
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;

  let value = 1;
  for (let index = 1; index <= k; index += 1) {
    value = (value * (n - k + index)) / index;
  }
  return value;
}

export function encodeSliceCombination(state: SolverCubieState): number {
  let rank = 0;
  let selected = 0;

  for (let position = 0; position < 12; position += 1) {
    if (SLICE_EDGE_IDS.has(state.edgePermutation[position])) {
      selected += 1;
      rank += binomial(position, selected);
    }
  }

  if (selected !== 4) throw new Error('Solver state must contain exactly four slice edges');
  return SLICE_COMBINATION_COUNT - 1 - rank;
}

/**
 * Returns a canonical edge permutation with the requested slice membership.
 * It does not guarantee global permutation parity relative to the corners.
 */
export function decodeSliceCombination(coordinate: number): Uint8Array {
  assertCoordinate(coordinate, SLICE_COMBINATION_COUNT, 'slice combination coordinate');
  let rank = SLICE_COMBINATION_COUNT - 1 - coordinate;
  const selectedPositions = new Set<number>();
  let maximumPosition = 11;

  for (let selected = 4; selected >= 1; selected -= 1) {
    while (binomial(maximumPosition, selected) > rank) maximumPosition -= 1;
    selectedPositions.add(maximumPosition);
    rank -= binomial(maximumPosition, selected);
    maximumPosition -= 1;
  }

  const permutation = new Uint8Array(12);
  let udEdge = 0;
  let sliceEdge = 8;

  for (let position = 0; position < 12; position += 1) {
    permutation[position] = selectedPositions.has(position) ? sliceEdge++ : udEdge++;
  }

  return permutation;
}

function factorial(value: number): number {
  let result = 1;
  for (let factor = 2; factor <= value; factor += 1) result *= factor;
  return result;
}

function encodePermutation(permutation: ArrayLike<number>): number {
  let rank = 0;

  for (let left = 0; left < permutation.length - 1; left += 1) {
    let smaller = 0;
    for (let right = left + 1; right < permutation.length; right += 1) {
      if (permutation[right] < permutation[left]) smaller += 1;
    }
    rank = rank * (permutation.length - left) + smaller;
  }

  return rank;
}

function isExactPermutation(values: ArrayLike<number>, size: number): boolean {
  if (values.length !== size) return false;
  const seen = new Uint8Array(size);

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isInteger(value) || value < 0 || value >= size || seen[value] === 1) {
      return false;
    }
    seen[value] = 1;
  }

  return true;
}

function decodePermutation(coordinate: number, size: number, name: string): Uint8Array {
  const count = factorial(size);
  assertCoordinate(coordinate, count, name);
  const available = Array.from({ length: size }, (_, index) => index);
  const permutation = new Uint8Array(size);

  for (let position = 0; position < size; position += 1) {
    const blockSize = factorial(size - position - 1);
    const availableIndex = Math.floor(coordinate / blockSize);
    coordinate %= blockSize;
    permutation[position] = available.splice(availableIndex, 1)[0];
  }

  return permutation;
}

export function encodeCornerPermutation(state: SolverCubieState): number {
  return encodePermutation(state.cornerPermutation);
}

/** Returns only the eight-corner permutation component. */
export function decodeCornerPermutation(coordinate: number): Uint8Array {
  return decodePermutation(coordinate, 8, 'corner permutation coordinate');
}

export function encodeUdEdgePermutation(state: SolverCubieState): number {
  const permutation = state.edgePermutation.slice(0, 8);
  if (!isExactPermutation(permutation, 8)) {
    throw new Error(
      'UD-edge permutation requires slots 0..7 to contain each UD edge exactly once'
    );
  }
  return encodePermutation(permutation);
}

/** Returns only the permutation component for UD-edge IDs 0..7. */
export function decodeUdEdgePermutation(coordinate: number): Uint8Array {
  return decodePermutation(coordinate, 8, 'UD-edge permutation coordinate');
}

export function encodeSliceEdgePermutation(state: SolverCubieState): number {
  const permutation = Array.from(state.edgePermutation.slice(8), (edge) => edge - 8);
  if (!isExactPermutation(permutation, 4)) {
    throw new Error(
      'Slice-edge permutation requires slots 8..11 to contain each slice edge exactly once'
    );
  }
  return encodePermutation(permutation);
}

/** Returns only the permutation component for slice-edge IDs 8..11. */
export function decodeSliceEdgePermutation(coordinate: number): Uint8Array {
  const permutation = decodePermutation(coordinate, 4, 'slice-edge permutation coordinate');
  return Uint8Array.from(permutation, (edge) => edge + 8);
}
