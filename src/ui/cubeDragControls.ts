import type { CubeRotation } from '../core/orientation/cubeOrientation.ts';

export interface DragVector {
  readonly deltaX: number;
  readonly deltaY: number;
}

export const CUBE_DRAG_THRESHOLD_PX = 32;
export const CUBE_DRAG_DOMINANCE_RATIO = 1.25;

export function interpretCubeDrag(
  drag: DragVector,
  thresholdPx: number = CUBE_DRAG_THRESHOLD_PX
): CubeRotation | undefined {
  const horizontal = Math.abs(drag.deltaX);
  const vertical = Math.abs(drag.deltaY);
  const dominant = Math.max(horizontal, vertical);
  const minor = Math.min(horizontal, vertical);

  if (dominant < thresholdPx) return undefined;
  if (minor > 0 && dominant < minor * CUBE_DRAG_DOMINANCE_RATIO) return undefined;

  if (horizontal > vertical) return drag.deltaX < 0 ? 'y' : "y'";
  if (vertical > horizontal) return drag.deltaY < 0 ? 'x' : "x'";
  return undefined;
}

interface ActiveDrag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  lastX: number;
  lastY: number;
}

export function installCubeDragControls(
  element: HTMLElement,
  onRotation: (rotation: CubeRotation) => void
): () => void {
  let activeDrag: ActiveDrag | undefined;

  const clearDrag = (releaseCapture: boolean): ActiveDrag | undefined => {
    const drag = activeDrag;
    activeDrag = undefined;
    element.classList.remove('is-dragging');

    if (
      releaseCapture &&
      drag !== undefined &&
      element.hasPointerCapture(drag.pointerId)
    ) {
      element.releasePointerCapture(drag.pointerId);
    }

    return drag;
  };

  const handlePointerDown = (event: PointerEvent): void => {
    if (activeDrag !== undefined) {
      clearDrag(false);
      return;
    }

    if (!event.isPrimary || event.button !== 0) return;

    activeDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY
    };
    element.setPointerCapture(event.pointerId);
    element.classList.add('is-dragging');
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (activeDrag?.pointerId !== event.pointerId) return;
    activeDrag.lastX = event.clientX;
    activeDrag.lastY = event.clientY;
  };

  const handlePointerUp = (event: PointerEvent): void => {
    if (activeDrag?.pointerId !== event.pointerId) return;

    activeDrag.lastX = event.clientX;
    activeDrag.lastY = event.clientY;

    const drag = clearDrag(true);
    if (drag === undefined) return;

    const rotation = interpretCubeDrag({
      deltaX: drag.lastX - drag.startX,
      deltaY: drag.lastY - drag.startY
    });
    if (rotation !== undefined) onRotation(rotation);
  };

  const handlePointerCancel = (event: PointerEvent): void => {
    if (activeDrag?.pointerId === event.pointerId) clearDrag(true);
  };

  const handleLostPointerCapture = (event: PointerEvent): void => {
    if (activeDrag?.pointerId === event.pointerId) clearDrag(false);
  };

  element.addEventListener('pointerdown', handlePointerDown);
  element.addEventListener('pointermove', handlePointerMove);
  element.addEventListener('pointerup', handlePointerUp);
  element.addEventListener('pointercancel', handlePointerCancel);
  element.addEventListener('lostpointercapture', handleLostPointerCapture);

  return () => {
    clearDrag(true);
    element.removeEventListener('pointerdown', handlePointerDown);
    element.removeEventListener('pointermove', handlePointerMove);
    element.removeEventListener('pointerup', handlePointerUp);
    element.removeEventListener('pointercancel', handlePointerCancel);
    element.removeEventListener('lostpointercapture', handleLostPointerCapture);
  };
}
