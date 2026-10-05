import React, { useEffect, useState } from 'react';
import { useAnnotationStore } from '../../store/annotationStore';

const TIPS: Record<string, string> = {
  rectangle: 'Drag from corner to corner. Hold Shift for a perfect square.',
  polygon:   'Click to place vertices. Double-click or Enter to close.',
  polyline:  'Click each point. Press Enter when done. Esc to cancel.',
  points:    'Click once per point. Each click creates a marker.',
  brush:     'Paint over the object. [ and ] resize the brush.',
  eraser:    'Paint to erase. Works only on the current mask.',
  select:    'Click a shape. Shift+click to multi-select. Drag empty space for marquee.',
};

const KEY = 'annotra.tool_tips_seen_v1';

export const ToolTip: React.FC = () => {
  const currentTool = useAnnotationStore((s) => s.currentTool);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (currentTool === 'select') return;
    const seen: Record<string, boolean> = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (seen[currentTool]) return;
    setMsg(TIPS[currentTool] ?? '');
    const t = setTimeout(() => {
      setMsg('');
      seen[currentTool] = true;
      localStorage.setItem(KEY, JSON.stringify(seen));
    }, 4500);
    return () => clearTimeout(t);
  }, [currentTool]);

  if (!msg) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-xs px-3 py-2 rounded-lg shadow-lg z-20 flex items-center gap-2 max-w-md">
      <span>💡</span>
      <span>{msg}</span>
      <button onClick={() => setMsg('')} className="text-slate-400 hover:text-white ml-1">✕</button>
    </div>
  );
};