import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, SystemStats, AuditEntry } from '../../api/admin';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const StatCard: React.FC<{
  label: string; value: string | number; sub?: string; icon: string; accent: string;
}> = ({ label, value, sub, icon, accent }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-4">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
          {value}
        </div>
        {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
      </div>
      <div className={`w-9 h-9 rounded-md flex items-center justify-center text-lg ${accent}`}>
        {icon}
      </div>
    </div>
  </div>
);

const fmtBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recent, setRecent] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<{ date: string; annotations: number; active_users: number }[]>([]);

  useEffect(() => {
    adminApi.analytics(30).then((s: any) => setSeries(s.points));
  }, []);

  useEffect(() => {
    Promise.all([
      adminApi.stats(),
      adminApi.audit({ limit: 15 }),
    ])
      .then(([s, a]) => { setStats(s); setRecent(a.items); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;
  if (!stats) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">System overview</h2>
        <p className="text-sm text-slate-500 mt-1">Live counts across the whole organization.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Users" value={stats.total_users}
                  sub={`${stats.active_users_7d} active in last 7d`}
                  icon="◉" accent="bg-indigo-50 text-indigo-600" />
        <StatCard label="Projects" value={stats.total_projects}
                  sub={`${stats.total_tasks} tasks`}
                  icon="▤" accent="bg-emerald-50 text-emerald-600" />
        <StatCard label="Images" value={stats.total_images.toLocaleString()}
                  sub={fmtBytes(stats.storage_bytes) + ' on disk'}
                  icon="▦" accent="bg-amber-50 text-amber-600" />
        <StatCard label="Annotations" value={stats.total_annotations.toLocaleString()}
                  sub={`${stats.annotations_today} today`}
                  icon="✦" accent="bg-rose-50 text-rose-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-medium text-slate-900">Recent activity</h3>
            <Link to="/admin/audit" className="text-xs text-indigo-600 hover:underline">
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {recent.length === 0 && (
              <li className="px-4 py-8 text-sm text-slate-500 text-center">
                No activity recorded yet.
              </li>
            )}
            {recent.map((e) => (
              <li key={e.id} className="px-4 py-3 flex items-start gap-3 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-slate-900">
                    <span className="font-medium">{e.user_email ?? 'system'}</span>
                    {' '}<span className="text-slate-500">{e.action}</span>
                    {e.resource_type && (
                      <span className="text-slate-400">
                        {' '}· {e.resource_type}#{e.resource_id}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b">
            <h3 className="font-medium text-slate-900">Quick actions</h3>
          </div>
          <div className="p-4 space-y-2">
            <Link to="/admin/users"
                  className="block w-full text-left px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">
              + Invite user
            </Link>
            <Link to="/admin/audit"
                  className="block w-full text-left px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">
              → Inspect audit log
            </Link>
            <Link to="/admin/health"
                  className="block w-full text-left px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50">
              ✚ Run health check
            </Link>
          </div>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="font-medium text-slate-900 mb-3">Activity (last 30 days)</h3>
        {series.length === 0 ? (
          <div className="text-sm text-slate-500 py-12 text-center">No data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={series} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="annotations" stroke="#6366f1" strokeWidth={2} dot={false} name="Annotations" />
              <Line type="monotone" dataKey="active_users" stroke="#10b981" strokeWidth={2} dot={false} name="Active users" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
};
