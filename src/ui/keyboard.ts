import type { Move } from '../core/moves/moves.ts';

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

export function installKeyboardControls(onMove: (move: Move) => void): () => void {
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target)) {
      return;
    }

    const move = keyboardEventToMove(event.key, event.shiftKey);

    if (move !== undefined) {
      event.preventDefault();
      onMove(move);
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  return () => document.removeEventListener('keydown', handleKeyDown);
}
