import React, { useEffect, useState } from 'react';
import { adminApi, type AuditEntry } from '../../api/admin';
import { useAuthStore } from '../../store/authStore';

const ACTION_COLOR = (action: string) => {
  if (action.includes('delete')) return 'text-red-700 bg-red-50';
  if (action.includes('create')) return 'text-emerald-700 bg-emerald-50';
  if (action.includes('update') || action.includes('role')) return 'text-amber-700 bg-amber-50';
  if (action.includes('password') || action.includes('sessions')) return 'text-sky-700 bg-sky-50';
  return 'text-slate-700 bg-slate-100';
};

export const AdminAuditPage: React.FC = () => {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [offset, setOffset] = useState(0);
  const LIMIT = 100;
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    setLoading(true);
    adminApi.audit({
      action: action || undefined,
      resource_type: resourceType || undefined,
      limit: LIMIT,
      offset,
    })
      .then((page) => { setItems(page.items); setTotal(page.total); })
      .finally(() => setLoading(false));
  }, [action, resourceType, offset]);

  const pages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Audit log</h2>
          <p className="text-sm text-slate-500 mt-1">
            {total.toLocaleString()} events recorded
          </p>
        </div>
        <button
          onClick={() => {
            const params = new URLSearchParams();
            if (action) params.set('action', action);
            if (resourceType) params.set('resource_type', resourceType);
            const url = `/api/admin/audit/export?${params.toString()}`;
            // Fetch with auth header, then trigger download via blob
            fetch(url, { headers: { Authorization: `Bearer ${token}` } })
              .then((r) => r.blob())
              .then((blob) => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
                link.click();
              });
          }}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
        >
          Export CSV
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }}
               placeholder="Filter by action (e.g. user.role_change)"
               className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm" />
        <select value={resourceType}
                onChange={(e) => { setResourceType(e.target.value); setOffset(0); }}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="">All resources</option>
          <option value="user">user</option>
          <option value="project">project</option>
          <option value="task">task</option>
          <option value="label">label</option>
          <option value="annotation">annotation</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Resource</th>
              <th className="px-4 py-2 font-medium">IP</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No events.</td></tr>
            )}
            {items.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-slate-700">{e.user_email ?? '—'}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${ACTION_COLOR(e.action)}`}>
                    {e.action}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600 text-xs">
                  {e.resource_type ? `${e.resource_type}#${e.resource_id}` : '—'}
                </td>
                <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">
                  {e.ip_address ?? '—'}
                </td>
                <td className="px-4 py-2 text-slate-500 text-xs max-w-md truncate"
                    title={JSON.stringify(e.meta)}>
                  {Object.keys(e.meta).length ? JSON.stringify(e.meta) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            disabled={offset === 0}
            className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-slate-500">Page {currentPage} of {pages}</span>
          <button
            onClick={() => setOffset(offset + LIMIT)}
            disabled={offset + LIMIT >= total}
            className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
