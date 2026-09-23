import React from 'react';
import type Konva from 'konva';
import type { Annotation, Label } from '../../types/annotation';
import { RectShape } from './Shapes/RectShape';
import { PolyShape } from './Shapes/PolyShape';
import { PointsShape } from './Shapes/PointsShape';

interface Props {
  annotation: Annotation;
  label: Label | undefined;
  selected: boolean;
  nodeRefs: React.MutableRefObject<Record<string, Konva.Node | null>>;
  onSelect: (e: any) => void;
}

export const ShapeRenderer: React.FC<Props> = (props) => {
  switch (props.annotation.shapeType) {
    case 'rectangle': return <RectShape {...props} />;
    case 'polygon':
    case 'polyline':  return <PolyShape {...props} />;
    case 'points':    return <PointsShape {...props} />;
  }
};