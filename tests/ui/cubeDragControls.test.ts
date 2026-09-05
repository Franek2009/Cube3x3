import { describe, expect, it, vi } from 'vitest';

import type { CubeRotation } from '../../src/core/orientation/cubeOrientation.ts';
import {
  CUBE_DRAG_THRESHOLD_PX,
  installCubeDragControls,
  interpretCubeDrag
} from '../../src/ui/cubeDragControls.ts';

describe('interpretCubeDrag', () => {
  it.each([
    [{ deltaX: -32, deltaY: 0 }, 'y'],
    [{ deltaX: 32, deltaY: 0 }, "y'"],
    [{ deltaX: 0, deltaY: -32 }, 'x'],
    [{ deltaX: 0, deltaY: 32 }, "x'"]
  ] as const)('maps $0 to $1', (drag, rotation) => {
    expect(interpretCubeDrag(drag)).toBe(rotation);
  });

  it('accepts the threshold and rejects movement immediately below it', () => {
    expect(interpretCubeDrag({ deltaX: CUBE_DRAG_THRESHOLD_PX, deltaY: 0 })).toBe("y'");
    expect(interpretCubeDrag({ deltaX: CUBE_DRAG_THRESHOLD_PX - 1, deltaY: 0 }))
      .toBeUndefined();
  });

  it.each([
    { deltaX: 0, deltaY: 0 },
    { deltaX: 8, deltaY: -6 },
    { deltaX: 31, deltaY: 31 }
  ])('ignores clicks, jitter and short movement %#', (drag) => {
    expect(interpretCubeDrag(drag)).toBeUndefined();
  });

  it('uses a clearly dominant diagonal axis', () => {
    expect(interpretCubeDrag({ deltaX: -80, deltaY: 40 })).toBe('y');
    expect(interpretCubeDrag({ deltaX: 40, deltaY: 80 })).toBe("x'");
  });

  it('rejects ambiguous diagonal movement', () => {
    expect(interpretCubeDrag({ deltaX: 80, deltaY: 80 })).toBeUndefined();
    expect(interpretCubeDrag({ deltaX: 99, deltaY: 80 })).toBeUndefined();
  });

  it('allows an explicit threshold for isolated consumers', () => {
    expect(interpretCubeDrag({ deltaX: 10, deltaY: 0 }, 10)).toBe("y'");
  });
});

interface PointerEventInitForTest {
  readonly pointerId: number;
  readonly clientX?: number;
  readonly clientY?: number;
  readonly button?: number;
  readonly isPrimary?: boolean;
  readonly pointerType?: string;
}

function pointerEvent(type: string, init: PointerEventInitForTest): PointerEvent {
  const event = new Event(type);
  Object.assign(event, {
    clientX: 0,
    clientY: 0,
    button: 0,
    isPrimary: true,
    pointerType: 'mouse',
    ...init
  });
  return event as PointerEvent;
}

class FakeInteractionElement extends EventTarget {
  readonly capturedPointers = new Set<number>();
  readonly classes = new Set<string>();
  readonly classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name)
  };

  setPointerCapture(pointerId: number): void {
    this.capturedPointers.add(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.capturedPointers.has(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    this.capturedPointers.delete(pointerId);
  }
}

function createHarness() {
  const element = new FakeInteractionElement();
  const rotations: CubeRotation[] = [];
  const remove = installCubeDragControls(
    element as unknown as HTMLElement,
    (rotation) => rotations.push(rotation)
  );
  const dispatch = (type: string, init: PointerEventInitForTest) => {
    element.dispatchEvent(pointerEvent(type, init));
  };
  return { element, rotations, remove, dispatch };
}

describe('cube drag pointer controls', () => {
  it.each([
    [-40, 0, 'y'],
    [40, 0, "y'"],
    [0, -40, 'x'],
    [0, 40, "x'"]
  ] as const)('emits one rotation for drag (%s, %s)', (deltaX, deltaY, rotation) => {
    const harness = createHarness();
    harness.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    harness.dispatch('pointermove', {
      pointerId: 1,
      clientX: 100 + deltaX,
      clientY: 100 + deltaY
    });
    harness.dispatch('pointerup', {
      pointerId: 1,
      clientX: 100 + deltaX,
      clientY: 100 + deltaY
    });

    expect(harness.rotations).toEqual([rotation]);
  });

  it('turns a very long drag into exactly one quarter rotation', () => {
    const harness = createHarness();
    harness.dispatch('pointerdown', { pointerId: 1 });
    harness.dispatch('pointermove', { pointerId: 1, clientX: 500 });
    harness.dispatch('pointerup', { pointerId: 1, clientX: 1000 });

    expect(harness.rotations).toEqual(["y'"]);
  });

  it.each(['mouse', 'touch', 'pen'])('accepts primary %s input', (pointerType) => {
    const harness = createHarness();
    harness.dispatch('pointerdown', { pointerId: 1, pointerType });
    harness.dispatch('pointerup', { pointerId: 1, clientY: -40, pointerType });

    expect(harness.rotations).toEqual(['x']);
  });

  it.each([1, 2])('ignores mouse button %s', (button) => {
    const harness = createHarness();
    harness.dispatch('pointerdown', { pointerId: 1, button });
    harness.dispatch('pointerup', { pointerId: 1, clientX: 100, button });

    expect(harness.rotations).toEqual([]);
  });

  it('sets capture and dragging feedback, then safely releases both', () => {
    const harness = createHarness();
    harness.dispatch('pointerdown', { pointerId: 7 });

    expect(harness.element.capturedPointers.has(7)).toBe(true);
    expect(harness.element.classes.has('is-dragging')).toBe(true);

    harness.dispatch('pointerup', { pointerId: 7 });
    expect(harness.element.capturedPointers.has(7)).toBe(false);
    expect(harness.element.classes.has('is-dragging')).toBe(false);
  });

  it.each(['pointercancel', 'lostpointercapture'])(
    'cancels without emitting on %s',
    (eventType) => {
      const harness = createHarness();
      harness.dispatch('pointerdown', { pointerId: 1 });
      harness.dispatch('pointermove', { pointerId: 1, clientX: 100 });
      harness.dispatch(eventType, { pointerId: 1, clientX: 100 });
      harness.dispatch('pointerup', { pointerId: 1, clientX: 100 });

      expect(harness.rotations).toEqual([]);
    }
  );

  it('ignores events from an unrelated pointer', () => {
    const harness = createHarness();
    harness.dispatch('pointerdown', { pointerId: 1 });
    harness.dispatch('pointermove', { pointerId: 2, clientX: 100 });
    harness.dispatch('pointerup', { pointerId: 2, clientX: 100 });
    harness.dispatch('pointerup', { pointerId: 1 });

    expect(harness.rotations).toEqual([]);
  });

  it('cancels single-pointer drag when a second pointer begins', () => {
    const harness = createHarness();
    harness.dispatch('pointerdown', { pointerId: 1, pointerType: 'touch' });
    harness.dispatch('pointermove', { pointerId: 1, clientX: 100, pointerType: 'touch' });
    harness.dispatch('pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      isPrimary: false
    });
    harness.dispatch('pointerup', { pointerId: 1, clientX: 100, pointerType: 'touch' });

    expect(harness.rotations).toEqual([]);
  });

  it('does not call back after cleanup and removes active feedback', () => {
    const harness = createHarness();
    harness.dispatch('pointerdown', { pointerId: 1 });
    harness.remove();
    harness.dispatch('pointerdown', { pointerId: 2 });
    harness.dispatch('pointerup', { pointerId: 2, clientX: 100 });

    expect(harness.rotations).toEqual([]);
    expect(harness.element.classes.has('is-dragging')).toBe(false);
  });

  it('passes the recognized CubeRotation directly to the supplied pipeline', () => {
    const element = new FakeInteractionElement();
    const applyUserRotation = vi.fn<(rotation: CubeRotation) => void>();
    installCubeDragControls(element as unknown as HTMLElement, applyUserRotation);

    element.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1 }));
    element.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: -50 }));

    expect(applyUserRotation).toHaveBeenCalledOnce();
    expect(applyUserRotation).toHaveBeenCalledWith('y');
  });
});
