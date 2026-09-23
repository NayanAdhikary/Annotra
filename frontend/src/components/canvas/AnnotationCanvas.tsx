import React, { useCallback, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import { useAnnotationStore } from '../../store/annotationStore';
import { useDrawing } from '../../hooks/useDrawing';
import { useMarquee } from '../../hooks/useMarquee';
import { ShapeRenderer } from './ShapeRenderer';
import { DraftShape } from './DraftShape';
import { SelectionTransformer } from './SelectionTransformer';
import { VertexHandles } from './VertexHandles';
import { MarqueeRect } from './MarqueeRect';
import { annotationsApi } from '../../api/annotations';
import { useSaveStatus } from '../../hooks/useSaveStatus';
import type { Annotation } from '../../types/annotation';

interface Props {
  imageUrl: string;
  width: number;
  height: number;
}

export const AnnotationCanvas: React.FC<Props> = ({ imageUrl, width, height }) => {
  const [img] = useImage(imageUrl);
  const stageRef = useRef<Konva.Stage>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});

  const {
    annotations, labels, selectedIds, currentTool, activeLabelId, taskId, frame,
    addLocal, attachServerId, removeLocal, selectOne, toggleSelect,
    setTool,
  } = useAnnotationStore();
  const wrap = useSaveStatus();

  const drawing = useDrawing();
  const marquee = useMarquee();

  const pointer = useCallback((): [number, number] => {
    const pos = stageRef.current?.getPointerPosition();
    return pos ? [pos.x, pos.y] : [0, 0];
  }, []);

  // ---------- Create ----------
  const commitShape = useCallback(
    async (shapeType: Annotation['shapeType'], points: number[]) => {
      if (!taskId || activeLabelId == null) return;
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const draft: Annotation = {
        id: localId, taskId, frame,
        labelId: activeLabelId, shapeType, points,
        occluded: false, source: 'manual', groupId: 0,
      };
      addLocal(draft);
      selectOne(localId);
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
        removeLocal(localId);
      }
    },
    [taskId, frame, activeLabelId, addLocal, attachServerId, removeLocal, selectOne, wrap],
  );

  // ---------- Mouse ----------
  const onMouseDown = useCallback((e: any) => {
    const stage = e.target.getStage();
    const onEmpty = e.target === stage;
    const [x, y] = pointer();

    if (currentTool === 'select') {
      if (onEmpty) {
        marquee.begin(x, y, (e.evt as MouseEvent).shiftKey);
      }
      return;
    }
    if (currentTool === 'rectangle') drawing.beginAt('rectangle', x, y);
  }, [currentTool, drawing, marquee, pointer]);

  const onMouseMove = useCallback(() => {
    const [x, y] = pointer();
    if (currentTool === 'select') marquee.move(x, y);
    drawing.moveTo(x, y);
  }, [currentTool, drawing, marquee, pointer]);

  const onMouseUp = useCallback(() => {
    if (currentTool === 'select') {
      marquee.end(false);
      return;
    }
    if (currentTool === 'rectangle' && drawing.draft.kind === 'rectangle') {
      const [x1, y1] = drawing.draft.start;
      const [x2, y2] = drawing.draft.current;
      if (Math.abs(x2 - x1) > 3 && Math.abs(y2 - y1) > 3) {
        commitShape('rectangle', [x1, y1, x2, y2]);
      }
      drawing.cancel();
    }
  }, [currentTool, drawing, marquee, commitShape]);

  const onClick = useCallback((e: any) => {
    const [x, y] = pointer();
    if (currentTool === 'select') {
      if (e.target === e.target.getStage()) selectOne(null);
      return;
    }
    if (currentTool === 'points') { commitShape('points', [x, y]); return; }
    if (currentTool === 'polygon' || currentTool === 'polyline') {
      if (drawing.draft.kind === 'none') { drawing.beginAt(currentTool, x, y); return; }
      const r = drawing.clickAt(x, y);
      if (r) commitShape(r.shapeType, r.points);
    }
  }, [currentTool, drawing, commitShape, selectOne, pointer]);

  const onDblClick = useCallback(() => {
    const r = drawing.doubleClick();
    if (r) commitShape(r.shapeType, r.points);
  }, [drawing, commitShape]);

  // ---------- Keyboard ----------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName,
      );

      if (e.key === 'Enter') {
        const r = drawing.finish();
        if (r) commitShape(r.shapeType, r.points);
        return;
      }
      if (e.key === 'Escape') {
        drawing.cancel();
        if (currentTool !== 'select') setTool('select');
        else selectOne(null);
        return;
      }
      if (inInput) return;

      // Ctrl/Cmd+A — select all on current frame
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        useAnnotationStore.getState().selectByPredicate((a) => a.frame === frame);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawing, commitShape, currentTool, setTool, selectOne, frame]);

  const visible = annotations.filter((a) => a.frame === frame);
  const primaryId = useAnnotationStore((s) => s.primaryId);
  const primary = primaryId ? annotations.find((a) => a.id === primaryId) : undefined;

  // Which shapes get vertex handles? Only the primary, and only non-rectangles.
  const vertexTarget =
    primary && (primary.shapeType === 'polygon' || primary.shapeType === 'polyline')
      ? primary
      : undefined;

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onClick={onClick}
      onDblClick={onDblClick}
      style={{
        cursor:
          currentTool === 'select'
            ? (marquee.rect ? 'crosshair' : 'default')
            : 'crosshair',
      }}
    >
      <Layer>
        {img && <KonvaImage image={img} width={width} height={height} listening={false} />}
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

      {/* Transformer + vertex handles in their own layer so they draw on top */}
      <Layer>
        <SelectionTransformer
          stageRef={stageRef}
          nodeRefs={nodeRefs}
          enabled={currentTool === 'select'}
        />
        {currentTool === 'select' && vertexTarget && (
          <VertexHandles annotation={vertexTarget} />
        )}
      </Layer>

      {/* Draft + marquee, non-interactive */}
      <Layer listening={false}>
        <DraftShape draft={drawing.draft} />
        {marquee.rect && <MarqueeRect rect={marquee.rect} />}
      </Layer>
    </Stage>
  );
};