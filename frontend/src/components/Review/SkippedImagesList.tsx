import React, { useEffect, useState } from 'react';
import { annotatorApi, type ImageStatus } from '../../api/annotator';

interface Props {
  taskId: number;
  onJump: (imageId: number) => void;
}

export const SkippedImagesList: React.FC<Props> = ({ taskId, onJump }) => {
  const [statuses, setStatuses] = useState<ImageStatus[]>([]);
  const [images, setImages] = useState<{ id: number; filename: string }[]>([]);

  useEffect(() => {
    Promise.all([
      annotatorApi.imageStatuses(taskId),
      // Use the images API to get filenames
      import('../../api/images').then((m) => m.imagesApi.list(taskId)),
    ]).then(([s, im]) => {
      setStatuses(s);
      setImages(im);
    });
  }, [taskId]);

  const skipped = statuses.filter((s) => s.status === 'skipped');
  if (!skipped.length) return null;

  const byId = Object.fromEntries(images.map((i) => [i.id, i]));

  return (
    <div className="border-t">
      <div className="px-4 py-3 border-b">
        <h3 className="font-medium text-sm text-slate-900">
          Skipped images ({skipped.length})
        </h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {skipped.map((s) => (
          <li
            key={s.image_id}
            className="px-4 py-2 text-xs cursor-pointer hover:bg-slate-50"
            onClick={() => {
              const idx = images.findIndex(i => i.id === s.image_id);
              if (idx !== -1) onJump(idx);
            }}
          >
            <div className="font-medium text-slate-900 truncate">
              {byId[s.image_id]?.filename ?? `Image #${s.image_id}`}
            </div>
            <div className="text-slate-500 mt-0.5">
              Reason: <span className="font-mono">{s.skip_reason}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
