import React from 'react';
import { useVideoStore } from '../../store/videoStore';
import { useAnnotationStore } from '../../store/annotationStore';
import { api } from '../../api/client';

export const TrackList: React.FC = () => {
  const tracks = useVideoStore((s) => s.tracks);
  const currentFrame = useVideoStore((s) => s.currentFrame);
  const setFrame = useVideoStore((s) => s.setFrame);
  const removeTrack = useVideoStore((s) => s.removeTrack);
  const labels = useAnnotationStore((s) => s.labels);

  const deleteTrack = async (trackId: number) => {
    if (!window.confirm('Delete this track and all its keyframes?')) return;
    await api.delete(`/api/tracks/${trackId}`);
    removeTrack(trackId);
  };

  return (
    <aside className="w-72 border-l bg-white flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Tracks</h3>
        <span className="text-xs text-slate-500">{tracks.length}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">
            No tracks yet. Draw a box to create one.
          </p>
        )}

        {tracks.map((t) => {
          const label = labels.find((l) => l.id === t.labelId);
          const onKeyframe = t.keyframes.some((k) => k.frame === currentFrame);
          const inRange = t.keyframes.length > 0
            && currentFrame >= t.keyframes[0].frame
            && currentFrame <= t.keyframes[t.keyframes.length - 1].frame;

          return (
            <div
              key={t.trackId}
              className={`px-4 py-2 border-l-2 ${
                inRange ? 'border-indigo-500' : 'border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-sm font-medium truncate"
                  style={{ color: label?.color }}
                >
                  {label?.name ?? 'Unlabeled'} #{t.trackId}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const existing = t.keyframes.find(k => k.frame === currentFrame);
                      if (existing && existing.outside) return; // already outside

                      // use last known points
                      const lastPoints = t.keyframes.length > 0 ? t.keyframes[t.keyframes.length - 1].points : [];
                      
                      await api.post(`/api/tracks/${t.trackId}/keyframes`, {
                        frame: currentFrame,
                        points: existing ? existing.points : lastPoints,
                        outside: true,
                        occluded: false,
                      });
                      
                      const newKf = { frame: currentFrame, points: existing ? existing.points : lastPoints, outside: true, occluded: false };
                      useVideoStore.getState().upsertTrack({
                        ...t,
                        keyframes: [...t.keyframes.filter(k => k.frame !== currentFrame), newKf].sort((a, b) => a.frame - b.frame)
                      });
                    }}
                    title="Mark outside"
                    className="text-xs text-slate-400 hover:text-indigo-600 font-bold"
                  >
                    O
                  </button>
                  <button
                    onClick={() => deleteTrack(t.trackId)}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mt-1">
                {t.keyframes.map((k) => (
                  <button
                    key={k.frame}
                    onClick={() => setFrame(k.frame)}
                    className={`text-[10px] px-1.5 py-0.5 rounded tabular-nums ${
                      k.frame === currentFrame
                        ? 'bg-indigo-600 text-white'
                        : k.outside 
                          ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {k.frame}{k.outside ? ' (O)' : ''}
                  </button>
                ))}
                {!onKeyframe && inRange && (
                  <span className="text-[10px] text-slate-400 italic self-center">
                    interpolated
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};