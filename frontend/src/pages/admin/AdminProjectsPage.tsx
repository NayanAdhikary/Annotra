import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';

interface Row {
  id: number; name: string; description: string | null;
  owner_id: number; owner_email: string | null; owner_name: string | null;
  task_count: number; image_count: number; annotation_count: number;
  created_at: string;
}

export const AdminProjectsPage: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    setLoading(true);
    adminApi.listAllProjects({ q: q || undefined })
      .then(setRows)
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">All projects</h2>
        <p className="text-sm text-slate-500 mt-1">
          Every project in the system, regardless of owner.
        </p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search projects…"
        className="w-full max-w-md border border-slate-300 rounded-md px-3 py-2 mb-4 text-sm"
      />

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Owner</th>
              <th className="px-4 py-2 font-medium">Tasks</th>
              <th className="px-4 py-2 font-medium">Images</th>
              <th className="px-4 py-2 font-medium">Annotations</th>
              <th className="px-4 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No projects.</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-slate-500 truncate max-w-xs">{p.description}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <div>{p.owner_name}</div>
                  <div className="text-xs text-slate-400">{p.owner_email}</div>
                </td>
                <td className="px-4 py-3 text-slate-600 tabular-nums">{p.task_count}</td>
                <td className="px-4 py-3 text-slate-600 tabular-nums">{p.image_count}</td>
                <td className="px-4 py-3 text-slate-600 tabular-nums">{p.annotation_count.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};