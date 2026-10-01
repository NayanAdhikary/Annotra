import { api } from './client';
import type { ShapeType } from '../types/annotation';

export interface CreateAnnotationPayload {
  label_id: number;
  shape_type: ShapeType;
  points: number[];
  frame: number;
  image_id?: number;
  occluded?: boolean;
  attributes?: any[];
}

function mapShape(s: any, taskId: number): any {
  return {
    id: String(s.id),
    serverId: s.id,
    taskId,
    frame: s.frame,
    imageId: s.image_id,
    labelId: s.label_id,
    shapeType: s.type,
    points: s.points,
    occluded: s.occluded,
    source: s.source,
    groupId: s.group,
    attributes: s.attributes,
    reviewStatus: s.review_status,
    reviewedBy: s.reviewed_by,
    reviewedAt: s.reviewed_at,
    reviewComment: s.review_comment,
    createdBy: s.created_by,
  };
}

export const annotationsApi = {
  create: async (taskId: number, payload: CreateAnnotationPayload) => {
    const { data } = await api.post(`/api/tasks/${taskId}/annotations`, payload);
    return data;
  },
  update: async (annId: number, patch: Partial<CreateAnnotationPayload>, ifMatch?: string) => {
    const config = ifMatch ? { headers: { 'If-Match': ifMatch } } : {};
    const { data } = await api.patch(`/api/annotations/${annId}`, patch, config);
    return data;
  },
  remove: async (annId: number) => {
    await api.delete(`/api/annotations/${annId}`);
  },
  listForImage: async (taskId: number, imageId: number): Promise<any[]> => {
    const { data } = await api.get(`/api/tasks/${taskId}/annotations`, {
      params: { image_id: imageId, limit: 2000 },
    });
    return data.shapes.map((s: any) => mapShape(s, taskId));
  },
  listPage: async (taskId: number, params: {
    image_id?: number; frame?: number;
    review_status?: string; source?: string;
    limit?: number; offset?: number;
  }) => {
    const { data } = await api.get(`/api/tasks/${taskId}/annotations`, { params });
    return { total: data.total, shapes: data.shapes.map((s: any) => mapShape(s, taskId)) };
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