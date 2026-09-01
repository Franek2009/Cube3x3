import type { CubeState } from './CubeState.ts';

export type CubeValidationError =
  | 'invalid-corner-permutation-length'
  | 'invalid-corner-orientation-length'
  | 'invalid-edge-permutation-length'
  | 'invalid-edge-orientation-length'
  | 'invalid-corner-permutation'
  | 'invalid-edge-permutation'
  | 'invalid-corner-orientation-value'
  | 'invalid-edge-orientation-value'
  | 'invalid-corner-orientation-sum'
  | 'invalid-edge-orientation-sum'
  | 'permutation-parity-mismatch';

export type CubeValidationResult =
  | { valid: true }
  | { valid: false; reason: CubeValidationError };

function isPermutation(values: readonly number[], size: number): boolean {
  const seen = new Array<boolean>(size).fill(false);

  for (const value of values) {
    if (!Number.isInteger(value) || value < 0 || value >= size || seen[value]) {
      return false;
    }

    seen[value] = true;
  }

  return true;
}

function hasValuesInRange(values: readonly number[], maximum: number): boolean {
  return values.every(
    (value) => Number.isInteger(value) && value >= 0 && value <= maximum
  );
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function permutationParity(permutation: readonly number[]): 0 | 1 {
  let parity: 0 | 1 = 0;

  for (let left = 0; left < permutation.length; left += 1) {
    for (let right = left + 1; right < permutation.length; right += 1) {
      if (permutation[left] > permutation[right]) {
        parity = parity === 0 ? 1 : 0;
      }
    }
  }

  return parity;
}

export function validateCubeState(state: CubeState): CubeValidationResult {
  const cornerPermutation = state.cornerPermutation;
  const cornerOrientation = state.cornerOrientation;
  const edgePermutation = state.edgePermutation;
  const edgeOrientation = state.edgeOrientation;

  if (cornerPermutation.length !== 8) {
    return { valid: false, reason: 'invalid-corner-permutation-length' };
  }

  if (cornerOrientation.length !== 8) {
    return { valid: false, reason: 'invalid-corner-orientation-length' };
  }

  if (edgePermutation.length !== 12) {
    return { valid: false, reason: 'invalid-edge-permutation-length' };
  }

  if (edgeOrientation.length !== 12) {
    return { valid: false, reason: 'invalid-edge-orientation-length' };
  }

  if (!isPermutation(cornerPermutation, 8)) {
    return { valid: false, reason: 'invalid-corner-permutation' };
  }

  if (!isPermutation(edgePermutation, 12)) {
    return { valid: false, reason: 'invalid-edge-permutation' };
  }

  if (!hasValuesInRange(cornerOrientation, 2)) {
    return { valid: false, reason: 'invalid-corner-orientation-value' };
  }

  if (!hasValuesInRange(edgeOrientation, 1)) {
    return { valid: false, reason: 'invalid-edge-orientation-value' };
  }

  if (sum(cornerOrientation) % 3 !== 0) {
    return { valid: false, reason: 'invalid-corner-orientation-sum' };
  }

  if (sum(edgeOrientation) % 2 !== 0) {
    return { valid: false, reason: 'invalid-edge-orientation-sum' };
  }

  if (permutationParity(cornerPermutation) !== permutationParity(edgePermutation)) {
    return { valid: false, reason: 'permutation-parity-mismatch' };
  }

  return { valid: true };
}

export function isValidCubeState(state: CubeState): boolean {
  return validateCubeState(state).valid;
}
