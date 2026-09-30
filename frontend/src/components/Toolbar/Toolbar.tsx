import React, { useEffect } from 'react';
import { useAnnotationStore } from '../../store/annotationStore';
import type { ToolType } from '../../types/annotation';

const TOOLS: { key: ToolType; label: string; hotkey: string; icon: string }[] = [
  { key: 'select',    label: 'Select',    hotkey: 'V', icon: '▣' },
  { key: 'rectangle', label: 'Rectangle', hotkey: 'R', icon: '▭' },
  { key: 'polygon',   label: 'Polygon',   hotkey: 'P', icon: '⬡' },
  { key: 'polyline',  label: 'Polyline',  hotkey: 'L', icon: '∿' },
  { key: 'points',    label: 'Points',    hotkey: 'K', icon: '•' },
  { key: 'brush',     label: 'Brush',     hotkey: 'B', icon: '🖌' },
  { key: 'eraser',    label: 'Eraser',    hotkey: 'E', icon: '⌫' },
];

const HOTKEY_TO_TOOL: Record<string, ToolType> = {
  v: 'select', r: 'rectangle', p: 'polygon', l: 'polyline', k: 'points', b: 'brush', e: 'eraser',
};

export const Toolbar: React.FC<{ vertical?: boolean }> = ({ vertical = false }) => {
  const { currentTool, setTool, labels, activeLabelId, setActiveLabel, brushSize, setBrushSize, taskStatus } =
    useAnnotationStore();
    
  const readOnly = taskStatus === 'completed' || taskStatus === 'archived';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (readOnly) return;
      // Ignore when typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const tool = HOTKEY_TO_TOOL[e.key.toLowerCase()];
      if (tool) setTool(tool);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setTool, readOnly]);

  return (
    <div className={`flex ${vertical ? 'flex-col items-center gap-4 py-4 w-16 border-r border-slate-200 bg-white overflow-y-auto shrink-0 z-10 shadow-sm' : 'items-center gap-4 p-2 border-b bg-white'}`}>
      <div className={`flex ${vertical ? 'flex-col gap-2' : 'gap-1'}`}>
        {TOOLS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTool(t.key)}
            disabled={readOnly && t.key !== 'select'}
            title={`${t.label} (${t.hotkey})`}
            className={`w-10 h-10 rounded flex items-center justify-center text-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              currentTool === t.key
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600'
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {['brush', 'eraser'].includes(currentTool) && (
        <div className={`flex ${vertical ? 'flex-col items-center gap-1 border-t border-slate-100 pt-4 w-full' : 'items-center gap-2 border-l pl-3'}`}>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Size</span>
          <input
            type="range" min={5} max={200}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className={vertical ? 'w-12 rotate-[-90deg] my-6' : 'w-32'}
          />
          <span className="text-[10px] font-medium text-slate-500 tabular-nums w-8 text-center">{brushSize}px</span>
        </div>
      )}

      {/* When vertical, we can either hide labels or show them compactly. In our UI labels are selected here. */}
      {/* For a compact vertical toolbar, just showing color swatches with tooltips works best. */}
      <div className={`${vertical ? 'border-t border-slate-100 pt-4 flex flex-col items-center gap-2 w-full mt-auto' : 'border-l pl-4 flex items-center gap-2'}`}>
        {!vertical && <span className="text-sm font-medium text-slate-600">Label:</span>}
        <div className={`flex ${vertical ? 'flex-col gap-2' : 'gap-1'}`}>
          {labels.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveLabel(l.id)}
              title={l.name}
              className={`rounded border flex items-center justify-center transition-all ${
                activeLabelId === l.id ? 'ring-2 ring-indigo-500 shadow-sm' : 'hover:scale-110'
              } ${vertical ? 'w-8 h-8 rounded-full' : 'px-3 py-1 text-sm'}`}
              style={vertical ? { backgroundColor: l.color, borderColor: 'transparent' } : { backgroundColor: l.color + '15', borderColor: l.color + '40' }}
            >
              {!vertical && (
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: l.color }}
                />
              )}
              {!vertical && <span className="text-slate-800">{l.name}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
