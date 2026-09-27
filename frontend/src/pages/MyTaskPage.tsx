import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tasksApi, MyTaskRow, TaskStatus } from '../api/tasks';

const PRIORITY_STYLE: Record<string, string> = {
  low:    'bg-slate-100 text-slate-600',
  normal: 'bg-sky-100 text-sky-700',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  annotation: 'bg-emerald-100 text-emerald-700',
  review:     'bg-amber-100 text-amber-700',
  completed:  'bg-sky-100 text-sky-700',
  archived:   'bg-slate-100 text-slate-500',
};

const DUE_SOON_DAYS = 3;

const dueBadge = (due: string | null) => {
  if (!due) return null;
  const d = new Date(due);
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return { text: `Overdue ${Math.abs(diffDays)}d`, cls: 'text-red-700' };
  if (diffDays <= DUE_SOON_DAYS) return { text: `Due in ${diffDays}d`, cls: 'text-amber-700' };
  return { text: `Due ${d.toLocaleDateString()}`, cls: 'text-slate-500' };
};

export const MyTasksPage: React.FC = () => {
  const nav = useNavigate();
  const [rows, setRows] = useState<MyTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [roleFilter, setRoleFilter] = useState<'annotator' | 'reviewer' | ''>('');

  useEffect(() => {
    setLoading(true);
    tasksApi.myTasks({
      status: (statusFilter || undefined) as TaskStatus | undefined,
      role: (roleFilter || undefined) as any,
    }).then(setRows).finally(() => setLoading(false));
  }, [statusFilter, roleFilter]);

  const counts = useMemo(() => {
    return {
      total: rows.length,
      urgent: rows.filter((r) => r.priority === 'urgent' && r.status !== 'completed').length,
      inReview: rows.filter((r) => r.status === 'review').length,
      unreadComments: rows.reduce((n, r) => n + r.open_comment_count, 0),
    };
  }, [rows]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">My tasks</h1>
        <p className="text-sm text-slate-500 mt-1">
          Work assigned to you. Sorted by due date, then priority.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Assigned', value: counts.total },
          { label: 'Urgent', value: counts.urgent, cls: counts.urgent > 0 ? 'text-red-600' : '' },
          { label: 'In review', value: counts.inReview },
          { label: 'Open comments', value: counts.unreadComments },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className={`text-2xl font-semibold mt-1 tabular-nums ${c.cls ?? 'text-slate-900'}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="annotation">To annotate</option>
          <option value="review">In review</option>
          <option value="completed">Completed</option>
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="">All roles</option>
          <option value="annotator">As annotator</option>
          <option value="reviewer">As reviewer</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-16 text-center bg-white">
          <div className="text-4xl mb-3">✓</div>
          <h3 className="text-lg font-medium text-slate-900 mb-1">Nothing on your plate</h3>
          <p className="text-sm text-slate-500">
            When a manager assigns you a task, it appears here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Task</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Progress</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const due = dueBadge(t.due_at);
                const pct = t.image_count ? (t.annotated_count / t.image_count) * 100 : 0;
                const openUrl = t.task_type === 'video'
                  ? `/tasks/${t.id}/setup`
                  : `/tasks/${t.id}`;
                return (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.project_name}</div>
                      {t.open_comment_count > 0 && (
                        <div className="text-xs text-amber-700 mt-0.5">
                          💬 {t.open_comment_count} open comment{t.open_comment_count === 1 ? '' : 's'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                        t.role === 'reviewer'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>{t.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${PRIORITY_STYLE[t.priority]}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${STATUS_STYLE[t.status]}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {t.annotated_count}/{t.image_count}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-xs ${due?.cls ?? 'text-slate-400'}`}>
                      {due?.text ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={openUrl}
                            className="text-indigo-600 hover:text-indigo-800 text-xs">
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};