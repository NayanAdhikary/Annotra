import { useEffect, useRef } from 'react';
import { useVideoStore } from '../store/videoStore';

export function useVideoPlayback(fps: number) {
  const playing = useVideoStore((s) => s.playing);
  const rate = useVideoStore((s) => s.playbackRate);
  const frameCount = useVideoStore((s) => s.frameUrls.length);
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!playing || fps <= 0 || frameCount === 0) return;

    const frameDurationMs = 1000 / (fps * rate);

    const tick = (t: number) => {
      if (!lastTickRef.current) lastTickRef.current = t;
      const elapsed = t - lastTickRef.current;

      if (elapsed >= frameDurationMs) {
        const advance = Math.floor(elapsed / frameDurationMs);
        const next = useVideoStore.getState().currentFrame + advance;
        if (next >= frameCount - 1) {
          useVideoStore.getState().setFrame(frameCount - 1);
          useVideoStore.getState().togglePlay();
          return;
        }
        useVideoStore.getState().stepFrame(advance);
        lastTickRef.current = t;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = 0;
    };
  }, [playing, fps, rate, frameCount]);
}