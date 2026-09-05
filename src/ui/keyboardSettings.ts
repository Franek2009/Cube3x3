import { ALL_MOVES } from '../core/moves/moves.ts';
import { CUBE_ROTATIONS } from '../core/orientation/cubeOrientation.ts';
import {
  assignBinding,
  bindingFromKeyboardEvent,
  clearBinding,
  createDefaultKeybindings,
  findBindingConflict,
  formatBinding,
  type KeybindingAction,
  type KeybindingMap
} from './keybindings.ts';

export interface KeyboardSettingsDependencies {
  readonly initialBindings: KeybindingMap;
  readonly onBindingsChange: (bindings: KeybindingMap) => void;
  readonly onResetDefaults: (bindings: KeybindingMap) => void;
  readonly confirmReset?: () => boolean;
}

export interface KeyboardSettingsController {
  readonly isCapturing: () => boolean;
  readonly cancelCapture: () => void;
  readonly dispose: () => void;
}

export function createKeyboardSettingsController(
  root: HTMLElement,
  toggleButton: HTMLButtonElement,
  dependencies: KeyboardSettingsDependencies
): KeyboardSettingsController {
  const ownerDocument = root.ownerDocument;
  let bindings = dependencies.initialBindings;
  let capturingAction: KeybindingAction | undefined;
  let status = '';
  let disposed = false;
  let expanded = false;

  const renderExpandedState = (): void => {
    root.hidden = !expanded;
    toggleButton.textContent = expanded ? 'Close' : 'Configure';
    toggleButton.setAttribute('aria-expanded', String(expanded));
  };

  const setBindings = (next: KeybindingMap): void => {
    bindings = next;
    dependencies.onBindingsChange(next);
  };

  const render = (): void => {
    root.replaceChildren();
    const groups = [
      { title: 'Face moves', actions: ALL_MOVES },
      { title: 'Cube rotations', actions: CUBE_ROTATIONS }
    ] as const;

    for (const group of groups) {
      const section = ownerDocument.createElement('section');
      section.className = 'keybinding-group';
      const heading = ownerDocument.createElement('h3');
      heading.textContent = group.title;
      section.append(heading);
      const list = ownerDocument.createElement('div');
      list.className = 'keybinding-list';

      for (const action of group.actions as readonly KeybindingAction[]) {
        const row = ownerDocument.createElement('div');
        row.className = 'keybinding-row';
        const actionLabel = ownerDocument.createElement('span');
        actionLabel.className = 'keybinding-action';
        actionLabel.textContent = action;
        const key = ownerDocument.createElement('kbd');
        key.className = 'keybinding-key';
        key.textContent = capturingAction === action ? 'Press a key…' : formatBinding(bindings[action]);
        if (bindings[action] === null) key.dataset.state = 'unassigned';

        const changeButton = ownerDocument.createElement('button');
        changeButton.type = 'button';
        changeButton.className = 'button keybinding-button';
        changeButton.textContent = capturingAction === action ? 'Listening…' : 'Change';
        changeButton.setAttribute('aria-label', `Change binding for ${action}`);
        changeButton.addEventListener('click', () => {
          capturingAction = action;
          status = `Press a key for ${action}. Escape cancels.`;
          render();
        });

        const clearButton = ownerDocument.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'button keybinding-button';
        clearButton.textContent = 'Clear';
        clearButton.disabled = bindings[action] === null;
        clearButton.setAttribute('aria-label', `Clear binding for ${action}`);
        clearButton.addEventListener('click', () => {
          capturingAction = undefined;
          setBindings(clearBinding(bindings, action));
          status = `${action} is now unassigned.`;
          render();
        });

        row.append(actionLabel, key, changeButton, clearButton);
        list.append(row);
      }
      section.append(list);
      root.append(section);
    }

    const footer = ownerDocument.createElement('div');
    footer.className = 'keybinding-footer';
    const statusElement = ownerDocument.createElement('p');
    statusElement.className = 'keybinding-status';
    statusElement.setAttribute('role', 'status');
    statusElement.textContent = status;
    const resetButton = ownerDocument.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'button';
    resetButton.textContent = 'Reset defaults';
    resetButton.addEventListener('click', () => {
      const confirmed = dependencies.confirmReset?.()
        ?? window.confirm('Reset all keyboard controls to their defaults?');
      if (!confirmed) return;
      capturingAction = undefined;
      bindings = createDefaultKeybindings();
      dependencies.onResetDefaults(bindings);
      status = 'Default keyboard controls restored.';
      render();
    });
    footer.append(statusElement, resetButton);
    root.append(footer);
  };

  const handleCaptureKeyDown = (event: KeyboardEvent): void => {
    if (capturingAction === undefined) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === 'Escape') {
      capturingAction = undefined;
      status = 'Binding change cancelled.';
      render();
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) {
      status = 'Ctrl, Alt and Meta shortcuts are not supported.';
      render();
      return;
    }
    const binding = bindingFromKeyboardEvent(event);
    if (binding === undefined) {
      status = 'Press a non-modifier key, or Escape to cancel.';
      render();
      return;
    }
    const conflict = findBindingConflict(bindings, binding, capturingAction);
    if (conflict !== undefined) {
      status = `${formatBinding(binding)} is already assigned to ${conflict}.`;
      render();
      return;
    }
    const action = capturingAction;
    setBindings(assignBinding(bindings, action, binding));
    capturingAction = undefined;
    status = `${action} is now ${formatBinding(binding)}.`;
    render();
  };

  const handleToggle = (): void => {
    expanded = !expanded;
    if (!expanded && capturingAction !== undefined) {
      capturingAction = undefined;
      status = '';
      render();
    }
    renderExpandedState();
  };

  ownerDocument.addEventListener('keydown', handleCaptureKeyDown, true);
  toggleButton.addEventListener('click', handleToggle);
  render();
  renderExpandedState();

  return {
    isCapturing: () => capturingAction !== undefined,
    cancelCapture: () => {
      if (capturingAction === undefined) return;
      capturingAction = undefined;
      status = 'Binding change cancelled.';
      render();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      capturingAction = undefined;
      ownerDocument.removeEventListener('keydown', handleCaptureKeyDown, true);
      toggleButton.removeEventListener('click', handleToggle);
      root.replaceChildren();
    }
  };
}
