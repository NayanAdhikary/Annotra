import React, { useEffect, useState } from 'react';
import { toolConfigApi, type ToolConfig } from '../../api/toolConfig';
import { useOrgStore } from '../../store/orgStore';

const TOOLS = [
  { key: 'rectangle', label: 'Rectangle', icon: '▭' },
  { key: 'polygon',   label: 'Polygon',   icon: '⬡' },
  { key: 'polyline',  label: 'Polyline',  icon: '∿' },
  { key: 'points',    label: 'Points',    icon: '•' },
  { key: 'brush',     label: 'Brush',     icon: '🖌' },
  { key: 'eraser',    label: 'Eraser',    icon: '⌫' },
];

const Toggle: React.FC<{ label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ label, hint, value, onChange, disabled }) => (
  <label className={`flex items-center justify-between py-2 ${disabled ? 'opacity-50' : ''}`}>
    <div>
      <div className="text-sm text-slate-900">{label}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
    <button
      type="button" disabled={disabled}
      onClick={() => onChange(!value)}
      className={`w-10 h-6 rounded-full relative ${value ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
    </button>
  </label>
);

export const AdminToolSetupPage: React.FC = () => {
  const org = useOrgStore((s) => s.current);
  const canManage = useOrgStore((s) => s.canManage());
  const [cfg, setCfg] = useState<ToolConfig | null>(null);
  const [dirty, setDirty] = useState<Partial<ToolConfig>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!org) return;
    toolConfigApi.getOrg(org.id).then(setCfg);
  }, [org]);

  if (!cfg || !org) return <div className="p-8 text-slate-500">Loading…</div>;

  const value = <K extends keyof ToolConfig>(k: K): ToolConfig[K] =>
    (k in dirty ? dirty[k] : cfg[k]) as ToolConfig[K];
  const setField = <K extends keyof ToolConfig>(k: K, v: ToolConfig[K]) =>
    setDirty((d) => ({ ...d, [k]: v }));

  const enabledTools = value('enabled_tools') as string[];
  const toggleTool = (key: string) => {
    const set = new Set(enabledTools);
    set.has(key) ? set.delete(key) : set.add(key);
    setField('enabled_tools', Array.from(set));
  };

  const save = async () => {
    setBusy(true);
    try {
      const updated = await toolConfigApi.updateOrg(org.id, dirty);
      setCfg(updated);
      setDirty({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setBusy(false); }
  };

  const dirtyCount = Object.keys(dirty).length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Tool setup</h1>
        <p className="text-sm text-slate-500 mt-1">
          Control which tools your team sees and how they behave. Users can override
          these for themselves.
        </p>
      </div>

      {!canManage && (
        <div className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 px-4 py-3 rounded-lg">
          You don't have permission to change these settings.
        </div>
      )}

      <fieldset disabled={!canManage} className={!canManage ? 'opacity-60' : ''}>
        {/* Tools */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-medium text-slate-900 mb-1">Enabled tools</h2>
          <p className="text-xs text-slate-500 mb-4">
            Only the tools your team actually uses. Fewer tools = less confusion.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TOOLS.map((t) => {
              const on = enabledTools.includes(t.key);
              return (
                <button
                  key={t.key} type="button"
                  onClick={() => toggleTool(t.key)}
                  className={`text-left p-3 rounded-lg border transition ${
                    on ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{t.icon}</span>
                    <span className="text-sm font-medium text-slate-900">{t.label}</span>
                  </div>
                  <div className={`text-xs mt-1 ${on ? 'text-indigo-700' : 'text-slate-400'}`}>
                    {on ? 'Enabled' : 'Disabled'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t">
            <label className="block text-sm font-medium text-slate-900 mb-1">Default tool</label>
            <p className="text-xs text-slate-500 mb-2">Selected when a user opens the workspace.</p>
            <select
              value={value('default_tool')}
              onChange={(e) => setField('default_tool', e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              {enabledTools.map((t) => (
                <option key={t} value={t}>
                  {TOOLS.find((x) => x.key === t)?.label ?? t}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Brush */}
        {enabledTools.includes('brush') && (
          <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
            <h2 className="font-medium text-slate-900 mb-1">Brush</h2>
            <p className="text-xs text-slate-500 mb-4">
              What size the annotator's brush starts at, and the allowed range.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'brush_size_min' as const, label: 'Min (px)' },
                { key: 'brush_size_default' as const, label: 'Default (px)' },
                { key: 'brush_size_max' as const, label: 'Max (px)' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-slate-500">{f.label}</label>
                  <input
                    type="number"
                    value={value(f.key) as number}
                    onChange={(e) => setField(f.key, Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Snapping */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-medium text-slate-900 mb-1">Precision</h2>
          <p className="text-xs text-slate-500 mb-3">
            Snapping helps annotators align shapes to a grid or to each other.
          </p>
          <Toggle
            label="Snap to grid"
            hint="Vertices snap to a regular grid."
            value={value('snap_to_grid')}
            onChange={(v) => setField('snap_to_grid', v)}
          />
          {value('snap_to_grid') && (
            <div className="ml-4 pl-4 border-l-2 border-slate-200 mb-2">
              <label className="text-xs text-slate-500">Grid size (px)</label>
              <input
                type="number"
                value={value('grid_size')}
                onChange={(e) => setField('grid_size', Number(e.target.value))}
                className="ml-3 border border-slate-300 rounded px-2 py-1 text-sm w-20"
              />
            </div>
          )}
          <Toggle
            label="Snap to nearby vertices"
            hint="Snap to another shape's corner within 8px."
            value={value('snap_to_vertex')}
            onChange={(v) => setField('snap_to_vertex', v)}
          />
        </section>

        {/* Workflow */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-medium text-slate-900 mb-1">Workflow behavior</h2>
          <p className="text-xs text-slate-500 mb-3">
            What happens automatically between actions.
          </p>
          <Toggle
            label="Auto-advance after marking done"
            hint="Jump to the next image on Space."
            value={value('auto_advance_on_complete')}
            onChange={(v) => setField('auto_advance_on_complete', v)}
          />
          <Toggle
            label="Auto-select new shapes"
            hint="A shape you draw becomes selected so you can label it immediately."
            value={value('auto_select_new_shape')}
            onChange={(v) => setField('auto_select_new_shape', v)}
          />
          <Toggle
            label="Confirm bulk delete"
            hint="Ask before deleting more than one shape at once."
            value={value('confirm_bulk_delete')}
            onChange={(v) => setField('confirm_bulk_delete', v)}
          />
        </section>

        {/* Display */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-medium text-slate-900 mb-1">Display</h2>
          <p className="text-xs text-slate-500 mb-3">
            What annotators see on the canvas.
          </p>
          <Toggle
            label="Show cursor coordinates"
            hint="Displays image-pixel position in the corner."
            value={value('show_coordinates')}
            onChange={(v) => setField('show_coordinates', v)}
          />
          <Toggle
            label="Show shape count"
            hint="Displays the number of shapes on the current image."
            value={value('show_shape_count')}
            onChange={(v) => setField('show_shape_count', v)}
          />
        </section>

        {/* Shortcuts */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
          <h2 className="font-medium text-slate-900 mb-1">Keyboard shortcuts</h2>
          <p className="text-xs text-slate-500 mb-3">
            Single keys for each tool. Experienced annotators live in shortcuts.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(value('shortcuts') as Record<string, string>).map(([k, v]) => (
              <div key={k}>
                <label className="text-xs text-slate-500 capitalize">{k}</label>
                <input
                  value={v}
                  maxLength={3}
                  onChange={(e) => {
                    const next = { ...(value('shortcuts') as Record<string, string>) };
                    next[k] = e.target.value;
                    setField('shortcuts', next);
                  }}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono mt-1 text-center uppercase"
                />
              </div>
            ))}
          </div>
        </section>
      </fieldset>

      {dirtyCount > 0 && (
        <div className="fixed bottom-4 right-6 bg-slate-900 text-white rounded-lg shadow-xl px-4 py-3 flex items-center gap-4 z-50">
          <span className="text-sm">{dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'}</span>
          <button onClick={() => setDirty({})} className="text-sm text-slate-300 hover:text-white">Discard</button>
          <button
            onClick={save} disabled={busy}
            className="bg-indigo-600 hover:bg-indigo-700 text-sm px-3 py-1.5 rounded disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

      {saved && (
        <div className="fixed bottom-4 right-6 bg-emerald-600 text-white rounded-lg shadow-xl px-4 py-3 text-sm z-50">
          ✓ Settings saved
        </div>
      )}
    </div>
  );
};