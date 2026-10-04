import { create } from 'zustand';

export interface ToolConfig {
  enabled_tools: string[];
  default_tool: string;
  enabled_groups: string[];
  brush_size_default: number;
  brush_size_min: number;
  brush_size_max: number;
  default_zoom_mode: 'fit' | '100' | 'last';
  snap_to_grid: boolean;
  snap_to_vertex: boolean;
  snap_to_edge: boolean;
  grid_size: number;
  auto_advance_on_complete: boolean;
  auto_select_new_shape: boolean;
  auto_open_label_picker: boolean;
  confirm_bulk_delete: boolean;
  show_coordinates: boolean;
  show_shape_count: boolean;
  show_minimap: boolean;
  shortcuts: Record<string, string>;
  undo_history_depth: number;
  autosave_debounce_ms: number;
}

interface ConfigState {
  config: ToolConfig | null;
  loaded: boolean;
  load: (c: ToolConfig) => void;
  set: (partial: Partial<ToolConfig>) => void;
  clear: () => void;
  isEnabled: (tool: string) => boolean;
}

export const useToolConfig = create<ConfigState>((set, get) => ({
  config: null,
  loaded: false,
  load: (config) => set({ config, loaded: true }),
  set: (partial) =>
    set((s) => (s.config ? { config: { ...s.config, ...partial } } : s)),
  clear: () => set({ config: null, loaded: false }),
  isEnabled: (tool) => get().config?.enabled_tools.includes(tool) ?? false,
}));