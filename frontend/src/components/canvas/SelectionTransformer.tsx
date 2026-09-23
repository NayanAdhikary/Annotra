import React, { useEffect, useRef } from 'react';
import { Transformer } from 'react-konva';
import type Konva from 'konva';
import { useAnnotationStore } from '../../store/annotationStore';
import type { Annotation } from '../../types/annotation';

interface Props {
  stageRef: React.RefObject<Konva.Stage>;
  nodeRefs: React.MutableRefObject<Record<string, Konva.Node | null>>;
  enabled: boolean;
}

/**
 * Attaches a Konva.Transformer to the currently-selected rectangle nodes.
 *
 * Polygon / polyline / points shapes are NOT handled by Transformer — they
 * use custom vertex handles (see VertexHandles.tsx). Transformer only attaches
 * to rectangles because their geometry is axis-aligned and maps cleanly to
 * scaleX / scaleY.
 */
export const SelectionTransformer: React.FC<Props> = ({ stageRef, nodeRefs, enabled }) => {
  const trRef = useRef<Konva.Transformer>(null);
  const selectedIds = useAnnotationStore((s) => s.selectedIds);
  const annotations = useAnnotationStore((s) => s.annotations);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr || !enabled) {
      tr?.nodes([]);
      return;
    }
    const nodes = selectedIds
      .map((id) => annotations.find((a) => a.id === id))
      .filter((a): a is Annotation => !!a && a.shapeType === 'rectangle')
      .map((a) => nodeRefs.current[a.id])
      .filter((n): n is Konva.Node => !!n);

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, annotations, enabled, nodeRefs]);

  return (
    <Transformer
      ref={trRef}
      rotateEnabled
      keepRatio={false}
      anchorSize={8}
      anchorStroke="#00E5FF"
      anchorCornerRadius={2}
      anchorFill="#FFFFFF"
      borderStroke="#00E5FF"
      borderDash={[4, 4]}
      rotateAnchorOffset={24}
      boundBoxFunc={(oldBox, newBox) => {
        // Disallow flipping to negative dimensions
        if (newBox.width < 5 || newBox.height < 5) return oldBox;
        return newBox;
      }}
    />
  );
};
