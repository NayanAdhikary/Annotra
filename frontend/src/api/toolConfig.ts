import { api } from './client';

export interface ToolConfig {
  enabled_tools: string[];
  default_tool: string;
  brush_size_default: number;
  brush_size_min: number;
  brush_size_max: number;
  default_zoom_mode: 'fit' | '100' | 'last';
  snap_to_grid: boolean;
  snap_to_vertex: boolean;
  grid_size: number;
  auto_advance_on_complete: boolean;
  auto_select_new_shape: boolean;
  confirm_bulk_delete: boolean;
  show_coordinates: boolean;
  show_shape_count: boolean;
  shortcuts: Record<string, string>;
}

export const toolConfigApi = {
  getOrg: async (orgId: number): Promise<ToolConfig> =>
    (await api.get(`/api/orgs/${orgId}/tool-config`)).data,
  updateOrg: async (orgId: number, patch: Partial<ToolConfig>): Promise<ToolConfig> =>
    (await api.patch(`/api/orgs/${orgId}/tool-config`, patch)).data,
  effective: async (orgId: number): Promise<ToolConfig> =>
    (await api.get(`/api/orgs/${orgId}/effective-config`)).data,
  getPrefs: async (): Promise<{ overrides: Partial<ToolConfig> }> =>
    (await api.get('/api/me/preferences')).data,
  savePrefs: async (overrides: Partial<ToolConfig>) =>
    (await api.put('/api/me/preferences', { overrides })).data,
  getProject: async (projectId: number): Promise<ToolConfig & { _has_project_override?: boolean }> =>
    (await api.get(`/api/projects/${projectId}/tool-config`)).data,
  updateProject: async (projectId: number, patch: Partial<ToolConfig>): Promise<ToolConfig> =>
    (await api.patch(`/api/projects/${projectId}/tool-config`, patch)).data,
  resetProject: async (projectId: number): Promise<void> =>
    api.delete(`/api/projects/${projectId}/tool-config`),
  effectiveForProject: async (projectId: number): Promise<ToolConfig> =>
    (await api.get(`/api/projects/${projectId}/effective-config`)).data,
};