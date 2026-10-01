import React, { useEffect, useRef, useState } from 'react';
import { mlApi } from '../../api/ml';
import type { MLModel } from '../../api/ml';

const fmtBytes = (b: number | null) => {
  if (!b) return '';
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
};

export const AdminModelsPage: React.FC = () => {
  const [models, setModels] = useState<MLModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0');
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = () => mlApi.listModels().then(setModels).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, []);

  const upload = async () => {
    if (!file || !name.trim()) {
      setErr('Name and file are required');
      return;
    }
    setUploading(true); setErr(null);
    try {
      await mlApi.uploadModel(name.trim(), description.trim(), version, file);
      setName(''); setDescription(''); setVersion('1.0'); setFile(null);
      await refresh();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? 'Upload failed');
    } finally { setUploading(false); }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      if (!name) setName(f.name.replace(/\.pt$/i, ''));
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!name) setName(f.name.replace(/\.pt$/i, ''));
    }
  };

  const deactivate = async (id: number) => {
    if (!window.confirm('Deactivate this model? Existing jobs keep working.')) return;
    await mlApi.deactivateModel(id);
    refresh();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">ML Models</h2>
        <p className="text-sm text-slate-500 mt-1">
          Upload YOLOv8 models to auto-annotate tasks. Only .pt files are supported today.
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <h3 className="font-medium text-slate-900 mb-3">Upload a model</h3>

        {err && (
          <div className="mb-3 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">{err}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)}
                 placeholder="Model name (e.g. Traffic Signs Detector)"
                 className="border border-slate-300 rounded px-3 py-2 text-sm md:col-span-2" />
          <input value={version} onChange={(e) => setVersion(e.target.value)}
                 placeholder="Version"
                 className="border border-slate-300 rounded px-3 py-2 text-sm" />
        </div>

        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)" rows={2}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm mb-3" />

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
            dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          {file ? (
            <>
              <div className="text-2xl mb-1">📦</div>
              <p className="text-sm font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">{fmtBytes(file.size)}</p>
            </>
          ) : (
            <>
              <div className="text-2xl mb-1">📤</div>
              <p className="text-sm font-medium text-slate-900">Drop a .pt file here, or click</p>
              <p className="text-xs text-slate-500 mt-1">YOLOv8 detection or segmentation</p>
            </>
          )}
          <input ref={inputRef} type="file" accept=".pt"
                 onChange={onPick} className="hidden" />
        </div>

        <div className="flex justify-end mt-3">
          <button onClick={upload} disabled={uploading || !file || !name.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
            {uploading ? 'Uploading & introspecting…' : 'Upload model'}
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-medium text-slate-900">Registered models ({models.length})</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : models.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No models uploaded yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Kind</th>
                <th className="px-4 py-2 font-medium">Classes</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium">Uploaded</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{m.name}</div>
                    <div className="text-xs text-slate-500">v{m.version}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {m.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {m.class_names.length} · {m.class_names.slice(0, 3).join(', ')}
                    {m.class_names.length > 3 && '…'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{fmtBytes(m.file_size)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deactivate(m.id)}
                            className="text-xs text-red-600 hover:underline">
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
