import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { projectsAPI } from '../api/project';

export const ProjectDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const projectId = parseInt(id || '0', 10);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [taskName, setTaskName] = useState('');
    const [taskType, setTaskType] = useState<'image' | 'video'>('image');

    const { data: project, isLoading: isProjectLoading } = useQuery({
        queryKey: ['projects', projectId],
        queryFn: () => projectsAPI.get(projectId),
        enabled: projectId > 0,
    });

    const { data: tasks, isLoading: isTasksLoading } = useQuery({
        queryKey: ['projects', projectId, 'tasks'],
        queryFn: () => projectsAPI.listTasks(projectId),
        enabled: projectId > 0,
    });

    const createTaskMutation = useMutation({
        mutationFn: () => projectsAPI.createdTask(projectId, taskName, taskType),
        onSuccess: (newTask) => {
            queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
            queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
            setIsModalOpen(false);
            setTaskName('');
            setTaskType('image');
            navigate(`/tasks/${newTask.id}/setup`);
        },
    });

    if (isProjectLoading || isTasksLoading) return <div className="p-8">Loading...</div>;
    if (!project) return <div className="p-8">Project not found.</div>;

    return (
        <div className="max-w-6xl mx-auto p-8">
            <div className="mb-6">
                <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                    ← Back to Projects
                </Link>
            </div>

            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">{project.name}</h1>
                    {project.description && <p className="text-slate-600">{project.description}</p>}
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium whitespace-nowrap"
                >
                    Create task
                </button>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-medium">
                        <tr>
                            <th className="py-3 px-4">Name</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Images</th>
                            <th className="py-3 px-4 text-right">Labels</th>
                            <th className="py-3 px-4 text-right">Progress</th>
                            <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {!tasks?.length ? (
                            <tr>
                                <td colSpan={7} className="py-8 text-center text-slate-500">
                                    No tasks in this project yet.
                                </td>
                            </tr>
                        ) : (
                            tasks.map((t) => (
                                <tr key={t.id} className="hover:bg-slate-50">
                                    <td className="py-3 px-4 font-medium text-slate-900">{t.name}</td>
                                    <td className="py-3 px-4 capitalize">{t.task_type}</td>
                                    <td className="py-3 px-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                            t.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">{t.image_count}</td>
                                    <td className="py-3 px-4 text-right">{t.label_count}</td>
                                    <td className="py-3 px-4 text-right text-slate-500">
                                        {t.annotated_count} / {t.image_count}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <Link
                                            to={`/tasks/${t.id}/setup`}
                                            className="text-indigo-600 font-medium hover:text-indigo-800"
                                        >
                                            Open →
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-xl font-semibold mb-4 text-slate-900">Create Task</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Task Name</label>
                                <input
                                    type="text"
                                    value={taskName}
                                    onChange={(e) => setTaskName(e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="e.g. Batch 01"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="taskType"
                                            value="image"
                                            checked={taskType === 'image'}
                                            onChange={() => setTaskType('image')}
                                            className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>Image</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="taskType"
                                            value="video"
                                            checked={taskType === 'video'}
                                            onChange={() => setTaskType('video')}
                                            className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>Video</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => createTaskMutation.mutate()}
                                disabled={!taskName.trim() || createTaskMutation.isPending}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50"
                            >
                                {createTaskMutation.isPending ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
