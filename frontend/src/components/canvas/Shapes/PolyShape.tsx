import React from 'react';
import { Line, Circle } from 'react-konva';
import { useViewportStore } from '../../../store/viewportStore';
import type { Annotation, Label } from '../../../types/annotation';

interface Props {
  annotation: Annotation;
  label: Label | undefined;
  selected: boolean;
  onSelect: (e: any) => void;
}

export const PolyShape: React.FC<Props> = ({ annotation, label, selected, onSelect }) => {
  const scale = useViewportStore((s) => s.scale);
  const isClosed = annotation.shapeType === 'polygon';
  const color = label?.color ?? '#FF0000';

  return (
    <>
      <Line
        points={annotation.points}
        closed={isClosed}
        stroke={selected ? '#00E5FF' : color}
        strokeWidth={selected ? 2.5 : 2}
        strokeScaleEnabled={false}
        fill={isClosed ? `${color}22` : undefined}
        shadowColor={color}
        shadowBlur={selected ? 8 : 0}
        shadowOpacity={selected ? 0.5 : 0}
        hitStrokeWidth={10 / scale}
        onClick={onSelect}
        onMouseEnter={(e) => {
          e.target.getStage()!.container().style.cursor = 'pointer';
          e.target.opacity(0.85);
        }}
        onMouseLeave={(e) => {
          e.target.getStage()!.container().style.cursor = '';
          e.target.opacity(1);
        }}
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
            strokeScaleEnabled={false}
            listening={false}
          />
        ))}
    </>
  );
};