import React, { useState } from 'react';
import { reviewApi } from '../../api/review';
import { useIsAdminOrManager } from '../../hooks/useRoleAccess';

interface Props { taskId: number; onDone: () => void; }

export const ReviewAdminActions: React.FC<Props> = ({ taskId, onDone }) => {
  const isAdmin = useIsAdminOrManager();
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const approveAll = async () => {
    if (!window.confirm('Approve every annotation in this task?')) return;
    setBusy(true);
    try { await reviewApi.approveAll(taskId); onDone(); }
    finally { setBusy(false); }
  };

  const resetAll = async () => {
    if (!window.confirm('Reset every review decision?')) return;
    setBusy(true);
    try { await reviewApi.resetAll(taskId); onDone(); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-1">
      <button onClick={approveAll} disabled={busy}
              className="text-xs px-2 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
        Approve all
      </button>
      <button onClick={resetAll} disabled={busy}
              className="text-xs px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50">
        Reset review
      </button>
    </div>
  );
};