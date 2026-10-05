import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { AdminTask } from '../../pages/admin/AdminProjectDetailPage';

interface Props {
  projectId: number;
  tasks: AdminTask[];
  onChanged: () => void;
}

interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
}

interface AssignState {
  annotator_ids: number[];
  reviewer_ids: number[];
}

export const ProjectTeamTab: React.FC<Props> = ({ tasks, onChanged }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/admin/users', { params: { limit: 500 } }).then((r) => setUsers(r.data)).catch(console.error);
  }, []);

  const eligible = users.filter(
    (u) => u.is_active && u.role !== 'observer',
  );

  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  return (
    <div className="space-y-4">
      {/* Header hint */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm text-indigo-900">
        Assign at least one annotator and one reviewer to every task before it goes live.
        Assignments drive the "My tasks" list each user sees.
      </div>

      {tasks.length === 0 && (
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-16 text-center bg-white">
          <div className="text-4xl mb-3">👥</div>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No tasks to staff yet</h3>
          <p className="text-sm text-slate-500">
            Create a task first, then come back to assign people.
          </p>
        </div>
      )}

      {tasks.map((t) => {
        const isOpen = openTaskId === t.id;
        const annotators = t.assignees.filter((a) => a.role === 'annotator');
        const reviewers = t.assignees.filter((a) => a.role === 'reviewer');
        const isStaffed = annotators.length > 0 && reviewers.length > 0;

        return (
          <div key={t.id} className="bg-white border border-slate-200 rounded-lg">
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-2 h-2 rounded-full ${
                  isStaffed ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">{t.name}</div>
                  <div className="text-xs text-slate-500">
                    {annotators.length} annotator{annotators.length === 1 ? '' : 's'} ·{' '}
                    {reviewers.length} reviewer{reviewers.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex flex-wrap gap-1 max-w-md justify-end">
                  {t.assignees.slice(0, 3).map((a) => (
                    <span
                      key={`${a.user_id}-${a.role}`}
                      className={`text-xs px-2 py-0.5 rounded ${
                        a.role === 'reviewer'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {a.name}
                    </span>
                  ))}
                  {t.assignees.length > 3 && (
                    <span className="text-xs text-slate-500">
                      +{t.assignees.length - 3} more
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setOpenTaskId(isOpen ? null : t.id)}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  {isOpen ? 'Close' : 'Assign'}
                </button>
              </div>
            </div>

            {isOpen && (
              <TaskAssignPanel
                task={t}
                eligible={eligible}
                usersById={usersById}
                saving={saving}
                setSaving={setSaving}
                onSaved={() => { setOpenTaskId(null); onChanged(); }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ---------------- Per-task assignment panel ----------------

const TaskAssignPanel: React.FC<{
  task: AdminTask;
  eligible: User[];
  usersById: Record<number, User>;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onSaved: () => void;
}> = ({ task, eligible, usersById, saving, setSaving, onSaved }) => {
  const [state, setState] = useState<AssignState>({
    annotator_ids: task.assignees.filter((a) => a.role === 'annotator').map((a) => a.user_id),
    reviewer_ids: task.assignees.filter((a) => a.role === 'reviewer').map((a) => a.user_id),
  });

  const toggle = (role: keyof AssignState, uid: number) => {
    setState((s) => {
      const list = s[role];
      return {
        ...s,
        [role]: list.includes(uid) ? list.filter((x) => x !== uid) : [...list, uid],
      };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/api/admin/tasks/${task.id}/assign/bulk`, {
        annotator_ids: state.annotator_ids,
        reviewer_ids: state.reviewer_ids,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const RolePicker: React.FC<{ role: keyof AssignState; title: string; hint: string }> = ({
    role, title, hint,
  }) => (
    <div>
      <div className="mb-2">
        <div className="text-sm font-medium text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{hint}</div>
      </div>
      <div className="border border-slate-200 rounded-md max-h-56 overflow-y-auto">
        {eligible.length === 0 && (
          <div className="p-3 text-xs text-slate-500">No eligible users.</div>
        )}
        {eligible.map((u) => {
          const checked = state[role].includes(u.id);
          return (
            <label
              key={u.id}
              className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-b border-slate-100 last:border-0 ${
                checked ? 'bg-indigo-50' : 'hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(role, u.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="truncate">{u.full_name ?? u.username}</div>
                <div className="text-xs text-slate-500 truncate">{u.email}</div>
              </div>
              <span className="text-[10px] uppercase text-slate-400">{u.role}</span>
            </label>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="border-t border-slate-200 p-5 space-y-4 bg-slate-50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RolePicker
          role="annotator_ids"
          title="Annotators"
          hint="People who will draw the shapes."
        />
        <RolePicker
          role="reviewer_ids"
          title="Reviewers"
          hint="People who will accept or reject annotations."
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
        <div className="mr-auto text-xs text-slate-500 self-center">
          Currently assigned:{' '}
          {state.annotator_ids.length + state.reviewer_ids.length} user
          {state.annotator_ids.length + state.reviewer_ids.length === 1 ? '' : 's'}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save assignments'}
        </button>
      </div>
    </div>
  );
};
