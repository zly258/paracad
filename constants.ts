import { NodeType, NodeData } from './types';
export { createDefaultNode } from './core/nodes/nodeFactory';

export const GRID_SIZE = 20;
export const NODE_WIDTH = 240;
export const HEADER_HEIGHT = 32;
export const SOCKET_ROW_HEIGHT = 30;
export const VECTOR_ROW_HEIGHT = 30;
export const OUTPUT_ROW_HEIGHT = 30;
export const CONTENT_PADDING_TOP = 4;
export const INPUT_OUTPUT_GAP = 6;
export const NODE_BORDER_WIDTH = 1;
export const INPUT_CONTAINER_PADDING = 5;
export const GEOMETRY_PARAMS_HEIGHT = 33;

export const SOCKET_COLORS = {
  number: 'bg-blue-500',
  geometry: 'bg-green-500',
  vector: 'bg-purple-500',
  boolean: 'bg-red-500',
  shape2d: 'bg-yellow-500',
  curve: 'bg-orange-500',
  color: 'bg-pink-500',
  any: 'bg-gray-400'
};

export const getInnerBodyHeight = (type: NodeType): number => {
  switch (type) {
    case NodeType.PARAMETER: return 120;
    case NodeType.EXPRESSION: return 100;
    case NodeType.BOOLEAN_OP: return 36;
    case NodeType.RECTANGLE:
    case NodeType.CIRCLE:
    case NodeType.ARC:
    case NodeType.ELLIPSE:
    case NodeType.POLYGON:
    case NodeType.STAR:
    case NodeType.FILLET:
      return 32;
    default: return 0;
  }
};

export const getSocketHeight = (type: string) => type === 'vector' ? VECTOR_ROW_HEIGHT : SOCKET_ROW_HEIGHT;

const hasGeometryParams = (node: NodeData): boolean => {
  if (node.type === NodeType.PARAMETER || node.type === NodeType.EXPRESSION || node.type === NodeType.GROUP) return false;
  return node.outputs.some(o => o.type === 'geometry' || o.type === 'shape2d' || o.type === 'curve');
};

export const getNodeRenderHeight = (node: NodeData): number => {
  let height = NODE_BORDER_WIDTH + HEADER_HEIGHT + CONTENT_PADDING_TOP;
  height += getInnerBodyHeight(node.type);
  if (node.inputs.length > 0) {
    height += node.inputs.reduce((sum, input) => sum + getSocketHeight(input.type), 0);
    height += INPUT_CONTAINER_PADDING;
  }
  if (hasGeometryParams(node)) height += GEOMETRY_PARAMS_HEIGHT;
  height += INPUT_OUTPUT_GAP;
  height += node.outputs.length * OUTPUT_ROW_HEIGHT;
  height += NODE_BORDER_WIDTH + 4;
  return height;
};

export const calculateSocketPosition = (node: NodeData, socketId: string, isInput: boolean) => {
  let currentY = NODE_BORDER_WIDTH + HEADER_HEIGHT + getInnerBodyHeight(node.type) + CONTENT_PADDING_TOP;

  if (isInput) {
    for (const input of node.inputs) {
      const h = getSocketHeight(input.type);
      if (input.id === socketId) {
        return { x: node.position.x, y: node.position.y + currentY + h / 2 };
      }
      currentY += h;
    }
  } else {
    for (const input of node.inputs) currentY += getSocketHeight(input.type);
    if (node.inputs.length > 0) currentY += INPUT_CONTAINER_PADDING;
    if (hasGeometryParams(node)) currentY += GEOMETRY_PARAMS_HEIGHT;
    currentY += INPUT_OUTPUT_GAP;
    for (const output of node.outputs) {
      if (output.id === socketId) {
        return { x: node.position.x + NODE_WIDTH, y: node.position.y + currentY + OUTPUT_ROW_HEIGHT / 2 };
      }
      currentY += OUTPUT_ROW_HEIGHT;
    }
  }
  return null;
};
