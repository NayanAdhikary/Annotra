import React from 'react';
import { Shape } from 'react-konva';
import type { Annotation, Label } from '../../../types/annotation';

interface Props {
  annotation: Annotation;
  label: Label | undefined;
  selected: boolean;
  onSelect: (e: any) => void;
}

export const MaskKonvaShape: React.FC<Props> = ({ annotation, label, selected, onSelect }) => (
  <Shape
    sceneFunc={(ctx, shape) => {
      try {
        const rle = JSON.parse(annotation.points[0] as any);
        const [h, w] = rle.size;
        const color = label?.color ?? "#FF0000";
        ctx.fillStyle = color + (selected ? "AA" : "77");
        let idx = 0, value = 0;
        for (const run of rle.counts) {
          if (value) {
            const x = idx % w;
            const y = Math.floor(idx / w);
            ctx.fillRect(x, y, run, 1);
          }
          idx += run;
          value = 1 - value;
        }
      } catch {}
      ctx.fillStrokeShape(shape);
    }}
    onClick={onSelect}
    onMouseEnter={(e) => {
      e.target.getStage()!.container().style.cursor = 'pointer';
      e.target.opacity(0.85);
    }}
    onMouseLeave={(e) => {
      e.target.getStage()!.container().style.cursor = '';
      e.target.opacity(1);
    }}
    hitFunc={(ctx, shape) => {
      try {
        const rle = JSON.parse(annotation.points[0] as any);
        const [h, w] = rle.size;
        let minX = w, minY = h, maxX = 0, maxY = 0;
        let idx = 0, value = 0;
        for (const run of rle.counts) {
          if (value) {
            const x = idx % w;
            const y = Math.floor(idx / w);
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + run > maxX) maxX = x + run;
            if (y + 1 > maxY) maxY = y + 1;
          }
          idx += run;
          value = 1 - value;
        }
        ctx.beginPath();
        ctx.rect(minX, minY, maxX - minX, maxY - minY);
        ctx.closePath();
        ctx.fillStrokeShape(shape);
      } catch {}
    }}
  />
);