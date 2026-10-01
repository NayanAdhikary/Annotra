import React, { useState } from 'react';
import { annotatorApi } from '../../api/annotator';

interface Props {
  taskId: number;
  imageId: number;
  currentStatus: string;
  onChanged: () => void;
  onNext: () => void;
}

const SKIP_PRESETS = [
  { key: 'blurry',              label: 'Blurry / unusable' },
  { key: 'no_objects',          label: 'No objects to label' },
  { key: 'wrong_category',      label: 'Out of task scope' },
  { key: 'duplicate_of_previous', label: 'Duplicate' },
  { key: 'cropped_too_tight',   label: 'Cropped too tight' },
  { key: 'needs_supervisor',    label: 'Needs supervisor' },
  { key: 'other',               label: 'Other…' },
];

export const AnnotatorActions: React.FC<Props> = ({
  taskId, imageId, currentStatus, onChanged, onNext,
}) => {
  const [showSkip, setShowSkip] = useState(false);
  const [customReason, setCustomReason] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    const handleOpen = () => setShowSkip(s => !s);
    window.addEventListener('openSkipMenu', handleOpen);
    return () => window.removeEventListener('openSkipMenu', handleOpen);
  }, []);

  const markDone = async () => {
    setBusy(true);
    try {
      await annotatorApi.setImageStatus(taskId, imageId, 'completed');
      onChanged();
      onNext();
    } finally { setBusy(false); }
  };

  const skip = async (reason: string) => {
    setBusy(true);
    try {
      const r = reason === 'other' && customReason.trim()
        ? customReason.trim()
        : reason;
      await annotatorApi.setImageStatus(taskId, imageId, 'skipped', r);
      setShowSkip(false);
      setCustomReason('');
      onChanged();
      onNext();
    } finally { setBusy(false); }
  };

  const reopen = async () => {
    setBusy(true);
    try {
      await annotatorApi.setImageStatus(taskId, imageId, 'pending');
      onChanged();
    } finally { setBusy(false); }
  };

  const isDone = currentStatus === 'completed';
  const isSkipped = currentStatus === 'skipped';

  return (
    <div className="border-t bg-white px-4 py-3 flex items-center gap-3 flex-wrap">
      {isDone ? (
        <>
          <span className="text-sm text-emerald-700 font-medium">
            ✓ Marked complete
          </span>
          <button
            onClick={reopen}
            disabled={busy}
            className="text-xs text-slate-500 hover:text-slate-900 underline"
          >
            Reopen
          </button>
        </>
      ) : isSkipped ? (
        <>
          <span className="text-sm text-slate-600">⏭ Skipped</span>
          <button
            onClick={reopen}
            disabled={busy}
            className="text-xs text-slate-500 hover:text-slate-900 underline"
          >
            Reopen
          </button>
        </>
      ) : (
        <>
          <button
            data-tour="mark-done"
            onClick={markDone}
            disabled={busy}
            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            ✓ Done, next →
          </button>
          <button
            onClick={() => setShowSkip((s) => !s)}
            disabled={busy}
            className="px-3 py-2 border border-slate-300 text-sm rounded-md text-slate-700 hover:bg-slate-50"
          >
            ⏭ Skip
          </button>
        </>
      )}

      <div className="ml-auto flex gap-2 text-xs text-slate-500">
        <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded">Space</kbd>
        <span>mark done</span>
        <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded ml-2">S</kbd>
        <span>skip</span>
      </div>

      {showSkip && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-lg shadow-xl p-3 z-20 w-80">
          <div className="text-xs font-medium text-slate-700 mb-2">
            Why are you skipping this image?
          </div>
          <div className="space-y-1">
            {SKIP_PRESETS.map((r) => (
              <button
                key={r.key}
                onClick={() => r.key === 'other' ? null : skip(r.key)}
                onMouseEnter={() => r.key === 'other' && setShowSkip(true)}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-50"
              >
                {r.label}
              </button>
            ))}
          </div>
          {customReason !== null && (
            <div className="mt-2 pt-2 border-t">
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Custom reason…"
                rows={2}
                className="w-full border rounded px-2 py-1 text-xs"
              />
              <button
                onClick={() => skip('other')}
                disabled={!customReason.trim()}
                className="mt-1 w-full bg-slate-900 text-white text-xs py-1.5 rounded disabled:opacity-50"
              >
                Skip with this reason
              </button>
            </div>
          )}
          <button
            onClick={() => setShowSkip(false)}
            className="mt-2 w-full text-xs text-slate-500"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};