import { api } from './client';

export interface MLModel {
  id: number;
  name: string;
  version: string;
  kind: string;
  class_names: string[];
  description: string | null;
  is_active: boolean;
  file_size: number | null;
  created_at: string;
}

export interface InferenceJob {
  id: number;
  task_id: number;
  model_id: number;
  confidence: string;
  label_mapping: Record<string, number>;
  status: 'pending' | 'running' | 'done' | 'failed';
  progress: string | null;
  error: string | null;
  stats: {
    images_processed?: number;
    detections?: number;
    annotations_created?: number;
    skipped?: number;
    class_counts?: Record<string, number>;
  };
  created_at: string;
  completed_at: string | null;
}

export interface MappingSuggestion {
  model_id: number;
  model_name: string;
  model_classes: string[];
  suggested_mapping: Record<string, number>;
  unmatched_classes: string[];
}

export const mlApi = {
  listModels: async (): Promise<MLModel[]> =>
    (await api.get('/api/admin/models')).data,

  uploadModel: async (
    name: string, description: string, version: string, file: File,
  ): Promise<MLModel> => {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('description', description);
    fd.append('version', version);
    fd.append('file', file);
    return (await api.post('/api/admin/models/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 5 * 60_000,
    })).data;
  },

  deactivateModel: async (id: number): Promise<void> =>
    api.delete(`/api/admin/models/${id}`),

  suggestMapping: async (taskId: number, modelId: number): Promise<MappingSuggestion> =>
    (await api.get(`/api/tasks/${taskId}/models/${modelId}/mapping`)).data,

  startInference: async (
    taskId: number, modelId: number, confidence: number,
    labelMapping: Record<string, number>,
  ): Promise<InferenceJob> =>
    (await api.post(`/api/tasks/${taskId}/predict`, {
      model_id: modelId, confidence, label_mapping: labelMapping,
    })).data,

  getJob: async (jobId: number): Promise<InferenceJob> =>
    (await api.get(`/api/inference-jobs/${jobId}`)).data,

  listJobs: async (taskId: number): Promise<InferenceJob[]> =>
    (await api.get(`/api/tasks/${taskId}/inference-jobs`)).data,
};
