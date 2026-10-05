import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { tasksApi } from '../api/tasks';
import type { TaskDetail, Comment, TaskStatus, TaskPriority } from '../api/tasks';
import { useAuthStore } from '../store/authStore';
import { TaskComments } from '../components/Tasks/TaskComments';
import { useToast } from "../components/Toast/ToastProvider";

const STATUS_STYLE: Record<TaskStatus, string> = {
  annotation: 'bg-emerald-100 text-emerald-700',
  review:     'bg-amber-100 text-amber-700',
  completed:  'bg-sky-100 text-sky-700',
  archived:   'bg-slate-100 text-slate-500',
};

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

export const TaskDetailPage: React.FC = () => {
    const toast = useToast();
  const { taskId } = useParams<{ taskId: string }>();
  const id = Number(taskId);
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Editable fields
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [description, setDescription] = useState('');

  const refresh = async () => {
    const [t, cs] = await Promise.all([
      tasksApi.get(id),
      tasksApi.listComments(id),
    ]);
    setTask(t);
    setComments(cs);
    setInstructions(t.instructions ?? '');
    setDescription(t.description ?? '');
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [id]);

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;
  if (!task) return null;

  const isOwner = user?.role === 'admin' || user?.role === 'manager';

  const changeStatus = async (to: TaskStatus) => {
    setBusy(true);
    try { setTask(await tasksApi.transition(id, to)); }
    catch (e: any) { toast.push('error', e.userMessage ?? 'Something went wrong'); }
    finally { setBusy(false); }
  };

  const saveInstructions = async () => {
    setBusy(true);
    try {
      const updated = await tasksApi.update(id, { instructions, description });
      setTask(updated);
      setEditingInstructions(false);
    } finally { setBusy(false); }
  };

  const changePriority = async (p: TaskPriority) => {
    setBusy(true);
    try { setTask(await tasksApi.update(id, { priority: p })); }
    finally { setBusy(false); }
  };

  const changeDue = async (iso: string) => {
    setBusy(true);
    try { setTask(await tasksApi.update(id, { due_at: iso || null })); }
    finally { setBusy(false); }
  };

  const duplicate = async () => {
    if (!window.confirm('Duplicate this task? Labels will be copied; images will not.')) return;
    setBusy(true);
    try {
      const clone = await tasksApi.duplicate(id);
      nav(`/tasks/${clone.id}`);
    } finally { setBusy(false); }
  };

  const pct = task.image_count ? (task.annotated_count / task.image_count) * 100 : 0;

  // Which transitions the current user can drive
  const canTransition = (to: TaskStatus) => {
    if (!user) return false;
    const role = user.role;
    const cur = task.status;
    if (cur === 'annotation' && to === 'review') return ['annotator', 'admin', 'manager'].includes(role);
    if (cur === 'review' && to === 'completed') return ['reviewer', 'admin', 'manager'].includes(role);
    if (cur === 'review' && to === 'annotation') return ['reviewer', 'admin', 'manager'].includes(role);
    if (to === 'archived') return ['admin', 'manager'].includes(role);
    return false;
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="text-sm text-slate-500 mb-3">
        <Link to="/" className="hover:text-slate-900">Projects</Link>
        <span className="mx-2">/</span>
        <Link to={`/projects/${task.project_id}`} className="hover:text-slate-900">
          {task.project_name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-900">{task.name}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-slate-900">{task.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded capitalize ${STATUS_STYLE[task.status]}`}>
              {task.status}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {task.task_type} · {task.image_count} images · {task.label_count} labels
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {canTransition('review') && task.status === 'annotation' && (
            <button onClick={() => changeStatus('review')} disabled={busy}
                    className="px-4 py-2 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 disabled:opacity-50">
              Submit for review
            </button>
          )}
          {canTransition('completed') && task.status === 'review' && (
            <button onClick={() => changeStatus('completed')} disabled={busy}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700 disabled:opacity-50">
              Approve & complete
            </button>
          )}
          {canTransition('annotation') && task.status === 'review' && (
            <button onClick={() => changeStatus('annotation')} disabled={busy}
                    className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50">
              Send back
            </button>
          )}
          {isOwner && (
            <>
              <button onClick={duplicate} disabled={busy}
                      className="px-3 py-2 border border-slate-300 text-sm rounded-md hover:bg-slate-50">
                Duplicate
              </button>
              <Link to={task.task_type === 'video' ? `/tasks/${id}/setup` : `/tasks/${id}`}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
                Open workspace →
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: instructions + description */}
        <div className="lg:col-span-2 space-y-4">
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-slate-900">Instructions for annotators</h2>
              {isOwner && !editingInstructions && (
                <button onClick={() => setEditingInstructions(true)}
                        className="text-xs text-indigo-600 hover:underline">
                  Edit
                </button>
              )}
            </div>

            {editingInstructions ? (
              <>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="One-line summary"
                  className="w-full border border-slate-300 rounded px-3 py-2 mb-2 text-sm"
                />
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={8}
                  placeholder="Markdown guidelines for annotators…"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={saveInstructions} disabled={busy}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
                    Save
                  </button>
                  <button onClick={() => { setEditingInstructions(false); setInstructions(task.instructions ?? ''); setDescription(task.description ?? ''); }}
                          className="px-3 py-1.5 text-sm text-slate-600">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                {task.description && (
                  <p className="text-sm text-slate-700 mb-3">{task.description}</p>
                )}
                {task.instructions ? (
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
                    {task.instructions}
                  </pre>
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    No instructions provided yet.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-lg">
            <TaskComments
              taskId={id}
              comments={comments}
              onChanged={refresh}
            />
          </section>
        </div>

        {/* Right: metadata + assignees + progress */}
        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="font-medium text-slate-900 mb-3">Progress</h2>
            <div className="text-3xl font-semibold text-slate-900 tabular-nums">
              {Math.round(pct)}%
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {task.annotated_count} of {task.image_count} images
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-3">
              <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="font-medium text-slate-900 mb-3">Priority</h2>
            <div className="flex gap-1 flex-wrap">
              {PRIORITIES.map((p) => (
                <button key={p} disabled={!isOwner || busy} onClick={() => changePriority(p)}
                        className={`text-xs px-2 py-1 rounded capitalize border ${
                          task.priority === p
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        } disabled:opacity-50`}>
                  {p}
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="font-medium text-slate-900 mb-3">Due date</h2>
            {isOwner ? (
              <input
                type="date"
                value={task.due_at ? task.due_at.slice(0, 10) : ''}
                onChange={(e) => changeDue(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            ) : (
              <p className="text-sm text-slate-700">
                {task.due_at ? new Date(task.due_at).toLocaleDateString() : 'No deadline set'}
              </p>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="font-medium text-slate-900 mb-3">Team</h2>
            {task.assignees.length === 0 && (
              <p className="text-sm text-slate-400">No assignees.</p>
            )}
            <ul className="space-y-2">
              {task.assignees.map((a) => (
                <li key={`${a.user_id}-${a.role}`} className="flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center">
                    {(a.name ?? '?').slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate text-slate-900">{a.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                    a.role === 'reviewer'
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>{a.role}</span>
                </li>
              ))}
            </ul>
            {isOwner && (
              <Link to="/admin/tasks"
                    className="block text-xs text-indigo-600 hover:underline mt-3">
                Manage assignments →
              </Link>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};