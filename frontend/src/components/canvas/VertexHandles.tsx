import React, { useRef } from 'react';
import { Circle, Group } from 'react-konva';
import { useAnnotationStore } from '../../store/annotationStore';
import type { Annotation } from '../../types/annotation';
import { useHistoryStore } from '../../store/historyStore';
import { ReplacePointsCommand } from '../../commands/AnnotationCommands';

const COLOR = '#00E5FF';
const MID_COLOR = '#FFC400';

interface Props {
  annotation: Annotation;
  scale: number;
}

/**
 * Renders:
 *  - one draggable circle per vertex
 *  - one small midpoint circle per edge (click to insert a vertex)
 *  - Alt+click on a vertex deletes it (if it would leave >= min vertices)
 */
export const VertexHandles: React.FC<Props> = ({ annotation, scale }) => {
  const VERTEX_R = 5 / scale;
  const MIDPOINT_R = 3.5 / scale;
  const STROKE_W = 1 / scale;
  const replaceAnnotation = useAnnotationStore((s) => s.replaceAnnotation);
  const execute = useHistoryStore((s) => s.execute);
  const dragStartRef = useRef<number[] | null>(null);
  
  const pts = annotation.points;
  const n = pts.length / 2;
  const isClosed = annotation.shapeType === 'polygon';
  const minVerts = isClosed ? 3 : 2;

  const setVertex = (i: number, x: number, y: number) => {
    const next = [...pts];
    next[i * 2] = x;
    next[i * 2 + 1] = y;
    replaceAnnotation(annotation.id, { points: next });
  };

  const deleteVertex = (i: number) => {
    if (n <= minVerts) return;
    const next = [...pts];
    next.splice(i * 2, 2);
    execute(new ReplacePointsCommand([{ id: annotation.id, from: pts, to: next }]));
  };

  const insertVertexAt = (edgeIndex: number) => {
    // edge i connects vertex i to vertex (i+1) % n
    const [ax, ay] = [pts[edgeIndex * 2], pts[edgeIndex * 2 + 1]];
    const j = (edgeIndex + 1) % n;
    const [bx, by] = [pts[j * 2], pts[j * 2 + 1]];
    const mid = [(ax + bx) / 2, (ay + by) / 2];
    const next = [...pts];
    next.splice((edgeIndex + 1) * 2, 0, mid[0], mid[1]);
    execute(new ReplacePointsCommand([{ id: annotation.id, from: pts, to: next }]));
  };

  return (
    <Group>
      {/* Midpoints: only draw when not mid-drag */}
      {Array.from({ length: isClosed ? n : n - 1 }).map((_, i) => {
        const [ax, ay] = [pts[i * 2], pts[i * 2 + 1]];
        const j = (i + 1) % n;
        const [bx, by] = [pts[j * 2], pts[j * 2 + 1]];
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        return (
          <Circle
            key={`mid-${i}`}
            x={mx}
            y={my}
            radius={MIDPOINT_R}
            fill={MID_COLOR}
            stroke="#000"
            strokeWidth={STROKE_W}
            opacity={0.6}
            onClick={(e) => { e.cancelBubble = true; insertVertexAt(i); }}
            onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'copy'; }}
            onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
          />
        );
      })}

      {/* Vertices */}
      {Array.from({ length: n }).map((_, i) => {
        const [x, y] = [pts[i * 2], pts[i * 2 + 1]];
        return (
          <Circle
            key={`v-${i}`}
            x={x}
            y={y}
            radius={VERTEX_R}
            fill={i === 0 && isClosed ? '#FFC400' : COLOR}
            stroke="#000"
            strokeWidth={STROKE_W}
            draggable
            onClick={(e) => {
              e.cancelBubble = true;
              // Alt+click deletes the vertex
              if ((e.evt as MouseEvent).altKey) {
                deleteVertex(i);
              }
            }}
            onDragStart={() => { dragStartRef.current = [...annotation.points]; }}
            onDragMove={(e) => {
              setVertex(i, e.target.x(), e.target.y());
            }}
            onDragEnd={(e) => {
              const next = [...annotation.points];
              next[i * 2] = e.target.x();
              next[i * 2 + 1] = e.target.y();
              execute(new ReplacePointsCommand([
                { id: annotation.id, from: dragStartRef.current!, to: next },
              ]));
            }}
            onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'grab'; }}
            onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
          />
        );
      })}
    </Group>
  );
};