import { isMove, type Move } from '../moves/moves.ts';
import type { SolveRecord } from './SolveResults.ts';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SOLVE_HISTORY_STORAGE_KEY = 'cube3x3.solveHistory.v1';

function isSolveRecord(value: unknown): value is SolveRecord {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.timeMs === 'number' &&
    Number.isFinite(candidate.timeMs) &&
    candidate.timeMs >= 0 &&
    Number.isSafeInteger(candidate.moveCount) &&
    (candidate.moveCount as number) >= 0 &&
    typeof candidate.completedAt === 'number' &&
    Number.isFinite(candidate.completedAt) &&
    candidate.completedAt >= 0 &&
    Array.isArray(candidate.scramble) &&
    candidate.scramble.every((move): move is Move => typeof move === 'string' && isMove(move))
  );
}

export function loadSolveRecords(storage: KeyValueStorage): SolveRecord[] {
  try {
    const serialized = storage.getItem(SOLVE_HISTORY_STORAGE_KEY);
    if (serialized === null) return [];

    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed) || !parsed.every(isSolveRecord)) return [];

    return parsed.map((record) => ({ ...record, scramble: [...record.scramble] }));
  } catch {
    return [];
  }
}

export function saveSolveRecords(
  storage: KeyValueStorage,
  records: readonly SolveRecord[]
): void {
  try {
    storage.setItem(SOLVE_HISTORY_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Storage may be unavailable or full; the in-memory history remains usable.
  }
}

export function clearSolveRecords(storage: KeyValueStorage): void {
  try {
    storage.removeItem(SOLVE_HISTORY_STORAGE_KEY);
  } catch {
    // Storage may be unavailable; clearing the in-memory history still succeeds.
  }
}
