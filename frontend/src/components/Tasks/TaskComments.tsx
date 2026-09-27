import React, { useState } from 'react';
import { tasksApi, Comment } from '../../api/tasks';
import { useAuthStore } from '../../store/authStore';

interface Props {
  taskId: number;
  comments: Comment[];
  onChanged: () => void;
  /** Compact mode used inside the annotation workspace sidebar */
  compact?: boolean;
}

export const TaskComments: React.FC<Props> = ({ taskId, comments, onChanged, compact }) => {
  const user = useAuthStore((s) => s.user);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const visible = comments.filter((c) => showResolved || !c.resolved);
  const openCount = comments.filter((c) => !c.resolved).length;

  const post = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await tasksApi.createComment(taskId, body.trim());
      setBody('');
      onChanged();
    } finally { setBusy(false); }
  };

  const toggleResolved = async (c: Comment) => {
    await tasksApi.updateComment(c.id, { resolved: !c.resolved });
    onChanged();
  };

  const remove = async (c: Comment) => {
    if (!window.confirm('Delete this comment?')) return;
    await tasksApi.deleteComment(c.id);
    onChanged();
  };

  return (
    <div className={compact ? 'flex flex-col h-full' : ''}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-medium text-sm text-slate-900">
          Discussion {openCount > 0 && (
            <span className="text-xs text-amber-700 ml-1">({openCount} open)</span>
          )}
        </h3>
        <label className="text-xs text-slate-500 flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={showResolved}
                 onChange={(e) => setShowResolved(e.target.checked)} />
          Show resolved
        </label>
      </div>

      <div className={`overflow-y-auto ${compact ? 'flex-1' : 'max-h-96'}`}>
        {visible.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            No comments yet. Use this to flag ambiguous objects.
          </p>
        )}
        <ul className="divide-y divide-slate-100">
          {visible.map((c) => (
            <li key={c.id} className={`px-4 py-3 ${c.resolved ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-2">
                <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center flex-shrink-0">
                  {(c.user_name ?? '?').slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {c.user_name ?? c.user_email}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                    {c.frame != null && (
                      <span className="text-xs text-slate-500">· frame {c.frame}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                    {c.body}
                  </p>
                  <div className="flex gap-3 mt-1">
                    <button onClick={() => toggleResolved(c)}
                            className="text-xs text-slate-500 hover:text-slate-900">
                      {c.resolved ? 'Reopen' : 'Resolve'}
                    </button>
                    {c.user_id === user?.id && (
                      <button onClick={() => remove(c)}
                              className="text-xs text-red-500 hover:text-red-700">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t p-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') post();
          }}
          placeholder="Ask a question or flag an issue… (Ctrl+Enter to post)"
          rows={compact ? 2 : 3}
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex justify-end mt-2">
          <button onClick={post} disabled={busy || !body.trim()}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </div>
    </div>
  );
};
