import React, { useEffect, useState } from 'react';
import { adminApi, type HealthReport } from '../../api/admin';

const Dot: React.FC<{ ok: boolean; label: string; sub?: string }> = ({ ok, label, sub }) => (
  <div className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-lg">
    <div className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
    <div className="flex-1">
      <div className="text-sm font-medium text-slate-900">{label}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
    <div className={`text-xs font-medium ${ok ? 'text-emerald-600' : 'text-red-600'}`}>
      {ok ? 'Healthy' : 'Down'}
    </div>
  </div>
);

export const AdminHealthPage: React.FC = () => {
  const [h, setH] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    adminApi.health().then(setH).finally(() => setLoading(false));
  }, [tick]);

  // Auto-refresh every 15s
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  if (loading && !h) return <div className="p-8 text-slate-500">Loading…</div>;
  if (!h) return null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">System health</h2>
          <p className="text-sm text-slate-500 mt-1">Refreshes every 15 seconds.</p>
        </div>
        <button onClick={() => setTick((x) => x + 1)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
          Refresh now
        </button>
      </div>

      <div className="grid gap-3">
        <Dot ok={h.database.ok} label="PostgreSQL" sub={`Ping: ${h.database.ping_ms}ms | Pool: ${h.database.pool.checked_out}/${h.database.pool.size} (overflow: ${h.database.pool.overflow})`} />
        <Dot ok={h.redis.ok} label="Redis" sub={`Ping: ${h.redis.ping_ms}ms`} />
        <Dot ok={h.storage.free_gb > 0} label="Object storage" sub={`Used: ${h.storage.used_gb}GB / ${h.storage.total_gb}GB (${h.storage.percent}%)`} />
        <Dot ok={h.celery.workers > 0} label="Celery workers" sub={`${h.celery.workers} workers online`} />
      </div>

      <section className="mt-6 bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-900 mb-2">Uptime</h3>
        <p className="text-sm text-slate-500">{h.uptime_sec} seconds</p>
      </section>
    </div>
  );
};
