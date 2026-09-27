import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useVideoStore } from '../store/videoStore';
import { useAnnotationStore } from '../store/annotationStore';
import { taskApi } from '../api/project';
import { labelsApi } from '../api/labels';
import { api } from '../api/client';
import { VideoPlayer } from '../components/Video/VideoPlayer';
import { TrackList } from '../components/Video/TrackList';
import { SaveIndicator } from '../components/Status/SaveIndicator';
import { UserMenu } from '../components/Layout/UserMenu';
import { tasksApi } from '../api/tasks';

interface Video {
  id: number; task_id: number; filename: string;
  duration_sec: number; fps: number; total_frames: number;
  width: number; height: number; extraction_status: string;
  extraction_error?: string;
}

export const VideoAnnotatePage: React.FC = () => {
  const { taskId, videoId } = useParams<{ taskId: string; videoId: string }>();
  const id = Number(taskId);
  const vid = Number(videoId);

  const [video, setVideo] = useState<Video | null>(null);
  const [taskName, setTaskName] = useState('');
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(true);
  const [taskStatus, setTaskStatus] = useState<string>('');

  useEffect(() => {
    tasksApi.get(id).then((t) => setTaskStatus(t.status));
  }, [id]);

  const setVideoStore = useVideoStore((s) => s.setVideo);
  const clearVideo = useVideoStore((s) => s.clear);
  const upsertTrack = useVideoStore((s) => s.upsertTrack);

  const setLabels = useAnnotationStore((s) => s.setLabels);
  const setTask = useAnnotationStore((s) => s.setTask);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [task, labels] = await Promise.all([
        taskApi.get(id),
        labelsApi.list(id),
      ]);
      if (cancelled) return;
      setTask(id);
      setTaskName(task.name);
      setLabels(labels);
    })();
    return () => { cancelled = true; };
  }, [id, setTask, setLabels]);

  // Poll extraction status
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
        // Load existing tracks
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
            {video?.extraction_status === 'running' ? 'Extracting frames…' : 'Loading video…'}
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
        <Link to={`/tasks/${id}/setup`}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md">
          Back to setup
        </Link>
      </div>
    );
  }

  if (!video) return null;

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <header className="h-12 border-b bg-white flex items-center px-3 gap-3 flex-shrink-0">
        <Link to={`/tasks/${id}/setup`} className="text-slate-500 hover:text-slate-900 text-sm">←</Link>
        <span className="text-sm text-slate-900 font-medium truncate">{taskName}</span>
        <span className="text-xs text-slate-400">·</span>
        <span className="text-xs text-slate-500 truncate">{video.filename}</span>
        <div className="ml-auto flex items-center gap-3">
          <SaveIndicator />
          {taskStatus === 'annotation' && (
            <button
              onClick={async () => {
                if (!window.confirm('Submit this task for review?')) return;
                await tasksApi.transition(id, 'review');
                setTaskStatus('review');
              }}
              className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700"
            >
              Submit for review
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

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <VideoPlayer fps={video.fps} width={video.width} height={video.height} />
        </div>
        <TrackList />
      </div>
    </div>
  );
};
