import React, { useState, useEffect } from 'react';
import { useAnnotationStore } from '../../store/annotationStore';

export const RectInspector: React.FC = () => {
  const primaryId = useAnnotationStore((s) => s.primaryId);
  const ann = useAnnotationStore((s) =>
    s.annotations.find((a) => a.id === s.primaryId),
  );
  const replaceAnnotation = useAnnotationStore((s) => s.replaceAnnotation);

  const [local, setLocal] = useState({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    if (ann && ann.shapeType === 'rectangle') {
      const [x1, y1, x2, y2] = ann.points;
      setLocal({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.abs(x2 - x1),
        h: Math.abs(y2 - y1),
      });
    }
  }, [ann]);

  if (!ann || ann.shapeType !== 'rectangle') return null;

  const commit = () => {
    const w = Math.max(5, local.w);
    const h = Math.max(5, local.h);
    setLocal({ ...local, w, h });
    replaceAnnotation(ann.id, { points: [local.x, local.y, local.x + w, local.y + h] });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
  };

  return (
    <div className="p-3 border-t text-xs grid grid-cols-2 gap-2">
      <label className="flex items-center gap-1">
        X
        <input
          type="number"
          value={Math.round(local.x)}
          onChange={(e) => setLocal((s) => ({ ...s, x: +e.target.value }))}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="w-full border rounded px-1 py-0.5"
        />
      </label>
      <label className="flex items-center gap-1">
        Y
        <input
          type="number"
          value={Math.round(local.y)}
          onChange={(e) => setLocal((s) => ({ ...s, y: +e.target.value }))}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="w-full border rounded px-1 py-0.5"
        />
      </label>
      <label className="flex items-center gap-1">
        W
        <input
          type="number"
          value={Math.round(local.w)}
          onChange={(e) => setLocal((s) => ({ ...s, w: +e.target.value }))}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="w-full border rounded px-1 py-0.5"
        />
      </label>
      <label className="flex items-center gap-1">
        H
        <input
          type="number"
          value={Math.round(local.h)}
          onChange={(e) => setLocal((s) => ({ ...s, h: +e.target.value }))}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="w-full border rounded px-1 py-0.5"
        />
      </label>
    </div>
  );
};
