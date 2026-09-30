import { api } from './client';

export type ReviewStatus = 'pending' | 'accepted' | 'rejected' | 'fixed';

export interface ReviewQueueResponse {
  stats: {
    pending: number; accepted: number; rejected: number;
    fixed: number; total: number; percent_reviewed: number;
  };
  pending_ids: number[];
  rejected_ids: number[];
}

export interface AnnotationComment {
  id: number;
  annotation_id: number;
  user_id: number | null;
  user_email: string | null;
  user_name: string | null;
  body: string;
  created_at: string;
}

export const reviewApi = {
  queue: async (taskId: number): Promise<ReviewQueueResponse> =>
    (await api.get(`/api/tasks/${taskId}/review-queue`)).data,

  reviewOne: async (
    annId: number,
    status: ReviewStatus,
    reason?: string,
    comment?: string,
  ) => (await api.post(`/api/annotations/${annId}/review`, {
    status, reason, comment,
  })).data,

  resetOne: async (annId: number) =>
    (await api.post(`/api/annotations/${annId}/review/reset`)).data,

  approveAll: async (taskId: number) =>
    (await api.post(`/api/tasks/${taskId}/review/approve-all`)).data,

  resetAll: async (taskId: number) =>
    (await api.post(`/api/tasks/${taskId}/review/reset-all`)).data,

  listComments: async (annId: number): Promise<AnnotationComment[]> =>
    (await api.get(`/api/annotations/${annId}/comments`)).data,

  addComment: async (annId: number, body: string): Promise<AnnotationComment> =>
    (await api.post(`/api/annotations/${annId}/comments`, { body })).data,

  deleteComment: async (commentId: number): Promise<void> =>
    api.delete(`/api/annotations/comments/${commentId}`),
};