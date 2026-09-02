import { solvedState } from '../cube/CubeState.ts';
import { ALL_MOVES, type Move } from '../moves/moves.ts';
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
} from './coordinates.ts';
import { applySolverMoveEffect, getSolverMoveEffect } from './moveEffects.ts';

export const PHASE2_MOVES = [
  'U', "U'", 'U2',
  'D', "D'", 'D2',
  'L2', 'R2', 'F2', 'B2'
] as const satisfies readonly Move[];

export const PHASE1_MOVE_COUNT = ALL_MOVES.length;
export const PHASE2_MOVE_COUNT = PHASE2_MOVES.length;

export interface SolverMoveTables {
  readonly cornerOrientation: Uint16Array;
  readonly edgeOrientation: Uint16Array;
  readonly sliceCombination: Uint16Array;
  readonly cornerPermutation: Uint16Array;
  readonly udEdgePermutation: Uint16Array;
  readonly sliceEdgePermutation: Uint16Array;
}

function withComponent(component: Partial<SolverCubieState>): SolverCubieState {
  return { ...toSolverCubieState(solvedState()), ...component };
}

function buildTable(
  coordinateCount: number,
  moves: readonly Move[],
  decode: (coordinate: number) => SolverCubieState,
  encode: (state: SolverCubieState) => number
): Uint16Array {
  const table = new Uint16Array(coordinateCount * moves.length);

  for (let coordinate = 0; coordinate < coordinateCount; coordinate += 1) {
    const state = decode(coordinate);
    for (let moveIndex = 0; moveIndex < moves.length; moveIndex += 1) {
      const moved = applySolverMoveEffect(state, getSolverMoveEffect(moves[moveIndex]));
      table[coordinate * moves.length + moveIndex] = encode(moved);
    }
  }

  return table;
}

function decodeUdRepresentative(coordinate: number): SolverCubieState {
  const udEdges = decodeUdEdgePermutation(coordinate);
  return withComponent({
    edgePermutation: Uint8Array.from([...udEdges, 8, 9, 10, 11])
  });
}

function decodeSliceEdgeRepresentative(coordinate: number): SolverCubieState {
  const sliceEdges = decodeSliceEdgePermutation(coordinate);
  return withComponent({
    edgePermutation: Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, ...sliceEdges])
  });
}

export function buildMoveTables(): SolverMoveTables {
  return {
    cornerOrientation: buildTable(
      CORNER_ORIENTATION_COUNT,
      ALL_MOVES,
      (coordinate) => withComponent({ cornerOrientation: decodeCornerOrientation(coordinate) }),
      encodeCornerOrientation
    ),
    edgeOrientation: buildTable(
      EDGE_ORIENTATION_COUNT,
      ALL_MOVES,
      (coordinate) => withComponent({ edgeOrientation: decodeEdgeOrientation(coordinate) }),
      encodeEdgeOrientation
    ),
    sliceCombination: buildTable(
      SLICE_COMBINATION_COUNT,
      ALL_MOVES,
      (coordinate) => withComponent({ edgePermutation: decodeSliceCombination(coordinate) }),
      encodeSliceCombination
    ),
    cornerPermutation: buildTable(
      CORNER_PERMUTATION_COUNT,
      PHASE2_MOVES,
      (coordinate) => withComponent({ cornerPermutation: decodeCornerPermutation(coordinate) }),
      encodeCornerPermutation
    ),
    udEdgePermutation: buildTable(
      UD_EDGE_PERMUTATION_COUNT,
      PHASE2_MOVES,
      decodeUdRepresentative,
      encodeUdEdgePermutation
    ),
    sliceEdgePermutation: buildTable(
      SLICE_EDGE_PERMUTATION_COUNT,
      PHASE2_MOVES,
      decodeSliceEdgeRepresentative,
      encodeSliceEdgePermutation
    )
  };
}

let cachedMoveTables: SolverMoveTables | undefined;

export function getMoveTables(): SolverMoveTables {
  cachedMoveTables ??= buildMoveTables();
  return cachedMoveTables;
}
