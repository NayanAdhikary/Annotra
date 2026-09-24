import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi, AdminUser, Role } from '../../api/admin';
import { useAuthStore } from '../../store/authStore';

const ROLES: Role[] = ['admin', 'manager', 'annotator', 'reviewer', 'observer'];

export const AdminUserDetailPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const id = Number(userId);
  const nav = useNavigate();
  const me = useAuthStore((s) => s.user);

  const [u, setU] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    adminApi.getUser(id).then(setU).catch(() => nav('/admin/users')).finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, [id]);

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;
  if (!u) return null;

  const isSelf = me?.id === u.id;

  const onRole = async (role: Role) => {
    setBusy(true);
    try { setU(await adminApi.updateUser(id, { role })); }
    finally { setBusy(false); }
  };

  const onToggleActive = async () => {
    if (!window.confirm(u.is_active ? 'Deactivate this user? All sessions end.' : 'Reactivate this user?')) return;
    setBusy(true);
    try { setU(await adminApi.updateUser(id, { is_active: !u.is_active })); }
    finally { setBusy(false); }
  };

  const onResetPassword = async () => {
    const pw = window.prompt('New password (min 8, letter + digit):');
    if (!pw) return;
    setBusy(true);
    try { await adminApi.resetPassword(id, pw); alert('Password reset. All their sessions were revoked.'); refresh(); }
    catch (e: any) { alert(e?.response?.data?.detail ?? 'Failed'); }
    finally { setBusy(false); }
  };

  const onRevoke = async () => {
    if (!window.confirm('Sign the user out of all devices?')) return;
    setBusy(true);
    try { await adminApi.revokeSessions(id); refresh(); }
    finally { setBusy(false); }
  };

  const onDelete = async () => {
    if (!window.confirm(`Permanently delete ${u.email}? This cannot be undone.`)) return;
    setBusy(true);
    try { await adminApi.deleteUser(id); nav('/admin/users'); }
    catch (e: any) { alert(e?.response?.data?.detail ?? 'Failed'); setBusy(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="text-sm text-slate-500 mb-2">
        <Link to="/admin/users" className="hover:text-slate-900">Users</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-900">{u.username}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-semibold">
            {(u.full_name ?? u.username).slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{u.full_name ?? u.username}</h1>
            <div className="text-sm text-slate-500">{u.email}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Projects', value: u.project_count },
          { label: 'Tasks', value: u.task_count },
          { label: 'Annotations', value: u.annotation_count.toLocaleString() },
          { label: 'Active sessions', value: u.active_sessions },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className="text-xl font-semibold text-slate-900 mt-1 tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Role */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <h2 className="font-medium text-slate-900 mb-3">Role</h2>
        <div className="flex gap-2 flex-wrap">
          {ROLES.map((r) => (
            <button
              key={r}
              disabled={busy || isSelf}
              onClick={() => onRole(r)}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                u.role === r
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              } disabled:opacity-50`}
            >
              {r}
            </button>
          ))}
        </div>
        {isSelf && (
          <p className="text-xs text-amber-600 mt-2">You cannot change your own role.</p>
        )}
      </section>

      {/* Danger zone */}
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="font-medium text-slate-900 mb-3">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={onResetPassword} disabled={busy}
                  className="px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-50">
            Reset password
          </button>
          <button onClick={onRevoke} disabled={busy}
                  className="px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-50">
            Sign out all devices
          </button>
          <button onClick={onToggleActive} disabled={busy || isSelf}
                  className="px-3 py-1.5 text-sm rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50">
            {u.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
          <button onClick={onDelete} disabled={busy || isSelf}
                  className="px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50">
            Delete user
          </button>
        </div>
      </section>

      {/* Metadata */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 mt-4 text-sm">
        <h2 className="font-medium text-slate-900 mb-3">Metadata</h2>
        <dl className="grid grid-cols-2 gap-2 text-slate-700">
          <dt className="text-slate-500">Created</dt>
          <dd>{new Date(u.created_at).toLocaleString()}</dd>
          <dt className="text-slate-500">Last login</dt>
          <dd>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}</dd>
        </dl>
      </section>
    </div>
  );
};
