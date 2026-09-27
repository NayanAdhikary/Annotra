import React, { useState } from 'react';
import { useAnnotationStore } from '../../store/annotationStore';
import { labelsApi } from '../../api/labels';
import { useSaveStatus } from '../../hooks/useSaveStatus';
import { AttributeEditor, AttributeDef } from './AttributeEditor';

const PALETTE = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759',
  '#00C7BE', '#007AFF', '#5856D6', '#AF52DE',
];

export const LabelManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { taskId, labels, upsertLabel, removeLabel } = useAnnotationStore();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [busy, setBusy] = useState(false);
  const wrap = useSaveStatus();
  
  const [editingAttributes, setEditingAttributes] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!taskId || !name.trim()) return;
    setBusy(true);
    try {
      const label = await wrap(() => labelsApi.create(taskId, name.trim(), color));
      upsertLabel(label);
      setName('');
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Failed to create label');
    } finally {
      setBusy(false);
    }
  };

  const handleColorChange = async (id: number, newColor: string) => {
    const updated = await wrap(() => labelsApi.update(id, { color: newColor }));
    upsertLabel(updated);
  };

  const handleNameChange = async (id: number, newName: string) => {
    const updated = await wrap(() => labelsApi.update(id, { name: newName }));
    upsertLabel(updated);
  };

  const handleDelete = async (id: number) => {
    const { annotation_count } = await labelsApi.usage(id);
    const msg = annotation_count > 0
      ? `This label is used by ${annotation_count} annotations. Delete all of them?`
      : 'Delete this label?';
    if (!window.confirm(msg)) return;
    await wrap(() => labelsApi.remove(id, annotation_count > 0));
    removeLabel(id);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex" onClick={onClose}>
      <div
        className="ml-auto w-96 h-full bg-white shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Labels</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900">✕</button>
        </div>

        <div className="p-4 border-b space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Label name (e.g. Car)"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-2 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-black' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={busy || !name.trim()}
            className="w-full bg-blue-600 text-white rounded py-2 text-sm disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Add label'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {labels.map((l) => (
            <div key={l.id} className="border-b border-slate-100 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
              <div className="flex items-center gap-2 group">
                <input
                  type="color"
                  value={l.color}
                  onChange={(e) => handleColorChange(l.id, e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                />
                <input
                  defaultValue={l.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== l.name) handleNameChange(l.id, v);
                  }}
                  className="flex-1 border rounded px-2 py-1 text-sm"
                />
                <button
                  onClick={() => setEditingAttributes(editingAttributes === l.id ? null : l.id)}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  Attrs ({l.attributes?.length ?? 0})
                </button>
                <button
                  onClick={() => handleDelete(l.id)}
                  className="text-red-500 opacity-0 group-hover:opacity-100 transition"
                  title="Delete label"
                >
                  🗑
                </button>
              </div>
              
              {editingAttributes === l.id && (
                <div className="mt-2 pl-9 pr-2">
                  <AttributeEditor
                    attributes={l.attributes ?? []}
                    onChange={(attrs) => {
                      // Optimistic local update
                      upsertLabel({ ...l, attributes: attrs });
                    }}
                  />
                  <button
                    onClick={async () => {
                      const updated = await wrap(() =>
                        labelsApi.update(l.id, { attributes: l.attributes } as any)
                      );
                      upsertLabel(updated);
                      setEditingAttributes(null);
                    }}
                    className="mt-2 text-xs text-indigo-600 hover:underline"
                  >
                    Save attributes
                  </button>
                </div>
              )}
            </div>
          ))}
          {labels.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              No labels yet. Add one above to start annotating.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};