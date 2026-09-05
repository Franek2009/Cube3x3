import type { Move } from '../core/moves/moves.ts';
import type { CubeRotation } from '../core/orientation/cubeOrientation.ts';
import type { CubeAction } from './cubeAction.ts';

const KEY_MOVES: Readonly<Record<string, Move>> = {
  u: 'U',
  d: 'D',
  l: 'L',
  r: 'R',
  f: 'F',
  b: 'B'
};

export function keyboardEventToMove(key: string, shiftKey: boolean): Move | undefined {
  const baseMove = KEY_MOVES[key.toLowerCase()];

  if (baseMove === undefined) {
    return undefined;
  }

  const isUppercaseLetter = key !== key.toLowerCase() && key === key.toUpperCase();

  return shiftKey || isUppercaseLetter ? `${baseMove}'` as Move : baseMove;
}

export function keyboardEventToAction(
  key: string,
  shiftKey: boolean
): CubeAction | undefined {
  const move = keyboardEventToMove(key, shiftKey);
  if (move !== undefined) return move;

  const axis = key.toLowerCase();
  if (axis !== 'x' && axis !== 'y' && axis !== 'z') return undefined;

  const isUppercaseLetter = key !== key.toLowerCase() && key === key.toUpperCase();
  return shiftKey || isUppercaseLetter ? `${axis}'` as CubeRotation : axis;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.matches('input, textarea, select') ||
    target.isContentEditable ||
    target.closest('[contenteditable="true"]') !== null
  );
}

export function installKeyboardControls(onAction: (action: CubeAction) => void): () => void {
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target)) {
      return;
    }

    const action = keyboardEventToAction(event.key, event.shiftKey);

    if (action !== undefined) {
      event.preventDefault();
      onAction(action);
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  return () => document.removeEventListener('keydown', handleKeyDown);
}
