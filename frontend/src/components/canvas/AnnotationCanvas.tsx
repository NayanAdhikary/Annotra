import React, { useCallback, useEffect, useLayoutEffect, useRef, useMemo, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle as KonvaCircle } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import { useAnnotationStore } from '../../store/annotationStore';
import { useViewportStore } from '../../store/viewportStore';
import { useDrawing } from '../../hooks/useDrawing';
import { useMarquee } from '../../hooks/useMarquee';
import { usePan } from '../../hooks/usePan';
import { useZoom } from '../../hooks/useZoom';
import { useFitToScreen } from '../../hooks/useFitToScreen';
import { BrushOverlay } from '../../commands/BrushOverlay';
import { useBrush } from '../../hooks/useBrush';
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
import { snapPoint } from '../../lib/snap';
import { useToolConfig } from '../../store/toolConfigStore';
import { ToolTip } from './ToolTip';
import { useRecentLabels } from '../../store/recentLabelsStore';

interface Props {
  taskId: number;
  imageId: number | null;
  imageUrl: string;
  width: number;
  height: number;
}

export const AnnotationCanvas: React.FC<Props> = ({ taskId, imageId, imageUrl, width, height }) => {
  const [img] = useImage(imageUrl);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});

  const {
    annotations, labels, selectedIds, currentTool, activeLabelId, frame,
    attachServerId, selectOne, toggleSelect, setTool, taskStatus
  } = useAnnotationStore();
  const config = useToolConfig((s) => s.config);

  const labelById = useMemo(
    () => new Map(labels.map((l) => [l.id, l])),
    [labels],
  );
  
  const readOnly = taskStatus === 'completed' || taskStatus === 'archived';

  const live = useViewportStore((s) => s.live);
  const containerW = useViewportStore((s) => s.containerW);
  const containerH = useViewportStore((s) => s.containerH);
  const setContainer = useViewportStore((s) => s.setContainer);
  const setImageSize = useViewportStore((s) => s.setImageSize);
  const loadTask = useViewportStore((s) => s.loadTask);
  const commitTask = useViewportStore((s) => s.commitTask);
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);

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

  const brush = useBrush(width, height, activeLabelId);

  useEffect(() => {
    if (currentTool === 'brush') brush.setMode('brush');
    else if (currentTool === 'eraser') brush.setMode('eraser');
    else if (brush.isDirty()) brush.endPaint();
  }, [currentTool, brush]);

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
    if (!pos) return [0, 0];
    if (!config) return [pos.x, pos.y];

    return snapPoint(pos.x, pos.y, {
      snapToGrid: config.snap_to_grid,
      snapToVertex: config.snap_to_vertex,
      gridSize: config.grid_size,
      annotations: useAnnotationStore.getState().annotations,
      currentId: useAnnotationStore.getState().primaryId,
      scale: live.scale,
    });
  }, [config, live.scale]);

  const execute = useHistoryStore((s) => s.execute);

  const commitShape = useCallback(
    async (shapeType: Annotation['shapeType'], points: number[]) => {
      if (!activeLabelId || !imageId) {
        console.warn('[draw] bailing - missing activeLabelId or imageId', { activeLabelId, imageId });
        return;
      }
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const draft: Annotation = {
        id: localId, taskId, imageId, frame,
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
            image_id: imageId,
          }),
        );
        attachServerId(localId, server.id);
      } catch (e: any) {
        console.error('persist failed', e);
        // Rollback via history store (and pop future so it can't be redone)
        useHistoryStore.getState().undo();
        useHistoryStore.setState({ future: [] });
        alert(e?.response?.data?.detail ?? "Couldn't save. Please retry.");
      }
    },
    [taskId, imageId, frame, activeLabelId, execute, attachServerId, wrap],
  );

  const onMouseDown = useCallback((e: any) => {
    if (readOnly) return;
    if (pan.onMouseDown(e)) return;
    const onStage = e.target === e.target.getStage();
    const [x, y] = relativePointer();
    if (currentTool === 'brush' || currentTool === 'eraser') {
      brush.startPaint(x, y);
      return;
    }
    if (currentTool === 'select') {
      if (onStage) {
        if (e.evt.shiftKey) {
          marquee.begin(x, y, true);
        } else {
          pan.startProgrammatic(e);
        }
        return;
      }
    }
    if (currentTool === 'rectangle') drawing.beginAt('rectangle', x, y);
  }, [pan, currentTool, marquee, drawing, relativePointer, brush]);

  const onMouseMove = useCallback(() => {
    if (pan.onMouseMove()) return;
    const [x, y] = relativePointer();
    setCursorPos([x, y]);
    if (currentTool === 'brush' || currentTool === 'eraser') {
      brush.movePaint(x, y);
      return;
    }
    if (currentTool === 'select') marquee.move(x, y);
    drawing.moveTo(x, y);
  }, [pan, currentTool, marquee, drawing, relativePointer, brush]);

  const onMouseUp = useCallback(() => {
    if (pan.onMouseUp()) return;
    if (currentTool === 'brush' || currentTool === 'eraser') {
      brush.endPaint();
      return;
    }
    if (currentTool === 'select') { marquee.end(false); return; }
    if (currentTool === 'rectangle' && drawing.draft.kind === 'rectangle') {
      const [x1, y1] = drawing.draft.start;
      const [x2, y2] = drawing.draft.current;
      if (Math.abs(x2 - x1) > 3 && Math.abs(y2 - y1) > 3) {
        commitShape('rectangle', [x1, y1, x2, y2]);
      }
      drawing.cancel();
    }
  }, [pan, currentTool, drawing, marquee, commitShape, brush]);

  const onClick = useCallback((e: any) => {
    if (readOnly) return;
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
      if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const org = { id: 1 };
        const recentIds = useRecentLabels.getState().recentFor(org.id);
        const labels = useAnnotationStore.getState().labels;
        const recent = recentIds.map((id) => labels.find((l) => l.id === id)).filter(Boolean) as any[];
        const rest = labels.filter((l) => !recentIds.includes(l.id));
        const ordered = [...recent, ...rest];
        const label = ordered[idx];
        if (label) {
          e.preventDefault();
          useAnnotationStore.getState().setActiveLabel(label.id);
        }
        return;
      }
      if (config) {
        const key = e.key.toUpperCase();
        for (const [tool, shortcut] of Object.entries(config.shortcuts)) {
          if (shortcut.toUpperCase() === key) {
            e.preventDefault();
            setTool(tool as any);
            return;
          }
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        useAnnotationStore.getState().selectByPredicate((a) => a.frame === frame);
        return;
      }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1.25); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(1 / 1.25); }
      else if (e.key === '0') { e.preventDefault(); fit(); }
      else if (e.key === '1') { e.preventDefault(); zoomTo(1); }
      else if (e.key === '[') {
        e.preventDefault();
        const cfg = useToolConfig.getState().config;
        if (cfg) {
          const current = useAnnotationStore.getState().brushSize;
          useAnnotationStore.getState().setBrushSize(Math.max(cfg.brush_size_min, current - 5));
        }
      }
      else if (e.key === ']') {
        e.preventDefault();
        const cfg = useToolConfig.getState().config;
        if (cfg) {
          const current = useAnnotationStore.getState().brushSize;
          useAnnotationStore.getState().setBrushSize(Math.min(cfg.brush_size_max, current + 5));
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawing, commitShape, currentTool, setTool, selectOne, frame, zoomBy, zoomTo, fit, config]);

  const visible = annotations.filter((a) => a.frame === frame);
  const primaryId = useAnnotationStore((s) => s.primaryId);
  const primary = primaryId ? annotations.find((a) => a.id === primaryId) : undefined;
  const vertexTarget = primary && (primary.shapeType === 'polygon' || primary.shapeType === 'polyline')
    ? primary : undefined;

  const s = live.scale;

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{
        cursor: pan.cursor,
        backgroundImage: config?.snap_to_grid
          ? `linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),
             linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)`
          : undefined,
        backgroundSize: config?.snap_to_grid
          ? `${config.grid_size * live.scale}px ${config.grid_size * live.scale}px`
          : undefined,
        backgroundPosition: config?.snap_to_grid ? `${live.x}px ${live.y}px` : undefined,
      }}
    >
      {readOnly && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md shadow-sm border border-yellow-200 font-medium text-sm">
          This task is {taskStatus}. Editing is disabled.
        </div>
      )}
      {config?.show_shape_count && (
        <div className="absolute top-2 left-2 bg-white/90 border border-slate-200 text-xs px-2 py-1 rounded pointer-events-none z-20">
          {visible.length} shape{visible.length === 1 ? '' : 's'}
        </div>
      )}
      {config?.show_coordinates && cursorPos && (
        <div className="absolute top-2 right-2 bg-slate-900/80 text-white text-[11px] font-mono px-2 py-1 rounded tabular-nums pointer-events-none z-20">
          {Math.round(cursorPos[0])}, {Math.round(cursorPos[1])}
        </div>
      )}
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
              label={labelById.get(a.labelId)}
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
          {['brush', 'eraser'].includes(currentTool) && cursorPos && (
            <KonvaCircle
              x={cursorPos[0]}
              y={cursorPos[1]}
              radius={brush.brushSize / 2}
              stroke="white"
              strokeWidth={1.5 / s}
              shadowColor="black"
              shadowBlur={2 / s}
              shadowOpacity={0.5}
            />
          )}
        </Layer>
      </Stage>

      {/* Brush overlay must be placed outside the Stage to leverage HTML composite,
          scaled and translated to match the canvas viewport. */}
      {['brush', 'eraser'].includes(currentTool) && (
        <div 
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            width, height,
            transform: `translate(${live.x}px, ${live.y}px) scale(${s})`,
            transformOrigin: '0 0',
          }}
        >
          <BrushOverlay
            width={width}
            height={height}
            mask={brush.getMask()}
            version={brush.version}
            color={activeLabelId ? labelById.get(activeLabelId)?.color ?? '#FF0000' : '#FF0000'}
          />
        </div>
      )}

      <div className="absolute bottom-3 right-3 z-10">
        <ZoomControls stageRef={stageRef} />
      </div>

      <div className="absolute bottom-3 left-3 z-10 text-[11px] text-slate-500 bg-white/80 backdrop-blur-sm px-2 py-1 rounded border border-slate-200 pointer-events-none">
        Scroll = zoom · Left-drag = pan · Shift+drag = marquee select · Space+drag = pan · 0 = fit · 1 = 100% · Shift+F = zoom to selection
      </div>

      <ToolTip />
    </div>
  );
};