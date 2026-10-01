import { api } from './client';

export interface ImageStatus {
  image_id: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  skip_reason: string | null;
  annotation_count: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface TaskProgress {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  skipped: number;
  images_with_annotations: number;
  percent_complete: number;
}

export interface SubmissionWarning {
  kind: string;
  message: string;
  count: number;
  detail: string | null;
}

export interface SubmissionPreflight {
  total_images: number;
  completed_images: number;
  skipped_images: number;
  pending_images: number;
  total_annotations: number;
  warnings: SubmissionWarning[];
  can_submit: boolean;
  blocks_submission: boolean;
}

export const annotatorApi = {
  imageStatuses: async (taskId: number): Promise<ImageStatus[]> =>
    (await api.get(`/api/tasks/${taskId}/image-status`)).data,

  progress: async (taskId: number): Promise<TaskProgress> =>
    (await api.get(`/api/tasks/${taskId}/progress`)).data,

  setImageStatus: async (
    taskId: number,
    imageId: number,
    status: 'completed' | 'skipped' | 'pending',
    skipReason?: string,
  ): Promise<ImageStatus> =>
    (await api.patch(`/api/tasks/${taskId}/images/${imageId}/status`, {
      status,
      skip_reason: skipReason,
    })).data,

  preflight: async (taskId: number): Promise<SubmissionPreflight> =>
    (await api.get(`/api/tasks/${taskId}/submission/preflight`)).data,

  submit: async (taskId: number, force: boolean, note?: string) =>
    (await api.post(`/api/tasks/${taskId}/submission`, { force, note })).data,

  skipReasons: async (): Promise<{ reasons: string[] }> =>
    (await api.get('/api/skip-reasons')).data,
};