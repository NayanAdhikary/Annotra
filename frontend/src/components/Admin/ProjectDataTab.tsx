import React, { useState, useRef } from 'react';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { AdminTask } from '../../pages/admin/AdminProjectDetailPage';
import { useToast } from "../Toast/ToastProvider";

interface Props {
  projectId: number;
  tasks: AdminTask[];
  onChanged: () => void;
}

export const ProjectDataTab: React.FC<Props> = ({ projectId, tasks, onChanged }) => {
    const toast = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<number | ''>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [skipped, setSkipped] = useState<{ filename: string; reason: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTask = tasks.find((t) => t.id === Number(selectedTaskId));
  const isVideo = selectedTask?.task_type === 'video';

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedTask) return;

    setUploading(true);
    setProgress({ done: 0, total: files.length });
    setSkipped([]);

    const fileArray = Array.from(files);
    const BATCH_SIZE = 20;
    const endpoint = isVideo 
      ? `/api/admin/tasks/${selectedTask.id}/videos/bulk`
      : `/api/admin/tasks/${selectedTask.id}/images/bulk`;

    let doneCount = 0;
    const newSkipped: { filename: string; reason: string }[] = [];

    try {
      for (let i = 0; i < fileArray.length; i += BATCH_SIZE) {
        const batch = fileArray.slice(i, i + BATCH_SIZE);
        const formData = new FormData();
        batch.forEach((f) => formData.append('files', f));

        const token = useAuthStore.getState().accessToken;
        const url = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + endpoint;
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();

        if (data.skipped) {
          newSkipped.push(...data.skipped);
        }

        doneCount += batch.length;
        setProgress({ done: doneCount, total: fileArray.length });
      }
    } catch (e) {
      toast.push('error', e.userMessage ?? 'Something went wrong');
      toast.push('error', e.userMessage ?? 'Something went wrong');
    } finally {
      setUploading(false);
      setSkipped(newSkipped);
      onChanged();
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploading || !selectedTask) return;
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="font-medium text-slate-900 mb-4">Upload Data</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Select a task to receive data
          </label>
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value ? Number(e.target.value) : '')}
            className="w-full md:w-1/2 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
            disabled={uploading}
          >
            <option value="">-- Choose a task --</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.task_type}) - {t.image_count} items
              </option>
            ))}
          </select>
        </div>

        {selectedTask && (
          <div
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={`mt-2 flex justify-center rounded-lg border border-dashed border-slate-900/25 px-6 py-10 ${
              uploading ? 'opacity-50 pointer-events-none' : 'hover:border-indigo-500'
            }`}
          >
            <div className="text-center">
              <div className="text-4xl mb-4">{isVideo ? '🎬' : '🖼️'}</div>
              <div className="mt-4 flex text-sm leading-6 text-slate-600 justify-center">
                <label className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
                  <span>Upload files</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="sr-only"
                    accept={isVideo ? "video/mp4,video/webm" : "image/*"}
                    onChange={(e) => handleUpload(e.target.files)}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs leading-5 text-slate-600">
                {isVideo ? 'MP4 or WebM' : 'PNG, JPG, BMP up to 10MB'}
              </p>
            </div>
          </div>
        )}

        {uploading && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-slate-600 mb-1">
              <span>Uploading...</span>
              <span>{progress.done} / {progress.total}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.max(5, (progress.done / progress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {!uploading && progress.total > 0 && (
          <div className="mt-4 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-md border border-emerald-200">
            ✓ Uploaded {progress.total} files
          </div>
        )}

        {skipped.length > 0 && (
          <div className="mt-4 border border-rose-200 rounded-md overflow-hidden">
            <div className="bg-rose-50 px-4 py-2 text-sm font-medium text-rose-800">
              Skipped files ({skipped.length})
            </div>
            <ul className="divide-y divide-rose-100 max-h-48 overflow-y-auto">
              {skipped.map((s, idx) => (
                <li key={idx} className="px-4 py-2 text-sm text-rose-700 flex justify-between">
                  <span className="truncate">{s.filename}</span>
                  <span className="text-rose-500 ml-4 flex-shrink-0">{s.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Data in this project table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-medium text-slate-900">Data in this project</h2>
        </div>
        {tasks.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No tasks exist. Create one first.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Task</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Uploaded Items</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{t.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 capitalize">{t.task_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{t.image_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};