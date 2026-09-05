import { describe, expect, it } from 'vitest';
import {
  KEYBINDINGS_STORAGE_KEY, clearStoredKeybindings, loadKeybindings, saveKeybindings,
  type KeybindingStorage
} from '../../src/ui/keybindingStorage.ts';
import { assignBinding, createDefaultKeybindings } from '../../src/ui/keybindings.ts';

class FakeStorage implements KeybindingStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

describe('keybinding storage', () => {
  it('returns defaults when empty and roundtrips custom bindings', () => {
    const storage = new FakeStorage();
    expect(loadKeybindings(storage)).toEqual(createDefaultKeybindings());
    const custom = assignBinding(createDefaultKeybindings(), 'U2', { code: 'KeyJ', shift: false });
    saveKeybindings(storage, custom);
    expect(loadKeybindings(storage)).toEqual(custom);
  });

  it.each(['{broken', 'null', '{}', '{"version":2,"bindings":{}}'])('falls back for invalid payload %s', (payload) => {
    const storage = new FakeStorage();
    storage.values.set(KEYBINDINGS_STORAGE_KEY, payload);
    expect(loadKeybindings(storage)).toEqual(createDefaultKeybindings());
  });

  it('rejects unknown, missing, malformed and duplicate bindings', () => {
    const defaults = createDefaultKeybindings();
    const payloads = [
      { version: 1, bindings: { ...defaults, unknown: null } },
      { version: 1, bindings: Object.fromEntries(Object.entries(defaults).slice(1)) },
      { version: 1, bindings: { ...defaults, U: { code: 'KeyU', shift: false, extra: true } } },
      { version: 1, bindings: { ...defaults, U: { code: '', shift: false } } },
      { version: 1, bindings: { ...defaults, R: { code: 'KeyU', shift: false } } }
    ];
    for (const payload of payloads) {
      const storage = new FakeStorage();
      storage.values.set(KEYBINDINGS_STORAGE_KEY, JSON.stringify(payload));
      expect(loadKeybindings(storage)).toEqual(defaults);
    }
  });

  it('absorbs throwing operations and clears the versioned key', () => {
    const throwing: KeybindingStorage = {
      getItem: () => { throw new Error('unavailable'); },
      setItem: () => { throw new Error('full'); },
      removeItem: () => { throw new Error('unavailable'); }
    };
    expect(loadKeybindings(throwing)).toEqual(createDefaultKeybindings());
    expect(() => saveKeybindings(throwing, createDefaultKeybindings())).not.toThrow();
    expect(() => clearStoredKeybindings(throwing)).not.toThrow();
    const storage = new FakeStorage();
    saveKeybindings(storage, createDefaultKeybindings());
    clearStoredKeybindings(storage);
    expect(storage.getItem(KEYBINDINGS_STORAGE_KEY)).toBeNull();
  });
});
