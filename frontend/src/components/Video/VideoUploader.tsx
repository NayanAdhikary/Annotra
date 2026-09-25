import React, { useState } from 'react';
import { api } from '../../api/client';

interface Props {
  taskId: number;
  onUploadComplete: () => void;
}

export const VideoUploader: React.FC<Props> = ({ taskId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/api/tasks/${taskId}/videos/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploadComplete();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setUploading(false);
      // clear the input
      e.target.value = '';
    }
  };

  return (
    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
      {uploading ? (
        <div className="text-sm text-slate-500">Uploading video... Please wait.</div>
      ) : (
        <>
          <p className="text-sm text-slate-600 mb-2">Upload a video (MP4, MOV, AVI)</p>
          <input
            type="file"
            accept=".mp4,.mov,.avi,.mkv,.webm"
            onChange={handleFileChange}
            className="text-sm"
          />
          {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
        </>
      )}
    </div>
  );
};
