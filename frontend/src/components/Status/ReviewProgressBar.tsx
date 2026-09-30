import React from 'react';
import { useReviewStore } from '../../store/reviewStore';

export const ReviewProgressBar: React.FC = () => {
  const stats = useReviewStore((s) => s.stats);
  if (!stats || stats.total === 0) return null;

  const pct = Math.round(stats.percent_reviewed * 100);
  const reviewed = stats.accepted + stats.rejected + stats.fixed;

  return (
    <div className="flex items-center gap-2 text-xs text-slate-600">
      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums">
        Review {reviewed}/{stats.total}
      </span>
      {stats.pending > 0 && (
        <span className="text-slate-400">· {stats.pending} pending</span>
      )}
    </div>
  );
};