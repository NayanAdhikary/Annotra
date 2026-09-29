import React, { memo } from 'react';
import type Konva from 'konva';
import type { Annotation, Label } from '../../types/annotation';
import { RectShape } from './Shapes/RectShape';
import { PolyShape } from './Shapes/PolyShape';
import { PointsShape } from './Shapes/PointsShape';
import { MaskKonvaShape } from './Shapes/MaskKonvaShape';

interface Props {
  annotation: Annotation;
  label: Label | undefined;
  selected: boolean;
  nodeRefs: React.MutableRefObject<Record<string, Konva.Node | null>>;
  onSelect: (e: any) => void;
}

const ShapeRendererImpl: React.FC<Props> = (props) => {
  switch (props.annotation.shapeType) {
    case 'rectangle': return <RectShape {...props} />;
    case 'polygon':
    case 'polyline':  return <PolyShape {...props} />;
    case 'points':    return <PointsShape {...props} />;
    case 'mask':      return <MaskKonvaShape {...props} />;
  }
};

export const ShapeRenderer = memo(ShapeRendererImpl, (prev, next) => {
  if (prev.annotation !== next.annotation) return false;
  if (prev.selected !== next.selected) return false;
  if (prev.label?.color !== next.label?.color) return false;
  if (prev.label?.name !== next.label?.name) return false;
  // Anything else — don't re-render
  return true;
});