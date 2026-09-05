import { describe, expect, it, vi } from 'vitest';
import { installKeyboardControls, isEditableTarget, keyboardEventToAction } from '../../src/ui/keyboard.ts';
import { assignBinding, createDefaultKeybindings } from '../../src/ui/keybindings.ts';

function input(code: string, shiftKey = false, modifiers = {}) {
  return { code, shiftKey, ctrlKey: false, altKey: false, metaKey: false, ...modifiers };
}

describe('keyboardEventToAction', () => {
  it.each([
    ['KeyU', false, 'U'], ['KeyD', false, 'D'], ['KeyL', false, 'L'],
    ['KeyR', false, 'R'], ['KeyF', false, 'F'], ['KeyB', false, 'B'],
    ['KeyU', true, "U'"], ['KeyR', true, "R'"],
    ['KeyX', false, 'x'], ['KeyY', false, 'y'], ['KeyZ', false, 'z'],
    ['KeyX', true, "x'"], ['KeyY', true, "y'"], ['KeyZ', true, "z'"]
  ] as const)('maps %s shift=%s to %s by default', (code, shift, action) => {
    expect(keyboardEventToAction(input(code, shift), createDefaultKeybindings())).toBe(action);
  });

  it('matches exactly and supports custom double actions', () => {
    const custom = assignBinding(createDefaultKeybindings(), 'R2', { code: 'KeyJ', shift: false });
    expect(keyboardEventToAction(input('KeyJ'), custom)).toBe('R2');
    expect(keyboardEventToAction(input('KeyJ', true), custom)).toBeUndefined();
  });

  it.each([{ ctrlKey: true }, { altKey: true }, { metaKey: true }])(
    'rejects unsupported modifier %#',
    (modifier) => expect(keyboardEventToAction(input('KeyU', false, modifier), createDefaultKeybindings())).toBeUndefined()
  );
});

function keyboardEvent(code: string, options: Record<string, unknown> = {}): KeyboardEvent {
  const event = new Event('keydown', { cancelable: true });
  Object.assign(event, input(code), { repeat: false, ...options });
  return event as KeyboardEvent;
}

describe('installKeyboardControls', () => {
  it('fires once, prevents only matched defaults, and ignores repeat', () => {
    const target = new EventTarget();
    const onAction = vi.fn();
    installKeyboardControls({ target: target as unknown as Document, getBindings: createDefaultKeybindings, isCaptureActive: () => false, onAction });
    const matched = keyboardEvent('KeyU');
    const unmatched = keyboardEvent('KeyJ');
    target.dispatchEvent(matched);
    target.dispatchEvent(unmatched);
    target.dispatchEvent(keyboardEvent('KeyU', { repeat: true }));
    expect(onAction.mock.calls).toEqual([['U']]);
    expect(matched.defaultPrevented).toBe(true);
    expect(unmatched.defaultPrevented).toBe(false);
  });

  it('does not fire during capture and reads updated bindings dynamically', () => {
    const target = new EventTarget();
    const onAction = vi.fn();
    let capturing = true;
    let bindings = createDefaultKeybindings();
    installKeyboardControls({ target: target as unknown as Document, getBindings: () => bindings, isCaptureActive: () => capturing, onAction });
    target.dispatchEvent(keyboardEvent('KeyU'));
    capturing = false;
    bindings = assignBinding(bindings, 'U2', { code: 'KeyJ', shift: false });
    target.dispatchEvent(keyboardEvent('KeyJ'));
    expect(onAction.mock.calls).toEqual([['U2']]);
  });

  it('stops listening after disposal', () => {
    const target = new EventTarget();
    const onAction = vi.fn();
    const dispose = installKeyboardControls({ target: target as unknown as Document, getBindings: createDefaultKeybindings, isCaptureActive: () => false, onAction });
    dispose();
    target.dispatchEvent(keyboardEvent('KeyU'));
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('editable targets', () => {
  it('recognizes form controls and contenteditable ancestors', () => {
    const previous = globalThis.HTMLElement;
    class FakeHtmlElement extends EventTarget {
      constructor(
        readonly selectorMatch: boolean,
        readonly isContentEditable: boolean,
        readonly editableAncestor: boolean
      ) { super(); }
      matches(): boolean { return this.selectorMatch; }
      closest(): object | null { return this.editableAncestor ? {} : null; }
    }
    Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHtmlElement, configurable: true });
    try {
      expect(isEditableTarget(new FakeHtmlElement(true, false, false))).toBe(true);
      expect(isEditableTarget(new FakeHtmlElement(false, true, false))).toBe(true);
      expect(isEditableTarget(new FakeHtmlElement(false, false, true))).toBe(true);
      expect(isEditableTarget(new FakeHtmlElement(false, false, false))).toBe(false);
    } finally {
      if (previous === undefined) delete (globalThis as { HTMLElement?: unknown }).HTMLElement;
      else Object.defineProperty(globalThis, 'HTMLElement', { value: previous, configurable: true });
    }
  });
});
