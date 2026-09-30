import React, { useState, useEffect } from 'react';
import { exportsApi, type DetectResult, type ImportJob } from '../../api/exports';
import { useAnnotationStore } from '../../store/annotationStore';

export const ImportDrawer: React.FC<{ taskId: number; onClose: () => void; onDone?: () => void }> = ({
  taskId, onClose, onDone
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [asPreannotations, setAsPreannotations] = useState(false);
  
  const [job, setJob] = useState<ImportJob | null>(null);
  const [busy, setBusy] = useState(false);
  
  const labels = useAnnotationStore(s => s.labels);

  useEffect(() => {
    if (!file) {
      setDetectResult(null);
      setMapping({});
      return;
    }
    setDetecting(true);
    exportsApi.detectImport(taskId, file).then(res => {
      setDetectResult(res);
      const newMap: Record<string, number> = {};
      res.external_labels.forEach(ext => {
        const match = labels.find(l => l.name.toLowerCase() === ext.toLowerCase());
        if (match) newMap[ext] = match.id;
      });
      setMapping(newMap);
    }).catch(err => {
      alert('Failed to detect format: ' + err.message);
      setFile(null);
    }).finally(() => {
      setDetecting(false);
    });
  }, [file, taskId, labels]);

  useEffect(() => {
    if (!job) return;
    if (job.status === 'done' || job.status === 'failed') {
      if (job.status === 'done' && onDone) onDone();
      return;
    }
    const timer = setInterval(() => {
      exportsApi.getImport(job.id).then(setJob);
    }, 2000);
    return () => clearInterval(timer);
  }, [job, onDone]);

  const start = async () => {
    if (!file || !detectResult) return;
    setBusy(true);
    try {
      const j = await exportsApi.startImport(
        taskId, detectResult.detected_format, mapping, asPreannotations, file
      );
      setJob(j);
    } catch (e: any) {
      alert('Import failed to start: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="bg-white w-[540px] h-full shadow-xl flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Import dataset</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {!job ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Upload dataset zip
                </label>
                <input 
                  type="file" 
                  accept=".zip"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-slate-200 rounded p-1"
                />
              </div>

              {detecting && <div className="text-sm text-slate-500">Analyzing archive…</div>}

              {detectResult && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm space-y-1">
                    <div><span className="font-medium text-slate-700">Format detected:</span> <span className="uppercase">{detectResult.detected_format}</span></div>
                    <div><span className="font-medium text-slate-700">Images:</span> {detectResult.image_count}</div>
                    <div><span className="font-medium text-slate-700">Annotations:</span> {detectResult.annotation_count}</div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-slate-700 mb-2">Label Mapping</h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2 font-medium text-slate-700">Dataset label</th>
                            <th className="px-3 py-2 font-medium text-slate-700">Map to task label</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detectResult.external_labels.map(ext => {
                            const isUnmapped = !mapping[ext];
                            return (
                              <tr key={ext} className={isUnmapped ? 'bg-amber-50/50' : ''}>
                                <td className={`px-3 py-2 ${isUnmapped ? 'text-amber-900' : 'text-slate-700'}`}>
                                  {ext}
                                </td>
                                <td className="px-3 py-2">
                                  <select 
                                    value={mapping[ext] || ''} 
                                    onChange={(e) => setMapping({...mapping, [ext]: Number(e.target.value) || 0})}
                                    className={`w-full border rounded px-2 py-1 ${isUnmapped ? 'border-amber-300' : 'border-slate-300'}`}
                                  >
                                    <option value="">-- Ignore --</option>
                                    {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                          {detectResult.external_labels.length === 0 && (
                            <tr><td colSpan={2} className="px-3 py-4 text-center text-slate-500">No labels found in dataset.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm pt-2">
                    <input type="checkbox" checked={asPreannotations}
                           onChange={(e) => setAsPreannotations(e.target.checked)} />
                    Import as pre-annotations (can be reviewed)
                  </label>

                  <button onClick={start} disabled={busy}
                          className="w-full bg-indigo-600 text-white rounded py-2 text-sm hover:bg-indigo-700 disabled:opacity-50 mt-4">
                    {busy ? 'Starting…' : 'Start import'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-slate-900">Import Job #{job.id}</h3>
                  <span className="text-sm px-2 py-1 rounded bg-slate-100 text-slate-700 capitalize">
                    {job.status}
                  </span>
                </div>
                
                {job.status === 'failed' ? (
                  <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                    {job.error || 'Unknown error occurred'}
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">
                    {job.progress || 'Processing...'}
                  </div>
                )}
                
                {job.status === 'done' && job.stats && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Annotations imported:</span>
                      <span className="font-medium text-green-600">{job.stats.imported || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Shapes skipped:</span>
                      <span className="font-medium">{job.stats.skipped || 0}</span>
                    </div>
                    {(job.stats.unknown_labels || []).length > 0 && (
                      <div className="mt-2 text-slate-500">
                        Ignored labels: <span className="text-slate-700">{job.stats.unknown_labels!.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {(job.status === 'done' || job.status === 'failed') && (
                <button onClick={() => { setJob(null); setFile(null); setDetectResult(null); }}
                        className="w-full bg-slate-100 text-slate-700 rounded py-2 text-sm hover:bg-slate-200">
                  Import another
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
