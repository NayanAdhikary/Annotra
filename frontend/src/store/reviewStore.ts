import { create } from 'zustand';

interface Stats{
    pending: number;
    accepted: number;
    rejected: number;
    fixed: number;
    total: number;
    percent_reviewed: number;
}

interface ReviewState {
    stats: Stats | null;
    pendingIds: number[];
    rejectedIds: number[]; 
    filter: 'all' | 'pending' | 'rejected' | 'accepted';
    setStats: (s: Stats, pending: number[], rejected: number []) => void;
    setFilter: (filter: 'all' | 'pending' | 'rejected' | 'accepted') => void;
    clear: () => void;
}

export const useReviewStore = create<ReviewState>((set) => ({
  stats: null,
  pendingIds: [],
  rejectedIds: [],
  filter: 'all',
  setStats: (stats, pendingIds, rejectedIds) => set({ stats, pendingIds, rejectedIds }),
  setFilter: (filter: 'all' | 'pending' | 'rejected' | 'accepted') => set({ filter }),
  clear: () => set({ stats: null, pendingIds: [], rejectedIds: [], filter: 'all' }),
}));