export type SolveTimerState = 'idle' | 'ready' | 'running' | 'stopped';

export class SolveTimer {
  #state: SolveTimerState = 'idle';
  #startedAt = 0;
  #elapsedMs = 0;

  getState(): SolveTimerState {
    return this.#state;
  }

  getElapsedMs(now: number = performance.now()): number {
    if (this.#state === 'running') {
      return Math.max(0, now - this.#startedAt);
    }

    return this.#elapsedMs;
  }

  prepare(): void {
    this.#state = 'ready';
    this.#startedAt = 0;
    this.#elapsedMs = 0;
  }

  start(now: number = performance.now()): void {
    if (this.#state !== 'ready') {
      throw new Error(`Cannot start timer from ${this.#state} state`);
    }

    this.#state = 'running';
    this.#startedAt = now;
  }

  stop(now: number = performance.now()): number {
    if (this.#state !== 'running') {
      throw new Error(`Cannot stop timer from ${this.#state} state`);
    }

    this.#elapsedMs = this.getElapsedMs(now);
    this.#state = 'stopped';

    return this.#elapsedMs;
  }

  reset(): void {
    this.#state = 'idle';
    this.#startedAt = 0;
    this.#elapsedMs = 0;
  }
}

export function formatElapsedTime(ms: number): string {
  const totalCentiseconds = Math.floor(Math.max(0, ms) / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  const fraction = String(centiseconds).padStart(2, '0');

  if (minutes === 0) {
    return `${seconds}.${fraction}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}.${fraction}`;
}
