import { useEffect } from 'react';
import { useAnnotationStore } from '../store/annotationStore';
import { useViewportStore } from '../store/viewportStore';

export function useZoomToSelection() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName,
      );
      if (inInput) return;
      if (e.key !== 'F' || !e.shiftKey) return;

      e.preventDefault();
      const store = useAnnotationStore.getState();
      const { annotations, selectedIds } = store;
      const sel = annotations.filter((a) => selectedIds.includes(a.id));
      if (sel.length === 0) return;

      // Compute bounding box of selection
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const a of sel) {
        if (a.shapeType === 'mask') continue;   // skip masks for now
        for (let i = 0; i < a.points.length; i += 2) {
          minX = Math.min(minX, a.points[i]);
          maxX = Math.max(maxX, a.points[i]);
          minY = Math.min(minY, a.points[i + 1]);
          maxY = Math.max(maxY, a.points[i + 1]);
        }
      }
      if (!isFinite(minX)) return;

      const vp = useViewportStore.getState();
      const pad = 60;
      const scale = Math.min(
        (vp.containerW - pad * 2) / (maxX - minX),
        (vp.containerH - pad * 2) / (maxY - minY),
        8,
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      vp.setLive({
        scale,
        x: vp.containerW / 2 - cx * scale,
        y: vp.containerH / 2 - cy * scale,
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
