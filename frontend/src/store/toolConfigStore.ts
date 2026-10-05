import { create } from 'zustand';
import type { ToolConfig } from '../api/toolConfig';

interface State {
  config: ToolConfig | null;
  load: (c: ToolConfig) => void;
  clear: () => void;
  isEnabled: (tool: string) => boolean;
}

export const useToolConfig = create<State>((set, get) => ({
  config: null,
  load: (config) => set({ config }),
  clear: () => set({ config: null }),
  isEnabled: (tool) => get().config?.enabled_tools.includes(tool) ?? false,
}));