import React, { useMemo } from 'react';
import { useVideoStore } from '../../store/videoStore';
import { useAnnotationStore } from '../../store/annotationStore';
import { interpolateAt } from '../../lib/interpolate';

interface Props { width: number; height: number }

export const InterpolatedShapes: React.FC<Props> = ({ width, height }) => {
  const tracks = useVideoStore((s) => s.tracks);
  const currentFrame = useVideoStore((s) => s.currentFrame);
  const labels = useAnnotationStore((s) => s.labels);

  const drawn = useMemo(() => {
    return tracks
      .map((t) => {
        const ann = interpolateAt(
          t.trackId, t.keyframes, currentFrame,
          { labelId: t.labelId, shapeType: t.shapeType },
        );
        if (!ann) return null;
        const isKey = t.keyframes.some((k) => k.frame === currentFrame);
        return { ann, isKey };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [tracks, currentFrame]);

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width} height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {drawn.map(({ ann, isKey }) => {
        const color = labels.find((l) => l.id === ann.labelId)?.color ?? '#FF0000';
        const dash = isKey ? undefined : '6 4';

        if (ann.shapeType === 'rectangle') {
          const [x1, y1, x2, y2] = ann.points;
          return (
            <rect
              key={ann.id}
              x={Math.min(x1, x2)} y={Math.min(y1, y2)}
              width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)}
              fill="none" stroke={color} strokeWidth={2}
              strokeDasharray={dash}
            />
          );
        }

        if (ann.shapeType === 'polygon' || ann.shapeType === 'polyline') {
          const pointsStr = Array.from({ length: ann.points.length / 2 })
            .map((_, i) => `${ann.points[i * 2]},${ann.points[i * 2 + 1]}`)
            .join(' ');
          return (
            <polygon
              key={ann.id}
              points={pointsStr}
              fill="none" stroke={color} strokeWidth={2}
              strokeDasharray={dash}
            />
          );
        }

        if (ann.shapeType === 'points') {
          return (
            <g key={ann.id}>
              {Array.from({ length: ann.points.length / 2 }).map((_, i) => (
                <circle key={i} cx={ann.points[i * 2]} cy={ann.points[i * 2 + 1]}
                        r={5} fill={color} stroke="#000" />
              ))}
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
};