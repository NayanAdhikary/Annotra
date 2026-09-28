import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectsAPI } from '../api/project';
import { useAuthStore } from '../store/authStore';

export const ProjectsPage: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const queryClient = useQueryClient();
    const nav = useNavigate();
    const user = useAuthStore((s) => s.user);
    const isAdmin = user?.role === 'admin' || user?.role === 'manager';

    const openProject = async (projectId: number) => {
        try {
            const tasks = await projectsAPI.listTasks(projectId);
            if (tasks.length === 0) {
                nav(`/projects/${projectId}`);
                return;
            }
            if (tasks.length === 1) {
                nav(`/tasks/${tasks[0].id}`);
                return;
            }
            nav(`/projects/${projectId}`);
        } catch {
            nav(`/projects/${projectId}`);
        }
    };

    const { data: projects, isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: projectsAPI.list,
    });

    const createMutation = useMutation({
        mutationFn: () => projectsAPI.create(name, description),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            setIsModalOpen(false);
            setName('');
            setDescription('');
        },
    });

    if (isLoading) return <div className="p-8">Loading projects...</div>;

    return (
        <div className="max-w-6xl mx-auto p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
                {isAdmin && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium"
                    >
                        Create project
                    </button>
                )}
            </div>

            {!projects?.length ? (
                <div className="text-center py-20 bg-white rounded-lg border border-slate-200">
                    <div className="text-5xl mb-4 text-slate-300">📁</div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">
                        {isAdmin ? 'No projects yet' : 'No projects assigned to you'}
                    </h3>
                    <p className="text-slate-500 mb-6">
                        {isAdmin
                            ? 'Create your first project to get started with annotation.'
                            : 'You have not been assigned to any project tasks yet. Contact your admin.'}
                    </p>
                    {isAdmin && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium"
                        >
                            Create project
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => openProject(p.id)}
                            className="block w-full text-left bg-white border border-slate-200 rounded-lg p-5 hover:border-indigo-400 hover:shadow-sm transition group"
                        >
                            <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600 mb-2">
                                {p.name}
                            </h3>
                            {p.description && (
                                <p className="text-slate-500 text-sm mb-4 line-clamp-2">
                                    {p.description}
                                </p>
                            )}
                            <div className="flex gap-4 text-sm text-slate-500 mt-auto pt-4 border-t border-slate-100">
                                <div><span className="font-medium text-slate-700">{p.task_count}</span> tasks</div>
                                <div><span className="font-medium text-slate-700">{p.image_count}</span> images</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {isAdmin && isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-xl font-semibold mb-4 text-slate-900">Create Project</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    placeholder="e.g. Traffic Signs"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none h-24 resize-none"
                                    placeholder="Project description..."
                                />
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
                                onClick={() => createMutation.mutate()}
                                disabled={!name.trim() || createMutation.isPending}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50"
                            >
                                {createMutation.isPending ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
