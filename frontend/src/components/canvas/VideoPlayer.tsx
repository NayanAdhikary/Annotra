import React from 'react';
import { AnnotationCanvas } from './AnnotationCanvas';
import { useVideoFrames } from '../../hooks/useVideoFrames';

export const VideoPlayer: React.FC<{ taskId: number }> = ({ taskId }) => {
  const { frames, currentFrame, setCurrentFrame } = useVideoFrames(taskId);

  if (!frames.length) return <div>Loading frames...</div>;

  return (
    <div className="flex flex-col items-center">
      <AnnotationCanvas
        imageUrl={frames[currentFrame]}
        width={1280}
        height={720}
      />
      <div className="flex gap-4 mt-4">
        <button
          onClick={() => setCurrentFrame((f) => Math.max(0, f - 1))}
          disabled={currentFrame === 0}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          ← Prev
        </button>
        <span className="px-4 py-2">
          Frame {currentFrame + 1} / {frames.length}
        </span>
        <button
          onClick={() => setCurrentFrame((f) => Math.min(frames.length - 1, f + 1))}
          disabled={currentFrame === frames.length - 1}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </div>
  );
};