import { describe, expect, it, vi } from 'vitest';
import { installSatisfactionRoomShortcut } from '../../src/ui/satisfactionRoom/satisfactionRoomShortcut.ts';

function keydown(code: string, options: Record<string, unknown> = {}): KeyboardEvent {
  const event = new Event('keydown', { cancelable: true });
  Object.assign(event, {
    code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, repeat: false,
    ...options
  });
  return event as KeyboardEvent;
}

class FakeWindow extends EventTarget {
  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null
  ): void {
    super.addEventListener(type, callback);
  }

  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null
  ): void {
    super.removeEventListener(type, callback);
  }
}

function createHarness() {
  const target = new FakeWindow();
  let open = false;
  const toggleRoom = vi.fn(() => { open = !open; });
  const closeRoom = vi.fn(() => { open = false; });
  const dispose = installSatisfactionRoomShortcut({
    target: target as unknown as Window,
    isRoomOpen: () => open,
    toggleRoom,
    closeRoom
  });
  return { target, toggleRoom, closeRoom, dispose, setOpen: (value: boolean) => { open = value; } };
}

describe('Satisfaction Room shortcut', () => {
  it('opens and closes on exact Ctrl+Shift+S', () => {
    const harness = createHarness();
    const openEvent = keydown('KeyS', { ctrlKey: true, shiftKey: true });
    harness.target.dispatchEvent(openEvent);
    expect(harness.toggleRoom).toHaveBeenCalledOnce();
    expect(openEvent.defaultPrevented).toBe(true);
    harness.target.dispatchEvent(keydown('KeyS', { ctrlKey: true, shiftKey: true }));
    expect(harness.toggleRoom).toHaveBeenCalledTimes(2);
  });

  it.each([
    { ctrlKey: true }, { shiftKey: true }, {},
    { ctrlKey: true, shiftKey: true, altKey: true },
    { ctrlKey: true, shiftKey: true, metaKey: true },
    { ctrlKey: true, shiftKey: true, repeat: true }
  ])('ignores non-exact shortcut %#', (options) => {
    const harness = createHarness();
    const event = keydown('KeyS', options);
    harness.target.dispatchEvent(event);
    expect(harness.toggleRoom).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores Ctrl+Shift with a different physical key', () => {
    const harness = createHarness();
    const event = keydown('KeyA', { ctrlKey: true, shiftKey: true });
    harness.target.dispatchEvent(event);
    expect(harness.toggleRoom).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    { name: 'input', matches: true, contentEditable: false, closest: false },
    { name: 'textarea', matches: true, contentEditable: false, closest: false },
    { name: 'contenteditable', matches: false, contentEditable: true, closest: false }
  ])('ignores the shortcut from an editable $name target', ({ matches, contentEditable, closest }) => {
    const OriginalHTMLElement = globalThis.HTMLElement;
    class FakeElement extends FakeWindow {
      isContentEditable = contentEditable;
      matches = vi.fn(() => matches);
      closest = vi.fn(() => closest ? this : null);
    }
    Object.defineProperty(globalThis, 'HTMLElement', {
      configurable: true,
      value: FakeElement
    });

    try {
      const target = new FakeElement();
      const toggleRoom = vi.fn();
      const dispose = installSatisfactionRoomShortcut({
        target: target as unknown as Window,
        isRoomOpen: () => false,
        toggleRoom,
        closeRoom: vi.fn()
      });
      const event = keydown('KeyS', { ctrlKey: true, shiftKey: true });
      target.dispatchEvent(event);
      expect(toggleRoom).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
      dispose();
    } finally {
      Object.defineProperty(globalThis, 'HTMLElement', {
        configurable: true,
        value: OriginalHTMLElement
      });
    }
  });

  it('closes on Escape and blocks ordinary cube keys while open', () => {
    const harness = createHarness();
    harness.setOpen(true);
    const leaked = vi.fn();
    harness.target.addEventListener('keydown', leaked);
    harness.target.dispatchEvent(keydown('KeyU'));
    expect(leaked).not.toHaveBeenCalled();
    const escape = keydown('Escape');
    harness.target.dispatchEvent(escape);
    expect(harness.closeRoom).toHaveBeenCalledOnce();
    expect(escape.defaultPrevented).toBe(true);
  });

  it('removes its listener on dispose', () => {
    const harness = createHarness();
    harness.dispose();
    harness.target.dispatchEvent(keydown('KeyS', { ctrlKey: true, shiftKey: true }));
    expect(harness.toggleRoom).not.toHaveBeenCalled();
  });
});
