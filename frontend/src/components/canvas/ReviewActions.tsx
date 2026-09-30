import React, { useState } from 'react';
import { useAnnotationStore } from '../../store/annotationStore';
import { useCanReview } from '../../hooks/useRoleAccess';
import { reviewApi } from '../../api/review';

const REASONS = [
  { key: 'wrong_label',      label: 'Wrong label' },
  { key: 'bad_geometry',     label: 'Bad geometry' },
  { key: 'outside_object',   label: 'Outside object' },
  { key: 'missing_occlusion',label: 'Missing occlusion' },
  { key: 'duplicate',        label: 'Duplicate' },
  { key: 'other',            label: 'Other' },
];

interface Props {
  taskId: number;
  onReviewed: () => void;
}

export const ReviewActions: React.FC<Props> = ({ onReviewed }) => {
  const canReview = useCanReview();
  const ann = useAnnotationStore((s) =>
    s.annotations.find((a) => a.id === s.primaryId)
  );
  const replaceAnnotation = useAnnotationStore((s) => s.replaceAnnotation);

  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!canReview || !ann || !ann.serverId) return null;

  const call = async (
    status: 'accepted' | 'rejected' | 'fixed',
    reason?: string,
    comment?: string,
  ) => {
    setBusy(true);
    try {
      await reviewApi.reviewOne(ann.serverId!, status, reason, comment);
      replaceAnnotation(ann.id, { reviewStatus: status });
      onReviewed();
      setShowReject(false);
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Review failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-slate-200 p-3 bg-white">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
        Review action
      </div>
      <div className="grid grid-cols-3 gap-1">
        <button
          onClick={() => call('accepted')}
          disabled={busy}
          title="Accept (A)"
          className="px-2 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          ✓ Accept
        </button>
        <button
          onClick={() => setShowReject((s) => !s)}
          disabled={busy}
          title="Reject (R)"
          className="px-2 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          ✗ Reject
        </button>
        <button
          onClick={() => call('fixed')}
          disabled={busy}
          title="Mark as fixed (F)"
          className="px-2 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
        >
          ✎ Fix
        </button>
      </div>

      {showReject && (
        <div className="mt-2 border border-slate-200 rounded p-2">
          <div className="text-xs text-slate-500 mb-1">Reason</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {REASONS.map((r) => (
              <button
                key={r.key}
                onClick={() => call('rejected', r.key)}
                disabled={busy}
                className="text-[11px] px-2 py-0.5 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
              >
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Optional comment… (Ctrl+Enter to reject)"
            rows={2}
            className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                call('rejected', 'other', (e.target as HTMLTextAreaElement).value);
              }
            }}
          />
        </div>
      )}
    </div>
  );
};