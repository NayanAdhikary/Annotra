import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToolType, ShapeType } from '../types/annotation';

export type Draft =
  | { kind: 'none' }
  | { kind: 'rectangle'; start: [number, number]; current: [number, number] }
  | { kind: 'polygon' | 'polyline'; points: number[]; cursor: [number, number] | null };

const CLOSE_POLYGON_RADIUS_PX = 10;

export interface DrawingApi {
  draft: Draft;
  beginAt: (tool: ToolType, x: number, y: number) => void;
  moveTo: (x: number, y: number) => void;
  clickAt: (x: number, y: number) => CommitResult | null;
  doubleClick: () => CommitResult | null;
  finish: () => CommitResult | null;   // Enter key
  cancel: () => void;                  // Esc key
}

export interface CommitResult {
  shapeType: ShapeType;
  points: number[];
}

export function useDrawing(): DrawingApi {
  const [draft, setDraft] = useState<Draft>({ kind: 'none' });
  const draftRef = useRef<Draft>(draft);
  
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const cancel = useCallback(() => setDraft({ kind: 'none' }), []);

  const beginAt = useCallback((tool: ToolType, x: number, y: number) => {
    if (tool === 'rectangle') {
      setDraft({ kind: 'rectangle', start: [x, y], current: [x, y] });
    } else if (tool === 'polygon' || tool === 'polyline') {
      setDraft({ kind: tool, points: [x, y], cursor: [x, y] });
    } else if (tool === 'points') {
      // Points commit immediately as a 1-vertex shape
      setDraft({ kind: 'none' });
    }
  }, []);

  const moveTo = useCallback((x: number, y: number) => {
    setDraft((d) => {
      if (d.kind === 'rectangle') return { ...d, current: [x, y] };
      if (d.kind === 'polygon' || d.kind === 'polyline')
        return { ...d, cursor: [x, y] };
      return d;
    });
  }, []);

  const clickAt = useCallback((x: number, y: number): CommitResult | null => {
    const d = draftRef.current;
    if (d.kind !== 'polygon' && d.kind !== 'polyline') return null;

    // Close polygon if clicking near the first vertex
    if (d.kind === 'polygon' && d.points.length >= 6) {
      const [fx, fy] = [d.points[0], d.points[1]];
      const dist = Math.hypot(x - fx, y - fy);
      if (dist < CLOSE_POLYGON_RADIUS_PX) {
        const result: CommitResult = { shapeType: 'polygon', points: d.points };
        setDraft({ kind: 'none' });
        return result;
      }
    }
    setDraft({ ...d, points: [...d.points, x, y] });
    return null;
  }, []);

  const doubleClick = useCallback((): CommitResult | null => {
    const d = draftRef.current;
    if (d.kind === 'polygon' && d.points.length >= 6) {
      setDraft({ kind: 'none' });
      return { shapeType: 'polygon', points: d.points };
    }
    if (d.kind === 'polyline' && d.points.length >= 4) {
      setDraft({ kind: 'none' });
      return { shapeType: 'polyline', points: d.points };
    }
    return null;
  }, []);

  const finish = useCallback((): CommitResult | null => {
    const d = draftRef.current;
    if (d.kind === 'polygon' && d.points.length >= 6) {
      setDraft({ kind: 'none' });
      return { shapeType: 'polygon', points: d.points };
    }
    if (d.kind === 'polyline' && d.points.length >= 4) {
      setDraft({ kind: 'none' });
      return { shapeType: 'polyline', points: d.points };
    }
    return null;
  }, []);

  return { draft, beginAt, moveTo, clickAt, doubleClick, finish, cancel };
}