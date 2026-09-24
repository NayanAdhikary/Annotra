import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ViewportState {
  scale: number;
  x: number;
  y: number;
}

interface ViewportStore {
  byTask: Record<number, ViewportState>;
  live: ViewportState;
  containerW: number;
  containerH: number;
  imageW: number;
  imageH: number;

  loadTask: (taskId: number) => void;
  commitTask: (taskId: number) => void;
  setLive: (v: Partial<ViewportState>) => void;
  setContainer: (w: number, h: number) => void;
  setImageSize: (w: number, h: number) => void;
  reset: () => void;
}

const DEFAULT_VP: ViewportState = { scale: 1, x: 0, y: 0 };

export const useViewportStore = create<ViewportStore>()(
  persist(
    (set, get) => ({
      byTask: {},
      live: DEFAULT_VP,
      containerW: 0,
      containerH: 0,
      imageW: 0,
      imageH: 0,

      loadTask: (taskId) => {
        const saved = get().byTask[taskId];
        set({ live: saved ?? { ...DEFAULT_VP } });
      },

      commitTask: (taskId) => {
        set((s) => ({ byTask: { ...s.byTask, [taskId]: { ...s.live } } }));
      },

      setLive: (patch) => set((s) => ({ live: { ...s.live, ...patch } })),
      setContainer: (w, h) => set({ containerW: w, containerH: h }),
      setImageSize: (w, h) => set({ imageW: w, imageH: h }),
      reset: () => set({ live: { ...DEFAULT_VP } }),
    }),
    {
      name: 'annotra.viewport',
      partialize: (s) => ({ byTask: s.byTask }),
    },
  ),
);