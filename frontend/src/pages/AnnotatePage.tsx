import React, { useEffect, useState } from 'react';
import { Toolbar } from '../components/Toolbar/Toolbar';
import { AnnotationCanvas } from '../components/Canvas/AnnotationCanvas';
import { AnnotationList } from '../components/Sidebar/AnnotationList';
import { SaveIndicator } from '../components/Status/SaveIndicator';
import { LabelManager } from '../components/LabelManager/LabelManager';
import { useAnnotationStore } from '../store/annotationStore';
import { labelsApi } from '../api/labels';
import { imagesApi, type ImageAsset } from '../api/images';
import { annotationsApi } from '../api/annotations';
import { useDebouncedPersist } from '../hooks/useDebouncedPersist';
import { useBulkActions } from '../hooks/useBulkActions';
import { RectInspector } from '../components/Inspector/RectInspector';
import { UserMenu } from '../components/Layout/UserMenu';

export const AnnotatePage: React.FC<{ taskId: number }> = ({ taskId }) => {
  const { setTask, setLabels, setAnnotations, setFrame, frame, taskId: storeTaskId } =
    useAnnotationStore();
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLabelManager, setShowLabelManager] = useState(false);

  useDebouncedPersist();
  useBulkActions(taskId);

  useEffect(() => {
    if (storeTaskId === taskId) return;
    setTask(taskId);
  }, [taskId, storeTaskId, setTask]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [labels, imgs, annExport] = await Promise.all([
          labelsApi.list(taskId),
          imagesApi.list(taskId),
          annotationsApi.list(taskId),
        ]);
        if (cancelled) return;
        setLabels(labels);
        setImages(imgs);

        // Map CVAT export shape → internal Annotation
        const mapped: Annotation[] = annExport.shapes.map((s: any, i: number) => ({
          id: `srv-loaded-${i}`,
          taskId,
          frame: s.frame,
          labelId: s.label_id,
          shapeType: s.type,
          points: s.points,
          occluded: !!s.occluded,
          source: s.source ?? 'manual',
          groupId: s.group ?? 0,
        }));
        setAnnotations(mapped);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [taskId, setLabels, setAnnotations]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;
        e.preventDefault();
        const { frameAnnotations, selectMany } = useAnnotationStore.getState();
        selectMany(frameAnnotations().map(a => a.id));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading task…</div>;
  if (!images.length) {
    return (
      <div className="p-8 text-center text-gray-500">
        No images in this task yet. Upload some to begin annotating.
      </div>
    );
  }

  const current = images[Math.min(frame, images.length - 1)];

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between border-b bg-white">
        <Toolbar onManageLabels={() => setShowLabelManager(true)} />
        <div className="flex items-center gap-4 px-4">
          <SaveIndicator />
          <UserMenu />
        </div>
      </div>

      <div className="px-3 py-1 text-[11px] text-gray-500 border-b bg-gray-50 flex gap-4">
        <span><b>Shift+Click</b> multi-select</span>
        <span><b>Drag</b> marquee</span>
        <span><b>Alt+Click vertex</b> delete</span>
        <span><b>Click edge dot</b> insert vertex</span>
        <span><b>1–9</b> assign label to selection</span>
        <span><b>O</b> toggle occluded</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex items-center justify-center bg-gray-100 overflow-auto">
          <AnnotationCanvas
            imageUrl={current.url}
            width={current.width}
            height={current.height}
          />
        </div>
        <aside className="w-72 border-l bg-white flex flex-col overflow-hidden">
          <RectInspector />
          <AnnotationList />
        </aside>
      </div>

      {/* Frame navigation */}
      <footer className="border-t bg-white px-4 py-2 flex items-center justify-between text-sm">
        <button
          onClick={() => setFrame(Math.max(0, frame - 1))}
          disabled={frame === 0}
          className="px-3 py-1 rounded border disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="text-gray-600">
          {frame + 1} / {images.length} · {current.filename}
        </span>
        <button
          onClick={() => setFrame(Math.min(images.length - 1, frame + 1))}
          disabled={frame >= images.length - 1}
          className="px-3 py-1 rounded border disabled:opacity-40"
        >
          Next →
        </button>
      </footer>

      {showLabelManager && <LabelManager onClose={() => setShowLabelManager(false)} />}
    </div>
  );
};
