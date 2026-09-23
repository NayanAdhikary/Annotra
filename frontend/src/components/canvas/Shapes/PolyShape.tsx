import React from 'react';
import { Line, Circle } from 'react-konva';
import type { Annotation, Label } from '../../../types/annotation';

interface Props {
  annotation: Annotation;
  label: Label | undefined;
  selected: boolean;
  onSelect: (e: any) => void;
}

export const PolyShape: React.FC<Props> = ({ annotation, label, selected, onSelect }) => {
  const isClosed = annotation.shapeType === 'polygon';
  const color = label?.color ?? '#FF0000';

  return (
    <>
      <Line
        points={annotation.points}
        closed={isClosed}
        stroke={selected ? '#00E5FF' : color}
        strokeWidth={selected ? 2.5 : 2}
        fill={isClosed ? `${color}22` : undefined}
        hitStrokeWidth={10}
        onClick={onSelect}
      />
      {/* Small non-interactive vertex dots for visual feedback on unselected shapes */}
      {!selected &&
        Array.from({ length: annotation.points.length / 2 }).map((_, i) => (
          <Circle
            key={i}
            x={annotation.points[i * 2]}
            y={annotation.points[i * 2 + 1]}
            radius={3}
            fill={color}
            stroke="#fff"
            strokeWidth={1}
            listening={false}
          />
        ))}
    </>
  );
};