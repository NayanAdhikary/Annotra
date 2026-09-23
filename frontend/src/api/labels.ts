import { api } from './client';
import type { Label } from '../types/annotation';

export const labelsApi = {
  list: async (taskId: number): Promise<Label[]> => {
    const { data } = await api.get(`/api/tasks/${taskId}/labels`);
    return data;
  },

  create: async (taskId: number, name: string, color: string): Promise<Label> => {
    const { data } = await api.post(`/api/tasks/${taskId}/labels`, { name, color });
    return data;
  },

  update: async (labelId: number, patch: Partial<Pick<Label, 'name' | 'color'>>): Promise<Label> => {
    const { data } = await api.patch(`/api/labels/${labelId}`, patch);
    return data;
  },

  remove: async (labelId: number, force = false): Promise<void> => {
    await api.delete(`/api/labels/${labelId}`, { params: force ? { force: true } : {} });
  },

  usage: async (labelId: number): Promise<{ label_id: number; annotation_count: number }> => {
    const { data } = await api.get(`/api/labels/${labelId}/usage`);
    return data;
  },
};