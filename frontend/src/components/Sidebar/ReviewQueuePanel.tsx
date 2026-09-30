import React, { useEffect } from 'react';
import { reviewApi } from '../../api/review';
import { useReviewStore } from '../../store/reviewStore';
import { useAnnotationStore } from '../../store/annotationStore';

export const ReviewQueuePanel: React.FC<{ taskId: number }> = ({ taskId }) => {
  const { stats, pendingIds, rejectedIds, setStats } = useReviewStore();
  const selectOne = useAnnotationStore((s) => s.selectOne);
  const annotations = useAnnotationStore((s) => s.annotations);

  const refresh = async () => {
    const q = await reviewApi.queue(taskId);
    setStats(q.stats, q.pending_ids, q.rejected_ids);
  };
  useEffect(() => { refresh(); }, [taskId]);

  const jumpTo = (serverId: number) => {
    const a = annotations.find((x) => x.serverId === serverId);
    if (a) selectOne(a.id);
  };

  if (!stats) return <div className="p-4 text-xs text-slate-500">Loading…</div>;

  const pct = Math.round(stats.percent_reviewed * 100);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="text-xs text-slate-500 mb-1">Review progress</div>
        <div className="text-2xl font-semibold text-slate-900 tabular-nums">{pct}%</div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-slate-200">
        {[
          { label: 'Pending',  value: stats.pending,  cls: 'text-slate-700' },
          { label: 'Accepted', value: stats.accepted, cls: 'text-emerald-700' },
          { label: 'Rejected', value: stats.rejected, cls: 'text-red-700' },
          { label: 'Fixed',    value: stats.fixed,    cls: 'text-amber-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{s.label}</div>
            <div className={`text-lg font-semibold tabular-nums ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {rejectedIds.length > 0 && (
        <div className="p-3 border-t">
          <div className="text-xs font-medium text-red-700 mb-2">
            Rejected ({rejectedIds.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {rejectedIds.slice(0, 20).map((id) => (
              <button
                key={id}
                onClick={() => jumpTo(id)}
                className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 hover:bg-red-100"
              >
                #{id}
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingIds.length > 0 && (
        <div className="p-3 border-t">
          <div className="text-xs font-medium text-slate-700 mb-2">
            Pending ({pendingIds.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {pendingIds.slice(0, 30).map((id) => (
              <button
                key={id}
                onClick={() => jumpTo(id)}
                className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                #{id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};