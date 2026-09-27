import { create } from 'zustand';
import type { Annotation, Label, ToolType } from '../types/annotation';

interface State {
  taskId: number | null;
  frame: number;
  annotations: Annotation[];
  labels: Label[];
  activeLabelId: number | null;
  /** Ordered selection. Using an array (not Set) so we can render "last selected". */
  selectedIds: string[];
  /** The "primary" selection — used for inspector panels, keyboard ops, etc. */
  primaryId: string | null;
  currentTool: ToolType;
  brushSize: number;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';

  // Task / lifecycle
  setTask: (taskId: number) => void;
  setLabels: (labels: Label[]) => void;
  upsertLabel: (label: Label) => void;
  removeLabel: (labelId: number) => void;
  setFrame: (frame: number) => void;
  setSaveStatus: (s: State['saveStatus']) => void;
  conflicts: Record<string, { message: string; current: any }>;
  saveErrors: Record<string, any>;
  setConflict: (id: string, detail: any) => void;
  clearConflict: (id: string) => void;
  setSaveError: (id: string, err: any) => void;
  clearSaveError: (id: string) => void;

  // Tools & selection
  setTool: (t: ToolType) => void;
  setBrushSize: (size: number) => void;
  setActiveLabel: (id: number) => void;
  selectOne: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;
  /** Replace selection with all ids matching predicate (used by marquee). */
  selectByPredicate: (pred: (a: Annotation) => boolean) => void;

  // Annotation lifecycle
  setAnnotations: (anns: Annotation[]) => void;
  addLocal: (a: Annotation) => void;
  attachServerId: (localId: string, serverId: number) => void;
  replaceAnnotation: (id: string, patch: Partial<Annotation>) => void;
  replaceMany: (ids: string[], patch: Partial<Annotation>) => void;
  removeLocal: (id: string) => void;
  removeMany: (ids: string[]) => void;
  reassignLabel: (labelId: number, newLabelId: number) => void;

  // Derived
  frameAnnotations: () => Annotation[];
}

const uid = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useAnnotationStore = create<State>((set, get) => ({
  taskId: null,
  frame: 0,
  annotations: [],
  labels: [],
  activeLabelId: null,
  selectedIds: [],
  primaryId: null,
  currentTool: 'select',
  brushSize: 30,
  saveStatus: 'idle',
  conflicts: {},
  saveErrors: {},

  setTask: (taskId) => set({ taskId, annotations: [], selectedIds: [], primaryId: null, frame: 0 }),

  setLabels: (labels) =>
    set((s) => ({
      labels,
      activeLabelId:
        s.activeLabelId && labels.some((l) => l.id === s.activeLabelId)
          ? s.activeLabelId
          : labels[0]?.id ?? null,
    })),

  upsertLabel: (label) =>
    set((s) => {
      const exists = s.labels.some((l) => l.id === label.id);
      const labels = exists
        ? s.labels.map((l) => (l.id === label.id ? label : l))
        : [...s.labels, label];
      return { labels };
    }),

  removeLabel: (labelId) =>
    set((s) => ({
      labels: s.labels.filter((l) => l.id !== labelId),
      // Also drop any local annotations that used this label (server already cascaded if forced)
      annotations: s.annotations.filter((a) => a.labelId !== labelId),
      activeLabelId:
        s.activeLabelId === labelId ? (s.labels.find((l) => l.id !== labelId)?.id ?? null) : s.activeLabelId,
    })),

  setFrame: (frame) => set({ frame, selectedIds: [], primaryId: null }),
  setSaveStatus: (s) => set({ saveStatus: s }),

  setTool: (t) => set({ currentTool: t, selectedIds: [], primaryId: null }),
  setBrushSize: (size) => set({ brushSize: size }),
  setActiveLabel: (id) => set({ activeLabelId: id }),
  // ---------- Selection ----------
  selectOne: (id) =>
    set({ selectedIds: id ? [id] : [], primaryId: id }),

  toggleSelect: (id) =>
    set((s) => {
      const has = s.selectedIds.includes(id);
      const selectedIds = has
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id];
      return {
        selectedIds,
        primaryId: has
          ? (s.primaryId === id ? selectedIds[selectedIds.length - 1] ?? null : s.primaryId)
          : id,
      };
    }),

  selectMany: (ids) =>
    set({ selectedIds: ids, primaryId: ids[ids.length - 1] ?? null }),

  clearSelection: () => set({ selectedIds: [], primaryId: null }),

  selectByPredicate: (pred) => {
    const matches = get().annotations.filter(pred).map((a) => a.id);
    set({ selectedIds: matches, primaryId: matches[matches.length - 1] ?? null });
  },

  setAnnotations: (anns) => set({ annotations: anns }),

  addLocal: (a) => set((s) => ({ annotations: [...s.annotations, a] })),

  setConflict: (id, detail) =>
    set((s) => ({ conflicts: { ...s.conflicts, [id]: detail } })),
  clearConflict: (id) =>
    set((s) => {
      const next = { ...s.conflicts };
      delete next[id];
      return { conflicts: next };
    }),
  setSaveError: (id, err) =>
    set((s) => ({ saveErrors: { ...s.saveErrors, [id]: err } })),
  clearSaveError: (id) =>
    set((s) => {
      const next = { ...s.saveErrors };
      delete next[id];
      return { saveErrors: next };
    }),

  // ---------- Lifecycle (adjust existing ones) ----------
  // attachServerId must rewrite both selections
  attachServerId: (localId, serverId) =>
    set((s) => {
      const newId = `srv-${serverId}`;
      return {
        annotations: s.annotations.map((a) =>
          a.id === localId ? { ...a, id: newId, serverId } : a,
        ),
        selectedIds: s.selectedIds.map((x) => (x === localId ? newId : x)),
        primaryId: s.primaryId === localId ? newId : s.primaryId,
      };
    }),

  replaceAnnotation: (id, patch) =>
    set((s) => ({
      annotations: s.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),

  replaceMany: (ids, patch) =>
    set((s) => {
      const targets = new Set(ids);
      return {
        annotations: s.annotations.map((a) =>
          targets.has(a.id) ? { ...a, ...patch } : a,
        ),
      };
    }),

  // removeLocal must also drop from selectedIds
  removeLocal: (id) =>
    set((s) => ({
      annotations: s.annotations.filter((a) => a.id !== id),
      selectedIds: s.selectedIds.filter((x) => x !== id),
      primaryId: s.primaryId === id ? null : s.primaryId,
    })),

  // removeMany for bulk delete
  removeMany: (ids) =>
    set((s) => {
      const kill = new Set(ids);
      return {
        annotations: s.annotations.filter((a) => !kill.has(a.id)),
        selectedIds: s.selectedIds.filter((x) => !kill.has(x)),
        primaryId: s.primaryId && kill.has(s.primaryId) ? null : s.primaryId,
      };
    }),

  reassignLabel: (labelId, newLabelId) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.labelId === labelId ? { ...a, labelId: newLabelId } : a,
      ),
    })),

  frameAnnotations: () => {
    const { annotations, frame } = get();
    return annotations.filter((a) => a.frame === frame);
  },
}));

export { uid as makeLocalId };