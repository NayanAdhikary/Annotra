import { useEffect } from 'react';
import { useHistoryStore } from '../store/historyStore';

/**
 * Warns on tab close if there is any command in the history stack
 * that hasn't been explicitly saved. Since we autosave, this is a
 * coarse "you have unsaved work" check.
 */
export function useUnsavedGuard(isSaving: boolean) {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isSaving) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isSaving]);
}
