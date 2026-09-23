import { useCallback, useRef, useState } from 'react';
import { useAnnotationStore } from '../store/annotationStore';
import type { Annotation } from '../types/annotation';

export interface MarqueeRect {
  x1: number; y1: number; x2: number; y2: number;
}

const bbox = (a: Annotation): MarqueeRect => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < a.points.length; i += 2) {
    xs.push(a.points[i]);
    ys.push(a.points[i + 1]);
  }
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
};

const intersects = (a: MarqueeRect, b: MarqueeRect) =>
  !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);

export function useMarquee() {
  const [rect, setRect] = useState<MarqueeRect | null>(null);
  const startRef = useRef<[number, number] | null>(null);
  const { annotations, frame, selectMany, clearSelection, toggleSelect } = useAnnotationStore();

  const begin = useCallback((x: number, y: number, additive: boolean) => {
    startRef.current = [x, y];
    setRect({ x1: x, y1: y, x2: x, y2: y });
    if (!additive) clearSelection();
  }, [clearSelection]);

  const move = useCallback((x: number, y: number) => {
    if (!startRef.current) return;
    const [sx, sy] = startRef.current;
    setRect({ x1: sx, y1: sy, x2: x, y2: y });
  }, []);

  const end = useCallback((additive: boolean) => {
    const r = rect;
    startRef.current = null;
    setRect(null);
    if (!r) return;
    const w = Math.abs(r.x2 - r.x1);
    const h = Math.abs(r.y2 - r.y1);
    if (w < 3 || h < 3) return; // treat as click, not marquee

    const norm: MarqueeRect = {
      x1: Math.min(r.x1, r.x2), y1: Math.min(r.y1, r.y2),
      x2: Math.max(r.x1, r.x2), y2: Math.max(r.y1, r.y2),
    };
    const matches = annotations
      .filter((a) => a.frame === frame && intersects(bbox(a), norm))
      .map((a) => a.id);
    selectMany(additive ? matches : matches);
  }, [rect, annotations, frame, selectMany]);

  return { rect, begin, move, end };
}
