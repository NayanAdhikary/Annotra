import React from 'react';
import { Rect } from 'react-konva';
import type { MarqueeRect as MR } from '../../hooks/useMarquee';

export const MarqueeRect: React.FC<{ rect: MR }> = ({ rect }) => (
  <Rect
    x={Math.min(rect.x1, rect.x2)}
    y={Math.min(rect.y1, rect.y2)}
    width={Math.abs(rect.x2 - rect.x1)}
    height={Math.abs(rect.y2 - rect.y1)}
    fill="rgba(0,180,255,0.10)"
    stroke="#00B4FF"
    strokeWidth={1}
    dash={[5, 5]}
    listening={false}
  />
);
