import type { Annotation } from '../types/annotation';

interface Keyframe {
  frame: number;
  points: number[];
  outside: boolean;
  occluded: boolean;
}

/**
 * Given an array of keyframes for one track, return the annotation at a
 * given frame. If frame is outside the [first, last] keyframe range, returns
 * null (object not present).
 *
 * Rectangle & polyline: linear interpolation of each coordinate.
 * Polygon: linear interpolation IF the vertex counts match. If they don't,
 *   the polygon is held at the previous keyframe (no morphing between
 *   different topologies). This is what CVAT does.
 * Points: linear interpolation of each point.
 */
export function interpolateAt(
  trackId: number,
  keyframes: Keyframe[],
  frame: number,
  meta: { labelId: number; shapeType: Annotation['shapeType'] },
): Annotation | null {
  if (keyframes.length === 0) return null;
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

  // Before first / after last → outside
  if (frame < sorted[0].frame || frame > sorted[sorted.length - 1].frame) return null;

  // Exact keyframe hit
  const exact = sorted.find((k) => k.frame === frame);
  if (exact) {
    return {
      id: `track-${trackId}-${frame}`,
      serverId: undefined,
      taskId: -1,
      frame,
      labelId: meta.labelId,
      shapeType: meta.shapeType,
      points: exact.points,
      occluded: exact.occluded,
      source: 'manual',
      groupId: 0,
    } as Annotation;
  }

  // Find the bracketing pair
  let lo: Keyframe | null = null;
  let hi: Keyframe | null = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].frame <= frame && frame <= sorted[i + 1].frame) {
      lo = sorted[i]; hi = sorted[i + 1]; break;
    }
  }
  if (!lo || !hi) return null;

  // Outside marker — do not interpolate; object is hidden
  if (lo.outside || hi.outside) return null;

  const t = (frame - lo.frame) / Math.max(1, hi.frame - lo.frame);

  // Vertex count mismatch: hold previous keyframe (polygon topology change)
  if (lo.points.length !== hi.points.length) {
    return {
      id: `track-${trackId}-${frame}`,
      serverId: undefined,
      taskId: -1,
      frame,
      labelId: meta.labelId,
      shapeType: meta.shapeType,
      points: lo.points,
      occluded: lo.occluded,
      source: 'interpolated',
      groupId: 0,
    } as Annotation;
  }

  const points = lo.points.map((v, i) => v + (hi!.points[i] - v) * t);

  return {
    id: `track-${trackId}-${frame}`,
    serverId: undefined,
    taskId: -1,
    frame,
    labelId: meta.labelId,
    shapeType: meta.shapeType,
    points,
    occluded: lo.occluded && hi.occluded,
    source: 'interpolated',
    groupId: 0,
  } as Annotation;
}
