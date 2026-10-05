import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import { useToast } from "../../components/Toast/ToastProvider";

export const AdminApiKeysPage: React.FC = () => {
  const toast = useToast();
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [expiresDays, setExpiresDays] = useState<number | ''>('');
  const [rawKey, setRawKey] = useState<string | null>(null);

  const refresh = () => adminApi.listApiKeys().then(setKeys).finally(() => setLoading(false)).catch(console.error);
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const r = await adminApi.createApiKey(name.trim(), expiresDays ? Number(expiresDays) : undefined);
      setRawKey(r.raw_key);
      setName('');
      setExpiresDays('');
      refresh();
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: number) => {
    if (!window.confirm('Revoke this key? Any service using it will fail immediately.')) return;
    await adminApi.revokeApiKey(id);
    refresh();
  };

  const copy = () => {
    if (rawKey) { navigator.clipboard.writeText(rawKey); toast.push('info', 'Copied'); }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">API keys</h2>
        <p className="text-sm text-slate-500 mt-1">
          Service accounts for scripts, CI, and integrations.
          Keys are shown once at creation and never again.
        </p>
      </div>

      {rawKey && (
        <div className="mb-6 bg-emerald-50 border border-emerald-300 rounded-lg p-4">
          <div className="text-sm font-medium text-emerald-900 mb-2">
            New API key created — copy it now, you won't see it again.
          </div>
          <div className="flex gap-2">
            <code className="flex-1 bg-white border border-emerald-200 rounded px-3 py-2 text-xs font-mono break-all">
              {rawKey}
            </code>
            <button onClick={copy}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700">
              Copy
            </button>
          </div>
          <button onClick={() => setRawKey(null)} className="text-xs text-emerald-700 hover:underline mt-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <div className="mb-6 bg-white border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-[1fr_180px_auto] gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)}
                 placeholder="Key name (e.g. ci-pipeline)"
                 className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <input type="number" value={expiresDays}
                 onChange={(e) => setExpiresDays(e.target.value ? Number(e.target.value) : '')}
                 placeholder="Expires in days (optional)"
                 className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <button onClick={create} disabled={creating || !name.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
            {creating ? 'Creating…' : 'Create key'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Prefix</th>
              <th className="px-4 py-2 font-medium">Last used</th>
              <th className="px-4 py-2 font-medium">Expires</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No API keys issued yet.
              </td></tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{k.name}</td>
                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{k.prefix}…</td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {new Date(k.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => revoke(k.id)}
                          className="text-xs text-red-600 hover:underline">
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};