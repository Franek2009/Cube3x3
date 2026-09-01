import { describe, expect, it } from 'vitest';

import { CubeState, solvedState } from '../../src/core/cube/CubeState.ts';
import { ALL_MOVES } from '../../src/core/moves/moves.ts';

describe('CubeState', () => {
  it('creates the solved representation', () => {
    const state = solvedState();

    expect(state.cornerPermutation).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(state.cornerOrientation).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(state.edgePermutation).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(state.edgeOrientation).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('recognizes the solved state', () => {
    expect(solvedState().isSolved()).toBe(true);
  });

  it('compares independently created solved states by value', () => {
    const first = solvedState();
    const second = solvedState();

    expect(first).not.toBe(second);
    expect(first.equals(second)).toBe(true);
  });

  it('compares all four state representations', () => {
    const solved = solvedState();

    expect(new CubeState([1, 0, 2, 3, 4, 5, 6, 7], solved.cornerOrientation, solved.edgePermutation, solved.edgeOrientation).equals(solved)).toBe(false);
    expect(new CubeState(solved.cornerPermutation, [1, 0, 0, 0, 0, 0, 0, 0], solved.edgePermutation, solved.edgeOrientation).equals(solved)).toBe(false);
    expect(new CubeState(solved.cornerPermutation, solved.cornerOrientation, [1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], solved.edgeOrientation).equals(solved)).toBe(false);
    expect(new CubeState(solved.cornerPermutation, solved.cornerOrientation, solved.edgePermutation, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).equals(solved)).toBe(false);
  });

  it('clones to an independent object with equal value', () => {
    const original = solvedState();
    const clone = original.clone();

    expect(clone).not.toBe(original);
    expect(clone.equals(original)).toBe(true);
  });

  it('does not expose mutable internal arrays', () => {
    const state = solvedState();
    const exposedCornerPermutation = state.cornerPermutation as number[];
    const exposedCornerOrientation = state.cornerOrientation as number[];
    const exposedEdgePermutation = state.edgePermutation as number[];
    const exposedEdgeOrientation = state.edgeOrientation as number[];

    exposedCornerPermutation[0] = 7;
    exposedCornerOrientation[0] = 1;
    exposedEdgePermutation[0] = 11;
    exposedEdgeOrientation[0] = 1;

    expect(state.isSolved()).toBe(true);
    expect(state.cornerPermutation[0]).toBe(0);
    expect(state.cornerOrientation[0]).toBe(0);
    expect(state.edgePermutation[0]).toBe(0);
    expect(state.edgeOrientation[0]).toBe(0);
  });

  it('copies constructor inputs', () => {
    const cornerPermutation = [0, 1, 2, 3, 4, 5, 6, 7];
    const cornerOrientation = [0, 0, 0, 0, 0, 0, 0, 0];
    const edgePermutation = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const edgeOrientation = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const state = new CubeState(
      cornerPermutation,
      cornerOrientation,
      edgePermutation,
      edgeOrientation
    );

    cornerPermutation[0] = 7;
    cornerOrientation[0] = 1;
    edgePermutation[0] = 11;
    edgeOrientation[0] = 1;

    expect(state.isSolved()).toBe(true);
  });

  describe('applyMove', () => {
    it('applies the exact U permutation', () => {
      const moved = solvedState().applyMove('U');

      expect(moved.cornerPermutation).toEqual([3, 0, 1, 2, 4, 5, 6, 7]);
      expect(moved.edgePermutation).toEqual([3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    it('returns to identity after four U moves', () => {
      const state = solvedState();
      const moved = state.applyMove('U').applyMove('U').applyMove('U').applyMove('U');

      expect(moved.equals(state)).toBe(true);
    });

    it("returns to identity after U followed by U'", () => {
      const state = solvedState();

      expect(state.applyMove('U').applyMove("U'").equals(state)).toBe(true);
    });

    it("returns to identity after U' followed by U", () => {
      const state = solvedState();

      expect(state.applyMove("U'").applyMove('U').equals(state)).toBe(true);
    });

    it('returns to identity after two U2 moves', () => {
      const state = solvedState();

      expect(state.applyMove('U2').applyMove('U2').equals(state)).toBe(true);
    });

    it('applies U2 like two U moves', () => {
      const state = solvedState();

      expect(state.applyMove('U2').equals(state.applyMove('U').applyMove('U'))).toBe(true);
    });

    it("applies U' like three U moves", () => {
      const state = solvedState();
      const threeQuarterTurns = state.applyMove('U').applyMove('U').applyMove('U');

      expect(state.applyMove("U'").equals(threeQuarterTurns)).toBe(true);
    });

    it('does not change orientations', () => {
      const state = solvedState();
      const moved = state.applyMove('U');

      expect(moved.cornerOrientation).toEqual(state.cornerOrientation);
      expect(moved.edgeOrientation).toEqual(state.edgeOrientation);
    });

    it('does not change cubies outside the U layer', () => {
      const state = solvedState();
      const moved = state.applyMove('U');

      expect(moved.cornerPermutation.slice(4)).toEqual(state.cornerPermutation.slice(4));
      expect(moved.edgePermutation.slice(4)).toEqual(state.edgePermutation.slice(4));
    });

    it('does not mutate the original state', () => {
      const state = solvedState();
      const moved = state.applyMove('U');

      expect(moved).not.toBe(state);
      expect(state.isSolved()).toBe(true);
      expect(moved.isSolved()).toBe(false);
    });

    it('moves existing corner and edge orientations with U-layer cubies', () => {
      const state = new CubeState(
        [0, 1, 2, 3, 4, 5, 6, 7],
        [0, 1, 2, 0, 0, 0, 0, 0],
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      );
      const moved = state.applyMove('U');

      expect(moved.cornerOrientation).toEqual([0, 0, 1, 2, 0, 0, 0, 0]);
      expect(moved.edgeOrientation).toEqual([0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('restores a state with non-zero orientations after four U moves', () => {
      const state = new CubeState(
        [0, 1, 2, 3, 4, 5, 6, 7],
        [0, 1, 2, 0, 0, 0, 0, 0],
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      );
      const moved = state.applyMove('U').applyMove('U').applyMove('U').applyMove('U');

      expect(moved.equals(state)).toBe(true);
    });

    it('moves R corner orientations with cubies during a following U move', () => {
      const moved = solvedState().applyMove('R').applyMove('U');

      expect(moved.cornerOrientation).toEqual([1, 2, 0, 0, 1, 0, 0, 2]);
    });

    it('moves F edge orientations with cubies during a following U move', () => {
      const moved = solvedState().applyMove('F').applyMove('U');

      expect(moved.edgeOrientation).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0]);
    });

    it.each(ALL_MOVES)('supports move %s', (move) => {
      expect(() => solvedState().applyMove(move)).not.toThrow();
    });

    describe('D moves', () => {
      it('applies the exact D permutation and changes the solved state', () => {
        const moved = solvedState().applyMove('D');

        expect(moved.isSolved()).toBe(false);
        expect(moved.cornerPermutation).toEqual([0, 1, 2, 3, 5, 6, 7, 4]);
        expect(moved.edgePermutation).toEqual([0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11]);
      });

      it('does not mutate the original state', () => {
        const state = solvedState();
        const moved = state.applyMove('D');

        expect(moved).not.toBe(state);
        expect(state.isSolved()).toBe(true);
      });

      it('returns to identity after four D moves', () => {
        const state = solvedState();
        const moved = state.applyMove('D').applyMove('D').applyMove('D').applyMove('D');

        expect(moved.equals(state)).toBe(true);
      });

      it("returns to identity after D followed by D'", () => {
        const state = solvedState();

        expect(state.applyMove('D').applyMove("D'").equals(state)).toBe(true);
      });

      it("returns to identity after D' followed by D", () => {
        const state = solvedState();

        expect(state.applyMove("D'").applyMove('D').equals(state)).toBe(true);
      });

      it('returns to identity after two D2 moves', () => {
        const state = solvedState();

        expect(state.applyMove('D2').applyMove('D2').equals(state)).toBe(true);
      });

      it('applies D2 like two D moves', () => {
        const state = solvedState();

        expect(state.applyMove('D2').equals(state.applyMove('D').applyMove('D'))).toBe(true);
      });

      it("applies D' like three D moves", () => {
        const state = solvedState();
        const threeQuarterTurns = state.applyMove('D').applyMove('D').applyMove('D');

        expect(state.applyMove("D'").equals(threeQuarterTurns)).toBe(true);
      });

      it('does not change orientations', () => {
        const state = solvedState();
        const moved = state.applyMove('D');

        expect(moved.cornerOrientation).toEqual(state.cornerOrientation);
        expect(moved.edgeOrientation).toEqual(state.edgeOrientation);
      });

      it('does not change U-layer cubies', () => {
        const state = solvedState();
        const moved = state.applyMove('D');

        expect(moved.cornerPermutation.slice(0, 4)).toEqual(state.cornerPermutation.slice(0, 4));
        expect(moved.edgePermutation.slice(0, 4)).toEqual(state.edgePermutation.slice(0, 4));
      });

      it('does not change middle-layer edges', () => {
        const state = solvedState();
        const moved = state.applyMove('D');

        expect(moved.edgePermutation.slice(8)).toEqual(state.edgePermutation.slice(8));
      });

      it('moves existing corner and edge orientations with D-layer cubies', () => {
        const state = new CubeState(
          [0, 1, 2, 3, 4, 5, 6, 7],
          [0, 0, 0, 0, 1, 2, 0, 0],
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0]
        );
        const moved = state.applyMove('D');

        expect(moved.cornerOrientation).toEqual([0, 0, 0, 0, 2, 0, 0, 1]);
        expect(moved.edgeOrientation).toEqual([0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0]);
      });

      it('restores a state with non-zero orientations after four D moves', () => {
        const state = new CubeState(
          [0, 1, 2, 3, 4, 5, 6, 7],
          [0, 0, 0, 0, 1, 2, 0, 0],
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0]
        );
        const moved = state.applyMove('D').applyMove('D').applyMove('D').applyMove('D');

        expect(moved.equals(state)).toBe(true);
      });
    });

    describe('R moves', () => {
      it('applies the exact R transformation and changes the solved state', () => {
        const moved = solvedState().applyMove('R');

        expect(moved.isSolved()).toBe(false);
        expect(moved.cornerPermutation).toEqual([4, 1, 2, 0, 7, 5, 6, 3]);
        expect(moved.cornerOrientation).toEqual([2, 0, 0, 1, 1, 0, 0, 2]);
        expect(moved.edgePermutation).toEqual([8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0]);
        expect(moved.edgeOrientation).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      });

      it('does not mutate the original state', () => {
        const state = solvedState();
        const moved = state.applyMove('R');

        expect(moved).not.toBe(state);
        expect(state.isSolved()).toBe(true);
      });

      it('returns to identity after four R moves', () => {
        const state = solvedState();
        const moved = state.applyMove('R').applyMove('R').applyMove('R').applyMove('R');

        expect(moved.equals(state)).toBe(true);
      });

      it("returns to identity after R followed by R'", () => {
        const state = solvedState();

        expect(state.applyMove('R').applyMove("R'").equals(state)).toBe(true);
      });

      it("returns to identity after R' followed by R", () => {
        const state = solvedState();

        expect(state.applyMove("R'").applyMove('R').equals(state)).toBe(true);
      });

      it('returns to identity after two R2 moves', () => {
        const state = solvedState();

        expect(state.applyMove('R2').applyMove('R2').equals(state)).toBe(true);
      });

      it('applies R2 like two R moves', () => {
        const state = solvedState();

        expect(state.applyMove('R2').equals(state.applyMove('R').applyMove('R'))).toBe(true);
      });

      it("applies R' like three R moves", () => {
        const state = solvedState();
        const threeQuarterTurns = state.applyMove('R').applyMove('R').applyMove('R');

        expect(state.applyMove("R'").equals(threeQuarterTurns)).toBe(true);
      });

      it('keeps the corner orientation sum divisible by three', () => {
        const orientationSum = solvedState()
          .applyMove('R')
          .cornerOrientation.reduce((sum, orientation) => sum + orientation, 0);

        expect(orientationSum % 3).toBe(0);
      });

      it('does not change cubies outside the R layer', () => {
        const state = solvedState();
        const moved = state.applyMove('R');

        for (const index of [1, 2, 5, 6]) {
          expect(moved.cornerPermutation[index]).toBe(state.cornerPermutation[index]);
          expect(moved.cornerOrientation[index]).toBe(state.cornerOrientation[index]);
        }

        for (const index of [1, 2, 3, 5, 6, 7, 9, 10]) {
          expect(moved.edgePermutation[index]).toBe(state.edgePermutation[index]);
          expect(moved.edgeOrientation[index]).toBe(state.edgeOrientation[index]);
        }
      });

      it('moves existing orientations and adds R deltas modulo three', () => {
        const state = new CubeState(
          [0, 1, 2, 3, 4, 5, 6, 7],
          [1, 0, 0, 2, 0, 0, 0, 1],
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]
        );
        const moved = state.applyMove('R');

        expect(moved.cornerOrientation).toEqual([2, 0, 0, 2, 2, 0, 0, 1]);
        expect(moved.edgeOrientation).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1]);
      });

      it('restores a state with non-zero orientations after four R moves', () => {
        const state = new CubeState(
          [0, 1, 2, 3, 4, 5, 6, 7],
          [1, 0, 0, 2, 0, 0, 0, 1],
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]
        );
        const moved = state.applyMove('R').applyMove('R').applyMove('R').applyMove('R');

        expect(moved.equals(state)).toBe(true);
      });
    });

    describe('L moves', () => {
      it('applies the exact L transformation and changes the solved state', () => {
        const moved = solvedState().applyMove('L');

        expect(moved.isSolved()).toBe(false);
        expect(moved.cornerPermutation).toEqual([0, 2, 6, 3, 4, 1, 5, 7]);
        expect(moved.cornerOrientation).toEqual([0, 1, 2, 0, 0, 2, 1, 0]);
        expect(moved.edgePermutation).toEqual([0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11]);
        expect(moved.edgeOrientation).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      });

      it('does not mutate the original state', () => {
        const state = solvedState();
        const moved = state.applyMove('L');

        expect(moved).not.toBe(state);
        expect(state.isSolved()).toBe(true);
      });

      it('returns to identity after four L moves', () => {
        const state = solvedState();
        const moved = state.applyMove('L').applyMove('L').applyMove('L').applyMove('L');

        expect(moved.equals(state)).toBe(true);
      });

      it("returns to identity after L followed by L'", () => {
        const state = solvedState();

        expect(state.applyMove('L').applyMove("L'").equals(state)).toBe(true);
      });

      it("returns to identity after L' followed by L", () => {
        const state = solvedState();

        expect(state.applyMove("L'").applyMove('L').equals(state)).toBe(true);
      });

      it('returns to identity after two L2 moves', () => {
        const state = solvedState();

        expect(state.applyMove('L2').applyMove('L2').equals(state)).toBe(true);
      });

      it('applies L2 like two L moves', () => {
        const state = solvedState();

        expect(state.applyMove('L2').equals(state.applyMove('L').applyMove('L'))).toBe(true);
      });

      it("applies L' like three L moves", () => {
        const state = solvedState();
        const threeQuarterTurns = state.applyMove('L').applyMove('L').applyMove('L');

        expect(state.applyMove("L'").equals(threeQuarterTurns)).toBe(true);
      });

      it('keeps the corner orientation sum divisible by three', () => {
        const orientationSum = solvedState()
          .applyMove('L')
          .cornerOrientation.reduce((sum, orientation) => sum + orientation, 0);

        expect(orientationSum % 3).toBe(0);
      });

      it('does not change cubies outside the L layer', () => {
        const state = solvedState();
        const moved = state.applyMove('L');

        for (const index of [0, 3, 4, 7]) {
          expect(moved.cornerPermutation[index]).toBe(state.cornerPermutation[index]);
          expect(moved.cornerOrientation[index]).toBe(state.cornerOrientation[index]);
        }

        for (const index of [0, 1, 3, 4, 5, 7, 8, 11]) {
          expect(moved.edgePermutation[index]).toBe(state.edgePermutation[index]);
          expect(moved.edgeOrientation[index]).toBe(state.edgeOrientation[index]);
        }
      });

      it('moves existing orientations and adds L deltas modulo three', () => {
        const state = new CubeState(
          [0, 1, 2, 3, 4, 5, 6, 7],
          [0, 1, 0, 0, 0, 2, 0, 0],
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0]
        );
        const moved = state.applyMove('L');

        expect(moved.cornerOrientation).toEqual([0, 1, 2, 0, 0, 0, 0, 0]);
        expect(moved.edgeOrientation).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0]);
      });

      it('restores a state with non-zero orientations after four L moves', () => {
        const state = new CubeState(
          [0, 1, 2, 3, 4, 5, 6, 7],
          [0, 1, 0, 0, 0, 2, 0, 0],
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0]
        );
        const moved = state.applyMove('L').applyMove('L').applyMove('L').applyMove('L');

        expect(moved.equals(state)).toBe(true);
      });
    });

    describe('F moves', () => {
      it('applies the exact F transformation and changes the solved state', () => {
        const moved = solvedState().applyMove('F');

        expect(moved.isSolved()).toBe(false);
        expect(moved.cornerPermutation).toEqual([1, 5, 2, 3, 0, 4, 6, 7]);
        expect(moved.cornerOrientation).toEqual([1, 2, 0, 0, 2, 1, 0, 0]);
        expect(moved.edgePermutation).toEqual([0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11]);
        expect(moved.edgeOrientation).toEqual([0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0]);
      });

      it('does not mutate the original state', () => {
        const state = solvedState();
        const moved = state.applyMove('F');

        expect(moved).not.toBe(state);
        expect(state.isSolved()).toBe(true);
      });

      it('returns to identity after four F moves', () => {
        const state = solvedState();
        const moved = state.applyMove('F').applyMove('F').applyMove('F').applyMove('F');

        expect(moved.equals(state)).toBe(true);
      });

      it("returns to identity after F followed by F'", () => {
        const state = solvedState();

        expect(state.applyMove('F').applyMove("F'").equals(state)).toBe(true);
      });

      it("returns to identity after F' followed by F", () => {
        const state = solvedState();

        expect(state.applyMove("F'").applyMove('F').equals(state)).toBe(true);
      });

      it('returns to identity after two F2 moves', () => {
        const state = solvedState();

        expect(state.applyMove('F2').applyMove('F2').equals(state)).toBe(true);
      });

      it('applies F2 like two F moves', () => {
        const state = solvedState();

        expect(state.applyMove('F2').equals(state.applyMove('F').applyMove('F'))).toBe(true);
      });

      it("applies F' like three F moves", () => {
        const state = solvedState();
        const threeQuarterTurns = state.applyMove('F').applyMove('F').applyMove('F');

        expect(state.applyMove("F'").equals(threeQuarterTurns)).toBe(true);
      });

      it('keeps the corner orientation sum divisible by three', () => {
        const orientationSum = solvedState()
          .applyMove('F')
          .cornerOrientation.reduce((sum, orientation) => sum + orientation, 0);

        expect(orientationSum % 3).toBe(0);
      });

      it('keeps the edge orientation sum divisible by two', () => {
        const orientationSum = solvedState()
          .applyMove('F')
          .edgeOrientation.reduce((sum, orientation) => sum + orientation, 0);

        expect(orientationSum % 2).toBe(0);
      });

      it('flips all four edges in the F layer', () => {
        const edgeOrientation = solvedState().applyMove('F').edgeOrientation;

        expect([edgeOrientation[1], edgeOrientation[5], edgeOrientation[8], edgeOrientation[9]])
          .toEqual([1, 1, 1, 1]);
      });

      it('does not change cubies outside the F layer', () => {
        const state = solvedState();
        const moved = state.applyMove('F');

        for (const index of [2, 3, 6, 7]) {
          expect(moved.cornerPermutation[index]).toBe(state.cornerPermutation[index]);
          expect(moved.cornerOrientation[index]).toBe(state.cornerOrientation[index]);
        }

        for (const index of [0, 2, 3, 4, 6, 7, 10, 11]) {
          expect(moved.edgePermutation[index]).toBe(state.edgePermutation[index]);
          expect(moved.edgeOrientation[index]).toBe(state.edgeOrientation[index]);
        }
      });

      it('moves existing orientations and applies F deltas', () => {
        const state = new CubeState(
          [0, 1, 2, 3, 4, 5, 6, 7],
          [1, 1, 0, 0, 1, 0, 0, 0],
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          [0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
        );
        const moved = state.applyMove('F');

        expect(moved.cornerOrientation).toEqual([2, 2, 0, 0, 0, 2, 0, 0]);
        expect(moved.edgeOrientation).toEqual([0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
      });

      it('restores a state with non-zero orientations after four F moves', () => {
        const state = new CubeState(
          [0, 1, 2, 3, 4, 5, 6, 7],
          [1, 1, 0, 0, 1, 0, 0, 0],
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          [0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
        );
        const moved = state.applyMove('F').applyMove('F').applyMove('F').applyMove('F');

        expect(moved.equals(state)).toBe(true);
      });
    });

    describe('B moves', () => {
      it('applies the exact B transformation and changes the solved state', () => {
        const moved = solvedState().applyMove('B');

        expect(moved.isSolved()).toBe(false);
        expect(moved.cornerPermutation).toEqual([0, 1, 3, 7, 4, 5, 2, 6]);
        expect(moved.cornerOrientation).toEqual([0, 0, 1, 2, 0, 0, 2, 1]);
        expect(moved.edgePermutation).toEqual([0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7]);
        expect(moved.edgeOrientation).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1]);
      });

      it('does not mutate the original state', () => {
        const state = solvedState();
        const moved = state.applyMove('B');

        expect(moved).not.toBe(state);
        expect(state.isSolved()).toBe(true);
      });

      it('returns to identity after four B moves', () => {
        const state = solvedState();
        const moved = state.applyMove('B').applyMove('B').applyMove('B').applyMove('B');

        expect(moved.equals(state)).toBe(true);
      });

      it("returns to identity after B followed by B'", () => {
        const state = solvedState();

        expect(state.applyMove('B').applyMove("B'").equals(state)).toBe(true);
      });

      it("returns to identity after B' followed by B", () => {
        const state = solvedState();

        expect(state.applyMove("B'").applyMove('B').equals(state)).toBe(true);
      });

      it('returns to identity after two B2 moves', () => {
        const state = solvedState();

        expect(state.applyMove('B2').applyMove('B2').equals(state)).toBe(true);
      });

      it('applies B2 like two B moves', () => {
        const state = solvedState();

        expect(state.applyMove('B2').equals(state.applyMove('B').applyMove('B'))).toBe(true);
      });

      it("applies B' like three B moves", () => {
        const state = solvedState();
        const threeQuarterTurns = state.applyMove('B').applyMove('B').applyMove('B');

        expect(state.applyMove("B'").equals(threeQuarterTurns)).toBe(true);
      });

      it('keeps the corner orientation sum divisible by three', () => {
        const orientationSum = solvedState()
          .applyMove('B')
          .cornerOrientation.reduce((sum, orientation) => sum + orientation, 0);

        expect(orientationSum % 3).toBe(0);
      });

      it('keeps the edge orientation sum divisible by two', () => {
        const orientationSum = solvedState()
          .applyMove('B')
          .edgeOrientation.reduce((sum, orientation) => sum + orientation, 0);

        expect(orientationSum % 2).toBe(0);
      });

      it('flips all four edges in the B layer', () => {
        const edgeOrientation = solvedState().applyMove('B').edgeOrientation;

        expect([edgeOrientation[3], edgeOrientation[7], edgeOrientation[10], edgeOrientation[11]])
          .toEqual([1, 1, 1, 1]);
      });

      it('does not change cubies outside the B layer', () => {
        const state = solvedState();
        const moved = state.applyMove('B');

        for (const index of [0, 1, 4, 5]) {
          expect(moved.cornerPermutation[index]).toBe(state.cornerPermutation[index]);
          expect(moved.cornerOrientation[index]).toBe(state.cornerOrientation[index]);
        }

        for (const index of [0, 1, 2, 4, 5, 6, 8, 9]) {
          expect(moved.edgePermutation[index]).toBe(state.edgePermutation[index]);
          expect(moved.edgeOrientation[index]).toBe(state.edgeOrientation[index]);
        }
      });

      it('moves existing orientations and applies B deltas', () => {
        const state = new CubeState(
          [0, 1, 2, 3, 4, 5, 6, 7],
          [0, 0, 1, 1, 0, 0, 1, 0],
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0]
        );
        const moved = state.applyMove('B');

        expect(moved.cornerOrientation).toEqual([0, 0, 2, 2, 0, 0, 0, 2]);
        expect(moved.edgeOrientation).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1]);
      });

      it('restores a state with non-zero orientations after four B moves', () => {
        const state = new CubeState(
          [0, 1, 2, 3, 4, 5, 6, 7],
          [0, 0, 1, 1, 0, 0, 1, 0],
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0]
        );
        const moved = state.applyMove('B').applyMove('B').applyMove('B').applyMove('B');

        expect(moved.equals(state)).toBe(true);
      });
    });
  });
});
