import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { adminApi } from '../../api/admin';
import { ProjectDataTab } from '../../components/Admin/ProjectDataTab';
import { ProjectTeamTab } from '../../components/Admin/ProjectTeamTab';
import { ProjectSetupTab } from '../../components/Admin/ProjectSetupTab';
import { useToast } from "../../components/Toast/ToastProvider";

export interface AdminProject {
  id: number; name: string; description: string | null;
  owner_id: number; owner_email: string | null; owner_name: string | null;
  task_count: number; image_count: number; annotation_count: number;
  created_at: string;
}

export interface AdminTask {
  id: number; name: string; task_type: 'image' | 'video';
  status: string; priority: string;
  image_count: number; label_count: number; annotated_count: number;
  assignees: { user_id: number; role: string; name: string; email: string }[];
}

type Tab = 'overview' | 'data' | 'team' | 'setup';

const CreateTaskModal: React.FC<{
  projectId: number;
  onClose: () => void;
  onCreated: () => void;
}> = ({ projectId, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [taskType, setTaskType] = useState<'image' | 'video'>('image');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.createTask(projectId, { name, task_type: taskType });
      onCreated();
    } catch (err: any) {
      setError(err.userMessage || 'Failed to create task');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Create task</h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Name</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Batch 1 - Street signs"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Type</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as 'image' | 'video')}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="image">Image Annotation</option>
              <option value="video">Video Annotation</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded">
              Cancel
            </button>
            <button type="submit" disabled={busy || !name.trim()} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
              {busy ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AdminProjectDetailPage: React.FC = () => {
    const toast = useToast();
  const { projectId } = useParams<{ projectId: string }>();
  const id = Number(projectId);
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('overview');
  const [project, setProject] = useState<AdminProject | null>(null);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);

  const refresh = async () => {
    try {
      const [p, t] = await Promise.all([
        api.get(`/api/admin/projects/${id}`),
        api.get(`/api/admin/tasks`, { params: { project_id: id, limit: 500 } }),
      ]);
      setProject(p.data);
      setTasks(t.data);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [id]);

  if (loading) return <div className="p-8 text-slate-500">Loading project…</div>;

  if (notFound || !project) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center bg-white">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="text-lg font-medium text-slate-900 mb-1">Project not found</h2>
          <Link to="/admin/projects"
                className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
            ← Back to all projects
          </Link>
        </div>
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'data',     label: 'Data' },
    { key: 'team',     label: 'Team & assignments' },
    { key: 'setup',    label: 'Setup & Labels' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b bg-white">
        <div className="text-sm text-slate-500 mb-2">
          <Link to="/admin/projects" className="hover:text-slate-900">All projects</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-900">{project.name}</span>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-slate-500 mt-1">{project.description}</p>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Owned by <span className="text-slate-700">{project.owner_name}</span>
              {' '}({project.owner_email})
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={async () => {
                if (!window.confirm(`Are you sure you want to delete ${project.name}?`)) return;
                try {
                  await api.delete(`/api/projects/${id}`);
                  navigate('/admin/projects');
                } catch (e: any) {
                  toast.push('error', e.userMessage ?? 'Something went wrong');
                }
              }}
              className="px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-md hover:bg-red-50 shadow-sm"
            >
              Delete project
            </button>
            <button
              onClick={() => setShowCreateTask(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 shadow-sm"
            >
              + Create task
            </button>
            <Link to={`/projects/${project.id}`}
                  className="px-4 py-2 border border-slate-300 text-sm font-medium text-slate-700 rounded-md hover:bg-slate-50 shadow-sm">
              Open as user →
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b bg-white">
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-700 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {tab === 'overview' && (
          <OverviewTab project={project} tasks={tasks} />
        )}
        {tab === 'data' && (
          <ProjectDataTab projectId={id} tasks={tasks} onChanged={refresh} />
        )}
        {tab === 'team' && (
          <ProjectTeamTab projectId={id} tasks={tasks} onChanged={refresh} />
        )}
        {tab === 'setup' && (
          <ProjectSetupTab projectId={id} tasks={tasks} onChanged={refresh} />
        )}
      </div>

      {showCreateTask && (
        <CreateTaskModal
          projectId={id}
          onClose={() => setShowCreateTask(false)}
          onCreated={() => {
            setShowCreateTask(false);
            refresh();
          }}
        />
      )}
    </div>
  );
};

// ---------------- Overview tab ----------------

const OverviewTab: React.FC<{ project: AdminProject; tasks: AdminTask[] }> = ({
  project, tasks,
}) => (
  <>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[
        { label: 'Tasks', value: project.task_count },
        { label: 'Images', value: project.image_count.toLocaleString() },
        { label: 'Annotations', value: project.annotation_count.toLocaleString() },
        { label: 'Staffed tasks', value: tasks.filter((t) => t.assignees.length > 0).length },
      ].map((s) => (
        <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">{s.label}</div>
          <div className="text-xl font-semibold text-slate-900 mt-1 tabular-nums">{s.value}</div>
        </div>
      ))}
    </div>

    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h2 className="font-medium text-slate-900">Tasks</h2>
      </div>
      {tasks.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-slate-500">No tasks yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Progress</th>
              <th className="px-4 py-2 font-medium">Staffed</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                <td className="px-4 py-3 text-slate-600 capitalize">{t.task_type}</td>
                <td className="px-4 py-3 text-slate-600 capitalize">{t.status}</td>
                <td className="px-4 py-3 text-slate-600 tabular-nums">
                  {t.annotated_count}/{t.image_count}
                </td>
                <td className="px-4 py-3">
                  {t.assignees.length === 0
                    ? <span className="text-xs text-amber-700">unassigned</span>
                    : <span className="text-xs text-emerald-700">
                        {t.assignees.length} user{t.assignees.length === 1 ? '' : 's'}
                      </span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/tasks/${t.id}/setup`} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                    Setup →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </>
);
