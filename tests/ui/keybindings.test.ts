import { describe, expect, it } from 'vitest';
import {
  KEYBINDING_ACTIONS, assignBinding, bindingFromKeyboardEvent, bindingKey, clearBinding,
  createDefaultKeybindings, findBindingConflict, formatBinding
} from '../../src/ui/keybindings.ts';

describe('keybindings model', () => {
  it('contains all 27 actions once, with doubles initially unassigned', () => {
    expect(KEYBINDING_ACTIONS).toHaveLength(27);
    expect(new Set(KEYBINDING_ACTIONS).size).toBe(27);
    const defaults = createDefaultKeybindings();
    for (const action of KEYBINDING_ACTIONS.filter((item) => item.endsWith('2'))) expect(defaults[action]).toBeNull();
  });

  it('returns frozen, independent defaults', () => {
    const first = createDefaultKeybindings();
    const second = createDefaultKeybindings();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.U)).toBe(true);
  });

  it('detects conflicts, assigns free bindings and clears immutably', () => {
    const defaults = createDefaultKeybindings();
    expect(findBindingConflict(defaults, { code: 'KeyU', shift: false }, 'R')).toBe('U');
    expect(() => assignBinding(defaults, 'R', { code: 'KeyU', shift: false })).toThrow();
    const assigned = assignBinding(defaults, 'R2', { code: 'KeyJ', shift: false });
    expect(assigned.R2).toEqual({ code: 'KeyJ', shift: false });
    expect(defaults.R2).toBeNull();
    expect(clearBinding(assigned, 'R2').R2).toBeNull();
  });

  it('normalizes only Shift and rejects reserved or unsupported modifiers', () => {
    const base = { code: 'KeyJ', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false };
    expect(bindingFromKeyboardEvent(base)).toEqual({ code: 'KeyJ', shift: true });
    expect(bindingFromKeyboardEvent({ ...base, code: 'Escape' })).toBeUndefined();
    expect(bindingFromKeyboardEvent({ ...base, ctrlKey: true })).toBeUndefined();
    expect(bindingFromKeyboardEvent({ ...base, altKey: true })).toBeUndefined();
    expect(bindingFromKeyboardEvent({ ...base, metaKey: true })).toBeUndefined();
  });

  it('encodes code and Shift unambiguously even for untrusted code strings', () => {
    expect(bindingKey({ code: 'shift+KeyA', shift: false }))
      .not.toBe(bindingKey({ code: 'KeyA', shift: true }));
  });

  it.each([
    [{ code: 'KeyU', shift: false }, 'U'], [{ code: 'KeyU', shift: true }, 'Shift+U'],
    [{ code: 'Digit1', shift: false }, '1'], [{ code: 'ArrowLeft', shift: false }, '←'],
    [null, 'Unassigned']
  ] as const)('formats a binding as %s', (binding, expected) => {
    expect(formatBinding(binding)).toBe(expected);
  });
});
