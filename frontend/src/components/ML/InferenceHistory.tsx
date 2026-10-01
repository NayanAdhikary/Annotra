import React, { useEffect, useState } from 'react';
import { mlApi } from '../../api/ml';
import type { InferenceJob } from '../../api/ml';

export const InferenceHistory: React.FC<{ taskId: number }> = ({ taskId }) => {
  const [jobs, setJobs] = useState<InferenceJob[]>([]);
  useEffect(() => { mlApi.listJobs(taskId).then(setJobs); }, [taskId]);

  if (jobs.length === 0) return null;

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 mt-4">
      <h3 className="text-sm font-medium text-slate-900 mb-3">Inference history</h3>
      <ul className="space-y-2 text-sm">
        {jobs.map((j) => (
          <li key={j.id}
              className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
            <div className="min-w-0">
              <div className="text-slate-900">
                Model #{j.model_id} · conf {j.confidence}
              </div>
              <div className="text-xs text-slate-500">
                {new Date(j.created_at).toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              {j.status === 'done' && j.stats.annotations_created != null && (
                <span className="text-xs text-emerald-700">
                  +{j.stats.annotations_created} annotations
                </span>
              )}
              {j.status === 'failed' && (
                <span className="text-xs text-red-600">Failed</span>
              )}
              {(j.status === 'pending' || j.status === 'running') && (
                <span className="text-xs text-slate-500">{j.progress ?? j.status}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
