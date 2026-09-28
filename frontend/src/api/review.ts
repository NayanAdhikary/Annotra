import { api } from './client';

export const reviewApi = {
  queue: async (taskId: number) => (await api.get(`/api/tasks/${taskId}/review/queue`)).data,
};
