import React, { useEffect } from 'react';
import { useAnnotationStore } from '../../store/annotationStore';
import type { ToolType } from '../../types/annotation';

const TOOLS: { key: ToolType; label: string; hotkey: string; icon: string }[] = [
  { key: 'select',    label: 'Select',    hotkey: 'V', icon: '▣' },
  { key: 'rectangle', label: 'Rectangle', hotkey: 'R', icon: '▭' },
  { key: 'polygon',   label: 'Polygon',   hotkey: 'P', icon: '⬡' },
  { key: 'polyline',  label: 'Polyline',  hotkey: 'L', icon: '∿' },
  { key: 'points',    label: 'Points',    hotkey: 'K', icon: '•' },
];

const HOTKEY_TO_TOOL: Record<string, ToolType> = {
  v: 'select', r: 'rectangle', p: 'polygon', l: 'polyline', k: 'points',
};

export const Toolbar: React.FC<{ onManageLabels?: () => void }> = ({ onManageLabels }) => {
  const { currentTool, setTool, labels, activeLabelId, setActiveLabel } =
    useAnnotationStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const tool = HOTKEY_TO_TOOL[e.key.toLowerCase()];
      if (tool) setTool(tool);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setTool]);

  return (
    <div className="flex items-center gap-4 p-2 border-b bg-white">
      <div className="flex gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTool(t.key)}
            title={`${t.label} (${t.hotkey})`}
            className={`w-10 h-10 rounded flex items-center justify-center text-lg border ${
              currentTool === t.key
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white border-gray-300 hover:bg-gray-100'
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="border-l pl-4 flex items-center gap-2">
        <span className="text-sm text-gray-600">Label:</span>
        <div className="flex gap-1">
          {labels.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveLabel(l.id)}
              className={`px-3 py-1 rounded text-sm border ${
                activeLabelId === l.id ? 'ring-2 ring-blue-500' : ''
              }`}
              style={{ backgroundColor: l.color + '20', borderColor: l.color }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: l.color }}
              />
              {l.name}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onManageLabels}
        className="ml-auto text-sm text-blue-600 hover:underline"
      >
        ⚙ Manage labels
      </button>
    </div>
  );
};
