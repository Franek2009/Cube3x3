import { isEditableTarget } from '../keyboard.ts';

export interface SatisfactionRoomShortcutOptions {
  readonly isRoomOpen: () => boolean;
  readonly toggleRoom: () => void;
  readonly closeRoom: () => void;
  readonly target?: Window;
}

function isToggleShortcut(event: KeyboardEvent): boolean {
  return (
    event.code === 'KeyS' &&
    event.ctrlKey &&
    event.shiftKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.repeat
  );
}

export function installSatisfactionRoomShortcut(
  options: SatisfactionRoomShortcutOptions
): () => void {
  const target = options.target ?? window;
  const handleKeyDown = (event: KeyboardEvent): void => {
    const open = options.isRoomOpen();
    if (isToggleShortcut(event) && (open || !isEditableTarget(event.target))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      options.toggleRoom();
      return;
    }
    if (!open) return;
    if (event.code === 'Escape' && !event.repeat) {
      event.preventDefault();
      event.stopImmediatePropagation();
      options.closeRoom();
      return;
    }
    event.stopImmediatePropagation();
  };

  target.addEventListener('keydown', handleKeyDown, true);
  return () => target.removeEventListener('keydown', handleKeyDown, true);
}
