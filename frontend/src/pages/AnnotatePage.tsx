import React, { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Toolbar } from '../components/Toolbar/Toolbar';
import { HistoryControls } from '../components/Toolbar/HistoryControls';
import { AnnotationCanvas } from '../components/canvas/AnnotationCanvas';
import { WorkspaceSidebar } from '../components/Sidebar/WorkspaceSidebar';
import { SaveIndicator } from '../components/Status/SaveIndicator';
import { ConflictBanner } from '../components/Status/ConflictBanner';
import { useAnnotationStore } from '../store/annotationStore';
import { labelsApi } from '../api/labels';
import { imagesApi, type ImageAsset } from '../api/images';
import { annotationsApi } from '../api/annotations';
import { taskApi, type Task } from '../api/project';
import { useAutosaveQueue } from '../hooks/useAutosaveQueue';
import { reviewApi } from '../api/review';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { useBulkActions } from '../hooks/useBulkActions';
import { useReviewKeys } from '../hooks/useReviewKeys';
import { useReviewStore } from '../store/reviewStore';
import { ReviewProgressBar } from '../components/Status/ReviewProgressBar';
import { ReviewAdminActions } from '../components/Admin/ReviewAdminActions';
import { ImageStrip } from '../components/canvas/ImageStrip';
import { AnnotatorActions } from '../components/canvas/AnnotatorActions';
import { SubmissionDialog } from '../components/Submission/SubmissionDialog';
import { UserMenu } from '../components/Layout/UserMenu';
import type { Annotation } from '../types/annotation';
import { useHistoryKeys } from '../hooks/useHistoryKeys';
import { useHistoryStore } from '../store/historyStore';
import { tasksApi } from '../api/tasks';
import { useCopyPaste } from '../hooks/useCopyPaste';
import { useTabNavigation } from '../hooks/useTabNavigation';
import { useZoomToSelection } from '../hooks/useZoomToSelection';
import { toolConfigApi } from '../api/toolConfig';
import { useToolConfig } from '../store/toolConfigStore';
import { ToolTip } from '../components/canvas/ToolTip';

export const AnnotatePage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const id = parseInt(taskId || '0', 10);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTab = (searchParams.get('tab') as 'objects' | 'comments' | 'review') ?? 'objects';

  const { setTask, setLabels, setAnnotations, setFrame, frame, taskId: storeTaskId, setTaskStatus } =
    useAnnotationStore();
    
  const [taskData, setTaskData] = useState<Task | null>(null);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [taskStatus, setTaskStatusLocal] = useState<string>('');
  const [showSubmit, setShowSubmit] = useState(false);
  const annCount = useAnnotationStore((s) => s.annotations.length);
  const refreshKey = annCount;
  const [imageStatus, setImageStatus] = useState<string>('pending');
  const [progress, setProgress] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      setToastMsg(e.detail);
      const timer = setTimeout(() => setToastMsg(null), 5000);
      return () => clearTimeout(timer); // If new event arrives before 5s
    };
    window.addEventListener('annotra-toast', handler);
    return () => window.removeEventListener('annotra-toast', handler);
  }, []);

  const currentImageId = images.length > 0 ? images[Math.min(frame, images.length - 1)]?.id : undefined;

  useEffect(() => {
    import('../api/annotator').then(m => m.annotatorApi.progress(id).then(setProgress).catch(()=>{}));
  }, [id, refreshKey]);

  useEffect(() => {
    if (!currentImageId) return;
    import('../api/annotator').then(m => 
      m.annotatorApi.imageStatuses(id).then(statuses => {
        const s = statuses.find(x => x.image_id === currentImageId);
        setImageStatus(s?.status || 'pending');
      }).catch(()=>{})
    );
  }, [id, currentImageId, refreshKey]);

  useEffect(() => {
    tasksApi.get(id).then((t) => {
      setTaskStatusLocal(t.status);
      setTaskStatus(t.status);
    }).catch(e => console.error(e));
  }, [id, setTaskStatus]);
  
  const loadConfig = useToolConfig((s) => s.load);
  const config = useToolConfig((s) => s.config);
  useEffect(() => {
    toolConfigApi.effective(id).then((cfg) => {
      loadConfig(cfg);
      useAnnotationStore.getState().setBrushSize(cfg.brush_size_default);
    }).catch(console.error);
  }, [id, loadConfig]);
  
  const [rejectedCount, setRejectedCount] = useState(0);

  const refreshRejected = async () => {
    try {
      const queue = await reviewApi.queue(id);
      setRejectedCount(queue.stats.rejected);
    } catch (e) {
      console.error(e);
    }
  };
  useEffect(() => { refreshRejected(); }, [id]);

  const saveStatus = useAnnotationStore((s) => s.saveStatus);
  
  useUnsavedGuard(saveStatus === 'saving');
  useAutosaveQueue();
  useBulkActions(id);
  useHistoryKeys();
  useCopyPaste();
  useTabNavigation();
  useZoomToSelection();

  const setStats = useReviewStore((s) => s.setStats);
  const refreshReview = async () => {
    const q = await reviewApi.queue(id);
    setStats(q.stats, q.pending_ids, q.rejected_ids);
  };
  useReviewKeys(id, refreshReview);

  useEffect(() => { useHistoryStore.getState().clear(); }, [id]);

  useEffect(() => {
    if (storeTaskId === id) return;
    setTask(id);
  }, [id, storeTaskId, setTask]);

  const { labels } = useAnnotationStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [taskRes, labels, imgs] = await Promise.all([
          taskApi.get(id),
          labelsApi.list(id),
          imagesApi.list(id),
        ]);
        if (cancelled) return;
        setTaskData(taskRes);

        if (taskRes.task_type === 'video') {
          const { api } = await import('../api/client');
          const { data: videos } = await api.get(`/api/tasks/${id}/videos`);
          if (videos && videos.length > 0) {
            navigate(`/tasks/${id}/videos/${videos[0].id}`);
            return;
          }
        }

        setLabels(labels);
        setImages(imgs);
      } catch (e) {
        console.error('Failed to load task', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, setLabels, setImages]);

  useEffect(() => {
    if (!currentImageId) return;
    annotationsApi.listForImage(id, currentImageId).then((anns) => {
      const others = useAnnotationStore.getState().annotations.filter(
        (a) => a.imageId !== currentImageId,
      );
      useAnnotationStore.getState().setAnnotations([...others, ...anns]);
    });
  }, [id, currentImageId]);

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

  const markCurrentDone = async () => {
    if (!currentImageId) return;
    try {
      const { annotatorApi } = await import('../api/annotator');
      await annotatorApi.setImageStatus(id, currentImageId, 'completed');
      setFrame(Math.min(images.length - 1, frame + 1));
      // store will trigger refreshKey on change? wait, we didn't add it to store.
      // we can just force update:
      useAnnotationStore.getState().setAnnotations([...useAnnotationStore.getState().annotations]);
    } catch(e) {}
  };

  useEffect(() => {
    let spacePressedAt = 0;
    const h = (e: KeyboardEvent) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName,
      );
      if (inInput) return;
      if (e.code === 'Space') {
        if (!e.repeat) spacePressedAt = Date.now();
        // Don't prevent default here if we want to allow space+drag for panning, 
        // but if CVAT behavior is desired, maybe we shouldn't mark done if they held it long enough?
      }
      if (e.key.toLowerCase() === 's') { 
        e.preventDefault(); 
        window.dispatchEvent(new Event('openSkipMenu')); 
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFrame(Math.max(0, frame - 1));
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFrame(Math.min(images.length - 1, frame + 1));
      }
    };
    const keyupH = (e: KeyboardEvent) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName,
      );
      if (inInput) return;
      if (e.code === 'Space') { 
        const duration = Date.now() - spacePressedAt;
        if (duration < 250) {
          markCurrentDone();
        }
      }
    };
    window.addEventListener('keydown', h);
    window.addEventListener('keyup', keyupH);
    return () => {
      window.removeEventListener('keydown', h);
      window.removeEventListener('keyup', keyupH);
    };
  }, [currentImageId, id, frame, images.length]);

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

  if (!taskData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-4 text-slate-400">🔍</div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Task not found</h2>
        <p className="text-sm text-slate-500 mb-6">The task you're looking for doesn't exist or you don't have access to it.</p>
        <Link to="/my-tasks" className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
          Back to tasks
        </Link>
      </div>
    );
  }

  if (!images.length) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-4">🖼</div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          This task has no images
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Upload images to start annotating.
        </p>
        <Link
          to={`/projects/${taskData?.project_id}`}
          className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
        >
          Back to Project
        </Link>
      </div>
    );
  }


  const current = images[Math.min(frame, images.length - 1)];

  // Guard: if images haven't loaded yet or frame is out of sync, show a spinner
  if (!current) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-500 font-medium">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          Loading image…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {labels.length === 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900 flex items-center gap-3">
          <span>⚠ This task has no labels yet. Add at least one before drawing.</span>
          <Link
            to={`/projects/${taskData?.project_id}`}
            className="ml-auto text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
          >
            Back to Project
          </Link>
        </div>
      )}
      {taskStatus === 'review' && taskData?.last_submission_note && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
          <span className="font-medium">Annotator's note:</span> {taskData.last_submission_note.replace('[Submission note] ', '')}
        </div>
      )}
      {/* Top bar with breadcrumb arrow, task name, annotated/total count, SaveIndicator, UserMenu */}
      <header className="flex items-center justify-between h-14 border-b border-slate-200 bg-white px-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link to={`/projects/${taskData?.project_id}`} className="text-slate-400 hover:text-slate-700 transition-colors" title="Back to Project">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div className="h-6 w-px bg-slate-200"></div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900 leading-tight">{taskData?.name || `Task #${id}`}</h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
              {taskData?.annotated_count ?? 0} / {taskData?.image_count ?? images.length} annotated
              {useAnnotationStore((s) => s.selectedIds).length > 1 && (
                <span className="text-xs text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                  {useAnnotationStore.getState().selectedIds.length} selected
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <HistoryControls />
          <SaveIndicator />
          <div className="h-6 w-px bg-slate-200"></div>
          <ReviewProgressBar />
          <ReviewAdminActions taskId={id} onDone={refreshReview} />
          {taskStatus === 'annotation' && (
            <button
              onClick={() => setShowSubmit(true)}
              className={`text-xs px-3 py-1.5 rounded font-medium ${
                progress && progress.percent_complete >= 0.9
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 animate-pulse'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {progress && progress.percent_complete >= 0.9 ? '✓ Ready — Submit for review' : 'Submit for review'}
            </button>
          )}
          {taskStatus === 'review' && (
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">
              In review
            </span>
          )}
          <UserMenu />
        </div>
      </header>

      {showSubmit && (
        <SubmissionDialog
          taskId={id}
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => {
            setShowSubmit(false);
            setTaskStatus('review');
            window.location.reload();
          }}
        />
      )}

      <ConflictBanner />

      {rejectedCount > 0 && taskStatus === 'annotation' && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-900 flex items-center gap-3">
          <span>⚠ {rejectedCount} annotation{rejectedCount === 1 ? ' was' : 's were'} sent back by the reviewer.</span>
          <button
            onClick={async () => {
              if (!confirm('Resubmit this task for review?')) return;
              await tasksApi.transition(id, 'review');
              setTaskStatusLocal('review');
              useAnnotationStore.getState().setTaskStatus('review');
            }}
            className="ml-auto text-xs px-3 py-1 bg-slate-900 text-white rounded hover:bg-slate-800"
          >
            Resubmit for review
          </button>
        </div>
      )}

      {taskStatus === 'review' && taskData?.last_submission_note && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
          <span className="font-medium">Annotator's note:</span> {taskData.last_submission_note}
        </div>
      )}

      <ImageStrip taskId={id} currentIndex={frame} onJump={setFrame} refreshKey={refreshKey} />

      {/* Shortcuts bar */}
      <div className="px-4 py-1.5 text-[11px] text-slate-500 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-x-6 gap-y-1 font-medium shrink-0">
        <div>
          <b>Draw:</b>{' '}
          {config?.enabled_tools.map((t) => `${config.shortcuts[t]?.toUpperCase() || '?'} ${t}`).join(' · ')}
        </div>
        <div>
          <b>Select:</b> {config?.shortcuts['select']?.toUpperCase() || 'V'} · Shift+click multi · Tab next · Shift+Tab prev
        </div>
        <div><b>Edit:</b> Ctrl+Z undo · Ctrl+C/V copy/paste</div>
        <div><b>View:</b> Scroll zoom · Space+drag pan · 0 fit · 1 100% · Shift+F zoom to selection</div>
        <div><b>Review:</b> A accept · R reject · F fix · N next pending · <span><b>Shift+A</b> accept ML predictions on frame</span></div>
      </div>

      <Toolbar onManageLabels={() => setShowLabelManager(true)} />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 flex items-stretch justify-stretch bg-slate-100 overflow-hidden relative">
          <div className="flex-1 bg-white border border-slate-300 shadow-md relative">
            <AnnotationCanvas
              taskId={id}
              imageId={currentImageId ?? null}
              imageUrl={current.url}
              width={current.width}
              height={current.height}
            />
          </div>
        </div>
        
        {/* Sidebar */}
        <WorkspaceSidebar taskId={id} initialTab={initialTab} />
      </div>

      <ToolTip />

      {taskStatus === 'annotation' ? (
        <AnnotatorActions
          taskId={id}
          imageId={currentImageId!}
          currentStatus={imageStatus}
          onChanged={() => {
            // trigger refresh
            useAnnotationStore.getState().setAnnotations([...useAnnotationStore.getState().annotations]);
          }}
          onNext={() => setFrame(Math.min(images.length - 1, frame + 1))}
        />
      ) : (
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
      )}

      {toastMsg && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50 pointer-events-none transition-opacity">
          {toastMsg}
        </div>
      )}

    </div>
  );
};
