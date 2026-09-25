import React from 'react';
import { useVideoStore } from '../../store/videoStore';
import { useAnnotationStore } from '../../store/annotationStore';

export const TrackList: React.FC = () => {
  const tracks = useVideoStore((s) => s.tracks);
  const currentFrame = useVideoStore((s) => s.currentFrame);
  const setFrame = useVideoStore((s) => s.setFrame);
  const removeTrack = useVideoStore((s) => s.removeTrack);
  const labels = useAnnotationStore((s) => s.labels);

  return (
    <aside className="w-72 border-l bg-white flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Tracks</h3>
        <span className="text-xs text-slate-500">{tracks.length}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">
            No tracks yet. Draw a shape to create one.
          </p>
        )}
        {tracks.map((t) => {
          const label = labels.find((l) => l.id === t.labelId);
          const kf = t.keyframes.some((k) => k.frame === currentFrame);
          const inRange = t.keyframes.length > 0
            && currentFrame >= t.keyframes[0].frame
            && currentFrame <= t.keyframes[t.keyframes.length - 1].frame;
          return (
            <div key={t.trackId}
                 className={`px-4 py-2 border-l-2 ${inRange ? 'border-indigo-500' : 'border-transparent'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate"
                      style={{ color: label?.color }}>
                  {label?.name ?? 'Unlabeled'} #{t.trackId}
                </span>
                <button onClick={() => removeTrack(t.trackId)}
                        className="text-xs text-slate-400 hover:text-red-600">✕</button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {t.keyframes.map((k) => (
                  <button
                    key={k.frame}
                    onClick={() => setFrame(k.frame)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      k.frame === currentFrame
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {k.frame}
                  </button>
                ))}
                {!kf && inRange && (
                  <span className="text-[10px] text-slate-400 italic">interpolated</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
