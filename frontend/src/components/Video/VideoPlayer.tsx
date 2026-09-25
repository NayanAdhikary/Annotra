import React, { useEffect, useRef } from 'react';
import useImage from 'use-image';
import { useVideoStore } from '../../store/videoStore';
import { useVideoPlayback } from '../../hooks/useVideoPlayback';
import { InterpolatedShapes } from './InterpolatedShapes';

interface Props {
  fps: number;
  width: number;
  height: number;
}

export const VideoPlayer: React.FC<Props> = ({ fps, width, height }) => {
  const frameUrls = useVideoStore((s) => s.frameUrls);
  const currentFrame = useVideoStore((s) => s.currentFrame);
  const playing = useVideoStore((s) => s.playing);
  const playbackRate = useVideoStore((s) => s.playbackRate);
  const stepFrame = useVideoStore((s) => s.stepFrame);
  const togglePlay = useVideoStore((s) => s.togglePlay);
  const setPlaybackRate = useVideoStore((s) => s.setPlaybackRate);

  useVideoPlayback(fps);

  const currentUrl = frameUrls[currentFrame];
  const [img] = useImage(currentUrl, 'anonymous');

  // Keyboard: space play/pause, ←/→ step
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName,
      );
      if (inInput) return;

      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); stepFrame(-1); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); stepFrame(1); }
      else if (e.code === 'ArrowUp') { e.preventDefault(); stepFrame(-10); }
      else if (e.code === 'ArrowDown') { e.preventDefault(); stepFrame(10); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, stepFrame]);

  return (
    <div className="flex flex-col">
      <div
        className="relative bg-slate-900 rounded-lg overflow-hidden"
        style={{ width, height }}
      >
        {img && (
          <img
            src={currentUrl}
            alt=""
            width={width}
            height={height}
            className="block"
            draggable={false}
          />
        )}
        {/* Annotation overlay — absolute positioned SVG in image coords */}
        <InterpolatedShapes width={width} height={height} />
      </div>

      <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3">
        {/* Scrubber */}
        <input
          type="range"
          min={0}
          max={frameUrls.length - 1}
          value={currentFrame}
          onChange={(e) => stepFrame(Number(e.target.value) - currentFrame)}
          className="w-full"
        />

        <div className="flex items-center gap-3 mt-2">
          <button onClick={() => stepFrame(-10)} title="Back 10 (↓)"
                  className="px-2 py-1 text-sm border rounded hover:bg-slate-50">⏪</button>
          <button onClick={() => stepFrame(-1)} title="Back 1 (←)"
                  className="px-2 py-1 text-sm border rounded hover:bg-slate-50">◀</button>
          <button onClick={togglePlay}
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">
            {playing ? 'Pause' : 'Play'}
          </button>
          <button onClick={() => stepFrame(1)} title="Forward 1 (→)"
                  className="px-2 py-1 text-sm border rounded hover:bg-slate-50">▶</button>
          <button onClick={() => stepFrame(10)} title="Forward 10 (↑)"
                  className="px-2 py-1 text-sm border rounded hover:bg-slate-50">⏩</button>

          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            className="ml-2 border rounded px-2 py-1 text-xs"
          >
            {[0.25, 0.5, 1, 2, 4].map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>

          <div className="ml-auto text-xs text-slate-600 tabular-nums">
            Frame {currentFrame + 1} / {frameUrls.length} ·
            {' '}{(currentFrame / fps).toFixed(2)}s
          </div>
        </div>
      </div>
    </div>
  );
};
