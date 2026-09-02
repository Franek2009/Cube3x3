import { describe, expect, it } from 'vitest';

import type { SolveRecord } from '../../src/core/results/SolveResults.ts';
import {
  clearSolveRecords,
  loadSolveRecords,
  saveSolveRecords,
  SOLVE_HISTORY_STORAGE_KEY,
  type KeyValueStorage
} from '../../src/core/results/solveStorage.ts';

class FakeStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const validRecord: SolveRecord = {
  timeMs: 1234.5,
  scramble: ['R', "U'", 'F2'],
  moveCount: 42,
  completedAt: 1_700_000_000_000
};

describe('solve storage', () => {
  it('saves and loads typed solve records', () => {
    const storage = new FakeStorage();

    saveSolveRecords(storage, [validRecord]);

    expect(loadSolveRecords(storage)).toEqual([validRecord]);
  });

  it('returns an empty history for corrupted JSON', () => {
    const storage = new FakeStorage();
    storage.values.set(SOLVE_HISTORY_STORAGE_KEY, '{broken');

    expect(loadSolveRecords(storage)).toEqual([]);
  });

  it.each([
    {},
    [null],
    [{ ...validRecord, timeMs: Number.POSITIVE_INFINITY }],
    [{ ...validRecord, timeMs: -1 }],
    [{ ...validRecord, moveCount: 1.5 }],
    [{ ...validRecord, moveCount: -1 }],
    [{ ...validRecord, completedAt: Number.NaN }],
    [{ ...validRecord, completedAt: -1 }],
    [{ ...validRecord, scramble: 'R U' }]
  ])('returns an empty history for an invalid payload %#', (payload) => {
    const storage = new FakeStorage();
    storage.values.set(SOLVE_HISTORY_STORAGE_KEY, JSON.stringify(payload));

    expect(loadSolveRecords(storage)).toEqual([]);
  });

  it('returns an empty history when a scramble contains an invalid move', () => {
    const storage = new FakeStorage();
    storage.values.set(
      SOLVE_HISTORY_STORAGE_KEY,
      JSON.stringify([{ ...validRecord, scramble: ['R', 'X'] }])
    );

    expect(loadSolveRecords(storage)).toEqual([]);
  });

  it('removes the storage key when clearing records', () => {
    const storage = new FakeStorage();
    saveSolveRecords(storage, [validRecord]);

    clearSolveRecords(storage);

    expect(storage.getItem(SOLVE_HISTORY_STORAGE_KEY)).toBeNull();
  });
});
