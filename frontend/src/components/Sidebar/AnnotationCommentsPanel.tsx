import React, { useEffect, useState } from 'react';
import { reviewApi, AnnotationComment } from '../../api/review';
import { useAnnotationStore } from '../../store/annotationStore';
import { useAuthStore } from '../../store/authStore';

export const AnnotationCommentsPanel: React.FC = () => {
  const ann = useAnnotationStore((s) =>
    s.annotations.find((a) => a.id === s.primaryId)
  );
  const user = useAuthStore((s) => s.user);

  const [comments, setComments] = useState<AnnotationComment[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!ann?.serverId) { setComments([]); return; }
    setComments(await reviewApi.listComments(ann.serverId));
  };
  useEffect(() => { refresh(); }, [ann?.serverId]);

  if (!ann) return null;
  if (!ann.serverId) {
    return (
      <div className="p-4 text-xs text-slate-400 border-t">
        Save this annotation before commenting.
      </div>
    );
  }

  const post = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await reviewApi.addComment(ann.serverId!, body.trim());
      setBody('');
      await refresh();
    } finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this comment?')) return;
    await reviewApi.deleteComment(id);
    await refresh();
  };

  return (
    <div className="border-t flex flex-col" style={{ maxHeight: 260 }}>
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700">Annotation notes</span>
        <span className="text-[10px] text-slate-400">{comments.length}</span>
      </div>

      <div className="overflow-y-auto flex-1">
        {comments.length === 0 && (
          <p className="text-xs text-slate-400 px-3 py-4 text-center">
            No notes on this annotation yet.
          </p>
        )}
        <ul className="divide-y divide-slate-100">
          {comments.map((c) => (
            <li key={c.id} className="px-3 py-2 text-xs">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-slate-800">
                  {c.user_name ?? c.user_email}
                </span>
                <span className="text-slate-400">
                  {new Date(c.created_at).toLocaleTimeString([], {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                {c.user_id === user?.id && (
                  <button
                    onClick={() => remove(c.id)}
                    className="ml-auto text-slate-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-2 border-t">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') post();
          }}
          placeholder="Add a note on this annotation…"
          rows={2}
          className="w-full border border-slate-300 rounded px-2 py-1 text-xs resize-none"
        />
        <div className="flex justify-end mt-1">
          <button
            onClick={post}
            disabled={busy || !body.trim()}
            className="text-xs px-2 py-1 bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            {busy ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
};