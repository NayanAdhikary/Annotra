import React, { useEffect, useState } from 'react';
import { useHistoryStore } from '../../store/historyStore';

export const HistoryControls: React.FC = () => {
  const [tick, setTick] = useState(0);
  const past = useHistoryStore((s) => s.past);
  const future = useHistoryStore((s) => s.future);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  // Force re-render when store changes (Zustand already subscribes, but
  // we need a "tick" for the tooltip label too).
  useEffect(() => setTick((t) => t + 1), [past, future]);

  const undoLabel = past.length ? `Undo ${past[past.length - 1].label}` : 'Nothing to undo';
  const redoLabel = future.length ? `Redo ${future[0].label}` : 'Nothing to redo';

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={undo}
        disabled={!past.length}
        title={`${undoLabel} (Ctrl+Z)`}
        className="h-8 w-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30"
      >
        ↶
      </button>
      <button
        onClick={redo}
        disabled={!future.length}
        title={`${redoLabel} (Ctrl+Shift+Z)`}
        className="h-8 w-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30"
      >
        ↷
      </button>
    </div>
  );
};
