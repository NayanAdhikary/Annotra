import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ImageUploader } from '../components/Upload/ImageUploader';
import { ImageGrid } from '../components/Upload/ImageGrid';
import { VideoUploader } from '../components/Video/VideoUploader';
import { LabelManager } from '../components/LabelManager/LabelManager';
import { LabelEditor } from '../components/TaskSetup/LabelEditor';
import { taskApi, type Task } from '../api/project';
import { tasksApi } from '../api/tasks';
import { imagesApi, type ImageAsset } from '../api/images';
import { labelsApi } from '../api/labels';
import { api } from '../api/client';
import { useAnnotationStore } from '../store/annotationStore';
import type { Label } from '../types/annotation';
import { ExportDrawer } from '../components/Export/ExportDrawer';
import { ImportDrawer } from '../components/Export/ImportDrawer';
import { PredictDialog } from '../components/ML/PredictDialog';
import { InferenceHistory } from '../components/ML/InferenceHistory';
import { useAuthStore } from '../store/authStore';
import { useToast } from "../components/Toast/ToastProvider";

export const TaskSetupPage: React.FC = () => {
    const toast = useToast();
    const { taskId } = useParams<{ taskId: string }>();
    const id = parseInt(taskId || '0', 10);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [task, setTask] = useState<Task | null>(null);
    const [images, setImages] = useState<ImageAsset[]>([]);
    const [labels, setLabels] = useState<Label[]>([]);
    const [isLabelManagerOpen, setIsLabelManagerOpen] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showPredict, setShowPredict] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const user = useAuthStore((s) => s.user);
    const canPredict = user && ['admin', 'manager'].includes(user.role);
    
    const setTask_ = useAnnotationStore(s => s.setTask);
    const setLabels_ = useAnnotationStore(s => s.setLabels);

    const [videos, setVideos] = useState<any[]>([]);

    const loadData = async () => {
        try {
            const [t, lbls] = await Promise.all([
                taskApi.get(id),
                labelsApi.list(id),
            ]);
            setTask(t);
            setLabels(lbls);
            setTask_(id);
            setLabels_(lbls);

            if (t.task_type === 'video') {
                const { data } = await api.get(`/api/tasks/${id}/videos`);
                setVideos(data);
            } else {
                const imgs = await imagesApi.list(id);
                setImages(imgs);
            }
        } catch (e: any) {
            toast.push('error', e.userMessage ?? 'Something went wrong');
            setError(e.message || 'Failed to load task');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (id > 0) {
            loadData();
        }
    }, [id]);

    // Poll videos if extraction is running/pending
    useEffect(() => {
        if (task?.task_type !== 'video') return;
        const needsPolling = videos.some(v => ['pending', 'running'].includes(v.extraction_status));
        if (!needsPolling) return;
        const timer = setInterval(() => {
            api.get(`/api/tasks/${id}/videos`).then(res => setVideos(res.data)).catch(console.error);
        }, 2000);
        return () => clearInterval(timer);
    }, [task, videos, id]);

    const canAnnotate = task?.task_type === 'video' 
        ? videos.some(v => v.extraction_status === 'done') && labels.length > 0
        : images.length > 0 && labels.length > 0;

    const handleDeleteTask = async () => {
        if (!window.confirm("Are you sure you want to delete this task? All annotations will be lost.")) return;
        try {
            await tasksApi.remove(id);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            navigate(`/projects/${task?.project_id}`);
        } catch (e) {
            toast.push('error', e.userMessage ?? 'Something went wrong');
            toast.push('error', e.userMessage ?? 'Something went wrong');
        }
    };

    if (isLoading) {
        return <div className="max-w-6xl mx-auto p-8 pb-20 text-center text-slate-500">Loading task...</div>;
    }

    if (error || !task) {
        return <div className="max-w-6xl mx-auto p-8 pb-20 text-center text-red-500">{error || 'Task not found.'}</div>;
    }

    return (
        <div className="max-w-6xl mx-auto p-8 pb-20">
            <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-6">
                <div>
                    <Link to={task ? `/projects/${task.project_id}` : '/'} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-2 inline-block">
                        ← Back to Project
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900">Task Setup: {task?.name || '...'}</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        {canPredict && task?.task_type === 'image' && (
                          <button onClick={() => setShowPredict(true)}
                                  className="px-3 py-1.5 text-sm border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50">
                            🧠 Predict
                          </button>
                        )}
                        <button onClick={() => setShowImport(true)}
                                className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
                            Import dataset
                        </button>
                        <button onClick={() => setShowExport(true)}
                                className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
                            Export
                        </button>
                        <Link
                          to={`/tasks/${id}/tool-setup`}
                          className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1"
                        >
                          🔧 Tool setup
                        </Link>
                        <button onClick={handleDeleteTask}
                                className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-md hover:bg-red-50">
                            Delete task
                        </button>
                    </div>
                    <button
                        disabled={!canAnnotate}
                        onClick={() => {
                            if (task?.task_type === 'video') {
                                const firstReady = videos.find(v => v.extraction_status === 'done');
                                if (firstReady) navigate(`/tasks/${id}/videos/${firstReady.id}`);
                            } else {
                                navigate(`/tasks/${id}`);
                            }
                        }}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Start annotating →
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left column: image uploader + thumbnail grid */}
                <div className="lg:col-span-2 space-y-6">
                    {task?.task_type === 'video' ? (
                        <>
                            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Upload Video</h2>
                                <VideoUploader taskId={id} onUploadComplete={loadData} />
                            </div>
                            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold text-slate-900">Videos ({videos.length})</h2>
                                </div>
                                {videos.length === 0 ? (
                                    <p className="text-slate-500 text-sm">No videos uploaded yet.</p>
                                ) : (
                                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                        {videos.map((vid: any) => (
                                            <div key={vid.id} className="flex items-center justify-between p-3 border rounded-md">
                                                <div>
                                                    <div className="font-medium">{vid.filename}</div>
                                                    <div className="text-xs text-slate-500">
                                                        Status: {vid.extraction_status} {vid.extraction_status === 'done' && `(${vid.total_frames} frames)`}
                                                    </div>
                                                </div>
                                                {vid.extraction_status === 'done' && (
                                                    <Link to={`/tasks/${id}/videos/${vid.id}`} className="text-indigo-600 hover:underline text-sm font-medium">
                                                        Open →
                                                    </Link>
                                                )}
                                                {vid.extraction_status === 'failed' && (
                                                    <span className="text-red-500 text-sm">Failed</span>
                                                )}
                                                {vid.extraction_status === 'pending' || vid.extraction_status === 'running' ? (
                                                    <span className="text-amber-600 text-sm">Processing...</span>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Upload Images</h2>
                                <ImageUploader taskId={id} onUploadComplete={loadData} />
                            </div>

                            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold text-slate-900">Images ({images.length})</h2>
                                </div>
                                {images.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-slate-200 rounded-lg text-center bg-slate-50">
                                        <div className="text-4xl mb-3 text-slate-300">🖼️</div>
                                        <h3 className="text-base font-medium text-slate-900 mb-1">No images yet</h3>
                                        <p className="text-slate-500 text-sm">Use the uploader above to add images.</p>
                                    </div>
                                ) : (
                                    <ImageGrid 
                                      images={images} 
                                      onOpen={() => navigate(`/tasks/${id}`)}
                                      onDelete={async (img) => {
                                        if (confirm('Are you sure you want to delete this image?')) {
                                          await imagesApi.delete(id!, img.id);
                                          loadData();
                                        }
                                      }}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Right column: labels list */}
                <div className="space-y-6">
                    <LabelEditor taskId={id} />
                    {task?.task_type === 'image' && <InferenceHistory taskId={id} />}
                </div>
            </div>

            {isLabelManagerOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => { setIsLabelManagerOpen(false); loadData(); }}></div>
                    <div className="relative w-[400px] bg-white h-full shadow-2xl overflow-y-auto">
                        <LabelManager onClose={() => { setIsLabelManagerOpen(false); loadData(); }} />
                    </div>
                </div>
            )}

            {showExport && <ExportDrawer taskId={id} taskType={task?.task_type || 'image'} onClose={() => setShowExport(false)} />}
            {showImport && (
              <ImportDrawer
                taskId={id}
                onClose={() => setShowImport(false)}
                onDone={() => {
                  // Refresh image list
                  imagesApi.list(id).then(setImages).catch(console.error);
                }}
              />
            )}
            {showPredict && (
              <PredictDialog
                taskId={id}
                onClose={() => setShowPredict(false)}
                onDone={() => { imagesApi.list(id).then(setImages); }}
              />
            )}
        </div>
    );
};
