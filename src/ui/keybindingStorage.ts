import {
  KEYBINDING_ACTIONS, bindingKey, createDefaultKeybindings, freezeKeybindings,
  isBindableCode, type Keybinding, type KeybindingAction, type KeybindingMap
} from './keybindings.ts';

export interface KeybindingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const KEYBINDINGS_STORAGE_KEY = 'cube3x3.keybindings.v1';

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseBindings(value: unknown): KeybindingMap | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (!hasExactKeys(candidate, KEYBINDING_ACTIONS)) return undefined;
  const bindings = {} as Record<KeybindingAction, Keybinding | null>;
  const assigned = new Set<string>();
  for (const action of KEYBINDING_ACTIONS) {
    const binding = candidate[action];
    if (binding === null) { bindings[action] = null; continue; }
    if (typeof binding !== 'object' || binding === null || Array.isArray(binding)) return undefined;
    const fields = binding as Record<string, unknown>;
    if (!hasExactKeys(fields, ['code', 'shift'])) return undefined;
    if (typeof fields.code !== 'string' || !isBindableCode(fields.code)) return undefined;
    if (typeof fields.shift !== 'boolean') return undefined;
    const parsed = { code: fields.code, shift: fields.shift };
    const key = bindingKey(parsed);
    if (assigned.has(key)) return undefined;
    assigned.add(key);
    bindings[action] = parsed;
  }
  return freezeKeybindings(bindings);
}

export function loadKeybindings(storage: KeybindingStorage): KeybindingMap {
  try {
    const serialized = storage.getItem(KEYBINDINGS_STORAGE_KEY);
    if (serialized === null) return createDefaultKeybindings();
    const payload: unknown = JSON.parse(serialized);
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return createDefaultKeybindings();
    const record = payload as Record<string, unknown>;
    if (!hasExactKeys(record, ['version', 'bindings']) || record.version !== 1) return createDefaultKeybindings();
    return parseBindings(record.bindings) ?? createDefaultKeybindings();
  } catch {
    return createDefaultKeybindings();
  }
}

export function saveKeybindings(storage: KeybindingStorage, bindings: KeybindingMap): void {
  try {
    storage.setItem(KEYBINDINGS_STORAGE_KEY, JSON.stringify({ version: 1, bindings }));
  } catch {
    // The current in-memory bindings remain usable when storage is unavailable.
  }
}

export function clearStoredKeybindings(storage: KeybindingStorage): void {
  try { storage.removeItem(KEYBINDINGS_STORAGE_KEY); } catch {
    // Resetting the in-memory bindings still succeeds.
  }
}
