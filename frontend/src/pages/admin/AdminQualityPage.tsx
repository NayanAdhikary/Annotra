import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface QRow {
  user_id: number; user_email: string; user_name: string | null; role: string;
  annotated_count: number; accepted_count: number; rejected_count: number;
  fixed_count: number; pending_count: number;
  acceptance_rate: number; avg_per_day_7d: number;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const rateColor = (r: number) => {
  if (r >= 0.95) return 'text-emerald-700';
  if (r >= 0.85) return 'text-sky-700';
  if (r >= 0.7)  return 'text-amber-700';
  return 'text-red-700';
};

export const AdminQualityPage: React.FC = () => {
  const [rows, setRows] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'rate' | 'volume' | 'rejections'>('rate');

  useEffect(() => {
    api.get('/api/admin/quality')
      .then((r) => setRows(r.data.rows))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === 'rate') return b.acceptance_rate - a.acceptance_rate;
    if (sortBy === 'volume') return b.annotated_count - a.annotated_count;
    return b.rejected_count - a.rejected_count;
  });

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Quality report</h2>
        <p className="text-sm text-slate-500 mt-1">
          Acceptance rate is the strongest signal of annotation quality.
          Aim for &gt; 90%.
        </p>
      </div>

      <div className="flex gap-3 mb-4">
        <button onClick={() => setSortBy('rate')}
                className={`px-3 py-1.5 text-sm rounded border ${
                  sortBy === 'rate' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300'
                }`}>
          Sort by acceptance
        </button>
        <button onClick={() => setSortBy('volume')}
                className={`px-3 py-1.5 text-sm rounded border ${
                  sortBy === 'volume' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300'
                }`}>
          Sort by volume
        </button>
        <button onClick={() => setSortBy('rejections')}
                className={`px-3 py-1.5 text-sm rounded border ${
                  sortBy === 'rejections' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300'
                }`}>
          Sort by rejections
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Annotated</th>
              <th className="px-4 py-2 font-medium">Accepted</th>
              <th className="px-4 py-2 font-medium">Rejected</th>
              <th className="px-4 py-2 font-medium">Fixed</th>
              <th className="px-4 py-2 font-medium">Acceptance</th>
              <th className="px-4 py-2 font-medium">7d avg / day</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.user_id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{r.user_name ?? r.user_email}</div>
                  <div className="text-xs text-slate-500">{r.user_email}</div>
                </td>
                <td className="px-4 py-3 text-slate-600 capitalize text-xs">{r.role}</td>
                <td className="px-4 py-3 text-slate-700 tabular-nums">
                  {r.annotated_count.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-emerald-700 tabular-nums">{r.accepted_count}</td>
                <td className="px-4 py-3 text-red-700 tabular-nums">{r.rejected_count}</td>
                <td className="px-4 py-3 text-amber-700 tabular-nums">{r.fixed_count}</td>
                <td className={`px-4 py-3 font-medium tabular-nums ${rateColor(r.acceptance_rate)}`}>
                  {pct(r.acceptance_rate)}
                </td>
                <td className="px-4 py-3 text-slate-600 tabular-nums">
                  {r.avg_per_day_7d}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
