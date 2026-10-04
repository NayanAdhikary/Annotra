import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toolConfigApi } from '../api/toolConfig';
import { taskApi, type Task } from '../api/project';
import { useAuthStore } from '../store/authStore';
import type { ToolConfig } from '../store/toolConfigStore';

const TOOLS = [
  { key: 'rectangle', label: 'Rectangle', icon: '▭', group: 'shapes' },
  { key: 'polygon',   label: 'Polygon',   icon: '⬡', group: 'shapes' },
  { key: 'polyline',  label: 'Polyline',  icon: '∿', group: 'shapes' },
  { key: 'points',    label: 'Points',    icon: '•', group: 'shapes' },
  { key: 'brush',     label: 'Brush',     icon: '🖌', group: 'draw' },
  { key: 'eraser',    label: 'Eraser',    icon: '⌫', group: 'draw' },
];

interface SectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}
const Section: React.FC<SectionProps> = ({ title, description, children }) => (
  <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
    <div className="mb-4">
      <h2 className="font-medium text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
    {children}
  </section>
);

const Toggle: React.FC<{
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}> = ({ label, hint, value, onChange }) => (
  <label className="flex items-center justify-between py-2 cursor-pointer">
    <div>
      <div className="text-sm text-slate-900">{label}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-10 h-6 rounded-full transition-colors ${
        value ? 'bg-emerald-500' : 'bg-slate-300'
      } relative`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-4' : ''
        }`}
      />
    </button>
  </label>
);

export const TaskToolSetupPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const id = Number(taskId);

  const user = useAuthStore((s) => s.user);
  const canManage = user && ['admin', 'manager'].includes(user.role);

  const [task, setTask] = useState<Task | null>(null);
  const [cfg, setCfg] = useState<ToolConfig | null>(null);
  const [dirty, setDirty] = useState<Partial<ToolConfig>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    taskApi.get(id).then(setTask);
    toolConfigApi.taskGet(id).then(setCfg);
  }, [id]);

  if (!cfg || !task) return <div className="p-8 text-slate-500">Loading…</div>;

  const toggleTool = (key: string) => {
    const enabled = new Set(cfg.enabled_tools);
    if (enabled.has(key)) enabled.delete(key);
    else enabled.add(key);
    setDirty((d) => ({ ...d, enabled_tools: Array.from(enabled) }));
  };

  const setField = <K extends keyof ToolConfig>(k: K, v: ToolConfig[K]) =>
    setDirty((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const updated = await toolConfigApi.taskUpdate(id, dirty);
      setCfg(updated);
      setDirty({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  const discard = () => setDirty({});
  const dirtyCount = Object.keys(dirty).length;
  const value = <K extends keyof ToolConfig>(k: K): ToolConfig[K] =>
    (k in dirty ? dirty[k] : cfg[k]) as ToolConfig[K];

  const isEnabled = (key: string) =>
    (value('enabled_tools') as string[]).includes(key);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-24">
      <div className="mb-6">
        <Link to={`/tasks/${id}/setup`} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-2 inline-block">
          ← Back to Task Setup
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Task Tool Setup: {task.name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Override the organization's default tool settings for this specific task.
        </p>
      </div>

      {!canManage && (
        <div className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 px-4 py-3 rounded-lg">
          You don't have permission to change these settings.
        </div>
      )}

      <fieldset disabled={!canManage} className={!canManage ? 'opacity-60' : ''}>
        {/* Enabled tools */}
        <Section
          title="Enabled tools"
          description="Tools the annotators will see in their toolbar for this task."
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TOOLS.map((t) => {
              const on = isEnabled(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleTool(t.key)}
                  className={`text-left p-3 rounded-lg border transition ${
                    on ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{t.icon}</span>
                    <span className="text-sm font-medium text-slate-900">{t.label}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {on ? 'Enabled' : 'Disabled'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t">
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Default tool
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Which tool is selected when a user opens this task.
            </p>
            <select
              value={value('default_tool')}
              onChange={(e) => setField('default_tool', e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              {(value('enabled_tools') as string[]).map((t) => (
                <option key={t} value={t}>
                  {TOOLS.find((x) => x.key === t)?.label ?? t}
                </option>
              ))}
            </select>
          </div>
        </Section>

        {/* Brush */}
        {isEnabled('brush') && (
          <Section
            title="Brush"
            description="Sizes available to the annotator. The default is what they start with."
          >
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'brush_size_min', label: 'Minimum (px)' },
                { key: 'brush_size_default', label: 'Default (px)' },
                { key: 'brush_size_max', label: 'Maximum (px)' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-slate-500">{f.label}</label>
                  <input
                    type="number"
                    value={value(f.key as any) as number}
                    onChange={(e) => setField(f.key as any, Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
                  />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Precision */}
        <Section
          title="Precision"
          description="Snapping and alignment. Useful for datasets with regular grids or shared edges."
        >
          <Toggle
            label="Snap to grid"
            hint="Vertices snap to a regular grid as you draw."
            value={value('snap_to_grid')}
            onChange={(v) => setField('snap_to_grid', v)}
          />
          {value('snap_to_grid') && (
            <div className="ml-4 pl-4 border-l border-slate-200 mb-2">
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
            hint="A vertex snaps to another shape's vertex when within 8px."
            value={value('snap_to_vertex')}
            onChange={(v) => setField('snap_to_vertex', v)}
          />
          <Toggle
            label="Snap to nearby edges"
            hint="A vertex snaps onto another shape's edge."
            value={value('snap_to_edge')}
            onChange={(v) => setField('snap_to_edge', v)}
          />
        </Section>

        {/* Workflow */}
        <Section
          title="Workflow behavior"
          description="What happens automatically between actions."
        >
          <Toggle
            label="Auto-advance after marking done"
            hint="Jump to the next image when the annotator marks the current one complete."
            value={value('auto_advance_on_complete')}
            onChange={(v) => setField('auto_advance_on_complete', v)}
          />
          <Toggle
            label="Auto-select newly drawn shapes"
            hint="The new shape becomes the selected one so you can label it immediately."
            value={value('auto_select_new_shape')}
            onChange={(v) => setField('auto_select_new_shape', v)}
          />
          <Toggle
            label="Open label picker after drawing"
            hint="Forces label assignment before moving on. Use for high-accuracy datasets."
            value={value('auto_open_label_picker')}
            onChange={(v) => setField('auto_open_label_picker', v)}
          />
          <Toggle
            label="Confirm bulk delete"
            hint="Ask before deleting more than one annotation at once."
            value={value('confirm_bulk_delete')}
            onChange={(v) => setField('confirm_bulk_delete', v)}
          />
        </Section>

        {/* Display */}
        <Section
          title="Display"
          description="What annotators see on the canvas."
        >
          <Toggle
            label="Show coordinates"
            hint="Display the cursor position in image pixels while drawing."
            value={value('show_coordinates')}
            onChange={(v) => setField('show_coordinates', v)}
          />
          <Toggle
            label="Show shape count"
            hint="Display the number of shapes on the current image."
            value={value('show_shape_count')}
            onChange={(v) => setField('show_shape_count', v)}
          />
          <Toggle
            label="Show minimap"
            hint="A small preview of the full image in the corner."
            value={value('show_minimap')}
            onChange={(v) => setField('show_minimap', v)}
          />
        </Section>

        {/* Shortcuts */}
        <Section
          title="Keyboard shortcuts"
          description="Single letters for each tool. Experienced annotators live in shortcuts."
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(value('shortcuts') as Record<string, string>).map(([k, v]) => (
              <div key={k}>
                <label className="text-xs text-slate-500 capitalize">
                  {k.replace('_', ' ')}
                </label>
                <input
                  value={v}
                  maxLength={20}
                  onChange={(e) => {
                    const next = { ...(value('shortcuts') as Record<string, string>) };
                    next[k] = e.target.value;
                    setField('shortcuts', next);
                  }}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono mt-1"
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Reset to defaults */}
        <Section
          title="Advanced"
          description="You can manage advanced settings here."
        >
        </Section>
      </fieldset>

      {/* Sticky save bar */}
      {dirtyCount > 0 && (
        <div className="fixed bottom-4 right-6 bg-slate-900 text-white rounded-lg shadow-xl px-4 py-3 flex items-center gap-4 z-50">
          <span className="text-sm">
            {dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'}
          </span>
          <button
            onClick={discard}
            className="text-sm text-slate-300 hover:text-white"
          >
            Discard
          </button>
          <button
            onClick={save}
            disabled={busy}
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