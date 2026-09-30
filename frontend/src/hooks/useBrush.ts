import { useCallback, useRef, useState } from 'react';
import { useAnnotationStore, makeLocalId } from '../store/annotationStore';
import { encodeRLE } from '../lib/rle';
import type { Annotation } from '../types/annotation';
import { annotationsApi } from '../api/annotations';
import { useHistoryStore } from '../store/historyStore';
import { AddAnnotationCommand } from '../commands/AnnotationCommands';

export type BrushMode = 'brush' | 'eraser';

export function useBrush(imageW: number, imageH: number, labelId: number | null) {
  const [mode, setMode] = useState<BrushMode>('brush');
  const [brushSize, setBrushSize] = useState(30);
  const [painting, setPainting] = useState(false);
  const [version, setVersion] = useState(0);

  const maskRef = useRef<Uint8Array | null>(null);
  const dirtyRef = useRef(false);

  const paintAt = useCallback((imgX: number, imgY: number) => {
    if (!maskRef.current) maskRef.current = new Uint8Array(imageW * imageH);
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
        if (dx * dx + dy * dy <= r2) mask[y * imageW + x] = target;
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
    if (!dirtyRef.current || !maskRef.current || labelId === null) return;

    const rle = encodeRLE(maskRef.current, imageW, imageH);
    const ann: Annotation = {
      id: makeLocalId(),
      taskId: useAnnotationStore.getState().taskId ?? -1,
      frame: useAnnotationStore.getState().frame,
      labelId,
      shapeType: 'mask',
      points: [JSON.stringify(rle)] as any,
      occluded: false,
      source: 'manual',
      groupId: 0,
    };
    
    useHistoryStore.getState().execute(new AddAnnotationCommand(ann));

    const taskId = useAnnotationStore.getState().taskId;
    if (taskId) {
      try {
        const server = await annotationsApi.create(taskId, {
          label_id: labelId,
          shape_type: 'mask',
          points: [JSON.stringify(rle)] as any,
          frame: useAnnotationStore.getState().frame,
        });
        useAnnotationStore.getState().attachServerId(ann.id, server.id);
      } catch (e) {
        console.error('mask persist failed', e);
        // Rollback on server failure to keep state synced
        useHistoryStore.getState().undo();
        useHistoryStore.setState({ future: [] });
      }
    }

    // Reset for the next stroke
    maskRef.current = new Uint8Array(imageW * imageH);
    dirtyRef.current = false;
    setVersion((v) => v + 1);
  }, [painting, labelId, imageW, imageH]);

  const getMask = useCallback(() => maskRef.current, []);
  const isDirty = useCallback(() => dirtyRef.current, []);

  return {
    mode, setMode,
    brushSize, setBrushSize,
    painting, version,
    startPaint, movePaint, endPaint,
    getMask, isDirty,
  };
}