import React, { useRef, useEffect } from 'react';
import { Rect } from 'react-konva';
import type Konva from 'konva';
import { useAnnotationStore } from '../../../store/annotationStore';
import type { Annotation, Label } from '../../../types/annotation';

interface Props {
  annotation: Annotation;
  label: Label | undefined;
  selected: boolean;
  nodeRefs: React.MutableRefObject<Record<string, Konva.Node | null>>;
  onSelect: (e: any) => void;
}

export const RectShape: React.FC<Props> = ({ annotation, label, selected, nodeRefs, onSelect }) => {
  const ref = useRef<Konva.Rect>(null);
  const replaceAnnotation = useAnnotationStore((s) => s.replaceAnnotation);

  // Register node for the Transformer to attach to
  useEffect(() => {
    nodeRefs.current[annotation.id] = ref.current;
    return () => { nodeRefs.current[annotation.id] = null; };
  }, [annotation.id, nodeRefs]);

  const [x1, y1, x2, y2] = annotation.points;
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);
  const rotation = (annotation as any).rotation ?? 0; // Day 8 adds optional rotation

  return (
    <Rect
      ref={ref}
      x={left}
      y={top}
      width={width}
      height={height}
      rotation={rotation}
      stroke={selected ? '#00E5FF' : label?.color ?? '#FF0000'}
      strokeWidth={selected ? 2.5 : 2}
      fill={label?.color ? `${label.color}22` : 'rgba(255,0,0,0.08)'}
      hitStrokeWidth={8}
      draggable
      onClick={onSelect}
      onDragEnd={(e) => {
        // Dragging the whole rect: translate all 4 coords by delta.
        // Konva moves the node to (newX, newY); we derive delta from current.
        const node = e.target;
        const dx = node.x() - left;
        const dy = node.y() - top;
        replaceAnnotation(annotation.id, {
          points: [x1 + dx, y1 + dy, x2 + dx, y2 + dy],
        });
      }}
      onTransformEnd={() => {
        const node = ref.current!;
        // Konva has scaled the node; we rebuild absolute points and reset the node
        // to identity so React renders from the canonical points[] array.
        const sx = node.scaleX();
        const sy = node.scaleY();
        const nx = node.x();
        const ny = node.y();
        const w = Math.max(5, node.width() * sx);
        const h = Math.max(5, node.height() * sy);
        const rot = node.rotation();

        // Reset node — React's declarative render will reassert from points[]
        node.scaleX(1);
        node.scaleY(1);

        replaceAnnotation(annotation.id, {
          points: [nx, ny, nx + w, ny + h],
          // store rotation as a shape attribute for now; promoted to a column on Day 12
          ...(rot !== 0 ? { rotation: rot } as any : {}),
        } as any);
      }}
    />
  );
};
