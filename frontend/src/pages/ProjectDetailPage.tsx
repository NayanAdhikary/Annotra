import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { projectsAPI } from '../api/project';
import { useAuthStore } from '../store/authStore';
import { useToast } from "../components/Toast/ToastProvider";

const STATUS_STYLE: Record<string, string> = {
  annotation: 'bg-emerald-100 text-emerald-700',
  review:     'bg-amber-100 text-amber-700',
  completed:  'bg-sky-100 text-sky-700',
  archived:   'bg-slate-100 text-slate-500',
};

const Stat: React.FC<{ label: string; value: number; accent?: string }> = ({ label, value, accent }) => {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-600',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    sky: 'text-sky-600',
    red: 'text-red-600',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${accent ? colorMap[accent] : 'text-slate-900'}`}>
        {value}
      </div>
    </div>
  );
};

export const ProjectDetailPage: React.FC = () => {
    const toast = useToast();
    const { projectId: rawId } = useParams<{ projectId: string }>();
    const projectId = parseInt(rawId || '0', 10);
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const isAdmin = user?.role === 'admin' || user?.role === 'manager';

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

    const [hasAutoOpened, setHasAutoOpened] = useState(false);
    useEffect(() => {
        // Only auto-open create modal for admins when there are no tasks
        if (isAdmin && !isTasksLoading && tasks?.length === 0 && !hasAutoOpened) {
            setIsModalOpen(true);
            setHasAutoOpened(true);
        }
    }, [isAdmin, isTasksLoading, tasks, hasAutoOpened]);

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

    const handleDeleteProject = async () => {
        if (!window.confirm(`Are you sure you want to delete the project "${project?.name}"? This action cannot be undone and will delete all associated tasks, images, and annotations.`)) return;
        try {
            await projectsAPI.remove(projectId);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            navigate('/');
        } catch (e) {
            toast.push('error', e.userMessage ?? 'Something went wrong');
            toast.push('error', e.userMessage ?? 'Something went wrong');
        }
    };

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
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
                        {project.has_tool_override && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                                🔧 Custom tools
                            </span>
                        )}
                    </div>
                    {project.description && <p className="text-slate-600">{project.description}</p>}
                    {!isAdmin && (
                        <p className="text-sm text-slate-400 mt-1">Showing tasks assigned to you</p>
                    )}
                </div>
                {isAdmin && (
                    <div className="flex gap-3 items-center">
                        <Link
                            to={`/projects/${project.id}/settings`}
                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1"
                        >
                            ⚙ Project settings
                        </Link>
                        <button
                            onClick={handleDeleteProject}
                            className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 font-medium whitespace-nowrap"
                        >
                            Delete project
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium whitespace-nowrap"
                        >
                            Create task
                        </button>
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-4 gap-3 mb-8">
                <Stat label="Tasks" value={project.task_count} />
                <Stat label="Annotations" value={project.image_count} />
                <Stat label="In progress" value={project.annotation_task_count} accent="emerald" />
                <Stat label="In review" value={project.in_review_task_count} accent="amber" />
                <Stat label="Completed" value={project.completed_task_count} accent="sky" />
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-900 font-medium">
                        <tr>
                            <th className="py-3 px-4">Name</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Status</th>
                            {!isAdmin && <th className="py-3 px-4">My Role</th>}
                            <th className="py-3 px-4 text-right">Images</th>
                            {isAdmin && <th className="py-3 px-4 text-right">Labels</th>}
                            <th className="py-3 px-4 text-right">Progress</th>
                            <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {!tasks?.length ? (
                            <tr>
                                <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-slate-500 bg-white">
                                    <div className="text-4xl mb-3 text-slate-300 text-center">📋</div>
                                    <h3 className="text-lg font-medium text-slate-900 mb-1">
                                        {isAdmin ? 'No tasks yet' : 'Nothing assigned'}
                                    </h3>
                                    <p className="text-sm mb-4 text-slate-500">
                                        {isAdmin ? 'Create your first task to start.' : 'No tasks in this project are assigned to you.'}
                                    </p>
                                    {isAdmin && (
                                        <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded font-medium hover:bg-indigo-700">
                                            Create task
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            tasks.map((t) => {
                                // Find the current user's assignment role for this task
                                const myAssignment = t.assignees?.find(
                                    (a) => a.user_id === user?.id
                                );
                                return (
                                    <tr key={t.id} className="hover:bg-slate-50">
                                        <td className="py-3 px-4 font-medium text-slate-900">{t.name}</td>
                                        <td className="py-3 px-4 capitalize">{t.task_type}</td>
                                        <td className="px-4 py-3">
                                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[t.status] ?? ''}`}>
                                            {t.status}
                                          </span>
                                        </td>
                                        {!isAdmin && (
                                            <td className="py-3 px-4">
                                                {myAssignment ? (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                                        myAssignment.role === 'reviewer'
                                                            ? 'bg-sky-100 text-sky-700'
                                                            : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                        {myAssignment.role}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">—</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="py-3 px-4 text-right">{t.image_count}</td>
                                        {isAdmin && <td className="py-3 px-4 text-right">{t.label_count}</td>}
                                        <td className="py-3 px-4 text-right text-slate-500">
                                            {t.annotated_count} / {t.image_count}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <Link
                                                to={`/tasks/${t.id}`}
                                                className="text-indigo-600 font-medium hover:text-indigo-800"
                                            >
                                                {myAssignment?.role === 'reviewer' ? 'Review →' : 'Annotate →'}
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {isAdmin && isModalOpen && (
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
