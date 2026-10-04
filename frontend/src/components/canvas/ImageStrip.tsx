import React, { useEffect, useState } from 'react';
import { annotatorApi, type ImageStatus } from '../../api/annotator';

interface Props {
  taskId: number;
  currentIndex: number;
  onJump: (index: number) => void;
  refreshKey: number;
}

const STATUS_COLOR: Record<string, string> = {
  pending:     'bg-slate-300',
  in_progress: 'bg-amber-400',
  completed:   'bg-emerald-500',
  skipped:     'bg-slate-500',
};

export const ImageStrip: React.FC<Props> = ({ taskId, currentIndex, onJump, refreshKey }) => {
  const [statuses, setStatuses] = useState<ImageStatus[]>([]);

  useEffect(() => {
    annotatorApi.imageStatuses(taskId).then(setStatuses);
  }, [taskId, refreshKey]);

  if (!statuses.length) return null;

  return (
    <div data-tour="image-strip" className="bg-white border-b px-4 py-2 overflow-x-auto">
      <div className="flex gap-1 items-center">
        {statuses.map((s, i) => (
          <button
            key={s.image_id}
            onClick={() => onJump(i)}
            title={`Image ${i + 1} · ${s.status}${s.skip_reason ? ` (${s.skip_reason})` : ''}`}
            className={`flex-shrink-0 w-3 h-6 rounded-sm transition-all hover:scale-y-125 ${
              STATUS_COLOR[s.status]
            } ${i === currentIndex ? 'ring-2 ring-indigo-600 ring-offset-1' : ''}`}
          />
        ))}
      </div>

      <div className="flex gap-4 text-[10px] text-slate-500 mt-1.5">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-emerald-500" /> done
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-amber-400" /> in progress
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-slate-500" /> skipped
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-slate-300" /> untouched
        </span>
      </div>
    </div>
  );
};