import { create } from 'zustand';
import type { Command, CommandContext } from '../commands/types';
import { useAnnotationStore } from './annotationStore';

const MAX_HISTORY = 100;

interface HistoryState {
  past: Command[];
  future: Command[];
  /** Used to attach to the current drag session for coalescing. */
  lastPushWasWithin: number;

  /** Apply a command, push it onto the past, clear the future. */
  execute: (cmd: Command) => void;
  /** Apply a command without pushing it (used for re-applying after undo/redo). */
  executeSilent: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function makeContext(): CommandContext {
  const s = useAnnotationStore.getState();
  return {
    annotations: s.annotations,
    addLocal: s.addLocal,
    removeLocal: s.removeLocal,
    replaceAnnotation: s.replaceAnnotation,
    replaceMany: s.replaceMany,
    selectOne: s.selectOne,
    selectMany: s.selectMany,
  };
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  lastPushWasWithin: 0,

  execute: (cmd) => {
    cmd.apply(makeContext());

    const now = Date.now();
    const { past, lastPushWasWithin } = get();
    const last = past[past.length - 1];
    const withinCoalesceWindow = now - lastPushWasWithin < 400;

    // Try to coalesce with the top of the stack
    if (last && withinCoalesceWindow && last.coalesceWith) {
      const merged = last.coalesceWith(cmd);
      if (merged) {
        const next = [...past];
        next[next.length - 1] = merged;
        set({ past: next, future: [], lastPushWasWithin: now });
        return;
      }
    }

    const nextPast = [...past, cmd];
    if (nextPast.length > MAX_HISTORY) nextPast.shift();
    set({ past: nextPast, future: [], lastPushWasWithin: now });
  },

  executeSilent: (cmd) => {
    cmd.apply(makeContext());
  },

  undo: () => {
    const { past, future } = get();
    if (!past.length) return;
    const cmd = past[past.length - 1];
    const inverse = cmd.invert();
    inverse.apply(makeContext());
    set({
      past: past.slice(0, -1),
      future: [cmd, ...future],
    });
  },

  redo: () => {
    const { past, future } = get();
    if (!future.length) return;
    const cmd = future[0];
    cmd.apply(makeContext());
    set({
      past: [...past, cmd],
      future: future.slice(1),
    });
  },

  clear: () => set({ past: [], future: [], lastPushWasWithin: 0 }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
