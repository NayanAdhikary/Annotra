import React, { useEffect, useState } from 'react';
import { mlApi } from '../../api/ml';
import type { MLModel, InferenceJob, MappingSuggestion } from '../../api/ml';
import { labelsApi } from '../../api/labels';
import type { Label } from '../../types/annotation';

interface Props {
  taskId: number;
  onClose: () => void;
  onDone: () => void;
}

export const PredictDialog: React.FC<Props> = ({ taskId, onClose, onDone }) => {
  const [step, setStep] = useState<'setup' | 'running' | 'done'>('setup');
  const [models, setModels] = useState<MLModel[]>([]);
  const [taskLabels, setTaskLabels] = useState<Label[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(0.25);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [suggestion, setSuggestion] = useState<MappingSuggestion | null>(null);
  const [job, setJob] = useState<InferenceJob | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([mlApi.listModels(), labelsApi.list(taskId)])
      .then(([ms, ls]) => {
        setModels(ms);
        setTaskLabels(ls);
        if (ms.length) setSelectedModelId(ms[0].id);
      });
  }, [taskId]);

  useEffect(() => {
    if (!selectedModelId) return;
    mlApi.suggestMapping(taskId, selectedModelId).then((s) => {
      setSuggestion(s);
      setMapping(s.suggested_mapping);
    });
  }, [selectedModelId, taskId]);

  const start = async () => {
    if (!selectedModelId || !suggestion) return;
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(mapping)) {
      if (v !== null) clean[k] = v;
    }
    if (Object.keys(clean).length === 0) {
      setErr('Map at least one class before running.');
      return;
    }
    setBusy(true); setErr(null);
    try {
      const j = await mlApi.startInference(taskId, selectedModelId, confidence, clean);
      setJob(j);
      setStep('running');
      const timer = setInterval(async () => {
        const fresh = await mlApi.getJob(j.id);
        setJob(fresh);
        if (fresh.status === 'done' || fresh.status === 'failed') {
          clearInterval(timer);
          setStep('done');
          if (fresh.status === 'done') onDone();
        }
      }, 1500);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? 'Failed to start');
      setBusy(false);
    }
  };

  const unmatched = Object.entries(mapping).filter(([, v]) => v === null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="bg-white rounded-lg w-full max-w-2xl p-6 shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {step === 'setup' && 'Auto-annotate task'}
            {step === 'running' && 'Running inference'}
            {step === 'done' && 'Inference complete'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">✕</button>
        </div>

        {err && (
          <div className="mb-3 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">{err}</div>
        )}

        {step === 'setup' && (
          <div className="overflow-y-auto flex-1 space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Model</label>
              <select value={selectedModelId ?? ''}
                      onChange={(e) => setSelectedModelId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm">
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} v{m.version} · {m.class_names.length} classes
                  </option>
                ))}
              </select>
              {models.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  No models registered. Upload one in /admin/models first.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Confidence threshold: {confidence.toFixed(2)}
              </label>
              <input type="range" min={0.05} max={0.95} step={0.05}
                     value={confidence}
                     onChange={(e) => setConfidence(Number(e.target.value))}
                     className="w-full" />
              <p className="text-xs text-slate-500 mt-1">
                Lower = more detections, more noise. Start at 0.25.
              </p>
            </div>

            {suggestion && (
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-2">
                  Label mapping ({Object.keys(suggestion.suggested_mapping).length}/
                  {suggestion.model_classes.length} auto-matched)
                </label>
                <div className="border border-slate-200 rounded-md max-h-72 overflow-y-auto">
                  {suggestion.model_classes.map((cls) => {
                    const value = mapping[cls] ?? null;
                    const matched = value !== null;
                    return (
                      <div key={cls}
                           className={`flex items-center gap-2 px-3 py-2 border-b border-slate-100 last:border-0 ${
                             matched ? '' : 'bg-amber-50'
                           }`}>
                        <span className="flex-1 font-mono text-xs truncate">{cls}</span>
                        <span className="text-slate-400 text-xs">→</span>
                        <select value={value ?? ''}
                                onChange={(e) => setMapping((m) => ({
                                  ...m,
                                  [cls]: e.target.value ? Number(e.target.value) : null,
                                }))}
                                className="border border-slate-300 rounded px-2 py-1 text-xs w-48">
                          <option value="">(skip)</option>
                          {taskLabels.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
                {unmatched.length > 0 && (
                  <p className="text-xs text-amber-700 mt-2">
                    {unmatched.length} class{unmatched.length === 1 ? '' : 'es'} will be
                    skipped unless mapped above.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t">
              <button onClick={start} disabled={busy || !selectedModelId}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
                {busy ? 'Starting…' : 'Run inference'}
              </button>
            </div>
          </div>
        )}

        {step === 'running' && job && (
          <div className="py-12 text-center">
            <div className="text-3xl mb-3">🧠</div>
            <p className="text-sm text-slate-700 font-medium">{job.progress ?? 'Starting…'}</p>
            <p className="text-xs text-slate-500 mt-1">
              This can take a few minutes on large tasks.
            </p>
          </div>
        )}

        {step === 'done' && job && (
          <div className="py-6 text-center">
            {job.status === 'done' ? (
              <>
                <div className="text-4xl mb-3">✓</div>
                <h3 className="font-medium text-slate-900">Inference complete</h3>
                <div className="mt-4 grid grid-cols-3 gap-3 max-w-sm mx-auto text-sm">
                  <div>
                    <div className="text-xs text-slate-500">Processed</div>
                    <div className="font-semibold">{job.stats.images_processed ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Detections</div>
                    <div className="font-semibold">{job.stats.detections ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Created</div>
                    <div className="font-semibold text-emerald-700">
                      {job.stats.annotations_created ?? 0}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-4">
                  Predictions carry <code>source=auto</code> and land in the review queue.
                </p>
                <button onClick={onClose}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded">
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">⚠</div>
                <h3 className="font-medium text-red-600">Inference failed</h3>
                <p className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">{job.error}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
