import type { Move } from '../moves/moves.ts';

export interface SolveRecord {
  readonly timeMs: number;
  readonly scramble: readonly Move[];
  readonly moveCount: number;
  readonly completedAt: number;
}

function copyRecord(record: SolveRecord): SolveRecord {
  return {
    ...record,
    scramble: [...record.scramble]
  };
}

function calculateAverage(records: readonly SolveRecord[], size: number): number | undefined {
  if (records.length < size) return undefined;

  const times = records.slice(-size).map((record) => record.timeMs);
  const total = times.reduce((sum, time) => sum + time, 0);

  return (total - Math.min(...times) - Math.max(...times)) / (size - 2);
}

export class SolveHistory {
  readonly #records: SolveRecord[];

  constructor(records: readonly SolveRecord[] = []) {
    this.#records = records.map(copyRecord);
  }

  add(record: SolveRecord): void {
    this.#records.push(copyRecord(record));
  }

  getAll(): readonly SolveRecord[] {
    return this.#records.map(copyRecord);
  }

  getLast(): SolveRecord | undefined {
    const record = this.#records.at(-1);

    return record === undefined ? undefined : copyRecord(record);
  }

  getBest(): SolveRecord | undefined {
    if (this.#records.length === 0) return undefined;

    return copyRecord(this.#records.reduce((best, record) => (
      record.timeMs < best.timeMs ? record : best
    )));
  }

  getAo5(): number | undefined {
    return calculateAverage(this.#records, 5);
  }

  getAo12(): number | undefined {
    return calculateAverage(this.#records, 12);
  }

  clear(): void {
    this.#records.length = 0;
  }
}
