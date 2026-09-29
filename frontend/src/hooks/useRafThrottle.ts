import { useRef, useCallback } from 'react';

export function useRafThrottle<T extends (...args: any[]) => void>(fn: T): T {
  const pendingRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number | null>(null);

  return useCallback((...args: any[]) => {
    pendingRef.current = () => fn(...args);
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      pendingRef.current?.();
      pendingRef.current = null;
    });
  }, [fn]) as T;
}
