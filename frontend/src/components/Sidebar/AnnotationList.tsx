import React, { useEffect, useRef, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useAnnotationStore } from '../../store/annotationStore';
import { annotationsApi } from '../../api/annotations';
import { useSaveStatus } from '../../hooks/useSaveStatus';
import type { Annotation } from '../../types/annotation';
import { useHistoryStore } from '../../store/historyStore';
import { DeleteAnnotationCommand, DeleteManyCommand } from '../../commands/AnnotationCommands';
import { ReviewBadge } from './ReviewBadge';
import { useReviewStore } from '../../store/reviewStore';

const ICON: Record<Annotation['shapeType'], string> = {
  rectangle: '▭',
  polygon: '⬡',
  polyline: '∿',
  points: '•',
  mask: '🖌',
};

export const AnnotationList: React.FC = () => {
  const {
    annotations, frame, labels, primaryId, selectedIds, selectOne, taskId
  } = useAnnotationStore();
  const wrap = useSaveStatus();
  const execute = useHistoryStore((s) => s.execute);
  const { filter, setFilter } = useReviewStore();

  const visible = annotations.filter((a) => {
    if (a.frame !== frame) return false;
    if (filter === 'all') return true;
    return (a.reviewStatus ?? 'pending') === filter;
  });

  useEffect(() => { selectOne(null); }, [frame, selectOne]);

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerHeight(entries[0].contentRect.height);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleDeleteSelection = async () => {
    const targets = annotations.filter((a) => selectedIds.includes(a.id));
    if (!targets.length) return;
    const serverIds = targets.map((a) => a.serverId).filter((x): x is number => !!x);

    execute(
      targets.length === 1
        ? new DeleteAnnotationCommand(targets[0])
        : new DeleteManyCommand(targets),
    );

    if (serverIds.length) {
      try {
        await wrap(() => annotationsApi.bulkDelete(taskId!, serverIds));
      } catch {
        // Day 12b: surface a toast. For now, pop the command.
        useHistoryStore.getState().undo();
      }
    }
  };

  // Global Backspace / Delete handler — only when an annotation is selected
  // and the user is not typing in an input field.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (selectedIds.length === 0) return;
      e.preventDefault();
      handleDeleteSelection();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, annotations, taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className="w-72 border-l bg-white flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Objects</h3>
        <span className="text-xs text-gray-500">{visible.length}</span>
      </header>

      <div className="px-3 py-2 border-b flex gap-1 text-[11px]">
        {(['all', 'pending', 'rejected', 'accepted'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 rounded capitalize ${
              filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden min-h-0">
        {visible.length > 0 ? (
          <List
            height={containerHeight || 500}
            itemCount={visible.length}
            itemSize={56}
            width="100%"
          >
            {({ index, style }) => {
              const a = visible[index];
              const label = labels.find((l) => l.id === a.labelId);
              const isSel = selectedIds.includes(a.id);
              return (
                <div
                  key={a.id}
                  style={style}
                  onClick={() => selectOne(a.id)}
                  className={`px-4 py-2 flex items-center gap-2 cursor-pointer border-l-2 ${
                    isSel ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg leading-none" style={{ color: label?.color ?? '#999' }}>
                    {ICON[a.shapeType]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      {label?.name ?? 'Unlabeled'}
                      <ReviewBadge status={a.reviewStatus} />
                      {a.source === 'auto' && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-medium ml-1">
                          ML
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      #{a.serverId ?? a.id.slice(-4)} · {a.shapeType}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!selectedIds.includes(a.id)) {
                        selectOne(a.id);
                        setTimeout(handleDeleteSelection, 0);
                      } else {
                        handleDeleteSelection();
                      }
                    }}
                    className="text-gray-400 hover:text-red-600 text-sm"
                    title="Delete (Del)"
                  >
                    ✕
                  </button>
                </div>
              );
            }}
          </List>
        ) : null}

        {visible.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">
            No annotations on this frame.
          </p>
        )}
      </div>
    </aside>
  );
};