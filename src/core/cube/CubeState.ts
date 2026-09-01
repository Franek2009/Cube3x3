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
      case 'D':
        quarterTurns = 1;
        break;
      case "D'":
        quarterTurns = 3;
        break;
      case 'D2':
        quarterTurns = 2;
        break;
      case 'R':
        quarterTurns = 1;
        break;
      case "R'":
        quarterTurns = 3;
        break;
      case 'R2':
        quarterTurns = 2;
        break;
      case 'L':
        quarterTurns = 1;
        break;
      case "L'":
        quarterTurns = 3;
        break;
      case 'L2':
        quarterTurns = 2;
        break;
      default:
        throw new Error(`Move ${move} is not implemented`);
    }

    let result: CubeState = this;

    for (let turn = 0; turn < quarterTurns; turn += 1) {
      switch (move[0]) {
        case 'U':
          result = result.#applyUQuarterTurn();
          break;
        case 'D':
          result = result.#applyDQuarterTurn();
          break;
        case 'R':
          result = result.#applyRQuarterTurn();
          break;
        case 'L':
          result = result.#applyLQuarterTurn();
          break;
      }
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

  #applyDQuarterTurn(): CubeState {
    const cornerPermutation = [...this.#cornerPermutation];
    const edgePermutation = [...this.#edgePermutation];

    cornerPermutation[4] = this.#cornerPermutation[5];
    cornerPermutation[5] = this.#cornerPermutation[6];
    cornerPermutation[6] = this.#cornerPermutation[7];
    cornerPermutation[7] = this.#cornerPermutation[4];

    edgePermutation[4] = this.#edgePermutation[5];
    edgePermutation[5] = this.#edgePermutation[6];
    edgePermutation[6] = this.#edgePermutation[7];
    edgePermutation[7] = this.#edgePermutation[4];

    return new CubeState(
      cornerPermutation,
      this.#cornerOrientation,
      edgePermutation,
      this.#edgeOrientation
    );
  }

  #applyRQuarterTurn(): CubeState {
    const cornerPermutation = [...this.#cornerPermutation];
    const cornerOrientation = [...this.#cornerOrientation];
    const edgePermutation = [...this.#edgePermutation];
    const edgeOrientation = [...this.#edgeOrientation];

    cornerPermutation[0] = this.#cornerPermutation[4];
    cornerPermutation[3] = this.#cornerPermutation[0];
    cornerPermutation[4] = this.#cornerPermutation[7];
    cornerPermutation[7] = this.#cornerPermutation[3];

    cornerOrientation[0] = (this.#cornerOrientation[4] + 2) % 3;
    cornerOrientation[3] = (this.#cornerOrientation[0] + 1) % 3;
    cornerOrientation[4] = (this.#cornerOrientation[7] + 1) % 3;
    cornerOrientation[7] = (this.#cornerOrientation[3] + 2) % 3;

    edgePermutation[0] = this.#edgePermutation[8];
    edgePermutation[4] = this.#edgePermutation[11];
    edgePermutation[8] = this.#edgePermutation[4];
    edgePermutation[11] = this.#edgePermutation[0];

    edgeOrientation[0] = this.#edgeOrientation[8];
    edgeOrientation[4] = this.#edgeOrientation[11];
    edgeOrientation[8] = this.#edgeOrientation[4];
    edgeOrientation[11] = this.#edgeOrientation[0];

    return new CubeState(
      cornerPermutation,
      cornerOrientation,
      edgePermutation,
      edgeOrientation
    );
  }

  #applyLQuarterTurn(): CubeState {
    const cornerPermutation = [...this.#cornerPermutation];
    const cornerOrientation = [...this.#cornerOrientation];
    const edgePermutation = [...this.#edgePermutation];
    const edgeOrientation = [...this.#edgeOrientation];

    cornerPermutation[1] = this.#cornerPermutation[2];
    cornerPermutation[2] = this.#cornerPermutation[6];
    cornerPermutation[5] = this.#cornerPermutation[1];
    cornerPermutation[6] = this.#cornerPermutation[5];

    cornerOrientation[1] = (this.#cornerOrientation[2] + 1) % 3;
    cornerOrientation[2] = (this.#cornerOrientation[6] + 2) % 3;
    cornerOrientation[5] = (this.#cornerOrientation[1] + 2) % 3;
    cornerOrientation[6] = (this.#cornerOrientation[5] + 1) % 3;

    edgePermutation[2] = this.#edgePermutation[10];
    edgePermutation[6] = this.#edgePermutation[9];
    edgePermutation[9] = this.#edgePermutation[2];
    edgePermutation[10] = this.#edgePermutation[6];

    edgeOrientation[2] = this.#edgeOrientation[10];
    edgeOrientation[6] = this.#edgeOrientation[9];
    edgeOrientation[9] = this.#edgeOrientation[2];
    edgeOrientation[10] = this.#edgeOrientation[6];

    return new CubeState(
      cornerPermutation,
      cornerOrientation,
      edgePermutation,
      edgeOrientation
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
