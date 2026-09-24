export type ShapeType = 'rectangle' | 'polygon' | 'polyline' | 'points';

export type ToolType = 'select' | ShapeType;

export interface Annotation {
  id: string;
  serverId?: number;
  taskId: number;
  frame: number;
  labelId: number;
  shapeType: ShapeType;
  /** Flat [x1,y1,x2,y2,...] — same wire format as CVAT. */
  points: number[];
  occluded: boolean;
  source: 'manual' | 'auto' | 'interpolated';
  groupId: number;
  updatedAt?: string;
  conflict?: any;
  saveError?: any;
}

export interface Label {
  id: number;
  name: string;
  color: string;
}

/** Vertex index helpers — never index points[] directly outside these. */
export const vertexCount = (a: Annotation) => a.points.length / 2;
export const getVertex = (a: Annotation, i: number): [number, number] =>
  [a.points[i * 2], a.points[i * 2 + 1]];