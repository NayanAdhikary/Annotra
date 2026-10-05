import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface State {
  byOrg: Record<number, number[]>;
  record: (orgId: number, labelId: number) => void;
  recentFor: (orgId: number) => number[];
}

export const useRecentLabels = create<State>()(
  persist(
    (set, get) => ({
      byOrg: {},
      record: (orgId, labelId) =>
        set((s) => {
          const existing = s.byOrg[orgId] ?? [];
          const next = [labelId, ...existing.filter((x) => x !== labelId)].slice(0, 9);
          return { byOrg: { ...s.byOrg, [orgId]: next } };
        }),
      recentFor: (orgId) => get().byOrg[orgId] ?? [],
    }),
    { name: 'annotra.recent_labels' },
  ),
);
