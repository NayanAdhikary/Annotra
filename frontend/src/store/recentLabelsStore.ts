import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RecentState {
  byTask: Record<number, number[]>;   // taskId → ordered label ids, most recent first
  record: (taskId: number, labelId: number) => void;
  recentFor: (taskId: number) => number[];
  clear: (taskId: number) => void;
}

export const useRecentLabels = create<RecentState>()(
  persist(
    (set, get) => ({
      byTask: {},
      record: (taskId, labelId) =>
        set((s) => {
          const existing = s.byTask[taskId] ?? [];
          const next = [labelId, ...existing.filter((x) => x !== labelId)].slice(0, 8);
          return { byTask: { ...s.byTask, [taskId]: next } };
        }),
      recentFor: (taskId) => get().byTask[taskId] ?? [],
      clear: (taskId) =>
        set((s) => {
          const next = { ...s.byTask };
          delete next[taskId];
          return { byTask: next };
        }),
    }),
    { name: 'annotra.recent_labels' },
  ),
);
