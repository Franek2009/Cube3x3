import type { CubeAction } from './cubeAction.ts';
import { bindingFromKeyboardEvent, findActionForBinding, type KeybindingMap } from './keybindings.ts';

export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.matches('input, textarea, select') ||
    target.isContentEditable ||
    target.closest('[contenteditable="true"]') !== null
  );
}

export interface KeyboardControlsOptions {
  readonly getBindings: () => KeybindingMap;
  readonly isCaptureActive: () => boolean;
  readonly onAction: (action: CubeAction) => void;
  readonly target?: Document;
}

export function keyboardEventToAction(
  event: Parameters<typeof bindingFromKeyboardEvent>[0],
  bindings: KeybindingMap
): CubeAction | undefined {
  const binding = bindingFromKeyboardEvent(event);
  return binding === undefined ? undefined : findActionForBinding(bindings, binding);
}

export function installKeyboardControls(options: KeyboardControlsOptions): () => void {
  const target = options.target ?? document;
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (options.isCaptureActive() || event.repeat || isEditableTarget(event.target)) return;
    const action = keyboardEventToAction(event, options.getBindings());
    if (action === undefined) return;
    event.preventDefault();
    options.onAction(action);
  };

  target.addEventListener('keydown', handleKeyDown);
  return () => target.removeEventListener('keydown', handleKeyDown);
}
