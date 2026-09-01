import type { Move } from '../moves/moves.ts';

const SOLVED_CORNER_PERMUTATION = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const SOLVED_CORNER_ORIENTATION = [0, 0, 0, 0, 0, 0, 0, 0] as const;
const SOLVED_EDGE_PERMUTATION = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const SOLVED_EDGE_ORIENTATION = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as const;

function arraysEqual(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export class CubeState {
  readonly #cornerPermutation: readonly number[];
  readonly #cornerOrientation: readonly number[];
  readonly #edgePermutation: readonly number[];
  readonly #edgeOrientation: readonly number[];

  constructor(
    cornerPermutation: readonly number[],
    cornerOrientation: readonly number[],
    edgePermutation: readonly number[],
    edgeOrientation: readonly number[]
  ) {
    this.#cornerPermutation = Object.freeze([...cornerPermutation]);
    this.#cornerOrientation = Object.freeze([...cornerOrientation]);
    this.#edgePermutation = Object.freeze([...edgePermutation]);
    this.#edgeOrientation = Object.freeze([...edgeOrientation]);
  }

  get cornerPermutation(): readonly number[] {
    return [...this.#cornerPermutation];
  }

  get cornerOrientation(): readonly number[] {
    return [...this.#cornerOrientation];
  }

  get edgePermutation(): readonly number[] {
    return [...this.#edgePermutation];
  }

  get edgeOrientation(): readonly number[] {
    return [...this.#edgeOrientation];
  }

  isSolved(): boolean {
    return (
      arraysEqual(this.#cornerPermutation, SOLVED_CORNER_PERMUTATION) &&
      arraysEqual(this.#cornerOrientation, SOLVED_CORNER_ORIENTATION) &&
      arraysEqual(this.#edgePermutation, SOLVED_EDGE_PERMUTATION) &&
      arraysEqual(this.#edgeOrientation, SOLVED_EDGE_ORIENTATION)
    );
  }

  equals(other: CubeState): boolean {
    return (
      arraysEqual(this.#cornerPermutation, other.#cornerPermutation) &&
      arraysEqual(this.#cornerOrientation, other.#cornerOrientation) &&
      arraysEqual(this.#edgePermutation, other.#edgePermutation) &&
      arraysEqual(this.#edgeOrientation, other.#edgeOrientation)
    );
  }

  clone(): CubeState {
    return new CubeState(
      this.#cornerPermutation,
      this.#cornerOrientation,
      this.#edgePermutation,
      this.#edgeOrientation
    );
  }

  applyMove(move: Move): CubeState {
    let quarterTurns: number;

    switch (move) {
      case 'U':
        quarterTurns = 1;
        break;
      case "U'":
        quarterTurns = 3;
        break;
      case 'U2':
        quarterTurns = 2;
        break;
      default:
        throw new Error(`Move ${move} is not implemented`);
    }

    let result: CubeState = this;

    for (let turn = 0; turn < quarterTurns; turn += 1) {
      result = result.#applyUQuarterTurn();
    }

    return result;
  }

  #applyUQuarterTurn(): CubeState {
    const cornerPermutation = [...this.#cornerPermutation];
    const edgePermutation = [...this.#edgePermutation];

    cornerPermutation[0] = this.#cornerPermutation[3];
    cornerPermutation[1] = this.#cornerPermutation[0];
    cornerPermutation[2] = this.#cornerPermutation[1];
    cornerPermutation[3] = this.#cornerPermutation[2];

    edgePermutation[0] = this.#edgePermutation[3];
    edgePermutation[1] = this.#edgePermutation[0];
    edgePermutation[2] = this.#edgePermutation[1];
    edgePermutation[3] = this.#edgePermutation[2];

    return new CubeState(
      cornerPermutation,
      this.#cornerOrientation,
      edgePermutation,
      this.#edgeOrientation
    );
  }
}

export function solvedState(): CubeState {
  return new CubeState(
    SOLVED_CORNER_PERMUTATION,
    SOLVED_CORNER_ORIENTATION,
    SOLVED_EDGE_PERMUTATION,
    SOLVED_EDGE_ORIENTATION
  );
}
