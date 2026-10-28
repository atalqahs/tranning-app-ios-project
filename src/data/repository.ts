/**
 * In-memory program data mirrored to localStorage on every change.
 * Shaped for React's useSyncExternalStore; it knows nothing about React.
 */
import { emptyProgram } from '../domain/program/commands';
import type { ProgramData } from '../domain/program/types';
import { clearStored, loadStored, saveStored } from './storage';

type Listener = () => void;

export interface ProgramRepository {
  getSnapshot(): ProgramData;
  subscribe(listener: Listener): () => void;
  /** Applies a command; the command throws if the rules forbid it. */
  update(command: (data: ProgramData) => ProgramData): void;
  /** Deletes everything. Only called after the user confirmed. */
  reset(): void;
  /** False after the browser refused to store (e.g. storage disabled). */
  isPersisting(): boolean;
}

export function createRepository(): ProgramRepository {
  let data = loadStored() ?? emptyProgram();
  let persisting = true;
  const listeners = new Set<Listener>();

  const commit = (next: ProgramData) => {
    data = next;
    persisting = saveStored(next);
    listeners.forEach((l) => l());
  };

  return {
    getSnapshot: () => data,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(command) {
      commit(command(data));
    },
    reset() {
      clearStored();
      data = emptyProgram();
      listeners.forEach((l) => l());
    },
    isPersisting: () => persisting,
  };
}
