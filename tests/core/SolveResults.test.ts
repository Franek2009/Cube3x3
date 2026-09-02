import { describe, expect, it } from 'vitest';

import { SolveHistory, type SolveRecord } from '../../src/core/results/SolveResults.ts';

function record(timeMs: number, completedAt: number = timeMs): SolveRecord {
  return { timeMs, scramble: ['R', 'U'], moveCount: 20, completedAt };
}

function historyWithTimes(times: readonly number[]): SolveHistory {
  return new SolveHistory(times.map((time, index) => record(time, index)));
}

describe('SolveHistory', () => {
  it('starts empty', () => {
    const history = new SolveHistory();

    expect(history.getAll()).toEqual([]);
    expect(history.getLast()).toBeUndefined();
    expect(history.getBest()).toBeUndefined();
  });

  it('adds records in chronological order and returns copies', () => {
    const history = new SolveHistory();
    const first = record(2000, 1);
    const second = record(1000, 2);

    history.add(first);
    history.add(second);
    const returned = history.getAll();

    expect(returned).toEqual([first, second]);
    expect(returned).not.toBe(history.getAll());
    expect(returned[0]?.scramble).not.toBe(first.scramble);
  });

  it('returns the last record', () => {
    const history = historyWithTimes([3000, 2000, 2500]);

    expect(history.getLast()?.timeMs).toBe(2500);
  });

  it('returns the best record from multiple results', () => {
    const history = historyWithTimes([3000, 1500, 2000]);

    expect(history.getBest()?.timeMs).toBe(1500);
  });

  it('returns undefined Ao5 with fewer than five records', () => {
    expect(historyWithTimes([1000, 2000, 3000, 4000]).getAo5()).toBeUndefined();
  });

  it('calculates Ao5 after removing one best and one worst', () => {
    expect(historyWithTimes([1000, 2000, 3000, 4000, 5000]).getAo5()).toBe(3000);
  });

  it('uses only the latest five records for Ao5', () => {
    expect(historyWithTimes([100_000, 1000, 2000, 3000, 4000, 5000]).getAo5()).toBe(3000);
  });

  it('removes exactly one best and one worst when times are equal', () => {
    expect(historyWithTimes([1000, 1000, 2000, 3000, 3000]).getAo5()).toBe(2000);
  });

  it('returns undefined Ao12 with fewer than twelve records', () => {
    expect(historyWithTimes(Array.from({ length: 11 }, (_, index) => index + 1)).getAo12())
      .toBeUndefined();
  });

  it('calculates Ao12 after removing one best and one worst', () => {
    expect(historyWithTimes(Array.from({ length: 12 }, (_, index) => (index + 1) * 1000)).getAo12())
      .toBe(6500);
  });

  it('uses only the latest twelve records for Ao12', () => {
    const latest = Array.from({ length: 12 }, (_, index) => (index + 1) * 1000);

    expect(historyWithTimes([100_000, ...latest]).getAo12()).toBe(6500);
  });

  it('clears every record', () => {
    const history = historyWithTimes([1000, 2000]);

    history.clear();

    expect(history.getAll()).toEqual([]);
  });
});
