import { describe, expect, it, vi } from 'vitest';

import {
  AnimationTransitionCancelledError,
  createAnimationTransitionSettlement
} from '../../src/ui/animationTransition.ts';

describe('animation transition settlement', () => {
  it('resolves a completed transition', async () => {
    const transition = createAnimationTransitionSettlement();

    transition.complete();

    await expect(transition.promise).resolves.toBeUndefined();
  });

  it('rejects a cancelled transition explicitly', async () => {
    const transition = createAnimationTransitionSettlement();

    transition.cancel();

    await expect(transition.promise).rejects.toBeInstanceOf(AnimationTransitionCancelledError);
  });

  it('keeps cancellation final when the renderer later resolves or rejects', async () => {
    const transition = createAnimationTransitionSettlement();
    const rejection = vi.fn();
    void transition.promise.catch(rejection);

    transition.cancel();
    transition.complete();
    transition.fail(new Error('late renderer failure'));
    await transition.promise.catch(() => undefined);

    expect(rejection).toHaveBeenCalledOnce();
    expect(rejection.mock.calls[0]?.[0]).toBeInstanceOf(AnimationTransitionCancelledError);
  });

  it('does not replace a completed transition with a later cancellation', async () => {
    const transition = createAnimationTransitionSettlement();

    transition.complete();
    transition.cancel();

    await expect(transition.promise).resolves.toBeUndefined();
  });
});
