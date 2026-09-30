import type { Annotation } from '../types/annotation';

interface Keyframe {
  frame: number;
  points: number[];
  outside: boolean;
  occluded: boolean;
}

export function interpolateAt(
  trackId: number,
  keyframes: Keyframe[],
  frame: number,
  meta: { labelId: number; shapeType: Annotation['shapeType'] },
): Annotation | null {
  if (keyframes.length === 0) return null;
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

  if (frame < sorted[0].frame || frame > sorted[sorted.length - 1].frame) return null;

  const exact = sorted.find((k) => k.frame === frame);
  if (exact) {
    return build(trackId, frame, meta, exact.points, exact.occluded, 'manual');
  }

  let lo: Keyframe | null = null;
  let hi: Keyframe | null = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].frame <= frame && frame <= sorted[i + 1].frame) {
      lo = sorted[i]; hi = sorted[i + 1]; break;
    }
  }
  if (!lo || !hi) return null;

  // Object marked outside — hidden
  if (lo.outside || hi.outside) return null;

  const t = (frame - lo.frame) / Math.max(1, hi.frame - lo.frame);

  // Topology change (polygon with different vertex count) — hold previous
  if (lo.points.length !== hi.points.length) {
    return build(trackId, frame, meta, lo.points, lo.occluded, 'interpolated');
  }

  const points = lo.points.map((v, i) => v + (hi!.points[i] - v) * t);
  return build(trackId, frame, meta, points, lo.occluded && hi.occluded, 'interpolated');
}

function build(
  trackId: number,
  frame: number,
  meta: { labelId: number; shapeType: Annotation['shapeType'] },
  points: number[],
  occluded: boolean,
  source: 'manual' | 'interpolated',
): Annotation {
  return {
    id: `track-${trackId}-${frame}`,
    serverId: undefined,
    taskId: -1,
    frame,
    labelId: meta.labelId,
    shapeType: meta.shapeType,
    points,
    occluded,
    source,
    groupId: 0,
  } as any;
}