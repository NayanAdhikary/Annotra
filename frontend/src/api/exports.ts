import { api } from './client';

export type ExportFormat = 'coco' | 'yolo' | 'voc' | 'cvat';

export interface ExportJob {
  id: number;
  task_id: number;
  format: ExportFormat;
  include_images: boolean;
  status: 'pending' | 'running' | 'done' | 'failed';
  progress: string | null;
  error: string | null;
  file_size: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface ImportJob {
  id: number;
  task_id: number;
  format: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  progress: string | null;
  error: string | null;
  stats: {
    imported?: number;
    skipped?: number;
    unknown_labels?: string[];
    total?: number;
  } | null;
  created_at: string;
  completed_at: string | null;
}

export interface DetectResult {
  detected_format: string;
  external_labels: string[];
  image_count: number;
  annotation_count: number;
}

export const exportsApi = {
  startExport: async (taskId: number, format: ExportFormat, includeImages = true): Promise<ExportJob> =>
    (await api.post(`/api/tasks/${taskId}/export`, {
      format, include_images: includeImages,
    })).data,

  getExport: async (jobId: number): Promise<ExportJob> =>
    (await api.get(`/api/export-jobs/${jobId}`)).data,

  listExports: async (taskId: number): Promise<ExportJob[]> =>
    (await api.get(`/api/tasks/${taskId}/export-jobs`)).data,

  downloadUrl: (jobId: number) => `/api/export-jobs/${jobId}/download`,

  detectImport: async (taskId: number, file: File): Promise<DetectResult> => {
    const fd = new FormData();
    fd.append('file', file);
    return (await api.post(`/api/tasks/${taskId}/import/detect`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
  },

  startImport: async (
    taskId: number,
    format: string,
    labelMapping: Record<string, number>,
    asPreannotations: boolean,
    file: File,
  ): Promise<ImportJob> => {
    const fd = new FormData();
    fd.append('file', file);
    return (await api.post(
      `/api/tasks/${taskId}/import`,
      fd,
      {
        params: {
          format,
          label_mapping: JSON.stringify(labelMapping),
          as_preannotations: asPreannotations,
        },
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    )).data;
  },

  getImport: async (jobId: number): Promise<ImportJob> =>
    (await api.get(`/api/import-jobs/${jobId}`)).data,
};
