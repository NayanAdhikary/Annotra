import { api } from './client';

export interface Project {
    id: number;
    name: string;
    description: string;
    owner_id: number;
    task_count: number;
    image_count: number;
    completed_task_count: number;
    in_review_task_count: number;
    annotation_task_count: number;
    created_at: string;
}

export interface Task {
    id: number;
    project_id: number;
    name: string;
    task_type: string;
    status: string;
    image_count: number;
    label_count: number;
    annotated_count: number;
    created_at: string;
    assignees?: { user_id: number; role: string; name: string | null; email: string | null }[];
    last_submission_note?: string;
}


export const projectsAPI = {
    list: async (): Promise<Project[]> => {
        const { data } = await api.get('/api/projects');
        return data;
    },
    get: async (id: number): Promise<Project> => {
        const {data} = await api.get(`/api/projects/${id}`);
        return data;
    },
    create: async (name: string, description?: string): Promise<Project> => {
        const { data } = await api.post('/api/projects', {name, description});
        return data;
    },
    remove: async (id: number): Promise<void> => {
        await api.delete(`/api/projects/${id}`);
    },
    listTasks: async (projectId: number): Promise<Task[]> => {
        const { data } = await api.get(`/api/projects/${projectId}/tasks`);
        return data;
    },
    createdTask: async (
        projectId: number,
        name: string,
        task_type: 'image' | 'video',
    ): Promise<Task> => {
        const { data } = await api.post(`/api/projects/${projectId}/tasks`, {
            name, task_type,
        });
        return data;
    },
};

export const taskApi = {
    get: async (id: number): Promise<Task> => {
        const { data } = await api.get(`/api/tasks/${id}`);
        return data;
    },
};