import React, { useEffect, useState } from 'react';
import { annotatorApi, type SubmissionPreflight } from '../../api/annotator';

interface Props {
  taskId: number;
  onClose: () => void;
  onSubmitted: () => void;
}

export const SubmissionDialog: React.FC<Props> = ({
  taskId, onClose, onSubmitted,
}) => {
  const [preflight, setPreflight] = useState<SubmissionPreflight | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needsForce, setNeedsForce] = useState(false);

  useEffect(() => {
    annotatorApi.preflight(taskId).then(setPreflight).catch(console.error);
  }, [taskId]);

  if (!preflight) return null;

  const submit = async (force: boolean) => {
    setBusy(true); setErr(null);
    try {
      await annotatorApi.submit(taskId, force, note.trim() || undefined);
      onSubmitted();
    } catch (e: any) {
      const detail = e.userMessage;
      if (detail?.preflight) {
        setPreflight(detail.preflight);
        setNeedsForce(true);
        setErr(detail.message ?? 'Confirmation required.');
      } else {
        setErr(typeof detail === 'string' ? detail : 'Submission failed');
      }
    } finally { setBusy(false); }
  };

  const pct = preflight.total_images
    ? Math.round((preflight.completed_images + preflight.skipped_images) / preflight.total_images * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Submit for review</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            The reviewer will see the current state of this task.
          </p>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
              {err}
            </div>
          )}

          {/* Summary grid */}
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Summary
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="text-xs text-emerald-700">Completed</div>
                <div className="text-2xl font-semibold text-emerald-900 tabular-nums">
                  {preflight.completed_images}
                </div>
              </div>
              <div className="bg-slate-100 border border-slate-200 rounded-lg p-3">
                <div className="text-xs text-slate-600">Skipped</div>
                <div className="text-2xl font-semibold text-slate-700 tabular-nums">
                  {preflight.skipped_images}
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-xs text-amber-700">Untouched</div>
                <div className="text-2xl font-semibold text-amber-900 tabular-nums">
                  {preflight.pending_images}
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {pct}% of {preflight.total_images} images are accounted for ·{' '}
              {preflight.total_annotations} annotation{preflight.total_annotations === 1 ? '' : 's'} drawn
            </div>
          </div>

          {/* Warnings */}
          {preflight.warnings.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                {preflight.blocks_submission ? 'Blocking issues' : 'Warnings'}
              </div>
              <ul className="space-y-2">
                {preflight.warnings.map((w, i) => (
                  <li
                    key={i}
                    className={`border rounded-lg px-3 py-2 text-sm ${
                      preflight.blocks_submission
                        ? 'border-red-200 bg-red-50 text-red-900'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <div className="font-medium">{w.message}</div>
                    {w.detail && (
                      <div className="text-xs opacity-80 mt-0.5">{w.detail}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Note to reviewer */}
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Note to reviewer (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 'Two images had blurry objects; I skipped them. Frame 14 is ambiguous — please check.'"
              rows={3}
              className="w-full mt-2 border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="border-t px-6 py-4 flex items-center gap-3 bg-slate-50">
          <div className="text-xs text-slate-500 flex-1">
            {preflight.blocks_submission
              ? 'Fix the blocking issues above to submit.'
              : preflight.warnings.length > 0
                ? 'You can still submit, but the reviewer will see these warnings.'
                : 'Everything looks good.'}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>

          <button
            onClick={() => submit(needsForce || preflight.blocks_submission || preflight.warnings.length > 0)}
            disabled={busy || (preflight.blocks_submission && !preflight.can_submit)}
            className={`px-4 py-2 text-sm rounded-md text-white font-medium disabled:opacity-50 ${
              preflight.warnings.length || preflight.blocks_submission
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {busy
              ? 'Submitting…'
              : preflight.warnings.length || preflight.blocks_submission
                ? 'Submit anyway'
                : 'Submit for review'}
          </button>
        </div>
      </div>
    </div>
  );
};