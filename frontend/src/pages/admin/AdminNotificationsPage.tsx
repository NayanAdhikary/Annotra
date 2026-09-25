import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';

export const AdminNotificationsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info');
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);

  const refresh = () => adminApi.listNotifications().then(setItems);
  useEffect(() => { refresh(); }, []);

  const publish = async () => {
    if (!title.trim() || !message.trim()) return;
    setBusy(true);
    try {
      await adminApi.createNotification({
        title: title.trim(), message: message.trim(),
        severity, expires_in_hours: hours,
      });
      setTitle(''); setMessage('');
      refresh();
    } finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this announcement?')) return;
    await adminApi.deleteNotification(id);
    refresh();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Announcements</h2>
        <p className="text-sm text-slate-500 mt-1">
          Broadcast a banner to every user. Use for outages, releases, policy changes.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)}
               placeholder="Title (e.g. Scheduled maintenance Saturday 02:00 UTC)"
               className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Details…" rows={3}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        <div className="flex gap-3">
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}
                  className="border border-slate-300 rounded px-3 py-2 text-sm">
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))}
                 className="border border-slate-300 rounded px-3 py-2 text-sm w-32"
                 placeholder="Hours" />
          <span className="text-xs text-slate-500 self-center">hours until auto-expire</span>
          <button onClick={publish} disabled={busy}
                  className="ml-auto px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {items.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">No active announcements.</div>
        )}
        {items.map((n) => (
          <div key={n.id} className="p-4 flex items-start gap-3">
            <span className={`mt-1 w-2 h-2 rounded-full ${
              n.severity === 'critical' ? 'bg-red-500'
              : n.severity === 'warning' ? 'bg-amber-500'
              : 'bg-sky-500'
            }`} />
            <div className="flex-1">
              <div className="font-medium text-slate-900">{n.title}</div>
              <div className="text-sm text-slate-600 mt-0.5">{n.message}</div>
              <div className="text-xs text-slate-400 mt-1">
                by {n.created_by_email} · {new Date(n.created_at).toLocaleString()}
                {n.expires_at && ` · expires ${new Date(n.expires_at).toLocaleString()}`}
              </div>
            </div>
            <button onClick={() => remove(n.id)} className="text-xs text-red-600 hover:underline">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
