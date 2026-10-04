import type { Annotation } from '../types/annotation';

interface SnapContext {
  snapToGrid: boolean;
  snapToVertex: boolean;
  snapToEdge: boolean;
  gridSize: number;
  annotations: Annotation[];
  currentId: string | null;
  scale: number; // current viewport scale, so snap tolerance is in screen pixels
}

const VERTEX_TOLERANCE_SCREEN = 8;
const EDGE_TOLERANCE_SCREEN = 6;

export function snapPoint(x: number, y: number, ctx: SnapContext): [number, number] {
  const vertexTol = VERTEX_TOLERANCE_SCREEN / ctx.scale;
  const edgeTol = EDGE_TOLERANCE_SCREEN / ctx.scale;

  // 1. Vertex snap — highest priority
  if (ctx.snapToVertex) {
    let best: [number, number] | null = null;
    let bestDist = vertexTol * vertexTol;
    for (const a of ctx.annotations) {
      if (a.id === ctx.currentId) continue;
      if (a.shapeType === 'mask') continue;
      for (let i = 0; i < a.points.length; i += 2) {
        const dx = a.points[i] - x;
        const dy = a.points[i + 1] - y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          best = [a.points[i], a.points[i + 1]];
        }
      }
    }
    if (best) return best;
  }

  // 2. Edge snap — project onto nearest edge segment
  if (ctx.snapToEdge) {
    let best: [number, number] | null = null;
    let bestDist = edgeTol * edgeTol;
    for (const a of ctx.annotations) {
      if (a.id === ctx.currentId) continue;
      if (a.shapeType === 'mask' || a.shapeType === 'points') continue;
      const closed = a.shapeType === 'polygon' || a.shapeType === 'rectangle';
      const n = a.points.length / 2;
      const last = closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const j = (i + 1) % n;
        const [ax, ay] = [a.points[i * 2], a.points[i * 2 + 1]];
        const [bx, by] = [a.points[j * 2], a.points[j * 2 + 1]];
        const [px, py] = projectPointOnSegment(x, y, ax, ay, bx, by);
        const dx = px - x;
        const dy = py - y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          best = [px, py];
        }
      }
    }
    if (best) return best;
  }

  // 3. Grid snap — lowest priority
  if (ctx.snapToGrid) {
    const g = ctx.gridSize;
    return [Math.round(x / g) * g, Math.round(y / g) * g];
  }

  return [x, y];
}

function projectPointOnSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return [ax, ay];
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return [ax + t * dx, ay + t * dy];
}