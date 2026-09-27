import React from 'react';

export interface AttributeDef {
  name: string;
  input_type: 'select' | 'radio' | 'checkbox' | 'text' | 'number';
  values?: string[];
  default?: any;
  required?: boolean;
}

interface Props {
  attributes: AttributeDef[];
  onChange: (next: AttributeDef[]) => void;
}

const INPUT_TYPES: AttributeDef['input_type'][] = [
  'select', 'radio', 'checkbox', 'text', 'number',
];

export const AttributeEditor: React.FC<Props> = ({ attributes, onChange }) => {
  const add = () => onChange([
    ...attributes,
    { name: '', input_type: 'text', default: '', required: false },
  ]);

  const update = (i: number, patch: Partial<AttributeDef>) => {
    const next = [...attributes];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const remove = (i: number) => onChange(attributes.filter((_, x) => x !== i));

  return (
    <div className="space-y-2">
      {attributes.map((a, i) => (
        <div key={i} className="border border-slate-200 rounded p-2 space-y-1.5 bg-slate-50">
          <div className="flex gap-2">
            <input
              value={a.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="attribute_name"
              className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs font-mono"
            />
            <select
              value={a.input_type}
              onChange={(e) => update(i, { input_type: e.target.value as any })}
              className="border border-slate-300 rounded px-2 py-1 text-xs"
            >
              {INPUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => remove(i)}
                    className="text-slate-400 hover:text-red-600 px-1">✕</button>
          </div>

          {(a.input_type === 'select' || a.input_type === 'radio') && (
            <input
              value={(a.values ?? []).join(', ')}
              onChange={(e) => update(i, {
                values: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })}
              placeholder="values: red, blue, white"
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
            />
          )}

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={a.required ?? false}
                     onChange={(e) => update(i, { required: e.target.checked })} />
              required
            </label>
            {a.input_type !== 'checkbox' && (
              <label className="flex items-center gap-1">
                default:
                <input
                  value={a.default ?? ''}
                  onChange={(e) => update(i, {
                    default: a.input_type === 'number' ? Number(e.target.value) : e.target.value,
                  })}
                  className="border border-slate-300 rounded px-1 py-0.5 w-24 text-xs"
                />
              </label>
            )}
          </div>
        </div>
      ))}

      <button onClick={add}
              className="text-xs text-indigo-600 hover:underline">
        + Add attribute
      </button>
    </div>
  );
};
