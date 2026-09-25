import React, { useMemo } from 'react';
import { useVideoStore } from '../../store/videoStore';
import { useAnnotationStore } from '../../store/annotationStore';
import { interpolateAt } from '../../lib/interpolate';

interface Props { width: number; height: number }

/**
 * Renders every track's shape at the current frame. Keyframes are drawn
 * solid; interpolated shapes are drawn dashed to signal "computed, not set".
 */
export const InterpolatedShapes: React.FC<Props> = ({ width, height }) => {
  const tracks = useVideoStore((s) => s.tracks);
  const currentFrame = useVideoStore((s) => s.currentFrame);
  const labels = useAnnotationStore((s) => s.labels);

  const drawn = useMemo(() => {
    return tracks
      .map((t) => {
        const a = interpolateAt(
          t.trackId, t.keyframes, currentFrame,
          { labelId: t.labelId, shapeType: t.shapeType },
        );
        return a ? { annotation: a, keyframe: t.keyframes.some((k) => k.frame === currentFrame) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [tracks, currentFrame]);

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width} height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {drawn.map(({ annotation: a, keyframe }) => {
        const color = labels.find((l) => l.id === a.labelId)?.color ?? '#FF0000';
        const dash = keyframe ? undefined : '6 4';
        if (a.shapeType === 'rectangle') {
          const [x1, y1, x2, y2] = a.points;
          return (
            <rect
              key={a.id}
              x={Math.min(x1, x2)} y={Math.min(y1, y2)}
              width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)}
              fill="none" stroke={color} strokeWidth={2}
              strokeDasharray={dash}
            />
          );
        }
        if (a.shapeType === 'polygon' || a.shapeType === 'polyline') {
          const pts: string = [];
          for (let i = 0; i < a.points.length; i += 2) {
            (pts as any).push?.(`${a.points[i]},${a.points[i + 1]}`);
          }
          const pointsStr = Array.from({ length: a.points.length / 2 })
            .map((_, i) => `${a.points[i * 2]},${a.points[i * 2 + 1]}`)
            .join(' ');
          return (
            <polygon
              key={a.id}
              points={pointsStr}
              fill="none" stroke={color} strokeWidth={2}
              strokeDasharray={dash}
            />
          );
        }
        if (a.shapeType === 'points') {
          return (
            <g key={a.id}>
              {Array.from({ length: a.points.length / 2 }).map((_, i) => (
                <circle
                  key={i}
                  cx={a.points[i * 2]} cy={a.points[i * 2 + 1]}
                  r={5} fill={color} stroke="#000"
                />
              ))}
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
};
