import React, { useCallback, useRef, useState } from 'react';
import { useVideoStore } from '../../store/videoStore';
import { useAnnotationStore } from '../../store/annotationStore';
import { api } from '../../api/client';

interface Props { width: number; height: number }

export const VideoDrawLayer: React.FC<Props> = ({ width, height }) => {
  const currentFrame = useVideoStore((s) => s.currentFrame);
  const tracks = useVideoStore((s) => s.tracks);
  const upsertTrack = useVideoStore((s) => s.upsertTrack);
  const currentTool = useAnnotationStore((s) => s.currentTool);
  const activeLabelId = useAnnotationStore((s) => s.activeLabelId);
  const taskId = useAnnotationStore((s) => s.taskId);

  const svgRef = useRef<SVGSVGElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);

  const pointer = useCallback((e: React.MouseEvent): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (currentTool !== 'rectangle') return;
    const [x, y] = pointer(e);
    setStart({ x, y });
    setCurrent({ x, y });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!start) return;
    const [x, y] = pointer(e);
    setCurrent({ x, y });
  };

  const onMouseUp = async () => {
    if (!start || !current || !activeLabelId || !taskId) {
      setStart(null); setCurrent(null); return;
    }
    const x1 = Math.min(start.x, current.x);
    const y1 = Math.min(start.y, current.y);
    const x2 = Math.max(start.x, current.x);
    const y2 = Math.max(start.y, current.y);

    if (x2 - x1 < 4 || y2 - y1 < 4) {
      setStart(null); setCurrent(null); return;
    }

    // Does any track already have a keyframe on this frame? Add keyframe to it.
    // Otherwise create a new track.
    const existingTrack = tracks.find((t) =>
      t.keyframes.some((k) => k.frame === currentFrame),
    );

    if (existingTrack) {
      // Add a keyframe to the existing track
      await api.post(`/api/tracks/${existingTrack.trackId}/keyframes`, {
        frame: currentFrame,
        points: [x1, y1, x2, y2],
      });
      upsertTrack({
        ...existingTrack,
        keyframes: [
          ...existingTrack.keyframes.filter((k) => k.frame !== currentFrame),
          { frame: currentFrame, points: [x1, y1, x2, y2], outside: false, occluded: false },
        ].sort((a, b) => a.frame - b.frame),
      });
    } else {
      const { data } = await api.post(`/api/tasks/${taskId}/tracks`, {
        label_id: activeLabelId,
        shape_type: 'rectangle',
        points: [x1, y1, x2, y2],
        frame: currentFrame,
      });
      upsertTrack({
        trackId: data.track_id,
        labelId: activeLabelId,
        shapeType: 'rectangle',
        keyframes: [{
          frame: currentFrame, points: [x1, y1, x2, y2],
          outside: false, occluded: false,
        }],
      });
    }

    setStart(null); setCurrent(null);
  };

  // Preview during drag
  const preview = start && current && (
    <rect
      x={Math.min(start.x, current.x)}
      y={Math.min(start.y, current.y)}
      width={Math.abs(current.x - start.x)}
      height={Math.abs(current.y - start.y)}
      stroke="#00E5FF" strokeWidth={1.5} strokeDasharray="6 4" fill="none"
    />
  );

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0"
      width={width} height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ cursor: currentTool === 'rectangle' ? 'crosshair' : 'default' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {preview}
    </svg>
  );
};