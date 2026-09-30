import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tasksApi } from '../api/tasks';
import type { MyTaskRow, TaskStatus } from '../api/tasks';

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

const Tile: React.FC<{ label: string; value: number; accent: string }> = ({ label, value, accent }) => {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-600',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    red: 'text-red-600',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${colorMap[accent] || 'text-slate-900'}`}>
        {value}
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; tasks: MyTaskRow[]; highlight?: string }> = ({ title, tasks, highlight }) => {
  const [open, setOpen] = useState(true);
  
  if (tasks.length === 0) return null;

  return (
    <div className="mb-8">
      <button 
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mb-3 text-slate-800 font-semibold text-lg hover:text-indigo-600 transition-colors w-full text-left focus:outline-none"
      >
        <span className="w-4 text-center">{open ? '▼' : '▶'}</span>
        {title} <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{tasks.length}</span>
      </button>
      
      {open && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const due = dueBadge(t.due_at);
                const pct = t.image_count ? (t.annotated_count / t.image_count) * 100 : 0;
                const openUrl = t.role === 'reviewer' && t.status === 'review'
                  ? `/tasks/${t.id}?tab=review`
                  : `/tasks/${t.id}`;
                const isHighlight = highlight && t.status === highlight;
                
                return (
                  <tr key={t.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${isHighlight ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.project_name}</div>
                      {t.open_comment_count > 0 && (
                        <div className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                          💬 {t.open_comment_count} open comment{t.open_comment_count === 1 ? '' : 's'}
                        </div>
                      )}
                      {t.rejected_annotation_count > 0 && (
                        <div className="text-xs text-red-700 mt-0.5 flex items-center gap-1">
                          <span className="font-bold">✗</span> {t.rejected_annotation_count} rejected — needs fix
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full capitalize font-medium ${PRIORITY_STYLE[t.priority]}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full capitalize font-medium ${STATUS_STYLE[t.status]}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums font-medium">
                          {t.annotated_count}/{t.image_count}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-xs ${due?.cls ?? 'text-slate-400'}`}>
                      {due?.text ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={openUrl}
                            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors">
                        Open
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

  const annotatorRows = rows.filter((r) => r.role === 'annotator');
  const reviewerRows = rows.filter((r) => r.role === 'reviewer');

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My tasks</h1>
          <p className="text-sm text-slate-500 mt-1">
            Work assigned to you. Sorted by due date, then priority.
          </p>
        </div>
        
        {/* Filters */}
        <div className="flex gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm outline-none">
            <option value="">All statuses</option>
            <option value="annotation">To annotate</option>
            <option value="review">In review</option>
            <option value="completed">Completed</option>
          </select>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm outline-none">
            <option value="">All roles</option>
            <option value="annotator">As annotator</option>
            <option value="reviewer">As reviewer</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Tile label="Assigned to me" value={annotatorRows.length} accent="indigo" />
        <Tile label="To review" value={reviewerRows.filter((r) => r.status === 'review').length} accent="amber" />
        <Tile label="In progress" value={annotatorRows.filter((r) => r.status === 'annotation').length} accent="emerald" />
        <Tile label="Sent back" value={
          annotatorRows.filter((r) => r.status === 'annotation' && r.rejected_annotation_count > 0).length
        } accent="red" />
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 flex justify-center items-center shadow-sm">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : rows.length === 0 ? (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-16 text-center bg-white shadow-sm flex flex-col items-center justify-center">
          <div className="text-5xl mb-4 text-slate-300">✓</div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Nothing on your plate</h3>
          <p className="text-sm text-slate-500 max-w-md">
            When a manager assigns you a task to annotate or review, it will appear here. Enjoy your free time!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="Review queue" tasks={reviewerRows} highlight="review" />
          <Section title="My annotation work" tasks={annotatorRows} />
        </div>
      )}
    </div>
  );
};