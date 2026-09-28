import React, { useEffect, useState } from 'react';
import { exportsApi } from '../../api/exports';
import type { ExportJob, ExportFormat } from '../../api/exports';
import { useAuthStore } from '../../store/authStore';

const FORMATS: { key: ExportFormat; label: string; hint: string }[] = [
  { key: 'coco', label: 'COCO JSON', hint: 'Standard for detection & segmentation' },
  { key: 'yolo', label: 'YOLO txt', hint: 'Darknet format — one txt per image' },
  { key: 'voc', label: 'Pascal VOC', hint: 'XML per image (2007 layout)' },
  { key: 'cvat', label: 'CVAT XML 1.1', hint: 'Round-trips with CVAT' },
];

const fmtBytes = (b: number | null) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};

export const ExportDrawer: React.FC<{ taskId: number; onClose: () => void }> = ({
  taskId, onClose,
}) => {
  const token = useAuthStore((s) => s.accessToken);
  const [format, setFormat] = useState<ExportFormat>('coco');
  const [includeImages, setIncludeImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<ExportJob[]>([]);

  const refresh = () => exportsApi.listExports(taskId).then(setJobs);
  useEffect(() => { refresh(); }, [taskId]);

  // Poll any in-progress jobs
  useEffect(() => {
    const pending = jobs.filter((j) => j.status === 'pending' || j.status === 'running');
    if (pending.length === 0) return;
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [jobs]);

  const start = async () => {
    setBusy(true);
    try {
      await exportsApi.startExport(taskId, format, includeImages);
      refresh();
    } finally { setBusy(false); }
  };

  const download = async (jobId: number, jobFormat: string) => {
    const res = await fetch(exportsApi.downloadUrl(jobId), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { alert('Download failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-${taskId}-${jobFormat}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="bg-white w-[480px] h-full shadow-xl flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Export task</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">✕</button>
        </div>

        <div className="p-4 space-y-3 border-b">
          <div className="text-xs font-medium text-slate-500">Format</div>
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map((f) => (
              <button key={f.key} onClick={() => setFormat(f.key)}
                      className={`text-left p-3 rounded-lg border ${
                        format === f.key
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}>
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{f.hint}</div>
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm pt-2">
            <input type="checkbox" checked={includeImages}
                   onChange={(e) => setIncludeImages(e.target.checked)} />
            Include images in the zip
          </label>

          <button onClick={start} disabled={busy}
                  className="w-full bg-indigo-600 text-white rounded py-2 text-sm hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Starting…' : 'Start export'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-xs font-medium text-slate-500 mb-2">Recent exports</div>
          {jobs.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No exports yet.</p>
          )}
          <ul className="space-y-2">
            {jobs.map((j) => (
              <li key={j.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium capitalize">{j.format}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(j.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    {j.status === 'done' && (
                      <>
                        <div className="text-xs text-slate-500 mb-1">{fmtBytes(j.file_size)}</div>
                        <button onClick={() => download(j.id, j.format)}
                                className="text-xs text-indigo-600 hover:underline">
                          Download
                        </button>
                      </>
                    )}
                    {j.status === 'failed' && (
                      <div className="text-xs text-red-600" title={j.error ?? ''}>Failed</div>
                    )}
                    {(j.status === 'pending' || j.status === 'running') && (
                      <div className="text-xs text-slate-500">
                        {j.progress ?? j.status}…
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
