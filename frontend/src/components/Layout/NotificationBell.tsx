import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi, NotificationItem } from '../../api/notifications';

const ICONS: Record<string, string> = {
  task_assigned: '📌',
  task_submitted_for_review: '📬',
  review_rejected: '↩',
  review_approved: '✓',
  comment_added: '💬',
  task_completed: '🎉',
};

export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  const refresh = async () => {
    const data = await notificationsApi.list(false);
    setItems(data.items);
    setUnread(data.unread);
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const click = async (n: NotificationItem) => {
    if (!n.read) {
      await notificationsApi.markRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.link) nav(n.link);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center"
        title="Notifications"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="font-medium text-slate-900">Notifications</span>
            {unread > 0 && (
              <button
                onClick={async () => {
                  await notificationsApi.markAllRead();
                  setItems((p) => p.map((x) => ({ ...x, read: true })));
                  setUnread(0);
                }}
                className="text-xs text-indigo-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-10 flex flex-col items-center justify-center bg-slate-50 rounded-b-lg">
                <div className="text-4xl mb-3 text-slate-300">🔕</div>
                <h3 className="text-sm font-medium text-slate-900 mb-1">No notifications</h3>
                <p className="text-xs text-slate-500 text-center px-4">You're all caught up! When you have new tasks or updates, they'll appear here.</p>
              </li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => click(n)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 flex gap-3 ${
                    !n.read ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  <span className="text-lg flex-shrink-0">
                    {ICONS[n.kind] ?? '•'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${!n.read ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
