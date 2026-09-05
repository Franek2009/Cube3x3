import { describe, expect, it, vi } from 'vitest';

import { installKeyboardControls } from '../../src/ui/keyboard.ts';
import { createDefaultKeybindings, type KeybindingMap } from '../../src/ui/keybindings.ts';
import { createKeyboardSettingsController } from '../../src/ui/keyboardSettings.ts';

class FakeElement extends EventTarget {
  readonly ownerDocument: FakeDocument;
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  className = '';
  textContent = '';
  type = '';
  disabled = false;
  hidden = false;

  constructor(ownerDocument: FakeDocument) {
    super();
    this.ownerDocument = ownerDocument;
  }

  append(...children: FakeElement[]): void { this.children.push(...children); }
  replaceChildren(...children: FakeElement[]): void { this.children.splice(0, this.children.length, ...children); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
}

class FakeDocument extends EventTarget {
  createElement(): FakeElement { return new FakeElement(this); }
}

function find(root: FakeElement, predicate: (element: FakeElement) => boolean): FakeElement {
  if (predicate(root)) return root;
  for (const child of root.children) {
    try { return find(child, predicate); } catch { /* try the next branch */ }
  }
  throw new Error('Element not found');
}

function buttonFor(root: FakeElement, label: string): FakeElement {
  return find(root, (element) => element.attributes.get('aria-label') === label);
}

function status(root: FakeElement): string {
  return find(root, (element) => element.attributes.get('role') === 'status').textContent;
}

function keydown(code: string, options: Record<string, unknown> = {}): KeyboardEvent {
  const event = new Event('keydown', { cancelable: true });
  Object.assign(event, {
    code,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    repeat: false,
    ...options
  });
  return event as KeyboardEvent;
}

function click(element: FakeElement): void {
  element.dispatchEvent(new Event('click'));
}

function createHarness(confirmReset = vi.fn(() => true)) {
  const document = new FakeDocument();
  const root = new FakeElement(document);
  const toggle = new FakeElement(document);
  let bindings: KeybindingMap = createDefaultKeybindings();
  const changes: KeybindingMap[] = [];
  const resets: KeybindingMap[] = [];
  const controller = createKeyboardSettingsController(
    root as unknown as HTMLElement,
    toggle as unknown as HTMLButtonElement,
    {
    initialBindings: bindings,
    onBindingsChange: (next) => { bindings = next; changes.push(next); },
    onResetDefaults: (next) => { bindings = next; resets.push(next); },
    confirmReset
    }
  );
  return { document, root, toggle, controller, changes, resets, confirmReset, getBindings: () => bindings };
}

describe('keyboard settings capture', () => {
  it('starts collapsed, opens with Configure, and closes with Close', () => {
    const harness = createHarness();
    expect(harness.root.hidden).toBe(true);
    expect(harness.toggle.textContent).toBe('Configure');
    expect(harness.toggle.attributes.get('aria-expanded')).toBe('false');

    click(harness.toggle);
    expect(harness.root.hidden).toBe(false);
    expect(harness.toggle.textContent).toBe('Close');
    expect(harness.toggle.attributes.get('aria-expanded')).toBe('true');

    click(harness.toggle);
    expect(harness.root.hidden).toBe(true);
    expect(harness.toggle.textContent).toBe('Configure');
  });

  it('cancels capture when closed and restores runtime controls', () => {
    const harness = createHarness();
    const onAction = vi.fn();
    installKeyboardControls({
      target: harness.document as unknown as Document,
      getBindings: harness.getBindings,
      isCaptureActive: harness.controller.isCapturing,
      onAction
    });
    click(harness.toggle);
    click(buttonFor(harness.root, 'Change binding for U2'));
    expect(harness.controller.isCapturing()).toBe(true);
    click(harness.toggle);
    expect(harness.controller.isCapturing()).toBe(false);
    harness.document.dispatchEvent(keydown('KeyU'));
    expect(onAction).toHaveBeenCalledWith('U');
  });

  it('shows current bindings after closing and reopening', () => {
    const harness = createHarness();
    click(harness.toggle);
    click(buttonFor(harness.root, 'Change binding for U2'));
    harness.document.dispatchEvent(keydown('KeyJ'));
    click(harness.toggle);
    click(harness.toggle);
    expect(find(harness.root, (element) => element.textContent === 'J')).toBeDefined();
  });

  it('captures a free binding and reports success', () => {
    const harness = createHarness();
    click(buttonFor(harness.root, 'Change binding for U2'));
    expect(harness.controller.isCapturing()).toBe(true);
    expect(status(harness.root)).toContain('Press a key for U2');
    harness.document.dispatchEvent(keydown('KeyJ'));
    expect(harness.getBindings().U2).toEqual({ code: 'KeyJ', shift: false });
    expect(harness.controller.isCapturing()).toBe(false);
    expect(status(harness.root)).toContain('U2 is now J');
  });

  it('cancels on Escape without changing bindings', () => {
    const harness = createHarness();
    click(buttonFor(harness.root, 'Change binding for U2'));
    harness.document.dispatchEvent(keydown('Escape'));
    expect(harness.changes).toEqual([]);
    expect(harness.controller.isCapturing()).toBe(false);
    expect(status(harness.root)).toContain('cancelled');
  });

  it('blocks conflicts and unsupported modifiers while keeping capture active', () => {
    const harness = createHarness();
    click(buttonFor(harness.root, 'Change binding for U2'));
    harness.document.dispatchEvent(keydown('KeyU'));
    expect(status(harness.root)).toContain('already assigned to U');
    expect(harness.controller.isCapturing()).toBe(true);
    harness.document.dispatchEvent(keydown('KeyJ', { ctrlKey: true }));
    expect(status(harness.root)).toContain('not supported');
    expect(harness.getBindings().U2).toBeNull();
  });

  it('does not execute an action while capture consumes the key', () => {
    const harness = createHarness();
    const onAction = vi.fn();
    installKeyboardControls({
      target: harness.document as unknown as Document,
      getBindings: harness.getBindings,
      isCaptureActive: harness.controller.isCapturing,
      onAction
    });
    click(buttonFor(harness.root, 'Change binding for U2'));
    harness.document.dispatchEvent(keydown('KeyU'));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('clears an assigned binding', () => {
    const harness = createHarness();
    click(buttonFor(harness.root, 'Clear binding for U'));
    expect(harness.getBindings().U).toBeNull();
    expect(status(harness.root)).toContain('unassigned');
  });

  it('resets defaults only after confirmation', () => {
    const reject = createHarness(vi.fn(() => false));
    click(find(reject.root, (element) => element.textContent === 'Reset defaults'));
    expect(reject.resets).toEqual([]);

    const accept = createHarness(vi.fn(() => true));
    click(find(accept.root, (element) => element.textContent === 'Reset defaults'));
    expect(accept.resets).toHaveLength(1);
    expect(accept.getBindings()).toEqual(createDefaultKeybindings());
  });

  it('removes capture listener and UI on dispose', () => {
    const harness = createHarness();
    click(buttonFor(harness.root, 'Change binding for U2'));
    harness.controller.dispose();
    harness.document.dispatchEvent(keydown('KeyJ'));
    expect(harness.changes).toEqual([]);
    expect(harness.root.children).toEqual([]);
  });
});
