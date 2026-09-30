import React from 'react';
import { useAnnotationStore } from '../../store/annotationStore';
import { annotationsApi } from '../../api/annotations';
import { useSaveStatus } from '../../hooks/useSaveStatus';
import type { AttributeDef } from '../LabelManager/AttributeEditor';

export const AttributePanel: React.FC = () => {
  const primaryId = useAnnotationStore((s) => s.primaryId);
  const ann = useAnnotationStore((s) => s.annotations.find((a) => a.id === s.primaryId));
  const label = useAnnotationStore((s) => s.labels.find((l) => l.id === ann?.labelId));
  const replaceAnnotation = useAnnotationStore((s) => s.replaceAnnotation);
  const wrap = useSaveStatus();

  if (!ann || !label) return null;
  const defs: AttributeDef[] = label.attributes ?? [];
  if (defs.length === 0) return null;

  const values: Record<string, any> = {};
  for (const a of ann.attributes ?? []) {
    if (a && typeof a === 'object' && 'name' in a) values[a.name] = a.value;
  }

  const setValue = async (name: string, value: any) => {
    const next = defs.map((d) => ({
      name: d.name,
      value: d.name === name ? value : (values[d.name] ?? d.default),
    }));
    replaceAnnotation(ann.id, { attributes: next });
    if (ann.serverId) {
      await wrap(() => annotationsApi.update(ann.serverId!, { attributes: next } as any));
    }
  };

  return (
    <div className="border-t border-slate-200 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
        Attributes · {label.name}
      </div>
      <div className="space-y-2">
        {defs.map((d) => {
          const current = values[d.name] ?? d.default;
          return (
            <div key={d.name}>
              <label className="block text-xs text-slate-600 mb-1">
                {d.name}
                {d.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>

              {d.input_type === 'select' && (
                <select
                  value={current ?? ''}
                  onChange={(e) => setValue(d.name, e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">—</option>
                  {(d.values ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              )}

              {d.input_type === 'radio' && (
                <div className="flex gap-2 flex-wrap">
                  {(d.values ?? []).map((v) => (
                    <label key={v} className="text-xs flex items-center gap-1">
                      <input type="radio" checked={current === v}
                             onChange={() => setValue(d.name, v)} />
                      {v}
                    </label>
                  ))}
                </div>
              )}

              {d.input_type === 'checkbox' && (
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={!!current}
                         onChange={(e) => setValue(d.name, e.target.checked)} />
                  <span className="text-slate-600 text-xs">yes</span>
                </label>
              )}

              {d.input_type === 'number' && (
                <input
                  type="number"
                  value={current ?? 0}
                  onChange={(e) => setValue(d.name, Number(e.target.value))}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                />
              )}

              {d.input_type === 'text' && (
                <input
                  type="text"
                  value={current ?? ''}
                  onChange={(e) => setValue(d.name, e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};