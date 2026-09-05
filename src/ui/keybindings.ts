import { ALL_MOVES } from '../core/moves/moves.ts';
import { CUBE_ROTATIONS } from '../core/orientation/cubeOrientation.ts';
import type { CubeAction } from './cubeAction.ts';

export type KeybindingAction = CubeAction;
export interface Keybinding { readonly code: string; readonly shift: boolean; }
export type KeybindingMap = Readonly<Record<KeybindingAction, Keybinding | null>>;

export const KEYBINDING_ACTIONS = Object.freeze([
  ...ALL_MOVES, ...CUBE_ROTATIONS
] as const satisfies readonly KeybindingAction[]);

const RESERVED_CODES = new Set([
  'Escape', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'
]);

function freezeBinding(binding: Keybinding | null): Keybinding | null {
  return binding === null ? null : Object.freeze({ ...binding });
}

export function freezeKeybindings(
  bindings: Record<KeybindingAction, Keybinding | null>
): KeybindingMap {
  const copy = {} as Record<KeybindingAction, Keybinding | null>;
  for (const action of KEYBINDING_ACTIONS) copy[action] = freezeBinding(bindings[action]);
  return Object.freeze(copy);
}

function createDefaultRecord(): Record<KeybindingAction, Keybinding | null> {
  const bindings = {} as Record<KeybindingAction, Keybinding | null>;
  for (const action of KEYBINDING_ACTIONS) bindings[action] = null;
  for (const face of ['U', 'D', 'L', 'R', 'F', 'B'] as const) {
    bindings[face] = { code: `Key${face}`, shift: false };
    bindings[`${face}'`] = { code: `Key${face}`, shift: true };
  }
  for (const axis of ['x', 'y', 'z'] as const) {
    const code = `Key${axis.toUpperCase()}`;
    bindings[axis] = { code, shift: false };
    bindings[`${axis}'`] = { code, shift: true };
  }
  return bindings;
}

export const DEFAULT_KEYBINDINGS = freezeKeybindings(createDefaultRecord());

export function createDefaultKeybindings(): KeybindingMap {
  return freezeKeybindings({ ...DEFAULT_KEYBINDINGS });
}

export function isBindableCode(code: string): boolean {
  return code.length > 0 && !RESERVED_CODES.has(code);
}

export function bindingKey(binding: Keybinding): string {
  return JSON.stringify([binding.code, binding.shift]);
}

export function bindingsEqual(left: Keybinding, right: Keybinding): boolean {
  return left.code === right.code && left.shift === right.shift;
}

export function findBindingConflict(
  bindings: KeybindingMap,
  binding: Keybinding,
  exceptAction?: KeybindingAction
): KeybindingAction | undefined {
  return KEYBINDING_ACTIONS.find((action) => {
    const assigned = bindings[action];
    return action !== exceptAction && assigned !== null && bindingsEqual(assigned, binding);
  });
}

export function assignBinding(
  bindings: KeybindingMap,
  action: KeybindingAction,
  binding: Keybinding
): KeybindingMap {
  if (!isBindableCode(binding.code)) throw new Error(`Unsupported binding code: ${binding.code}`);
  const conflict = findBindingConflict(bindings, binding, action);
  if (conflict !== undefined) throw new Error(`Binding is already assigned to ${conflict}`);
  return freezeKeybindings({ ...bindings, [action]: binding });
}

export function clearBinding(
  bindings: KeybindingMap,
  action: KeybindingAction
): KeybindingMap {
  return freezeKeybindings({ ...bindings, [action]: null });
}

export interface KeyboardEventBindingInput {
  readonly code: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

export function bindingFromKeyboardEvent(
  event: KeyboardEventBindingInput
): Keybinding | undefined {
  if (event.ctrlKey || event.altKey || event.metaKey || !isBindableCode(event.code)) return undefined;
  return Object.freeze({ code: event.code, shift: event.shiftKey });
}

export function findActionForBinding(
  bindings: KeybindingMap,
  binding: Keybinding
): KeybindingAction | undefined {
  return KEYBINDING_ACTIONS.find((action) => {
    const assigned = bindings[action];
    return assigned !== null && bindingsEqual(assigned, binding);
  });
}

const CODE_LABELS: Readonly<Record<string, string>> = {
  Space: 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab'
};

export function formatBinding(binding: Keybinding | null): string {
  if (binding === null) return 'Unassigned';
  const key = CODE_LABELS[binding.code]
    ?? (binding.code.startsWith('Key') ? binding.code.slice(3) : undefined)
    ?? (binding.code.startsWith('Digit') ? binding.code.slice(5) : undefined)
    ?? binding.code;
  return binding.shift ? `Shift+${key}` : key;
}
