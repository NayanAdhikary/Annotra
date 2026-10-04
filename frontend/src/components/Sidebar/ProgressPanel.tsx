import React, { useEffect, useState } from 'react';
import { annotatorApi, type TaskProgress } from '../../api/annotator';

interface Props {
  taskId: number;
  refreshKey: number;
}

export const ProgressPanel: React.FC<Props> = ({ taskId, refreshKey }) => {
  const [p, setP] = useState<TaskProgress | null>(null);

  useEffect(() => {
    annotatorApi.progress(taskId).then(setP);
  }, [taskId, refreshKey]);

  if (!p) return null;

  const pct = Math.round(p.percent_complete * 100);

  return (
    <div className="border-b bg-white p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Progress
        </span>
        <span className="text-sm font-semibold text-slate-900 tabular-nums">{pct}%</span>
      </div>

      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-slate-500">Done</div>
          <div className="text-sm font-semibold text-emerald-700 tabular-nums">
            {p.completed}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Skipped</div>
          <div className="text-sm font-semibold text-amber-700 tabular-nums">
            {p.skipped}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Left</div>
          <div className="text-sm font-semibold text-slate-700 tabular-nums">
            {p.pending + p.in_progress}
          </div>
        </div>
      </div>
    </div>
  );
};