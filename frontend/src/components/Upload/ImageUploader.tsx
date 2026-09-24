import React, { useCallback, useRef, useState } from 'react';
import { imagesApi } from '../../api/images';

interface ImageUploaderProps {
  taskId: number;
  onUploadComplete?: () => void;
}

const VALID_TYPES = ['image/jpeg', 'image/png', 'image/bmp', 'image/webp'];

export const ImageUploader: React.FC<ImageUploaderProps> = ({ taskId, onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: File[]) => {
    const validFiles = files.filter(f => VALID_TYPES.includes(f.type));
    if (validFiles.length === 0) return;

    setIsUploading(true);
    setProgress({ current: 0, total: validFiles.length });

    let completed = 0;
    let active = 0;
    const queue = [...validFiles];
    const maxConcurrent = 4;

    return new Promise<void>((resolve) => {
      const next = async () => {
        if (queue.length === 0 && active === 0) {
          setIsUploading(false);
          onUploadComplete?.();
          resolve();
          return;
        }

        while (active < maxConcurrent && queue.length > 0) {
          const file = queue.shift();
          if (!file) continue;

          active++;
          try {
            await imagesApi.upload(taskId, file);
          } catch (e) {
            console.error('Failed to upload', file.name, e);
          } finally {
            active--;
            completed++;
            setProgress((p) => ({ ...p, current: completed }));
            next();
          }
        }
      };
      
      next();
    });
  }, [taskId, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, [processFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processFiles(Array.from(e.target.files));
    }
    // reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-colors cursor-pointer ${
          isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept=".jpg,.jpeg,.png,.bmp,.webp"
          onChange={handleChange}
          disabled={isUploading}
        />
        
        {isUploading ? (
          <div className="w-full max-w-md flex flex-col items-center">
            <p className="text-sm font-medium text-slate-700 mb-2">
              Uploading {progress.current} of {progress.total} images...
            </p>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, (progress.current / progress.total) * 100)}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <p className="text-lg font-medium text-slate-900 mb-1">Click or drag images to upload</p>
            <p className="text-sm text-slate-500">Supports JPG, PNG, BMP, WEBP</p>
          </>
        )}
      </div>
    </div>
  );
};
