import { api } from './client';
import type { ToolConfig } from '../store/toolConfigStore';

export const toolConfigApi = {
  orgGet: async (orgId: number): Promise<ToolConfig> =>
    (await api.get(`/api/orgs/${orgId}/tool-config`)).data,

  orgUpdate: async (orgId: number, patch: Partial<ToolConfig>): Promise<ToolConfig> =>
    (await api.patch(`/api/orgs/${orgId}/tool-config`, patch)).data,

  taskGet: async (taskId: number): Promise<ToolConfig> =>
    (await api.get(`/api/tasks/${taskId}/tool-config`)).data,

  taskUpdate: async (taskId: number, patch: Partial<ToolConfig>): Promise<ToolConfig> =>
    (await api.patch(`/api/tasks/${taskId}/tool-config`, patch)).data,

  taskReset: async (taskId: number): Promise<void> =>
    api.delete(`/api/tasks/${taskId}/tool-config`),

  effective: async (taskId: number): Promise<ToolConfig> =>
    (await api.get(`/api/tasks/${taskId}/effective-tool-config`)).data,

  myPrefs: async (): Promise<{ overrides: Partial<ToolConfig> }> =>
    (await api.get('/api/me/preferences')).data,

  saveMyPrefs: async (overrides: Partial<ToolConfig>) =>
    (await api.put('/api/me/preferences', { overrides })).data,

  resetMyPrefs: async (): Promise<void> =>
    api.delete('/api/me/preferences'),
};