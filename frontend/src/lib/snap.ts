import type { Annotation } from '../types/annotation';

const VERTEX_TOLERANCE_SCREEN = 8;

interface Ctx {
  snapToGrid: boolean;
  snapToVertex: boolean;
  gridSize: number;
  annotations: Annotation[];
  currentId: string | null;
  scale: number;
}

export function snapPoint(x: number, y: number, ctx: Ctx): [number, number] {
  const tol = VERTEX_TOLERANCE_SCREEN / ctx.scale;

  if (ctx.snapToVertex) {
    let best: [number, number] | null = null;
    let bestDist = tol * tol;
    for (const a of ctx.annotations) {
      if (a.id === ctx.currentId || a.shapeType === 'mask') continue;
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

  if (ctx.snapToGrid) {
    const g = ctx.gridSize;
    return [Math.round(x / g) * g, Math.round(y / g) * g];
  }

  return [x, y];
}