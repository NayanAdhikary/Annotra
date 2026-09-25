import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface Ann { id: number; title: string; message: string; severity: string }

export const AnnouncementBanner: React.FC = () => {
  const [items, setItems] = useState<Ann[]>([]);
  const [dismissed, setDismissed] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('annotra.dismissedAnn') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    api.get('/api/announcements').then((r) => setItems(r.data)).catch(() => {});
  }, []);

  const dismiss = (id: number) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem('annotra.dismissedAnn', JSON.stringify(next));
  };

  const visible = items.filter((i) => !dismissed.includes(i.id));
  if (!visible.length) return null;

  const colors = {
    info: 'bg-sky-50 border-sky-300 text-sky-900',
    warning: 'bg-amber-50 border-amber-300 text-amber-900',
    critical: 'bg-red-50 border-red-300 text-red-900',
  };

  return (
    <div className="space-y-1">
      {visible.map((n) => (
        <div key={n.id}
             className={`border-b px-4 py-2 text-sm flex items-center gap-3 ${colors[n.severity as keyof typeof colors] || colors.info}`}>
          <span className="font-medium">{n.title}</span>
          <span className="flex-1">{n.message}</span>
          <button onClick={() => dismiss(n.id)} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      ))}
    </div>
  );
};
