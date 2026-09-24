import React from 'react';
import { useViewportStore } from '../../store/viewportStore';
import { useZoom } from '../../hooks/useZoom';
import { useFitToScreen } from '../../hooks/useFitToScreen';

const PRESETS = [0.5, 1, 2, 4];

export const ZoomControls: React.FC<{ stageRef: React.RefObject<any> }> = ({ stageRef }) => {
  const scale = useViewportStore((s) => s.live.scale);
  const setLive = useViewportStore((s) => s.setLive);
  const { zoomBy, zoomTo } = useZoom(stageRef);
  const fit = useFitToScreen();

  return (
    <div className="flex items-center gap-1 bg-white/95 backdrop-blur border border-slate-200 rounded-md shadow-sm px-1">
      <button onClick={() => zoomBy(1 / 1.25)} title="Zoom out (-)"
              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded">−</button>

      <span className="w-14 text-center text-xs text-slate-700 tabular-nums">
        {Math.round(scale * 100)}%
      </span>

      <button onClick={() => zoomBy(1.25)} title="Zoom in (+)"
              className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded">+</button>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {PRESETS.map((s) => (
        <button key={s} onClick={() => zoomTo(s)}
                className={`h-8 px-2 text-xs rounded ${
                  Math.abs(scale - s) < 0.001
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}>
          {s * 100}%
        </button>
      ))}

      <div className="w-px h-5 bg-slate-200 mx-1" />

      <button onClick={fit} title="Fit to screen (0)"
              className="h-8 px-2 text-xs text-slate-600 hover:bg-slate-100 rounded">Fit</button>

      <button onClick={() => setLive({ scale: 1, x: 0, y: 0 })} title="Actual size (1)"
              className="h-8 px-2 text-xs text-slate-600 hover:bg-slate-100 rounded">1:1</button>
    </div>
  );
};