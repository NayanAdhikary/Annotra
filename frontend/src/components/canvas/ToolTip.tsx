import React, { useEffect, useState } from 'react';
import { useAnnotationStore } from '../../store/annotationStore';

const TIPS: Record<string, string> = {
  rectangle: 'Drag from corner to corner. Hold Shift for a perfect square.',
  polygon:   'Click to place vertices. Double-click or press Enter to close.',
  polyline:  'Click each point. Press Enter when done. Press Escape to cancel.',
  points:    'Click once per point. Each click creates a marker.',
  brush:     'Paint over the object. Scroll to zoom while painting. [ and ] resize the brush.',
  eraser:    'Paint to erase the current mask. Works only when a mask is selected.',
  select:    'Click a shape to select it. Shift+click for multiple. Drag a rectangle on empty space for marquee.',
};

const STORAGE_KEY = 'annotra.tool_tips_seen';

export const ToolTip: React.FC = () => {
  const currentTool = useAnnotationStore((s) => s.currentTool);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (currentTool === 'select') return;
    const seen: Record<string, boolean> = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '{}',
    );
    if (seen[currentTool]) return;

    setMessage(TIPS[currentTool] ?? '');
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      seen[currentTool] = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    }, 4500);
    return () => clearTimeout(t);
  }, [currentTool]);

  if (!visible || !message) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg z-20 flex items-center gap-2 max-w-md">
      <span className="text-sm">💡</span>
      <span>{message}</span>
      <button
        onClick={() => setVisible(false)}
        className="text-slate-400 hover:text-white ml-1"
      >
        ✕
      </button>
    </div>
  );
};