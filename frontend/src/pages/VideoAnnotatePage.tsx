import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useVideoStore } from '../store/videoStore';
import { useAnnotationStore } from '../store/annotationStore';
import { tasksApi } from '../api/tasks';
import { labelsApi } from '../api/labels';
import { api } from '../api/client';
import { VideoPlayer } from '../components/Video/VideoPlayer';
import { TrackList } from '../components/Video/TrackList';
import { SaveIndicator } from '../components/Status/SaveIndicator';
import { UserMenu } from '../components/Layout/UserMenu';
import { toolConfigApi } from '../api/toolConfig';
import { useToolConfig } from '../store/toolConfigStore';

interface Video {
  id: number; filename: string;
  duration_sec: number; fps: number; total_frames: number;
  width: number; height: number;
  extraction_status: string; extraction_error: string | null;
}

export const VideoAnnotatePage: React.FC = () => {
  const { taskId, videoId } = useParams<{ taskId: string; videoId: string }>();
  const id = Number(taskId);
  const vid = Number(videoId);

  const [video, setVideo] = useState<Video | null>(null);
  const [taskName, setTaskName] = useState('');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(true);

  const setVideoStore = useVideoStore((s) => s.setVideo);
  const clearVideo = useVideoStore((s) => s.clear);
  const upsertTrack = useVideoStore((s) => s.upsertTrack);
  const setLabels = useAnnotationStore((s) => s.setLabels);
  const setTask = useAnnotationStore((s) => s.setTask);

  const loadConfig = useToolConfig((s) => s.load);

  useEffect(() => {
    if (!projectId) return;
    toolConfigApi.effectiveForProject(projectId).then((cfg) => {
      loadConfig(cfg);
      useAnnotationStore.getState().setBrushSize(cfg.brush_size_default);
    }).catch(console.error);
  }, [projectId, loadConfig]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [task, labels] = await Promise.all([
        tasksApi.get(id),
        labelsApi.list(id),
      ]);
      if (cancelled) return;
      setTask(id);
      setTaskName(task.name);
      setProjectId(task.project_id);
      setLabels(labels);
    })();
    return () => { cancelled = true; };
  }, [id, setTask, setLabels]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const { data } = await api.get(`/api/videos/${vid}`);
      if (cancelled) return;
      setVideo(data);

      if (data.extraction_status === 'done') {
        setPolling(false);
        const frames = await api.get(`/api/videos/${vid}/frames`);
        setVideoStore({
          id: vid,
          frameUrls: frames.data.frame_urls,
          w: frames.data.width,
          h: frames.data.height,
        });

        const tracks = await api.get(`/api/tasks/${id}/tracks`);
        for (const t of tracks.data) upsertTrack(t);
        setLoading(false);
      } else if (data.extraction_status === 'failed') {
        setPolling(false);
        setLoading(false);
      }
    };

    tick();
    const timer = polling ? setInterval(tick, 2000) : null;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      clearVideo();
    };
  }, [vid, id, polling, setVideoStore, upsertTrack, clearVideo]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="text-3xl mb-3">🎬</div>
          <div className="text-sm">
            {video?.extraction_status === 'running' ? 'Extracting frames…' : 'Loading…'}
          </div>
          {video?.total_frames ? (
            <div className="text-xs text-slate-400 mt-1">
              {video.total_frames} frames · {video.fps.toFixed(2)} fps
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (video?.extraction_status === 'failed') {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-3">⚠</div>
        <h2 className="text-xl font-semibold mb-2">Frame extraction failed</h2>
        <p className="text-sm text-slate-500 mb-4">{video.extraction_error}</p>
        <Link to={projectId ? `/projects/${projectId}` : '/'}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md">
          Back to Project
        </Link>
      </div>
    );
  }

  if (!video) return null;

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <header className="h-12 border-b bg-white flex items-center px-3 gap-3 flex-shrink-0">
        <Link to={projectId ? `/projects/${projectId}` : '/'} className="text-slate-500 hover:text-slate-900 text-sm">←</Link>
        <span className="text-sm font-medium truncate">{taskName}</span>
        <span className="text-xs text-slate-400">·</span>
        <span className="text-xs text-slate-500 truncate">{video.filename}</span>
        <div className="ml-auto flex items-center gap-3">
          <SaveIndicator />
          <UserMenu />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <VideoPlayer fps={video.fps} width={video.width} height={video.height} />
        </div>
        <TrackList />
      </div>
    </div>
  );
};