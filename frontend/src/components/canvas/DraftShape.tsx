import React from 'react';
import { Rect, Line, Circle } from 'react-konva';
import type { Draft } from '../../hooks/useDrawing';

const DRAFT_COLOR = '#00E5FF';

export const DraftShape: React.FC<{ draft: Draft }> = ({ draft }) => {
  if (draft.kind === 'none') return null;

  if (draft.kind === 'rectangle') {
    const [x1, y1] = draft.start;
    const [x2, y2] = draft.current;
    return (
      <Rect
        x={Math.min(x1, x2)}
        y={Math.min(y1, y2)}
        width={Math.abs(x2 - x1)}
        height={Math.abs(y2 - y1)}
        stroke={DRAFT_COLOR}
        dash={[6, 4]}
        strokeWidth={1.5}
        listening={false}
      />
    );
  }

  // polygon / polyline
  const pts = draft.cursor
    ? [...draft.points, draft.cursor[0], draft.cursor[1]]
    : draft.points;

  return (
    <>
      <Line
        points={pts}
        stroke={DRAFT_COLOR}
        strokeWidth={1.5}
        dash={[6, 4]}
        closed={false}
        listening={false}
      />
      {Array.from({ length: draft.points.length / 2 }).map((_, i) => (
        <Circle
          key={i}
          x={draft.points[i * 2]}
          y={draft.points[i * 2 + 1]}
          radius={i === 0 && draft.kind === 'polygon' ? 7 : 4}
          fill={i === 0 && draft.kind === 'polygon' ? '#FFC400' : DRAFT_COLOR}
          stroke="#000"
          strokeWidth={1}
          listening={false}
        />
      ))}
    </>
  );
};