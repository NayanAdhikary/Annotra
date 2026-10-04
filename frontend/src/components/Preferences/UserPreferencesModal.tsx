import React, { useEffect, useState } from 'react';
import { toolConfigApi } from '../../api/toolConfig';
import { useToolConfig } from '../../store/toolConfigStore';
import type { ToolConfig } from '../../store/toolConfigStore';

interface Props { onClose: () => void }

export const UserPreferencesModal: React.FC<Props> = ({ onClose }) => {
  const current = useToolConfig((s) => s.config);
  const [overrides, setOverrides] = useState<Partial<ToolConfig>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    toolConfigApi.myPrefs().then((p) => setOverrides(p.overrides));
  }, []);

  if (!current) return null;

  const save = async () => {
    setBusy(true);
    try {
      await toolConfigApi.saveMyPrefs(overrides);
      onClose();
    } finally { setBusy(false); }
  };

  const reset = async () => {
    if (!window.confirm('Reset all your preferences to the organization defaults?')) return;
    await toolConfigApi.resetMyPrefs();
    setOverrides({});
  };

  const set = <K extends keyof ToolConfig>(k: K, v: ToolConfig[K]) =>
    setOverrides((o) => ({ ...o, [k]: v }));

  const clear = <K extends keyof ToolConfig>(k: K) => {
    const next = { ...overrides };
    delete next[k];
    setOverrides(next);
  };

  const value = <K extends keyof ToolConfig>(k: K): ToolConfig[K] =>
    (k in overrides ? overrides[k] : current[k]) as ToolConfig[K];

  const overridden = <K extends keyof ToolConfig>(k: K) => k in overrides;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl"
      >
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">My workspace preferences</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            These override the organization defaults for your account only.
          </p>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Brush default */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-900">Default brush size</label>
              {overridden('brush_size_default') && (
                <button onClick={() => clear('brush_size_default')}
                        className="text-xs text-slate-500 hover:text-slate-900">
                  Reset
                </button>
              )}
            </div>
            <input
              type="range"
              min={current.brush_size_min}
              max={current.brush_size_max}
              value={value('brush_size_default')}
              onChange={(e) => set('brush_size_default', Number(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-slate-500 mt-1">
              {value('brush_size_default')}px
            </div>
          </div>

          {/* Default zoom */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-900">Default zoom</label>
              {overridden('default_zoom_mode') && (
                <button onClick={() => clear('default_zoom_mode')}
                        className="text-xs text-slate-500 hover:text-slate-900">
                  Reset
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {(['fit', '100', 'last'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => set('default_zoom_mode', m)}
                  className={`px-3 py-1.5 text-xs rounded border ${
                    value('default_zoom_mode') === m
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-slate-300 text-slate-700'
                  }`}
                >
                  {m === 'fit' ? 'Fit' : m === '100' ? '100%' : 'Last used'}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          {[
            { key: 'auto_advance_on_complete' as const, label: 'Auto-advance after marking done' },
            { key: 'auto_select_new_shape' as const,    label: 'Auto-select new shapes' },
            { key: 'snap_to_grid' as const,             label: 'Snap to grid' },
            { key: 'snap_to_vertex' as const,           label: 'Snap to nearby vertices' },
            { key: 'show_coordinates' as const,         label: 'Show cursor coordinates' },
            { key: 'show_shape_count' as const,         label: 'Show shape count' },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between py-2 border-t">
              <span className="text-sm text-slate-900">{row.label}</span>
              <div className="flex items-center gap-2">
                {overridden(row.key) && (
                  <button onClick={() => clear(row.key)}
                          className="text-xs text-slate-400 hover:text-slate-900">
                    reset
                  </button>
                )}
                <button
                  onClick={() => set(row.key, !value(row.key))}
                  className={`w-10 h-6 rounded-full relative ${
                    value(row.key) ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    value(row.key) ? 'translate-x-4' : ''
                  }`} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t px-6 py-4 flex items-center gap-3 bg-slate-50">
          <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-900">
            Reset all to defaults
          </button>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};