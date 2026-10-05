import React, { useState } from 'react';
import { labelsApi } from '../../api/labels';
import { useAnnotationStore } from '../../store/annotationStore';
import { useSaveStatus } from '../../hooks/useSaveStatus';
import { AttributeEditor } from '../LabelManager/AttributeEditor';
import type { AttributeDef } from '../LabelManager/AttributeEditor';
import { useToast } from "../Toast/ToastProvider";

const PALETTE = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759',
  '#00C7BE', '#007AFF', '#5856D6', '#AF52DE',
];

interface Props {
  taskId: number;
}

export const LabelEditor: React.FC<Props> = ({ taskId }) => {
    const toast = useToast();
  const { labels, upsertLabel, removeLabel } = useAnnotationStore();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [attributes, setAttributes] = useState<AttributeDef[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const wrap = useSaveStatus();

  const formatError = (e: any) => {
    const detail = e?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join('\n');
    }
    return detail ?? 'Failed to save';
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const label = await wrap(() =>
        labelsApi.create(taskId, name.trim(), color, attributes),
      );
      upsertLabel(label);
      setName('');
      setAttributes([]);
      setColor(PALETTE[0]);
    } catch (e: any) {
      toast.push('error', e.userMessage ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const saveAttributes = async (labelId: number, attrs: AttributeDef[]) => {
    try {
      const updated = await wrap(() => labelsApi.update(labelId, { attributes: attrs }));
      upsertLabel(updated);
    } catch (e: any) {
      toast.push('error', e.userMessage ?? 'Something went wrong');
    }
  };

  const deleteLabel = async (id: number) => {
    if (!window.confirm('Delete this label?')) return;
    await labelsApi.remove(id);
    removeLabel(id);
  };

  return (
    <div className="space-y-4">
      {/* Create form */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="text-xs font-medium text-slate-500 mb-2">New label</div>
        <div className="flex gap-2 mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Label name (e.g. Car, Pedestrian, Traffic Light)"
            className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-1">
            {PALETTE.slice(0, 5).map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 ${
                  color === c ? 'border-slate-900' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Attribute definition for the new label */}
        <div className="border-t border-slate-100 pt-3 mt-3">
          <div className="text-xs text-slate-500 mb-2">
            Properties (optional) — annotators will see these as dropdowns / checkboxes
          </div>
          <AttributeEditor attributes={attributes} onChange={setAttributes} />
        </div>

        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="mt-3 w-full bg-indigo-600 text-white rounded py-2 text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Add label'}
        </button>
      </div>

      {/* List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {labels.map((l) => (
          <div key={l.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span
                className="w-5 h-5 rounded-full border border-slate-300"
                style={{ backgroundColor: l.color }}
              />
              <span className="flex-1 text-sm font-medium text-slate-900">{l.name}</span>
              <span className="text-xs text-slate-500">
                {l.attributes?.length ?? 0} properties
              </span>
              <button
                onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                className="text-xs text-indigo-600 hover:underline"
              >
                {expanded === l.id ? 'Close' : 'Edit'}
              </button>
              <button
                onClick={() => deleteLabel(l.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>

            {expanded === l.id && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <AttributeEditor
                  attributes={l.attributes ?? []}
                  onChange={(attrs) => upsertLabel({ ...l, attributes: attrs })}
                />
                <button
                  onClick={() => saveAttributes(l.id, l.attributes ?? [])}
                  className="mt-2 text-xs px-3 py-1 bg-indigo-600 text-white rounded"
                >
                  Save properties
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
