import { useEffect } from 'react';
import { useAnnotationStore } from '../store/annotationStore';

export function useTabNavigation() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName,
      );
      if (inInput) return;
      if (e.key !== 'Tab') return;

      const store = useAnnotationStore.getState();
      const { annotations, frame, primaryId, selectOne } = store;
      const onFrame = annotations.filter((a) => a.frame === frame);
      if (onFrame.length === 0) return;

      e.preventDefault();

      const idx = onFrame.findIndex((a) => a.id === primaryId);
      const nextIdx = e.shiftKey
        ? (idx <= 0 ? onFrame.length - 1 : idx - 1)
        : (idx === -1 ? 0 : (idx + 1) % onFrame.length);
      selectOne(onFrame[nextIdx].id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
