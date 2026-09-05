export class AnimationTransitionCancelledError extends Error {
  constructor() {
    super('Animation transition was cancelled');
    this.name = 'AnimationTransitionCancelledError';
  }
}

export interface AnimationTransitionSettlement {
  readonly promise: Promise<void>;
  readonly complete: () => void;
  readonly fail: (error: unknown) => void;
  readonly cancel: () => void;
}

export function createAnimationTransitionSettlement(): AnimationTransitionSettlement {
  let settled = false;
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    complete: () => {
      if (settled) return;
      settled = true;
      resolve();
    },
    fail: (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    },
    cancel: () => {
      if (settled) return;
      settled = true;
      reject(new AnimationTransitionCancelledError());
    }
  };
}
