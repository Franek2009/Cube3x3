import { describe, expect, it } from 'vitest';

import { solvedState } from '../../src/core/cube/CubeState.ts';
import { ALL_MOVES, type Move } from '../../src/core/moves/moves.ts';
import { toSolverCubieState } from '../../src/core/solver/coordinates.ts';
import {
  applySolverMoveEffect,
  buildSolverMoveEffects,
  getSolverMoveEffect
} from '../../src/core/solver/moveEffects.ts';

function generateMoves(seed: number, length: number): Move[] {
  let value = seed >>> 0;
  return Array.from({ length }, () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ALL_MOVES[(value >>> 0) % ALL_MOVES.length];
  });
}

function expectSolverStatesEqual(
  actual: ReturnType<typeof toSolverCubieState>,
  expected: ReturnType<typeof toSolverCubieState>
): void {
  expect(actual.cornerPermutation).toEqual(expected.cornerPermutation);
  expect(actual.cornerOrientation).toEqual(expected.cornerOrientation);
  expect(actual.edgePermutation).toEqual(expected.edgePermutation);
  expect(actual.edgeOrientation).toEqual(expected.edgeOrientation);
}

describe('solver move effects', () => {
  it('derives all effects in ALL_MOVES order', () => {
    const effects = buildSolverMoveEffects();
    expect(effects).toHaveLength(ALL_MOVES.length);

    ALL_MOVES.forEach((move, index) => {
      const expected = toSolverCubieState(solvedState().applyMove(move));
      expect(effects[index].cornerSourceByDestination).toEqual(expected.cornerPermutation);
      expect(effects[index].cornerOrientationDelta).toEqual(expected.cornerOrientation);
      expect(effects[index].edgeSourceByDestination).toEqual(expected.edgePermutation);
      expect(effects[index].edgeOrientationDelta).toEqual(expected.edgeOrientation);
    });
  });

  it('matches CubeState for every move on deterministic reachable states', () => {
    for (const seed of [1, 0x12345678, 0xdeadbeef, 0xffffffff]) {
      let cubeState = solvedState();
      for (const setupMove of generateMoves(seed, 25)) {
        cubeState = cubeState.applyMove(setupMove);
        const solverState = toSolverCubieState(cubeState);

        for (const move of ALL_MOVES) {
          const actual = applySolverMoveEffect(solverState, getSolverMoveEffect(move));
          const expected = toSolverCubieState(cubeState.applyMove(move));
          expectSolverStatesEqual(actual, expected);
        }
      }
    }
  });

  it('does not mutate or alias the input arrays', () => {
    const input = toSolverCubieState(solvedState().applyMoves(['R', 'U', 'F']));
    const snapshot = {
      cornerPermutation: input.cornerPermutation.slice(),
      cornerOrientation: input.cornerOrientation.slice(),
      edgePermutation: input.edgePermutation.slice(),
      edgeOrientation: input.edgeOrientation.slice()
    };
    const output = applySolverMoveEffect(input, getSolverMoveEffect('L'));

    expectSolverStatesEqual(input, snapshot);
    expect(output.cornerPermutation).not.toBe(input.cornerPermutation);
    expect(output.cornerOrientation).not.toBe(input.cornerOrientation);
    expect(output.edgePermutation).not.toBe(input.edgePermutation);
    expect(output.edgeOrientation).not.toBe(input.edgeOrientation);
  });
});
