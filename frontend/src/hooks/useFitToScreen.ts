import { useCallback } from 'react';
import { useViewportStore } from '../store/viewportStore';

const PADDING = 48;

export function useFitToScreen() {
  const setLive = useViewportStore((s) => s.setLive);

  return useCallback(() => {
    const { containerW, containerH, imageW, imageH } = useViewportStore.getState();
    if (!containerW || !containerH || !imageW || !imageH) return;

    const availW = Math.max(1, containerW - PADDING);
    const availH = Math.max(1, containerH - PADDING);
    const scale = Math.min(availW / imageW, availH / imageH);

    setLive({
      scale,
      x: (containerW - imageW * scale) / 2,
      y: (containerH - imageH * scale) / 2,
    });
  }, [setLive]);
}