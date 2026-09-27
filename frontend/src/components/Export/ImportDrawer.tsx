import React, { useState } from 'react';
import { exportsApi, DetectResult, ImportJob } from '../../api/exports';
import { labelsApi } from '../../api/labels';
import type { Label } from '../../types/annotation';

interface Props {
  taskId: number;
  onClose: () => void;
  onDone: () => void;
}

export const ImportDrawer: React.FC<Props> = ({ taskId, onClose, onDone }) => {
  const [step, setStep] = useState<'upload' | 'map' | 'running' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [detected, setDetected] = useState<DetectResult | null>(null);
  const [taskLabels, setTaskLabels] = useState<Label[]>([]);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [asPre, setAsPre] = useState(false);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Load task labels once
  React.useEffect(() => {
    labelsApi.list(taskId).then(setTaskLabels);
  }, [taskId]);

  const uploadAndDetect = async () => {
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const d = await exportsApi.detectImport(taskId, file);
      setDetected(d);
      // Auto-map by case-insensitive name match
      const auto: Record<string, number | null> = {};
      for (const ext of d.external_labels) {
        const match = taskLabels.find(
          (l) => l.name.toLowerCase() === ext.toLowerCase(),
        );
        auto[ext] = match?.id ?? null;
      }
      setMapping(auto);
      setStep('map');
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? 'Upload failed');
    } finally { setBusy(false); }
  };

  const runImport = async () => {
    if (!file || !detected) return;
    setBusy(true);
    try {
      const finalMap: Record<string, number> = {};
      for (const [k, v] of Object.entries(mapping)) {
        if (v !== null) finalMap[k] = v;
      }
      const j = await exportsApi.startImport(
        taskId, detected.detected_format, finalMap, asPre, file,
      );
      setJob(j);
      setStep('running');
      // Poll until done
      const timer = setInterval(async () => {
        const updated = await exportsApi.getImport(j.id);
        setJob(updated);
        if (updated.status === 'done' || updated.status === 'failed') {
          clearInterval(timer);
          setStep('done');
          if (updated.status === 'done') onDone();
        }
      }, 1500);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? 'Import failed');
      setStep('map');
    } finally { setBusy(false); }
  };

  const unknownCount = Object.values(mapping).filter((v) => v === null).length;

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="bg-white w-[520px] h-full shadow-xl flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">
            {step === 'upload' && 'Import dataset'}
            {step === 'map' && 'Map labels'}
            {step === 'running' && 'Importing'}
            {step === 'done' && 'Import complete'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {err && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{err}</div>
          )}

          {step === 'upload' && (
            <>
              <p className="text-sm text-slate-600 mb-3">
                Upload a zip containing annotation files in COCO, YOLO, Pascal VOC, or CVAT XML format.
                We'll auto-detect the format.
              </p>
              <input
                type="file"
                accept=".zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm border border-slate-300 rounded px-3 py-2"
              />
              <button onClick={uploadAndDetect} disabled={!file || busy}
                      className="w-full mt-4 bg-indigo-600 text-white rounded py-2 text-sm disabled:opacity-50">
                {busy ? 'Detecting…' : 'Detect format'}
              </button>
            </>
          )}

          {step === 'map' && detected && (
            <>
              <div className="text-xs text-slate-500 mb-3">
                Detected <span className="font-mono uppercase">{detected.detected_format}</span> ·
                {' '}{detected.annotation_count} annotations ·
                {' '}{detected.image_count} images referenced ·
                {' '}{detected.external_labels.length} external labels
              </div>

              <div className="space-y-2">
                {detected.external_labels.map((ext) => (
                  <div key={ext} className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-medium truncate">{ext}</span>
                    <span className="text-slate-400">→</span>
                    <select
                      value={mapping[ext] ?? ''}
                      onChange={(e) => setMapping((m) => ({
                        ...m,
                        [ext]: e.target.value ? Number(e.target.value) : null,
                      }))}
                      className="border border-slate-300 rounded px-2 py-1 text-sm w-48"
                    >
                      <option value="">(skip — don't import)</option>
                      {taskLabels.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {unknownCount > 0 && (
                <div className="mt-3 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded">
                  {unknownCount} label{unknownCount === 1 ? '' : 's'} will be skipped.
                  Annotations using them will not be imported.
                </div>
              )}

              <label className="flex items-center gap-2 text-sm mt-4 pt-4 border-t">
                <input type="checkbox" checked={asPre}
                       onChange={(e) => setAsPre(e.target.checked)} />
                <span>
                  Import as <b>pre-annotations</b>
                  <span className="block text-xs text-slate-500">
                    Land in the review queue as model predictions (source=auto).
                  </span>
                </span>
              </label>

              <button onClick={runImport} disabled={busy}
                      className="w-full mt-4 bg-indigo-600 text-white rounded py-2 text-sm disabled:opacity-50">
                {busy ? 'Starting…' : 'Start import'}
              </button>
            </>
          )}

          {step === 'running' && job && (
            <div className="text-center py-12">
              <div className="text-3xl mb-3">⏳</div>
              <p className="text-sm text-slate-700">{job.progress ?? 'Importing…'}</p>
            </div>
          )}

          {step === 'done' && job && (
            <div className="text-center py-8">
              {job.status === 'done' ? (
                <>
                  <div className="text-4xl mb-3">✓</div>
                  <h3 className="font-medium text-slate-900">Import complete</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {job.stats?.imported} annotations imported ·
                    {' '}{job.stats?.skipped} skipped
                  </p>
                  {job.stats?.unknown_labels?.length ? (
                    <p className="text-xs text-amber-700 mt-2">
                      Unknown labels: {job.stats.unknown_labels.join(', ')}
                    </p>
                  ) : null}
                  <button onClick={onClose}
                          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded text-sm">
                    Close
                  </button>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-3">⚠</div>
                  <h3 className="font-medium text-red-600">Import failed</h3>
                  <p className="text-sm text-slate-500 mt-1">{job.error}</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
