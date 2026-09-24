import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ImageUploader } from '../components/Upload/ImageUploader';
import { LabelManager } from '../components/LabelManager/LabelManager';
import { taskApi, Task } from '../api/project';
import { imagesApi, ImageAsset } from '../api/images';
import { labelsApi } from '../api/labels';
import { useAnnotationStore } from '../store/annotationStore';
import type { Label } from '../types/annotation';

export const TaskSetupPage: React.FC = () => {
    const { taskId } = useParams<{ taskId: string }>();
    const id = parseInt(taskId || '0', 10);
    const navigate = useNavigate();

    const [task, setTask] = useState<Task | null>(null);
    const [images, setImages] = useState<ImageAsset[]>([]);
    const [labels, setLabels] = useState<Label[]>([]);
    const [isLabelManagerOpen, setIsLabelManagerOpen] = useState(false);
    
    const setTask_ = useAnnotationStore(s => s.setTask);
    const setLabels_ = useAnnotationStore(s => s.setLabels);

    const loadData = async () => {
        try {
            const [t, imgs, lbls] = await Promise.all([
                taskApi.get(id),
                imagesApi.list(id),
                labelsApi.list(id),
            ]);
            setTask(t);
            setImages(imgs);
            setLabels(lbls);
            setTask_(id);
            setLabels_(lbls);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (id > 0) {
            loadData();
        }
    }, [id]);

    const canAnnotate = images.length > 0 && labels.length > 0;

    return (
        <div className="max-w-6xl mx-auto p-8 pb-20">
            <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-6">
                <div>
                    <Link to={task ? `/projects/${task.project_id}` : '/'} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-2 inline-block">
                        ← Back to Project
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900">Task Setup: {task?.name || '...'}</h1>
                </div>
                <button
                    disabled={!canAnnotate}
                    onClick={() => navigate(`/tasks/${id}`)}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Start annotating →
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left column: image uploader + thumbnail grid */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Upload Images</h2>
                        <ImageUploader taskId={id} onUploadComplete={loadData} />
                    </div>

                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-slate-900">Images ({images.length})</h2>
                        </div>
                        {images.length === 0 ? (
                            <p className="text-slate-500 text-sm">No images uploaded yet.</p>
                        ) : (
                            <div className="grid grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2">
                                {images.map(img => (
                                    <div key={img.id} className="relative aspect-square bg-slate-100 rounded-md overflow-hidden border border-slate-200 group">
                                        <img src={img.url} alt={img.filename} className="object-cover w-full h-full" />
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] truncate px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {img.filename}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column: labels list */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col h-full min-h-[300px]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-slate-900">Labels ({labels.length})</h2>
                            <button
                                onClick={() => setIsLabelManagerOpen(true)}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                            >
                                Manage labels
                            </button>
                        </div>

                        {labels.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-lg">
                                <p className="text-slate-500 mb-4 text-sm">You need at least one label to start annotating.</p>
                                <button
                                    onClick={() => setIsLabelManagerOpen(true)}
                                    className="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 font-medium text-sm transition-colors"
                                >
                                    Create Label
                                </button>
                            </div>
                        ) : (
                            <ul className="space-y-3 overflow-y-auto max-h-[600px] pr-2">
                                {labels.map(l => (
                                    <li key={l.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
                                        <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: l.color }}></div>
                                        <span className="font-medium text-slate-700 truncate">{l.name}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
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
        </div>
    );
};
