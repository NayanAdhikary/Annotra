import React, { useEffect, useState } from 'react';
import { useAnnotationStore } from '../../store/annotationStore';
import { tasksApi } from '../../api/tasks';
import type { Comment } from '../../api/tasks';
import { AnnotationList } from './AnnotationList';
import { TaskComments } from '../Tasks/TaskComments';
import { RectInspector } from '../Inspector/RectInspector';
import { AttributePanel } from '../Inspector/AttributePannel';
import { ReviewQueuePanel } from './ReviewQueuePanel';
import { ReviewActions } from '../canvas/ReviewActions';
import { AnnotationCommentsPanel } from './AnnotationCommentsPanel';

type Tab = 'objects' | 'comments' | 'review';

export const WorkspaceSidebar: React.FC<{ taskId: number; initialTab?: Tab }> = ({ taskId, initialTab }) => {
  const [tab, setTab] = useState<Tab>(initialTab || 'objects');
  const [comments, setComments] = useState<Comment[]>([]);
  const openCount = comments.filter((c) => !c.resolved).length;

  const refresh = () => tasksApi.listComments(taskId).then(setComments);
  useEffect(() => { refresh(); }, [taskId]);

  return (
    <aside className="w-80 border-l bg-white flex flex-col overflow-hidden flex-shrink-0">
      <div className="flex border-b">
        <button
          onClick={() => setTab('objects')}
          className={`flex-1 py-2 text-sm font-medium border-b-2 ${
            tab === 'objects'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Objects ({useAnnotationStore.getState().annotations.length})
        </button>
        <button
          onClick={() => setTab('comments')}
          className={`flex-1 py-2 text-sm font-medium border-b-2 flex items-center justify-center gap-1 ${
            tab === 'comments'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Discussion
          {openCount > 0 && (
            <span className="text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5">
              {openCount}
            </span>
          )}
        </button>
        <button onClick={() => setTab('review')}
                className={`flex-1 py-2 text-sm font-medium border-b-2 ${
                  tab === 'review'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}>
          Review
        </button>
      </div>

      {tab === 'objects' && (
        <>
          <RectInspector />
          <ReviewActions taskId={taskId} onReviewed={() => {}} />
          <AttributePanel />
          <AnnotationList />
          <AnnotationCommentsPanel />
        </>
      )}
      {tab === 'comments' && (
        <TaskComments taskId={taskId} comments={comments} onChanged={refresh} compact />
      )}
      {tab === 'review' && <ReviewQueuePanel taskId={taskId} />}
    </aside>
  );
};
