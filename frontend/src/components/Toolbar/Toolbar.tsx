import React from 'react';
import { useAnnotationStore } from '../../store/annotationStore';
import { useToolConfig } from '../../store/toolConfigStore';
import { useRecentLabels } from '../../store/recentLabelsStore';

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
  const { currentTool, setTool, labels, activeLabelId, setActiveLabel } = useAnnotationStore();

  if (!config) return null;

  // Mock org for now
  const org = { id: 1 };
  const recentIds = useRecentLabels((s) => s.recentFor(org?.id ?? -1));
  const ordered = React.useMemo(() => {
    const recent = recentIds.map((id) => labels.find((l) => l.id === id)).filter(Boolean) as any[];
    const rest = labels.filter((l) => !recentIds.includes(l.id));
    return [...recent, ...rest];
  }, [labels, recentIds]);

  const enabled = new Set(['select', ...config.enabled_tools]);
  const visible = TOOL_DEFS.filter((t) => enabled.has(t.key));
  const shortcuts = config.shortcuts;

  return (
    <div className="flex items-center gap-3 p-2 border-b bg-white flex-wrap">
      {visible.map((t, i) => {
        const prev = visible[i - 1];
        const groupBreak = prev && prev.group !== t.group;
        const shortcut = shortcuts[t.key];
        return (
          <React.Fragment key={t.key}>
            {groupBreak && <div className="w-px h-6 bg-slate-200" />}
            <button
              onClick={() => setTool(t.key as any)}
              title={`${t.label}${shortcut ? ` (${shortcut})` : ''}`}
              className={`w-9 h-9 rounded flex items-center justify-center text-base border transition ${
                currentTool === t.key
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-inner'
                  : 'bg-white border-slate-300 hover:bg-slate-100'
              }`}
            >
              {t.icon}
            </button>
          </React.Fragment>
        );
      })}

      <div className="w-px h-6 bg-slate-200" />

      <div className="flex items-center gap-1.5 flex-wrap">
        {ordered.slice(0, 9).map((l, i) => (
          <button
            key={l.id}
            onClick={() => setActiveLabel(l.id)}
            title={`${l.name} (${i + 1})`}
            className={`relative px-2.5 py-1 rounded-full text-xs border transition flex items-center ${
              activeLabelId === l.id ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
            }`}
            style={{ backgroundColor: l.color + '20', borderColor: l.color }}
          >
            <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] flex items-center justify-center">
              {i + 1}
            </span>
            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: l.color }} />
            {l.name}
          </button>
        ))}
      </div>

      <button onClick={onManageLabels} className="ml-auto text-xs text-blue-600 hover:underline">
        ⚙ Manage labels
      </button>
    </div>
  );
};
