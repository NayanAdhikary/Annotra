import React, { useEffect, useRef } from 'react';
import { useAnnotationStore } from '../../store/annotationStore';
import { annotationsApi } from '../../api/annotations';
import { useSaveStatus } from '../../hooks/useSaveStatus';
import type { Annotation } from '../../types/annotation';

const ICON: Record<Annotation['shapeType'], string> = {
  rectangle: '▭',
  polygon: '⬡',
  polyline: '∿',
  points: '•',
};

export const AnnotationList: React.FC = () => {
  const {
    annotations, frame, labels, primaryId, selectedIds, selectOne, removeLocal, removeMany, taskId
  } = useAnnotationStore();
  const wrap = useSaveStatus();

  const visible = annotations.filter((a) => a.frame === frame);

  useEffect(() => { selectOne(null); }, [frame, selectOne]);

  // Auto-scroll selected row into view when primaryId changes from canvas clicks
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (primaryId && rowRefs.current[primaryId]) {
      rowRefs.current[primaryId]!.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [primaryId]);

  const handleDeleteSelection = async () => {
    const targets = annotations.filter((a) => selectedIds.includes(a.id));
    if (!targets.length) return;
    const serverIds = targets.map((a) => a.serverId).filter((x): x is number => !!x);

    removeMany(targets.map((t) => t.id));
    if (serverIds.length) {
      try {
        await wrap(() => annotationsApi.bulkDelete(taskId!, serverIds));
      } catch {
        alert('Bulk delete failed');
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

      <div className="flex-1 overflow-y-auto">
        {visible.map((a) => {
          const label = labels.find((l) => l.id === a.labelId);
          const isSel = selectedIds.includes(a.id);
          return (
            <div
              key={a.id}
              ref={(el) => { rowRefs.current[a.id] = el; }}
              onClick={() => selectOne(a.id)}
              className={`px-4 py-2 flex items-center gap-2 cursor-pointer border-l-2 ${
                isSel ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <span className="text-lg leading-none" style={{ color: label?.color ?? '#999' }}>
                {ICON[a.shapeType]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {label?.name ?? 'Unlabeled'}
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
        })}

        {visible.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">
            No annotations on this frame.
          </p>
        )}
      </div>
    </aside>
  );
};