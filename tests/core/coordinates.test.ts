import { describe, expect, it } from 'vitest';

import { solvedState } from '../../src/core/cube/CubeState.ts';
import { ALL_MOVES, type Move } from '../../src/core/moves/moves.ts';
import {
  CORNER_ORIENTATION_COUNT,
  CORNER_PERMUTATION_COUNT,
  decodeCornerOrientation,
  decodeCornerPermutation,
  decodeEdgeOrientation,
  decodeSliceCombination,
  decodeSliceEdgePermutation,
  decodeUdEdgePermutation,
  EDGE_ORIENTATION_COUNT,
  encodeCornerOrientation,
  encodeCornerPermutation,
  encodeEdgeOrientation,
  encodeSliceCombination,
  encodeSliceEdgePermutation,
  encodeUdEdgePermutation,
  SLICE_COMBINATION_COUNT,
  SLICE_EDGE_PERMUTATION_COUNT,
  toSolverCubieState,
  UD_EDGE_PERMUTATION_COUNT,
  type SolverCubieState
} from '../../src/core/solver/coordinates.ts';

function withComponent(
  component: Partial<SolverCubieState>
): SolverCubieState {
  return { ...toSolverCubieState(solvedState()), ...component };
}

function generateMoves(seed: number, length: number): Move[] {
  let value = seed >>> 0;
  return Array.from({ length }, () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ALL_MOVES[(value >>> 0) % ALL_MOVES.length];
  });
}

function edgePermutationWithSliceAt(positions: readonly number[]): Uint8Array {
  const slicePositions = new Set(positions);
  const permutation = new Uint8Array(12);
  let udEdge = 0;
  let sliceEdge = 8;

  for (let position = 0; position < 12; position += 1) {
    permutation[position] = slicePositions.has(position) ? sliceEdge++ : udEdge++;
  }

  return permutation;
}

describe('solver coordinates', () => {
  it('encodes every solved coordinate as zero', () => {
    const state = toSolverCubieState(solvedState());

    expect(encodeCornerOrientation(state)).toBe(0);
    expect(encodeEdgeOrientation(state)).toBe(0);
    expect(encodeSliceCombination(state)).toBe(0);
    expect(encodeCornerPermutation(state)).toBe(0);
    expect(encodeUdEdgePermutation(state)).toBe(0);
    expect(encodeSliceEdgePermutation(state)).toBe(0);
  });

  it('copies CubeState without exposing or mutating it', () => {
    const state = solvedState().applyMoves(['R', 'U', 'F']);
    const snapshot = state.clone();
    const solverState = toSolverCubieState(state);

    solverState.cornerPermutation[0] = 7;
    solverState.edgeOrientation[0] = 1;

    expect(state.equals(snapshot)).toBe(true);
  });

  it('round-trips and uniquely represents every corner orientation', () => {
    const seen = new Set<number>();
    for (let coordinate = 0; coordinate < CORNER_ORIENTATION_COUNT; coordinate += 1) {
      const decoded = decodeCornerOrientation(coordinate);
      const encoded = encodeCornerOrientation(withComponent({ cornerOrientation: decoded }));
      expect(encoded).toBe(coordinate);
      expect(decoded.reduce((sum, value) => sum + value, 0) % 3).toBe(0);
      seen.add(encoded);
    }
    expect(seen.size).toBe(CORNER_ORIENTATION_COUNT);
  });

  it('round-trips and uniquely represents every edge orientation', () => {
    const seen = new Set<number>();
    for (let coordinate = 0; coordinate < EDGE_ORIENTATION_COUNT; coordinate += 1) {
      const decoded = decodeEdgeOrientation(coordinate);
      const encoded = encodeEdgeOrientation(withComponent({ edgeOrientation: decoded }));
      expect(encoded).toBe(coordinate);
      expect(decoded.reduce((sum, value) => sum + value, 0) % 2).toBe(0);
      seen.add(encoded);
    }
    expect(seen.size).toBe(EDGE_ORIENTATION_COUNT);
  });

  it('round-trips and uniquely represents every slice combination', () => {
    const seen = new Set<number>();
    for (let coordinate = 0; coordinate < SLICE_COMBINATION_COUNT; coordinate += 1) {
      const edgePermutation = decodeSliceCombination(coordinate);
      const encoded = encodeSliceCombination(withComponent({ edgePermutation }));
      expect(encoded).toBe(coordinate);
      seen.add(encoded);
    }
    expect(seen.size).toBe(SLICE_COMBINATION_COUNT);
  });

  it('independently encodes all 495 slice membership combinations', () => {
    const coordinates = new Set<number>();

    for (let p0 = 0; p0 < 9; p0 += 1) {
      for (let p1 = p0 + 1; p1 < 10; p1 += 1) {
        for (let p2 = p1 + 1; p2 < 11; p2 += 1) {
          for (let p3 = p2 + 1; p3 < 12; p3 += 1) {
            const edgePermutation = edgePermutationWithSliceAt([p0, p1, p2, p3]);
            const coordinate = encodeSliceCombination(withComponent({ edgePermutation }));

            expect(coordinate).toBeGreaterThanOrEqual(0);
            expect(coordinate).toBeLessThan(SLICE_COMBINATION_COUNT);
            coordinates.add(coordinate);
          }
        }
      }
    }

    expect(coordinates.size).toBe(SLICE_COMBINATION_COUNT);
    expect(encodeSliceCombination(withComponent({
      edgePermutation: edgePermutationWithSliceAt([8, 9, 10, 11])
    }))).toBe(0);
  });

  it('round-trips every corner and UD-edge permutation', () => {
    for (let coordinate = 0; coordinate < CORNER_PERMUTATION_COUNT; coordinate += 1) {
      const cornerPermutation = decodeCornerPermutation(coordinate);
      expect(encodeCornerPermutation(withComponent({ cornerPermutation }))).toBe(coordinate);
    }

    for (let coordinate = 0; coordinate < UD_EDGE_PERMUTATION_COUNT; coordinate += 1) {
      const udEdges = decodeUdEdgePermutation(coordinate);
      const edgePermutation = Uint8Array.from([...udEdges, 8, 9, 10, 11]);
      expect(encodeUdEdgePermutation(withComponent({ edgePermutation }))).toBe(coordinate);
    }
  });

  it('round-trips every slice-edge permutation', () => {
    for (let coordinate = 0; coordinate < SLICE_EDGE_PERMUTATION_COUNT; coordinate += 1) {
      const sliceEdges = decodeSliceEdgePermutation(coordinate);
      const edgePermutation = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, ...sliceEdges]);
      expect(encodeSliceEdgePermutation(withComponent({ edgePermutation }))).toBe(coordinate);
    }
  });

  it('keeps Phase 1 coordinates in range for deterministic reachable states', () => {
    for (const seed of [1, 0x12345678, 0xdeadbeef, 0xffffffff]) {
      let state = solvedState();
      for (const move of generateMoves(seed, 200)) {
        state = state.applyMove(move);
        const solverState = toSolverCubieState(state);
        expect(encodeCornerOrientation(solverState)).toBeLessThan(CORNER_ORIENTATION_COUNT);
        expect(encodeEdgeOrientation(solverState)).toBeLessThan(EDGE_ORIENTATION_COUNT);
        expect(encodeSliceCombination(solverState)).toBeLessThan(SLICE_COMBINATION_COUNT);
        expect(encodeCornerPermutation(solverState)).toBeLessThan(CORNER_PERMUTATION_COUNT);
      }
    }
  });

  it('encodes Phase 2 permutations for a reachable subgroup state', () => {
    const state = toSolverCubieState(solvedState().applyMoves(['U', 'D2', 'L2', 'F2']));

    expect(encodeCornerOrientation(state)).toBe(0);
    expect(encodeEdgeOrientation(state)).toBe(0);
    expect(encodeSliceCombination(state)).toBe(0);
    expect(encodeCornerPermutation(state)).toBeLessThan(CORNER_PERMUTATION_COUNT);
    expect(encodeUdEdgePermutation(state)).toBeLessThan(UD_EDGE_PERMUTATION_COUNT);
    expect(encodeSliceEdgePermutation(state)).toBeLessThan(SLICE_EDGE_PERMUTATION_COUNT);
  });

  it('rejects Phase 2 edge permutations outside the subgroup', () => {
    const state = toSolverCubieState(solvedState().applyMove('R'));

    expect(() => encodeUdEdgePermutation(state)).toThrow(
      'UD-edge permutation requires slots 0..7 to contain each UD edge exactly once'
    );
    expect(() => encodeSliceEdgePermutation(state)).toThrow(
      'Slice-edge permutation requires slots 8..11 to contain each slice edge exactly once'
    );
  });

  it.each([
    [0, 0, 1, 2, 3, 4, 5, 6],
    [0, 1, 2, 3, 4, 5, 6, 6]
  ])('rejects invalid UD-edge IDs %j', (...udEdges) => {
    const edgePermutation = Uint8Array.from([...udEdges, 8, 9, 10, 11]);

    expect(() => encodeUdEdgePermutation(withComponent({ edgePermutation }))).toThrow(
      'UD-edge permutation requires slots 0..7 to contain each UD edge exactly once'
    );
  });

  it.each([
    [8, 8, 9, 10],
    [8, 9, 10, 10]
  ])('rejects invalid slice-edge IDs %j', (...sliceEdges) => {
    const edgePermutation = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, ...sliceEdges]);

    expect(() => encodeSliceEdgePermutation(withComponent({ edgePermutation }))).toThrow(
      'Slice-edge permutation requires slots 8..11 to contain each slice edge exactly once'
    );
  });

  it('rejects coordinates outside their ranges', () => {
    expect(() => decodeCornerOrientation(-1)).toThrow(RangeError);
    expect(() => decodeEdgeOrientation(EDGE_ORIENTATION_COUNT)).toThrow(RangeError);
    expect(() => decodeSliceCombination(1.5)).toThrow(RangeError);
    expect(() => decodeCornerPermutation(CORNER_PERMUTATION_COUNT)).toThrow(RangeError);
    expect(() => decodeUdEdgePermutation(Number.NaN)).toThrow(RangeError);
    expect(() => decodeSliceEdgePermutation(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
