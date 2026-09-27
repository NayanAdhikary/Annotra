import { useCallback, useRef, useState } from 'react';
import { useAnnotationStore } from '../store/annotationStore';
import { makeLocalId } from '../store/annotationStore';
import { encodeRLE } from '../lib/rle';
import type { Annotation } from '../types/annotation';

export type BrushMode = 'brush' | 'eraser';

/**
 * Manages an in-progress mask painting session.
 *
 * The user drags the brush over the canvas. We maintain a
 * Uint8Array bitmap the size of the image, mark pixels as we go,
 * and on mouseup we encode to RLE and commit as an annotation.
 *
 * During painting, we render a live canvas overlay (not per-pixel React).
 */
export function useBrush(
  imageW: number,
  imageH: number,
  labelId: number | null,
) {
  const addLocal = useAnnotationStore((s) => s.addLocal);
  const [mode, setMode] = useState<BrushMode>('brush');
  const [brushSize, setBrushSize] = useState(30);  // in image pixels
  const [painting, setPainting] = useState(false);

  // Current mask bitmap — a live working buffer
  const maskRef = useRef<Uint8Array | null>(null);
  // Track if we've modified anything this session
  const dirtyRef = useRef(false);
  // Incrementing counter forces React to re-render the canvas overlay
  const [version, setVersion] = useState(0);

  const reset = useCallback(() => {
    maskRef.current = new Uint8Array(imageW * imageH);
    dirtyRef.current = false;
    setVersion((v) => v + 1);
  }, [imageW, imageH]);

  const paintAt = useCallback((imgX: number, imgY: number) => {
    if (!maskRef.current) {
      maskRef.current = new Uint8Array(imageW * imageH);
    }
    const mask = maskRef.current;
    const r = brushSize / 2;
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(imgX - r));
    const x1 = Math.min(imageW - 1, Math.ceil(imgX + r));
    const y0 = Math.max(0, Math.floor(imgY - r));
    const y1 = Math.min(imageH - 1, Math.ceil(imgY + r));
    const target = mode === 'brush' ? 1 : 0;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - imgX;
        const dy = y - imgY;
        if (dx * dx + dy * dy <= r2) {
          mask[y * imageW + x] = target;
        }
      }
    }
    dirtyRef.current = true;
    setVersion((v) => v + 1);
  }, [brushSize, imageW, imageH, mode]);

  const startPaint = useCallback((x: number, y: number) => {
    setPainting(true);
    if (!maskRef.current) maskRef.current = new Uint8Array(imageW * imageH);
    paintAt(x, y);
  }, [imageW, imageH, paintAt]);

  const movePaint = useCallback((x: number, y: number) => {
    if (!painting) return;
    paintAt(x, y);
  }, [painting, paintAt]);

  const endPaint = useCallback(async () => {
    if (!painting) return;
    setPainting(false);
    if (!dirtyRef.current || !maskRef.current) return;
    if (labelId === null) return;

    const rle = encodeRLE(maskRef.current, imageW, imageH);
    const maskAnnotation: Annotation = {
      id: makeLocalId(),
      taskId: useAnnotationStore.getState().taskId ?? -1,
      frame: useAnnotationStore.getState().frame,
      labelId,
      shapeType: 'mask' as any,
      // We store RLE inside points as a JSON-stringified object; the backend
      // schema accepts any array but the frontend marks mask as a special case.
      points: [JSON.stringify(rle)] as any,
      occluded: false,
      source: 'manual',
      groupId: 0,
    };
    addLocal(maskAnnotation);
    // Clear the working mask so the next stroke starts fresh
    maskRef.current = new Uint8Array(imageW * imageH);
    dirtyRef.current = false;
    setVersion((v) => v + 1);
  }, [painting, labelId, imageW, imageH, addLocal]);

  const getMask = useCallback(() => maskRef.current, []);
  const isDirty = useCallback(() => dirtyRef.current, []);

  return {
    mode, setMode,
    brushSize, setBrushSize,
    painting, version,
    startPaint, movePaint, endPaint,
    reset, getMask, isDirty,
  };
}
