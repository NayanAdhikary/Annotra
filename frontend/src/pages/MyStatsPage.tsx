import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

interface MyStats {
  total_annotated: number;
  total_accepted: number;
  total_rejected: number;
  acceptance_rate: number;
  tasks_completed: number;
  avg_per_day_7d: number;
}

export const MyStatsPage: React.FC = () => {
  const [s, setS] = useState<MyStats | null>(null);
  useEffect(() => {
    api.get('/api/me/stats').then((r) => setS(r.data)).catch(console.error);
  }, []);

  if (!s) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">My annotation stats</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Annotations drawn', value: s.total_annotated },
          { label: 'Accepted', value: s.total_accepted },
          { label: 'Rejected', value: s.total_rejected },
          {
            label: 'Acceptance rate',
            value: `${(s.acceptance_rate * 100).toFixed(1)}%`,
            accent: s.acceptance_rate >= 0.9 ? 'text-emerald-700' : 'text-amber-700',
          },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className={`text-2xl font-semibold tabular-nums mt-1 ${c.accent ?? 'text-slate-900'}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="font-medium text-slate-900 mb-2">Recent throughput</h2>
        <p className="text-sm text-slate-600">
          {s.avg_per_day_7d} annotations per day over the last week.
        </p>
      </div>
    </div>
  );
};
