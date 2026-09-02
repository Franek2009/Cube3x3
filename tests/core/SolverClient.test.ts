import { describe, expect, it } from 'vitest';

import { solvedState } from '../../src/core/cube/CubeState.ts';
import { SolverClient, type WorkerLike } from '../../src/core/solver/SolverClient.ts';
import type {
  SolverWorkerRequest,
  SolverWorkerResponse
} from '../../src/core/solver/solverWorkerProtocol.ts';

class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  onmessageerror: WorkerLike['onmessageerror'] = null;
  readonly messages: SolverWorkerRequest[] = [];
  terminateCount = 0;
  postError: Error | undefined;

  postMessage(message: SolverWorkerRequest): void {
    if (this.postError !== undefined) throw this.postError;
    this.messages.push(message);
  }

  terminate(): void {
    this.terminateCount += 1;
  }

  emit(response: SolverWorkerResponse | unknown): void {
    this.onmessage?.({ data: response });
  }

  crash(error = new Error('worker crashed')): void {
    this.onerror?.({ error, message: error.message });
  }

  messageError(): void {
    this.onmessageerror?.({ message: 'decode failure' });
  }
}

function createClient(): { client: SolverClient; worker: FakeWorker } {
  const worker = new FakeWorker();
  return {
    client: new SolverClient({ workerFactory: () => worker }),
    worker
  };
}

async function makeReady(client: SolverClient, worker: FakeWorker): Promise<void> {
  const ready = client.prewarm();
  expect(worker.messages).toEqual([{ type: 'init', id: 1 }]);
  worker.emit({ type: 'ready', id: 1 });
  await ready;
}

describe('SolverClient', () => {
  it('deduplicates prewarm and resolves on the correlated ready response', async () => {
    const { client, worker } = createClient();
    const first = client.prewarm();
    const second = client.prewarm();

    expect(second).toBe(first);
    expect(worker.messages).toEqual([{ type: 'init', id: 1 }]);

    worker.emit({ type: 'ready', id: 1 });
    await expect(first).resolves.toBeUndefined();
    expect(client.prewarm()).toBe(first);
  });

  it('waits for prewarm before posting solve and freezes returned moves', async () => {
    const { client, worker } = createClient();
    const solution = client.solve(solvedState().applyMove('R'), { maxDepth: 1 });

    expect(worker.messages).toHaveLength(1);
    expect(worker.messages[0]).toEqual({ type: 'init', id: 1 });
    worker.emit({ type: 'ready', id: 1 });
    await Promise.resolve();

    expect(worker.messages[1]).toMatchObject({ type: 'solve', id: 2, options: { maxDepth: 1 } });
    worker.emit({
      type: 'result',
      id: 2,
      result: { solved: true, moves: ["R'"], depth: 1 }
    });

    const result = await solution;
    expect(result).toEqual({ solved: true, moves: ["R'"], depth: 1 });
    if (!result.solved) throw new Error('Expected solution');
    expect(Object.isFrozen(result.moves)).toBe(true);
    expect(() => (result.moves as string[]).push('U')).toThrow(TypeError);
  });

  it('correlates multiple pending solves even when responses arrive out of order', async () => {
    const { client, worker } = createClient();
    await makeReady(client, worker);
    const first = client.solve(solvedState());
    const second = client.solve(solvedState().applyMove('R'));
    await Promise.resolve();

    expect(worker.messages.slice(1).map((message) => message.id)).toEqual([2, 3]);
    worker.emit({
      type: 'result',
      id: 3,
      result: { solved: false, reason: 'depth-limit' }
    });
    worker.emit({
      type: 'result',
      id: 2,
      result: { solved: true, moves: [], depth: 0 }
    });

    await expect(first).resolves.toEqual({ solved: true, moves: [], depth: 0 });
    await expect(second).resolves.toEqual({ solved: false, reason: 'depth-limit' });
  });

  it('resolves invalid-state as a normal result', async () => {
    const { client, worker } = createClient();
    await makeReady(client, worker);
    const result = client.solve(solvedState());
    await Promise.resolve();
    worker.emit({
      type: 'result',
      id: 2,
      result: {
        solved: false,
        reason: 'invalid-state',
        validationError: 'permutation-parity-mismatch'
      }
    });

    await expect(result).resolves.toEqual({
      solved: false,
      reason: 'invalid-state',
      validationError: 'permutation-parity-mismatch'
    });
  });

  it('rejects a solve with the restored serialized error without killing the worker', async () => {
    const { client, worker } = createClient();
    await makeReady(client, worker);
    const result = client.solve(solvedState());
    await Promise.resolve();
    worker.emit({
      type: 'error',
      id: 2,
      error: { name: 'RangeError', message: 'invalid depth' }
    });

    await expect(result).rejects.toBeInstanceOf(RangeError);
    expect(worker.terminateCount).toBe(0);
  });

  it('treats initialization errors as fatal', async () => {
    const { client, worker } = createClient();
    const ready = client.prewarm();
    worker.emit({
      type: 'error',
      id: 1,
      error: { name: 'Error', message: 'tables failed' }
    });

    await expect(ready).rejects.toThrow('tables failed');
    await expect(client.solve(solvedState())).rejects.toThrow('tables failed');
    expect(worker.terminateCount).toBe(1);
  });

  it('rejects all pending requests when the worker crashes or emits messageerror', async () => {
    const first = createClient();
    const firstReady = first.client.prewarm();
    first.worker.crash();
    await expect(firstReady).rejects.toThrow('worker crashed');
    expect(first.worker.terminateCount).toBe(1);

    const second = createClient();
    const secondReady = second.client.prewarm();
    second.worker.messageError();
    await expect(secondReady).rejects.toThrow('decode failure');
    expect(second.worker.terminateCount).toBe(1);
  });

  it('fails deterministically for malformed, unknown, duplicate, or mismatched responses', async () => {
    for (const response of [
      { invalid: true },
      { type: 'ready', id: 99 },
      { type: 'result', id: 1, result: { solved: true, moves: [], depth: 0 } }
    ]) {
      const { client, worker } = createClient();
      const ready = client.prewarm();
      worker.emit(response);
      await expect(ready).rejects.toBeInstanceOf(Error);
      expect(worker.terminateCount).toBe(1);
    }

    const duplicate = createClient();
    const ready = duplicate.client.prewarm();
    duplicate.worker.emit({ type: 'ready', id: 1 });
    await ready;
    duplicate.worker.emit({ type: 'ready', id: 1 });
    await expect(duplicate.client.solve(solvedState())).rejects.toThrow(
      'unknown request ID'
    );
  });

  it('treats an uncorrelated worker error as fatal', async () => {
    const { client, worker } = createClient();
    const ready = client.prewarm();
    worker.emit({
      type: 'error',
      id: null,
      error: { name: 'TypeError', message: 'bad envelope' }
    });

    await expect(ready).rejects.toBeInstanceOf(TypeError);
    expect(worker.terminateCount).toBe(1);
  });

  it('dispose is idempotent, rejects pending and blocks future operations', async () => {
    const { client, worker } = createClient();
    const ready = client.prewarm();

    client.dispose();
    client.dispose();

    await expect(ready).rejects.toThrow('SolverClient has been disposed');
    await expect(client.prewarm()).rejects.toThrow('SolverClient has been disposed');
    await expect(client.solve(solvedState())).rejects.toThrow(
      'SolverClient has been disposed'
    );
    expect(worker.terminateCount).toBe(1);
  });

  it('blocks prewarm after a completed initialization is disposed', async () => {
    const { client, worker } = createClient();
    await makeReady(client, worker);

    client.dispose();

    await expect(client.prewarm()).rejects.toThrow('SolverClient has been disposed');
    expect(worker.terminateCount).toBe(1);
  });

  it('turns synchronous postMessage failures into terminal rejections', async () => {
    const { client, worker } = createClient();
    worker.postError = new Error('post failed');

    await expect(client.prewarm()).rejects.toThrow('post failed');
    await expect(client.solve(solvedState())).rejects.toThrow('post failed');
    expect(worker.terminateCount).toBe(1);
  });
});
