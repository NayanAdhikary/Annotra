import { useCallback, useRef } from 'react';
import { useAnnotationStore } from '../store/annotationStore';

/**
 * Wraps any async mutation. Sets saveStatus to 'saving', then 'saved',
 * then back to 'idle' after 1.2 s. On error sets 'error'.
 * Debounces the 'saved' → 'idle' transition when many writes fire quickly.
 */
export function useSaveStatus() {
  const setSaveStatus = useAnnotationStore((s) => s.setSaveStatus);
  const idleTimer = useRef<number | null>(null);

  return useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      setSaveStatus('saving');
      try {
        const result = await fn();
        setSaveStatus('saved');
        idleTimer.current = window.setTimeout(() => setSaveStatus('idle'), 1200);
        return result;
      } catch (e) {
        setSaveStatus('error');
        throw e;
      }
    },
    [setSaveStatus],
  );
}