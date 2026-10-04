import React from 'react';
import { Circle } from 'react-konva';
import { useAnnotationStore } from '../../../store/annotationStore';
import type { Annotation, Label } from '../../../types/annotation';

interface Props {
  annotation: Annotation;
  label: Label | undefined;
  selected: boolean;
  onSelect: (e: any) => void;
}

export const PointsShape: React.FC<Props> = ({ annotation, label, selected, onSelect }) => {
  const replaceAnnotation = useAnnotationStore((s) => s.replaceAnnotation);
  const color = label?.color ?? '#FF0000';
  const pts = annotation.points;

  const moveVertex = (i: number, x: number, y: number) => {
    const next = [...pts];
    next[i * 2] = x;
    next[i * 2 + 1] = y;
    replaceAnnotation(annotation.id, { points: next });
  };

  return (
    <>
      {Array.from({ length: pts.length / 2 }).map((_, i) => (
        <Circle
          key={i}
          x={pts[i * 2]}
          y={pts[i * 2 + 1]}
          radius={selected ? 7 : 5}
          fill={color}
          stroke={selected ? '#00E5FF' : '#000'}
          strokeWidth={selected ? 2 : 1}
          strokeScaleEnabled={false}
          shadowColor={color}
          shadowBlur={selected ? 8 : 0}
          shadowOpacity={selected ? 0.5 : 0}
          draggable={selected}
          onClick={onSelect}
          onMouseEnter={(e) => {
            e.target.getStage()!.container().style.cursor = 'pointer';
            e.target.opacity(0.85);
          }}
          onMouseLeave={(e) => {
            e.target.getStage()!.container().style.cursor = '';
            e.target.opacity(1);
          }}
          onDragMove={(e) => moveVertex(i, e.target.x(), e.target.y())}
        />
      ))}
    </>
  );
};