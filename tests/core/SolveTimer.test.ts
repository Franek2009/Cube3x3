import { describe, expect, it } from 'vitest';

import { formatElapsedTime, SolveTimer } from '../../src/core/timer/SolveTimer.ts';

describe('SolveTimer', () => {
  it('starts idle with zero elapsed time', () => {
    const timer = new SolveTimer();

    expect(timer.getState()).toBe('idle');
    expect(timer.getElapsedMs(1000)).toBe(0);
  });

  it('prepare enters ready and clears elapsed time', () => {
    const timer = new SolveTimer();
    timer.prepare();
    timer.start(100);
    timer.stop(350);

    timer.prepare();

    expect(timer.getState()).toBe('ready');
    expect(timer.getElapsedMs(1000)).toBe(0);
  });

  it('starts only from ready', () => {
    const timer = new SolveTimer();

    expect(() => timer.start(100)).toThrow('Cannot start timer from idle state');

    timer.prepare();
    timer.start(100);

    expect(timer.getState()).toBe('running');
  });

  it('reports elapsed time while running', () => {
    const timer = new SolveTimer();
    timer.prepare();
    timer.start(125);

    expect(timer.getElapsedMs(1375)).toBe(1250);
  });

  it('does not report negative elapsed time if the supplied clock moves backwards', () => {
    const timer = new SolveTimer();
    timer.prepare();
    timer.start(200);

    expect(timer.getElapsedMs(150)).toBe(0);
  });

  it('stop returns the final elapsed time', () => {
    const timer = new SolveTimer();
    timer.prepare();
    timer.start(100);

    expect(timer.stop(1334)).toBe(1234);
    expect(timer.getState()).toBe('stopped');
  });

  it('keeps stopped elapsed time fixed', () => {
    const timer = new SolveTimer();
    timer.prepare();
    timer.start(100);
    timer.stop(1334);

    expect(timer.getElapsedMs(5000)).toBe(1234);
  });

  it('reset enters idle and clears elapsed time', () => {
    const timer = new SolveTimer();
    timer.prepare();
    timer.start(100);
    timer.stop(1334);

    timer.reset();

    expect(timer.getState()).toBe('idle');
    expect(timer.getElapsedMs(5000)).toBe(0);
  });

  it('allows reset and prepare from any state', () => {
    const timer = new SolveTimer();
    timer.prepare();
    timer.start(100);

    timer.prepare();
    expect(timer.getState()).toBe('ready');
    expect(timer.getElapsedMs(500)).toBe(0);

    timer.reset();
    expect(timer.getState()).toBe('idle');
    expect(timer.getElapsedMs(500)).toBe(0);
  });

  it('throws when starting from a state other than ready', () => {
    const timer = new SolveTimer();
    timer.prepare();
    timer.start(100);

    expect(() => timer.start(200)).toThrow('Cannot start timer from running state');

    timer.stop(300);
    expect(() => timer.start(400)).toThrow('Cannot start timer from stopped state');
  });

  it('throws when stopping from a state other than running', () => {
    const timer = new SolveTimer();

    expect(() => timer.stop(100)).toThrow('Cannot stop timer from idle state');

    timer.prepare();
    expect(() => timer.stop(200)).toThrow('Cannot stop timer from ready state');

    timer.start(300);
    timer.stop(400);
    expect(() => timer.stop(500)).toThrow('Cannot stop timer from stopped state');
  });
});

describe('formatElapsedTime', () => {
  it.each([
    [0, '0.00'],
    [9, '0.00'],
    [10, '0.01'],
    [1234, '1.23'],
    [59999, '59.99'],
    [60000, '1:00.00'],
    [60009, '1:00.00'],
    [125678, '2:05.67']
  ] as const)('formats %d ms as %s', (ms, expected) => {
    expect(formatElapsedTime(ms)).toBe(expected);
  });

  it('clamps negative values to zero', () => {
    expect(formatElapsedTime(-1)).toBe('0.00');
  });
});
