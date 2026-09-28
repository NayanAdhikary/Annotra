import React, { useEffect, useRef } from 'react';
import { useAnnotationStore } from '../store/annotationStore';

interface Props {
  width: number;
  height: number;
  mask: Uint8Array | null;
  version: number;   // bump to force redraw
  color: string;
}

/**
 * Renders a Uint8Array mask as a colored overlay via HTML canvas.
 * Draws the buffer to an offscreen ImageData once per version, then composites.
 */
export const BrushOverlay: React.FC<Props> = ({ width, height, mask, version, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotations = useAnnotationStore((s) => s.annotations);
  const frame = useAnnotationStore((s) => s.frame);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);

    // Draw committed mask annotations for the current frame
    const rgb = hexToRgb(color);

    for (const a of annotations) {
      if (a.frame !== frame || a.shapeType !== 'mask') continue;
      try {
        const rle = JSON.parse(a.points[0] as any);
        paintRLE(ctx, rle, rgb);
      } catch { /* ignore malformed */ }
    }

    // Draw the in-progress mask
    if (mask) {
      const imgData = ctx.createImageData(width, height);
      const data = imgData.data;
      for (let i = 0; i < mask.length; i++) {
        if (mask[i]) {
          data[i * 4 + 0] = rgb.r;
          data[i * 4 + 1] = rgb.g;
          data[i * 4 + 2] = rgb.b;
          data[i * 4 + 3] = 100;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }, [mask, version, width, height, annotations, frame, color]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ mixBlendMode: 'multiply' }}
    />
  );
};

function paintRLE(ctx: CanvasRenderingContext2D, rle: any, rgb: { r: number; g: number; b: number }) {
  const [h, w] = rle.size;
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  let idx = 0;
  let value = 0;
  for (const run of rle.counts) {
    if (value) {
      for (let i = 0; i < run; i++) {
        const p = (idx + i) * 4;
        data[p] = rgb.r; data[p + 1] = rgb.g; data[p + 2] = rgb.b; data[p + 3] = 100;
      }
    }
    idx += run;
    value = 1 - value;
  }
  // putImageData ignores transform, so draw at 0,0 in image coords
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  tmp.getContext('2d')!.putImageData(imgData, 0, 0);
  ctx.drawImage(tmp, 0, 0);
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
