import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';

interface Assignee { user_id: number; role: string; name: string; email: string }
interface TaskRow {
  id: number; project_id: number; project_name: string;
  name: string; task_type: string; status: string;
  image_count: number; label_count: number; annotated_count: number;
  reviewer_count: number; annotator_count: number;
  assignees: Assignee[];
  created_at: string;
}

const AssignModal: React.FC<{
  task: TaskRow;
  onClose: () => void;
  onChanged: () => void;
}> = ({ task, onClose, onChanged }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [pickedUserId, setPickedUserId] = useState<number | null>(null);
  const [pickedRole, setPickedRole] = useState<'annotator' | 'reviewer'>('annotator');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.listUsers({ limit: 500 }).then(setUsers);
  }, []);

  const assign = async () => {
    if (!pickedUserId) return;
    setBusy(true);
    try {
      await adminApi.assignTask(task.id, pickedUserId, pickedRole);
      onChanged();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (userId: number, role: string) => {
    setBusy(true);
    try { await adminApi.unassignTask(task.id, userId, role); onChanged(); }
    finally { setBusy(false); }
  };

  const eligible = users.filter(
    (u) => u.is_active && (u.role === 'annotator' || u.role === 'manager' || u.role === 'reviewer' || u.role === 'admin'),
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="bg-white rounded-lg w-full max-w-lg p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-1">Assign task</h2>
        <p className="text-sm text-slate-500 mb-4">{task.project_name} · {task.name}</p>

        {/* Current assignees */}
        <div className="mb-4">
          <div className="text-xs font-medium text-slate-500 mb-2">Current assignees</div>
          {task.assignees.length === 0 && (
            <div className="text-sm text-slate-400">No one assigned yet.</div>
          )}
          {task.assignees.map((a) => (
            <div key={`${a.user_id}-${a.role}`}
                 className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
              <span className="text-sm text-slate-900 flex-1">
                {a.name} <span className="text-xs text-slate-500">({a.email})</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                {a.role}
              </span>
              <button onClick={() => unassign(a.user_id, a.role)} disabled={busy}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50">
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="grid grid-cols-[1fr_140px_auto] gap-2">
          <select value={pickedUserId ?? ''} onChange={(e) => setPickedUserId(Number(e.target.value))}
                  className="border border-slate-300 rounded px-2 py-2 text-sm">
            <option value="">Select a user…</option>
            {eligible.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name || u.username} ({u.email})</option>
            ))}
          </select>
          <select value={pickedRole} onChange={(e) => setPickedRole(e.target.value as any)}
                  className="border border-slate-300 rounded px-2 py-2 text-sm">
            <option value="annotator">Annotator</option>
            <option value="reviewer">Reviewer</option>
          </select>
          <button onClick={assign} disabled={!pickedUserId || busy}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
            Assign
          </button>
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Close</button>
        </div>
      </div>
    </div>
  );
};

export const AdminTasksPage: React.FC = () => {
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [assignTarget, setAssignTarget] = useState<TaskRow | null>(null);

  const refresh = () => {
    setLoading(true);
    adminApi.listAllTasks({ status: statusFilter || undefined })
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, [statusFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">All tasks</h2>
        <p className="text-sm text-slate-500 mt-1">
          Assign annotators and reviewers, monitor progress.
        </p>
      </div>

      <div className="flex gap-3 mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="annotation">annotation</option>
          <option value="review">review</option>
          <option value="completed">completed</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Task</th>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Progress</th>
              <th className="px-4 py-2 font-medium">Assignees</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No tasks.</td></tr>
            )}
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                <td className="px-4 py-3 text-slate-600">{t.project_name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{
                          width: `${t.image_count ? (t.annotated_count / t.image_count) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {t.annotated_count}/{t.image_count}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {t.assignees.length === 0 ? (
                    <span className="text-xs text-slate-400">unassigned</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {t.assignees.map((a) => (
                        <span key={`${a.user_id}-${a.role}`}
                              className={`text-xs px-2 py-0.5 rounded ${
                                a.role === 'reviewer'
                                  ? 'bg-sky-100 text-sky-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}>
                          {a.name}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setAssignTarget(t)}
                          className="text-indigo-600 hover:text-indigo-800 text-xs">
                    Assign →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assignTarget && (
        <AssignModal
          task={assignTarget}
          onClose={() => setAssignTarget(null)}
          onChanged={() => { refresh(); }}
        />
      )}
    </div>
  );
};