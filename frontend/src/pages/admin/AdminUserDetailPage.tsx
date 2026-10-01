import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi, type AdminUser, type Role } from '../../api/admin';
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

  const [sessions, setSessions] = useState<any[]>([]);
  useEffect(() => {
    adminApi.listUserSessions(id).then(setSessions);
  }, [id, busy]);

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


  const killSession = async (sessionId: number) => {
    if (!window.confirm('End this session?')) return;
    await adminApi.killSession(sessionId);
    setSessions(await adminApi.listUserSessions(id));
  };

  const impersonate = async () => {
    if (!window.confirm(
      `Impersonate ${u.email}? You will act as them for 30 minutes. This action is logged.`
    )) return;
    const r = await adminApi.impersonate(id);
    // Stash admin session, swap in the impersonated one
    const authStore = useAuthStore.getState();
    const adminBackup = {
      user: authStore.user,
      access: authStore.accessToken,
      refresh: authStore.refreshToken,
    };
    localStorage.setItem('annotra.impersonationBackup', JSON.stringify(adminBackup));
    // Fetch the impersonated user object
    const impersonatedUser = await (await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${r.access_token}` },
    })).json();
    authStore.setSession(impersonatedUser, r.access_token, r.refresh_token);
    window.location.href = '/';
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
            {(u.full_name || u.username || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{u.full_name || u.username || 'Unknown User'}</h1>
            <div className="text-sm text-slate-500">{u.email}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Projects', value: u.project_count || 0 },
          { label: 'Tasks', value: u.task_count || 0 },
          { label: 'Annotations', value: (u.annotation_count || 0).toLocaleString() },
          { label: 'Active sessions', value: u.active_sessions || 0 },
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
          <button onClick={impersonate} disabled={busy}
                  className="px-3 py-1.5 text-sm rounded-md border border-purple-300 text-purple-700 hover:bg-purple-50">
            Impersonate user
          </button>
        </div>
      </section>

      {/* Active Sessions */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 mt-4">
        <h2 className="font-medium text-slate-900 mb-3">
          Active sessions <span className="text-slate-400 text-sm">({(sessions || []).filter((s) => s.is_active).length})</span>
        </h2>
        {(!sessions || sessions.length === 0) && (
          <p className="text-sm text-slate-500">No sessions on record.</p>
        )}
        <ul className="divide-y divide-slate-100">
          {(sessions || []).map((s) => (
            <li key={s.id} className="py-3 flex items-center gap-3 text-sm">
              <span className={`w-2 h-2 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-slate-900 truncate">
                  {s.user_agent?.slice(0, 80) || 'Unknown client'}
                </div>
                <div className="text-xs text-slate-500">
                  {s.ip_address || 'no IP'} · started {new Date(s.created_at).toLocaleString()}
                </div>
              </div>
              {s.is_active && (
                <button onClick={() => killSession(s.id)}
                        className="text-xs text-red-600 hover:underline">
                  End session
                </button>
              )}
            </li>
          ))}
        </ul>
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
