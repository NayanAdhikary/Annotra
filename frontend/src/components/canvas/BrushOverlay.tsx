import React, { useEffect, useRef } from 'react';
import { useAnnotationStore } from '../../store/annotationStore';

interface Props {
  width: number;
  height: number;
  mask: Uint8Array | null;
  version: number;
  color: string;
}

export const BrushOverlay: React.FC<Props> = ({ width, height, mask, version, color }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const annotations = useAnnotationStore((s) => s.annotations);
  const frame = useAnnotationStore((s) => s.frame);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);

    // Committed masks on this frame
    for (const a of annotations) {
      if (a.frame !== frame || a.shapeType !== "mask") continue;
      try {
        const rle = JSON.parse(a.points[0] as any);
        paintRLE(ctx, rle, hexToRgb(color));
      } catch {}
    }

    // In-progress stroke
    if (mask) {
      const imgData = ctx.createImageData(width, height);
      const data = imgData.data;
      const rgb = hexToRgb(color);
      for (let i = 0; i < mask.length; i++) {
        if (mask[i]) {
          data[i * 4 + 0] = rgb.r;
          data[i * 4 + 1] = rgb.g;
          data[i * 4 + 2] = rgb.b;
          data[i * 4 + 3] = 120;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }, [mask, version, width, height, annotations, frame, color]);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 pointer-events-none"
      style={{ mixBlendMode: 'multiply' }}
    />
  );
};

function paintRLE(ctx: CanvasRenderingContext2D, rle: any, rgb: { r: number; g: number; b: number }) {
  const [h, w] = rle.size;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  let idx = 0, value = 0;
  for (const run of rle.counts) {
    if (value) {
      for (let i = 0; i < run; i++) {
        const p = (idx + i) * 4;
        d[p] = rgb.r; d[p + 1] = rgb.g; d[p + 2] = rgb.b; d[p + 3] = 120;
      }
    }
    idx += run;
    value = 1 - value;
  }
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  ctx.drawImage(tmp, 0, 0);
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}