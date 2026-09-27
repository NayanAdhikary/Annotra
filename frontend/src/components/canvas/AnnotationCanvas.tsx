import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import { useAnnotationStore } from '../../store/annotationStore';
import { useViewportStore } from '../../store/viewportStore';
import { useDrawing } from '../../hooks/useDrawing';
import { useMarquee } from '../../hooks/useMarquee';
import { usePan } from '../../hooks/usePan';
import { useZoom } from '../../hooks/useZoom';
import { useFitToScreen } from '../../hooks/useFitToScreen';
import { ShapeRenderer } from './ShapeRenderer';
import { DraftShape } from './DraftShape';
import { SelectionTransformer } from './SelectionTransformer';
import { VertexHandles } from './VertexHandles';
import { MarqueeRect } from './MarqueeRect';
import { ZoomControls } from '../Viewport/ZoomControls';
import { annotationsApi } from '../../api/annotations';
import { useSaveStatus } from '../../hooks/useSaveStatus';
import type { Annotation } from '../../types/annotation';
import { useHistoryStore } from '../../store/historyStore';
import { AddAnnotationCommand } from '../../commands/AnnotationCommands';

interface Props {
  taskId: number;
  imageUrl: string;
  width: number;
  height: number;
}

export const AnnotationCanvas: React.FC<Props> = ({ taskId, imageUrl, width, height }) => {
  const [img] = useImage(imageUrl);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});

  const {
    annotations, labels, selectedIds, currentTool, activeLabelId, frame,
    attachServerId, selectOne, toggleSelect, setTool,
  } = useAnnotationStore();

  const live = useViewportStore((s) => s.live);
  const containerW = useViewportStore((s) => s.containerW);
  const containerH = useViewportStore((s) => s.containerH);
  const setContainer = useViewportStore((s) => s.setContainer);
  const setImageSize = useViewportStore((s) => s.setImageSize);
  const loadTask = useViewportStore((s) => s.loadTask);
  const commitTask = useViewportStore((s) => s.commitTask);

  const wrap = useSaveStatus();
  const drawing = useDrawing();
  const marquee = useMarquee();
  const pan = usePan(stageRef, currentTool);
  const { onWheel, zoomBy, zoomTo } = useZoom(stageRef);
  const fit = useFitToScreen();

  // Load persisted viewport on task change; commit on unmount
  useEffect(() => {
    loadTask(taskId);
    return () => commitTask(taskId);
  }, [taskId, loadTask, commitTask]);

  useEffect(() => {
    if (img) setImageSize(width, height);
  }, [img, width, height, setImageSize]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainer(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);
    setContainer(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
  }, [setContainer]);

  // Auto-fit on first measure
  useEffect(() => {
    const s = useViewportStore.getState();
    if (
      s.containerW && s.containerH && s.imageW && s.imageH &&
      s.live.scale === 1 && s.live.x === 0 && s.live.y === 0
    ) {
      fit();
    }
  }, [containerW, containerH, img, fit]);

  const relativePointer = useCallback((): [number, number] => {
    const pos = stageRef.current?.getRelativePointerPosition();
    return pos ? [pos.x, pos.y] : [0, 0];
  }, []);

  const execute = useHistoryStore((s) => s.execute);

  const commitShape = useCallback(
    async (shapeType: Annotation['shapeType'], points: number[]) => {
      if (!activeLabelId) return;
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const draft: Annotation = {
        id: localId, taskId, frame,
        labelId: activeLabelId, shapeType, points,
        occluded: false, source: 'manual', groupId: 0,
      };

      // Instead of addLocal + selectOne directly:
      execute(new AddAnnotationCommand(draft));

      try {
        const server = await wrap(() =>
          annotationsApi.create(taskId, {
            label_id: activeLabelId,
            shape_type: shapeType,
            points, frame,
          }),
        );
        attachServerId(localId, server.id);
      } catch (e) {
        console.error('persist failed', e);
        // Rollback via history store (and pop future so it can't be redone)
        useHistoryStore.getState().undo();
        useHistoryStore.setState({ future: [] });
      }
    },
    [taskId, frame, activeLabelId, execute, attachServerId, wrap],
  );

  const onMouseDown = useCallback((e: any) => {
    if (pan.onMouseDown(e)) return;
    const onStage = e.target === e.target.getStage();
    const [x, y] = relativePointer();
    if (currentTool === 'select') {
      if (onStage) marquee.begin(x, y, (e.evt as MouseEvent).shiftKey);
      return;
    }
    if (currentTool === 'rectangle') drawing.beginAt('rectangle', x, y);
  }, [pan, currentTool, marquee, drawing, relativePointer]);

  const onMouseMove = useCallback(() => {
    if (pan.onMouseMove()) return;
    const [x, y] = relativePointer();
    if (currentTool === 'select') marquee.move(x, y);
    drawing.moveTo(x, y);
  }, [pan, currentTool, marquee, drawing, relativePointer]);

  const onMouseUp = useCallback(() => {
    if (pan.onMouseUp()) return;
    if (currentTool === 'select') { marquee.end(false); return; }
    if (currentTool === 'rectangle' && drawing.draft.kind === 'rectangle') {
      const [x1, y1] = drawing.draft.start;
      const [x2, y2] = drawing.draft.current;
      if (Math.abs(x2 - x1) > 3 && Math.abs(y2 - y1) > 3) {
        commitShape('rectangle', [x1, y1, x2, y2]);
      }
      drawing.cancel();
    }
  }, [pan, currentTool, drawing, marquee, commitShape]);

  const onClick = useCallback((e: any) => {
    if (pan.isPanning()) return;
    if (currentTool === 'select') {
      if (e.target === e.target.getStage()) selectOne(null);
      return;
    }
    const [x, y] = relativePointer();
    if (currentTool === 'points') { commitShape('points', [x, y]); return; }
    if (currentTool === 'polygon' || currentTool === 'polyline') {
      if (drawing.draft.kind === 'none') { drawing.beginAt(currentTool, x, y); return; }
      const r = drawing.clickAt(x, y);
      if (r) commitShape(r.shapeType, r.points);
    }
  }, [pan, currentTool, drawing, commitShape, selectOne, relativePointer]);

  const onDblClick = useCallback(() => {
    const r = drawing.doubleClick();
    if (r) commitShape(r.shapeType, r.points);
  }, [drawing, commitShape]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName,
      );
      if (e.key === 'Enter') { const r = drawing.finish(); if (r) commitShape(r.shapeType, r.points); return; }
      if (e.key === 'Escape') {
        drawing.cancel();
        if (currentTool !== 'select') setTool('select');
        else selectOne(null);
        return;
      }
      if (inInput) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        useAnnotationStore.getState().selectByPredicate((a) => a.frame === frame);
        return;
      }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1.25); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(1 / 1.25); }
      else if (e.key === '0') { e.preventDefault(); fit(); }
      else if (e.key === '1') { e.preventDefault(); zoomTo(1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawing, commitShape, currentTool, setTool, selectOne, frame, zoomBy, zoomTo, fit]);

  const visible = annotations.filter((a) => a.frame === frame);
  const primaryId = useAnnotationStore((s) => s.primaryId);
  const primary = primaryId ? annotations.find((a) => a.id === primaryId) : undefined;
  const vertexTarget = primary && (primary.shapeType === 'polygon' || primary.shapeType === 'polyline')
    ? primary : undefined;

  const s = live.scale;

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden" style={{ cursor: pan.cursor }}>
      <Stage
        ref={stageRef}
        width={containerW}
        height={containerH}
        x={live.x}
        y={live.y}
        scaleX={s}
        scaleY={s}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={onClick}
        onDblClick={onDblClick}
      >
        <Layer listening={false}>
          {img && <KonvaImage image={img} width={width} height={height} />}
        </Layer>

        <Layer>
          {visible.map((a) => (
            <ShapeRenderer
              key={a.id}
              annotation={a}
              label={labels.find((l) => l.id === a.labelId)}
              selected={selectedIds.includes(a.id)}
              nodeRefs={nodeRefs}
              onSelect={(e) => {
                e.cancelBubble = true;
                if ((e.evt as MouseEvent).shiftKey) toggleSelect(a.id);
                else selectOne(a.id);
              }}
            />
          ))}
        </Layer>

        <Layer>
          <SelectionTransformer
            stageRef={stageRef}
            nodeRefs={nodeRefs}
            enabled={currentTool === 'select' && !pan.isPanning()}
            scale={s}
          />
          {currentTool === 'select' && vertexTarget && (
            <VertexHandles annotation={vertexTarget} scale={s} />
          )}
        </Layer>

        <Layer listening={false}>
          <DraftShape draft={drawing.draft} />
        </Layer>

        <Layer listening={false}>
          {marquee.rect && <MarqueeRect rect={marquee.rect} />}
        </Layer>
      </Stage>

      <div className="absolute bottom-3 right-3 z-10">
        <ZoomControls stageRef={stageRef} />
      </div>

      <div className="absolute bottom-3 left-3 z-10 text-[11px] text-slate-500 bg-white/80 backdrop-blur-sm px-2 py-1 rounded border border-slate-200 pointer-events-none">
        Scroll = zoom · Space+drag or middle-drag = pan · 0 = fit · 1 = 100%
      </div>
    </div>
  );
};