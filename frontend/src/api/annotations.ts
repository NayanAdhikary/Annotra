import { api } from './client';
import type { ShapeType } from '../types/annotation';

export interface CreateAnnotationPayload {
  label_id: number;
  shape_type: ShapeType;
  points: number[];
  frame: number;
  occluded?: boolean;
}

export const annotationsApi = {
  create: async (taskId: number, payload: CreateAnnotationPayload) => {
    const { data } = await api.post(`/api/tasks/${taskId}/annotations`, payload);
    return data;
  },
  update: async (annId: number, patch: Partial<CreateAnnotationPayload>) => {
    const { data } = await api.patch(`/api/annotations/${annId}`, patch);
    return data;
  },
  remove: async (annId: number) => {
    await api.delete(`/api/annotations/${annId}`);
  },
  list: async (taskId: number, frame?: number) => {
    const { data } = await api.get(`/api/tasks/${taskId}/annotations`, {
      params: frame !== undefined ? { frame } : {},
    });
    return data;
  },
  bulkPatch: async (
    taskId: number,
    payload: { ids: number[]; patch: Record<string, any> },
  ) => {
    const { data } = await api.patch(`/api/tasks/${taskId}/annotations/bulk`, payload);
    return data;
  },
  bulkDelete: async (taskId: number, ids: number[]) => {
    const { data } = await api.post(`/api/tasks/${taskId}/annotations/bulk-delete`, ids);
    return data;
  },
};