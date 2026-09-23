import React from 'react';
import { Circle, Group } from 'react-konva';
import { useAnnotationStore } from '../../store/annotationStore';
import type { Annotation } from '../../types/annotation';

const VERTEX_R = 5;
const MIDPOINT_R = 3.5;
const COLOR = '#00E5FF';
const MID_COLOR = '#FFC400';

interface Props {
  annotation: Annotation;
}

/**
 * Renders:
 *  - one draggable circle per vertex
 *  - one small midpoint circle per edge (click to insert a vertex)
 *  - Alt+click on a vertex deletes it (if it would leave >= min vertices)
 */
export const VertexHandles: React.FC<Props> = ({ annotation }) => {
  const replaceAnnotation = useAnnotationStore((s) => s.replaceAnnotation);
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
    replaceAnnotation(annotation.id, { points: next });
  };

  const insertVertexAt = (edgeIndex: number) => {
    // edge i connects vertex i to vertex (i+1) % n
    const [ax, ay] = [pts[edgeIndex * 2], pts[edgeIndex * 2 + 1]];
    const j = (edgeIndex + 1) % n;
    const [bx, by] = [pts[j * 2], pts[j * 2 + 1]];
    const mid = [(ax + bx) / 2, (ay + by) / 2];
    const next = [...pts];
    next.splice((edgeIndex + 1) * 2, 0, mid[0], mid[1]);
    replaceAnnotation(annotation.id, { points: next });
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
            strokeWidth={1}
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
            strokeWidth={1}
            draggable
            onClick={(e) => {
              e.cancelBubble = true;
              // Alt+click deletes the vertex
              if ((e.evt as MouseEvent).altKey) {
                deleteVertex(i);
              }
            }}
            onDragMove={(e) => {
              setVertex(i, e.target.x(), e.target.y());
            }}
            onDragEnd={(e) => {
              // Already persisted via onDragMove; ensure final position is exact
              setVertex(i, e.target.x(), e.target.y());
            }}
            onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'grab'; }}
            onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
          />
        );
      })}
    </Group>
  );
};