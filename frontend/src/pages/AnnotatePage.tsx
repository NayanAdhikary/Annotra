import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Toolbar } from '../components/Toolbar/Toolbar';
import { AnnotationCanvas } from '../components/Canvas/AnnotationCanvas';
import { AnnotationList } from '../components/Sidebar/AnnotationList';
import { SaveIndicator } from '../components/Status/SaveIndicator';
import { LabelManager } from '../components/LabelManager/LabelManager';
import { useAnnotationStore } from '../store/annotationStore';
import { labelsApi } from '../api/labels';
import { imagesApi, type ImageAsset } from '../api/images';
import { annotationsApi } from '../api/annotations';
import { taskApi, type Task } from '../api/project';
import { useDebouncedPersist } from '../hooks/useDebouncedPersist';
import { useBulkActions } from '../hooks/useBulkActions';
import { RectInspector } from '../components/Inspector/RectInspector';
import { UserMenu } from '../components/Layout/UserMenu';
import type { Annotation } from '../types/annotation';

export const AnnotatePage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const id = parseInt(taskId || '0', 10);

  const { setTask, setLabels, setAnnotations, setFrame, frame, taskId: storeTaskId } =
    useAnnotationStore();
    
  const [taskData, setTaskData] = useState<Task | null>(null);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLabelManager, setShowLabelManager] = useState(false);

  useDebouncedPersist();
  useBulkActions(id);

  useEffect(() => {
    if (storeTaskId === id) return;
    setTask(id);
  }, [id, storeTaskId, setTask]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [taskRes, labels, imgs, annExport] = await Promise.all([
          taskApi.get(id),
          labelsApi.list(id),
          imagesApi.list(id),
          annotationsApi.list(id),
        ]);
        if (cancelled) return;
        setTaskData(taskRes);
        setLabels(labels);
        setImages(imgs);

        // Map CVAT export shape → internal Annotation
        const mapped: Annotation[] = annExport.shapes.map((s: any, i: number) => ({
          id: `srv-loaded-${i}`,
          taskId: id,
          frame: s.frame,
          labelId: s.label_id,
          shapeType: s.type,
          points: s.points,
          occluded: !!s.occluded,
          source: s.source ?? 'manual',
          groupId: s.group ?? 0,
        }));
        setAnnotations(mapped);
      } catch (e) {
        console.error('Failed to load task', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, setLabels, setAnnotations]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-500 font-medium">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          Loading task…
        </div>
      </div>
    );
  }

  if (!images.length) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-8 text-center">
        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">This task has no images</h2>
        <p className="text-slate-500 mb-6">You need to upload images before you can start annotating.</p>
        <Link to={`/tasks/${id}/setup`} className="bg-indigo-600 text-white px-5 py-2.5 rounded-md hover:bg-indigo-700 font-medium transition-colors">
          Go to Setup
        </Link>
      </div>
    );
  }

  const { labels } = useAnnotationStore.getState();
  if (!labels.length) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-8 text-center">
        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">No labels defined</h2>
        <p className="text-slate-500 mb-6">Create at least one label to classify your annotations.</p>
        <Link to={`/tasks/${id}/setup`} className="bg-indigo-600 text-white px-5 py-2.5 rounded-md hover:bg-indigo-700 font-medium transition-colors">
          Go to Setup
        </Link>
      </div>
    );
  }

  const current = images[Math.min(frame, images.length - 1)];

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Top bar with breadcrumb arrow, task name, annotated/total count, SaveIndicator, UserMenu */}
      <header className="flex items-center justify-between h-14 border-b border-slate-200 bg-white px-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link to={`/projects/${taskData?.project_id}`} className="text-slate-400 hover:text-slate-700 transition-colors" title="Back to Project">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div className="h-6 w-px bg-slate-200"></div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900 leading-tight">{taskData?.name || `Task #${id}`}</h1>
            <p className="text-xs text-slate-500 font-medium">
              {taskData?.annotated_count ?? 0} / {taskData?.image_count ?? images.length} annotated
            </p>
          </div>
        </div>
        <Toolbar onManageLabels={() => setShowLabelManager(true)} />
        <div className="flex items-center gap-5">
          <SaveIndicator />
          <div className="h-6 w-px bg-slate-200"></div>
          <UserMenu />
        </div>
      </header>

      {/* Shortcuts bar */}
      <div className="px-4 py-1.5 text-[11px] text-slate-500 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-x-6 gap-y-1 font-medium shrink-0">
        <span><b className="text-slate-700">Shift+Click</b> multi-select</span>
        <span><b className="text-slate-700">Drag</b> marquee</span>
        <span><b className="text-slate-700">Alt+Click vertex</b> delete</span>
        <span><b className="text-slate-700">Click edge dot</b> insert vertex</span>
        <span><b className="text-slate-700">1–9</b> assign label to selection</span>
        <span><b className="text-slate-700">O</b> toggle occluded</span>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center bg-slate-100 overflow-auto p-8">
          <div className="bg-white border border-slate-300 shadow-md rounded-sm overflow-hidden flex items-center justify-center">
            <AnnotationCanvas
              imageUrl={current.url}
              width={current.width}
              height={current.height}
            />
          </div>
        </div>
        
        {/* Sidebar */}
        <aside className="w-80 border-l border-slate-200 bg-white flex flex-col overflow-hidden shrink-0 shadow-sm z-10">
          <RectInspector />
          <div className="h-px bg-slate-200 shrink-0"></div>
          <AnnotationList />
        </aside>
      </div>

      {/* Footer nav with Prev/Next and frame / total counter */}
      <footer className="border-t border-slate-200 bg-white h-14 px-4 flex items-center justify-between shrink-0 shadow-[0_-1px_2px_rgba(0,0,0,0.02)] z-10">
        <button
          onClick={() => setFrame(Math.max(0, frame - 1))}
          disabled={frame === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Prev
        </button>
        
        <div className="flex flex-col items-center">
          <span className="text-sm font-semibold text-slate-900">
            {frame + 1} <span className="text-slate-400 font-medium mx-1">/</span> {images.length}
          </span>
          <span className="text-[11px] text-slate-500 truncate max-w-[200px]" title={current.filename}>
            {current.filename}
          </span>
        </div>
        
        <button
          onClick={() => setFrame(Math.min(images.length - 1, frame + 1))}
          disabled={frame >= images.length - 1}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white transition-colors"
        >
          Next
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </footer>

      {showLabelManager && <LabelManager onClose={() => setShowLabelManager(false)} />}
    </div>
  );
};
