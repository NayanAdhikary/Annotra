import React from 'react';
import { useAnnotationStore } from '../../store/annotationStore';

export const ConflictBanner: React.FC = () => {
  const conflicts = useAnnotationStore((s) => s.conflicts);
  const clearConflict = useAnnotationStore((s) => s.clearConflict);
  const replaceAnnotation = useAnnotationStore((s) => s.replaceAnnotation);

  const entries = Object.entries(conflicts);
  if (!entries.length) return null;

  const acceptTheirs = (id: string, current: any) => {
    replaceAnnotation(id, {
      points: current.points,
      labelId: current.label_id,
      updatedAt: current.updated_at,
    });
    clearConflict(id);
  };

  const keepMine = (id: string) => {
    // Force-resend on next autosave tick by clearing the "last sent" fingerprint.
    // Simplest impl: bump a fake field to force the effect to see a diff.
    clearConflict(id);
  };

  return (
    <div className="bg-amber-50 border-b border-amber-300 text-amber-900 text-sm px-4 py-2 flex items-center gap-3">
      <span className="font-medium">
        ⚠ {entries.length} annotation{entries.length === 1 ? '' : 's'} changed by another user.
      </span>
      <div className="ml-auto flex gap-2">
        {entries.map(([id, detail]) => (
          <div key={id} className="flex gap-1">
            <button
              onClick={() => acceptTheirs(id, detail.current)}
              className="text-xs px-2 py-1 bg-white border border-amber-300 rounded hover:bg-amber-100"
            >
              Use theirs
            </button>
            <button
              onClick={() => keepMine(id)}
              className="text-xs px-2 py-1 bg-white border border-amber-300 rounded hover:bg-amber-100"
            >
              Keep mine
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
