import React, { useEffect } from 'react';
import { useAnnotationStore } from '../../store/annotationStore';
import { useToolConfig } from '../../store/toolConfigStore';
import { useRecentLabels } from '../../store/recentLabelsStore';
import type { Label } from '../../types/annotation';


const TOOL_DEFS = [
  { key: 'select',    label: 'Select',    icon: '▣', group: 'select' },
  { key: 'rectangle', label: 'Rectangle', icon: '▭', group: 'shapes' },
  { key: 'polygon',   label: 'Polygon',   icon: '⬡', group: 'shapes' },
  { key: 'polyline',  label: 'Polyline',  icon: '∿', group: 'shapes' },
  { key: 'points',    label: 'Points',    icon: '•', group: 'shapes' },
  { key: 'brush',     label: 'Brush',     icon: '🖌', group: 'draw' },
  { key: 'eraser',    label: 'Eraser',    icon: '⌫', group: 'draw' },
];

export const Toolbar: React.FC<{ onManageLabels?: () => void }> = ({ onManageLabels }) => {
  const config = useToolConfig((s) => s.config);
  const { currentTool, setTool, labels, activeLabelId, setActiveLabel, taskStatus, taskId } = useAnnotationStore();
  const recentIds = useRecentLabels((s) => s.recentFor(taskId ?? -1));
  const recordRecent = useRecentLabels((s) => s.record);

  const orderedLabels = React.useMemo(() => {
    const recent = recentIds.map((id) => labels.find((l) => l.id === id)).filter(Boolean) as Label[];
    const rest = labels.filter((l) => !recentIds.includes(l.id));
    return [...recent, ...rest];
  }, [labels, recentIds]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (taskStatus === 'completed' || taskStatus === 'archived') return;
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (!config) return;
      
      const key = e.key.toLowerCase();

      // Number shortcuts for labels
      if (/^[1-9]$/.test(key)) {
        const idx = parseInt(key, 10) - 1;
        const label = orderedLabels[idx];
        if (label) {
          setActiveLabel(label.id);
          if (taskId) recordRecent(taskId, label.id);
        }
        return;
      }

      // Find tool by shortcut
      const entry = Object.entries(config.shortcuts).find(([_, shortcut]) => shortcut.toLowerCase() === key);
      if (entry) {
        const [toolKey] = entry;
        if (toolKey === 'select' || config.enabled_tools.includes(toolKey)) {
          setTool(toolKey as any);
        }
      }

    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setTool, taskStatus, config, orderedLabels, setActiveLabel, taskId, recordRecent]);

  if (!config) return null;

  const visible = TOOL_DEFS.filter((t) =>
    t.key === 'select' || config.enabled_tools.includes(t.key),
  );

  const groups: Record<string, typeof visible> = {};
  for (const t of visible) {
    (groups[t.group] ||= []).push(t);
  }

  const shortcuts = config.shortcuts;

  return (
    <div className="flex items-center gap-4 p-2 border-b bg-white flex-wrap shrink-0">
      {Object.entries(groups).map(([group, tools]) => (
        <div key={group} className="flex gap-1 items-center">
          {tools.map((t) => {
            const isActive = currentTool === t.key;
            const shortcut = shortcuts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTool(t.key as any)}
                title={`${t.label}${shortcut ? ` (${shortcut})` : ''}`}
                className={`w-9 h-9 rounded flex items-center justify-center text-base border transition ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-inner'
                    : 'bg-white border-slate-300 hover:bg-slate-100'
                }`}
              >
                {t.icon}
              </button>
            );
          })}
        </div>
      ))}

      <div className="w-px h-6 bg-slate-200" />

      {/* Label pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {orderedLabels.map((l, idx) => (
          <button
            key={l.id}
            onClick={() => {
              setActiveLabel(l.id);
              if (taskId) recordRecent(taskId, l.id);
            }}
            className={`px-2.5 py-1 rounded-full text-xs border transition relative flex items-center ${
              activeLabelId === l.id ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
            }`}
            style={{ backgroundColor: l.color + '20', borderColor: l.color }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: l.color }}
            />
            {l.name}
            {idx < 9 && (
              <span className="ml-1.5 text-[9px] font-bold text-slate-500 bg-white/50 px-1 rounded">
                {idx + 1}
              </span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={onManageLabels}
        className="ml-auto text-xs text-blue-600 hover:underline"
      >
        ⚙ Manage labels
      </button>
    </div>
  );
};
