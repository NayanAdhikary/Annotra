import { api } from './client';

export type TaskStatus = 'annotation' | 'review' | 'completed' | 'archived';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TaskDetail {
  id: number;
  project_id: number;
  project_name: string | null;
  name: string;
  task_type: 'image' | 'video';
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  description: string | null;
  instructions: string | null;
  image_count: number;
  label_count: number;
  annotated_count: number;
  comment_count: number;
  open_comment_count: number;
  assignees: { user_id: number; role: string; name: string; email: string }[];
  archived_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Comment {
  id: number;
  task_id: number;
  user_id: number | null;
  user_email: string | null;
  user_name: string | null;
  body: string;
  frame: number | null;
  annotation_id: number | null;
  resolved: boolean;
  created_at: string;
}

export interface MyTaskRow {
  id: number;
  project_id: number;
  project_name: string;
  name: string;
  task_type: 'image' | 'video';
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  role: 'annotator' | 'reviewer';
  image_count: number;
  annotated_count: number;
  open_comment_count: number;
  created_at: string;
}

export const tasksApi = {
  get: async (id: number): Promise<TaskDetail> =>
    (await api.get(`/api/tasks/${id}`)).data,

  update: async (id: number, patch: Partial<{
    name: string;
    priority: TaskPriority;
    due_at: string | null;
    description: string;
    instructions: string;
  }>): Promise<TaskDetail> =>
    (await api.patch(`/api/tasks/${id}`, patch)).data,

  transition: async (id: number, to_status: TaskStatus): Promise<TaskDetail> =>
    (await api.post(`/api/tasks/${id}/transition`, { to_status })).data,

  duplicate: async (id: number): Promise<TaskDetail> =>
    (await api.post(`/api/tasks/${id}/duplicate`)).data,

  listComments: async (taskId: number, includeResolved = true): Promise<Comment[]> =>
    (await api.get(`/api/tasks/${taskId}/comments`, {
      params: { include_resolved: includeResolved },
    })).data,

  createComment: async (taskId: number, body: string, frame?: number, annotation_id?: number): Promise<Comment> =>
    (await api.post(`/api/tasks/${taskId}/comments`, { body, frame, annotation_id })).data,

  updateComment: async (commentId: number, patch: { resolved?: boolean; body?: string }): Promise<Comment> =>
    (await api.patch(`/api/comments/${commentId}`, patch)).data,

  deleteComment: async (commentId: number): Promise<void> =>
    api.delete(`/api/comments/${commentId}`),

  myTasks: async (params: { status?: TaskStatus; role?: 'annotator' | 'reviewer'; include_archived?: boolean } = {}): Promise<MyTaskRow[]> =>
    (await api.get('/api/me/tasks', { params })).data,
};
