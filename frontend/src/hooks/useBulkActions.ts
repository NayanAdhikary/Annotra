import { useEffect } from 'react';
import { annotationsApi } from '../api/annotations';
import { useAnnotationStore } from '../store/annotationStore';
import { useSaveStatus } from './useSaveStatus';
import { useHistoryStore } from '../store/historyStore';
import { ChangeLabelCommand, ToggleOccludedCommand } from '../commands/AnnotationCommands';

/**
 * Keyboard-driven bulk actions:
 *   1..9    → reassign all selected to Nth label
 *   Delete  → bulk delete selected (multi-select only)
 *   O       → toggle occluded on all selected
 */
export function useBulkActions(taskId: number | null) {
  const wrap = useSaveStatus();

  useEffect(() => {
    if (!taskId) return;

    const handler = async (e: KeyboardEvent) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName,
      );
      if (inInput) return;

      const store = useAnnotationStore.getState();
      const { selectedIds, annotations, labels } = store;
      if (!selectedIds.length) return;

      const selected = annotations.filter((a) => selectedIds.includes(a.id));
      const serverIds = selected.map((a) => a.serverId).filter((x): x is number => !!x);

      // ---- Reassign by label hotkey ----
      if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const label = labels[idx];
        if (!label) return;

        const fromLabelId = selected[0].labelId;
        if (selected.some((a) => a.labelId !== fromLabelId)) {
          // Mixed labels — use each selected's own from-value
          for (const a of selected) {
            useHistoryStore.getState().execute(new ChangeLabelCommand([a.id], a.labelId, label.id));
          }
        } else {
          useHistoryStore.getState().execute(new ChangeLabelCommand(selectedIds, fromLabelId, label.id));
        }

        if (serverIds.length) {
          wrap(() =>
            annotationsApi.bulkPatch(taskId, {
              ids: serverIds,
              patch: { label_id: label.id },
            }),
          ).catch(() => {
            // Day 10: roll back from command stack
            useHistoryStore.getState().undo();
          });
        }
        return;
      }

      // ---- Toggle occluded ----
      if (e.key.toLowerCase() === 'o') {
        const allOccluded = selected.every((a) => a.occluded);
        const nextValue = !allOccluded;
        
        useHistoryStore.getState().execute(new ToggleOccludedCommand(selectedIds, nextValue));

        if (serverIds.length) {
          wrap(() =>
            annotationsApi.bulkPatch(taskId, {
              ids: serverIds,
              patch: { occluded: nextValue },
            }),
          ).catch(() => {
             useHistoryStore.getState().undo();
          });
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [taskId, wrap]);
}
