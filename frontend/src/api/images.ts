import { api } from './client';

export interface ImageAsset {
  id: number;
  filename: string;
  width: number;
  height: number;
  url: string;
}

export const imagesApi = {
  list: async (taskId: number): Promise<ImageAsset[]> => {
    const { data } = await api.get(`/api/tasks/${taskId}/images`);
    return data;
  },
  upload: async (taskId: number, file: File): Promise<ImageAsset> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post(`/api/tasks/${taskId}/images/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  delete: async (taskId: number, imageId: number): Promise<void> => {
    await api.delete(`/api/tasks/${taskId}/images/${imageId}`);
  },
};