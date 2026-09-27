import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../api/admin';

interface ConfigItem {
  key: string;
  value: any;
  category: string;
  description?: string;
  is_overridden?: boolean;
  updated_at: string;
  updated_by_email: string | null;
}

const RENDER_KIND = (value: any): 'bool' | 'number' | 'string' | 'json' => {
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  return 'json';
};

export const AdminSettingsPage: React.FC = () => {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    adminApi.getConfig().then((rows: any[]) => {
      setItems(rows.map((r) => ({ ...r, is_overridden: r.updated_by_email != null })));
    }).finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  const grouped = useMemo(() => {
    const g: Record<string, ConfigItem[]> = {};
    for (const item of items) {
      (g[item.category] ||= []).push(item);
    }
    return g;
  }, [items]);

  const dirtyKeys = Object.keys(dirty);

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.patchConfig(
        dirtyKeys.map((k) => ({ key: k, value: dirty[k] })),
      );
      setDirty({});
      refresh();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">System settings</h2>
        <p className="text-sm text-slate-500 mt-1">
          Runtime configuration. Changes apply immediately to all users.
        </p>
      </div>

      {Object.entries(grouped).map(([category, cfg]) => (
        <section key={category} className="mb-6">
          <h3 className="text-sm font-semibold uppercase text-slate-500 mb-2 tracking-wide">
            {category}
          </h3>
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {cfg.map((c) => {
              const current = c.key in dirty ? dirty[c.key] : c.value;
              const kind = RENDER_KIND(c.value);
              return (
                <div key={c.key} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 font-mono">{c.key}</div>
                      {c.description && (
                        <div className="text-xs text-slate-500 mt-0.5">{c.description}</div>
                      )}
                      {c.updated_by_email && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          Last changed by {c.updated_by_email} · {new Date(c.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="w-72 flex-shrink-0">
                      {kind === 'bool' && (
                        <button
                          onClick={() => setDirty((d) => ({ ...d, [c.key]: !current }))}
                          className={`px-3 py-1 text-xs rounded-full border ${
                            current
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'bg-slate-50 border-slate-300 text-slate-600'
                          }`}
                        >
                          {current ? 'Enabled' : 'Disabled'}
                        </button>
                      )}
                      {kind === 'number' && (
                        <input
                          type="number"
                          value={current}
                          onChange={(e) => setDirty((d) => ({ ...d, [c.key]: Number(e.target.value) }))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                        />
                      )}
                      {kind === 'string' && (
                        <input
                          type="text"
                          value={current}
                          onChange={(e) => setDirty((d) => ({ ...d, [c.key]: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm font-mono"
                        />
                      )}
                      {kind === 'json' && (
                        <textarea
                          value={JSON.stringify(current)}
                          onChange={(e) => {
                            try { setDirty((d) => ({ ...d, [c.key]: JSON.parse(e.target.value) })); }
                            catch { /* ignore invalid */ }
                          }}
                          rows={2}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {dirtyKeys.length > 0 && (
        <div className="fixed bottom-4 right-6 bg-slate-900 text-white rounded-lg shadow-xl px-4 py-3 flex items-center gap-4 z-50">
          <span className="text-sm">{dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? '' : 's'}</span>
          <button onClick={() => setDirty({})} className="text-sm text-slate-300 hover:text-white">
            Discard
          </button>
          <button onClick={save} disabled={busy}
                  className="bg-indigo-600 hover:bg-indigo-700 text-sm px-3 py-1.5 rounded disabled:opacity-50">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
};