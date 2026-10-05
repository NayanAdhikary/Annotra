import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type AdminUser, type Role } from '../../api/admin';

const ROLES: Role[] = ['admin', 'manager', 'annotator', 'reviewer', 'observer'];

const ROLE_BADGE: Record<Role, string> = {
  admin:     'bg-rose-100 text-rose-700',
  manager:   'bg-amber-100 text-amber-700',
  annotator: 'bg-emerald-100 text-emerald-700',
  reviewer:  'bg-sky-100 text-sky-700',
  observer:  'bg-slate-100 text-slate-700',
};

const CreateUserModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({
  onClose, onCreated,
}) => {
  const [form, setForm] = useState({
    email: '', username: '', full_name: '', password: '', role: 'annotator' as Role,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await adminApi.createUser(form);
      onCreated();
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setErr(typeof d === 'string' ? d : Array.isArray(d) ? d[0].msg : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
            className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Create user</h2>

        {err && <div className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{err}</div>}

        <input required placeholder="Full name" value={form.full_name} onChange={set('full_name')}
               className="w-full border rounded px-3 py-2 mb-2 text-sm" />
        <input required type="email" placeholder="Email" value={form.email} onChange={set('email')}
               className="w-full border rounded px-3 py-2 mb-2 text-sm" />
        <input required placeholder="Username" value={form.username} onChange={set('username')}
               className="w-full border rounded px-3 py-2 mb-2 text-sm" />
        <input required type="password" placeholder="Password (min 8, letter + digit)"
               value={form.password} onChange={set('password')}
               className="w-full border rounded px-3 py-2 mb-2 text-sm" />

        <label className="block text-xs text-slate-600 mb-1 mt-2">Role</label>
        <select value={form.role} onChange={set('role')}
                className="w-full border rounded px-3 py-2 text-sm mb-4">
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">
            Cancel
          </button>
          <button type="submit" disabled={busy}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [showCreate, setShowCreate] = useState(false);

  const refresh = () => {
    setLoading(true);
    adminApi.listUsers({
      q: q || undefined,
      role: (roleFilter || undefined) as Role | undefined,
    }).then(setUsers).finally(() => setLoading(false)).catch(console.error);
  };

  useEffect(() => { refresh(); }, [q, roleFilter]);

  const total = users.length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Users</h2>
          <p className="text-sm text-slate-500 mt-1">{total} total</p>
        </div>
        <button onClick={() => setShowCreate(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
          + Create user
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Search by email, username, or name…"
               className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm" />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Projects</th>
              <th className="px-4 py-2 font-medium">Last login</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No users match.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/admin/users/${u.id}`} className="block">
                    <div className="font-medium text-slate-900">{u.full_name ?? u.username}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${ROLE_BADGE[u.role]}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 tabular-nums">{u.project_count}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                </td>
                <td className="px-4 py-3">
                  {u.is_active
                    ? <span className="text-xs text-emerald-700">active</span>
                    : <span className="text-xs text-slate-400">disabled</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/admin/users/${u.id}`}
                        className="text-indigo-600 hover:text-indigo-800 text-xs">
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh(); }}
        />
      )}
    </div>
  );
};
