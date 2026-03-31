import { NodeType, NodeData } from './types';
export { createDefaultNode } from './core/nodes/nodeFactory';

export const GRID_SIZE = 20;
export const NODE_WIDTH = 220;
export const HEADER_HEIGHT = 30;
export const SOCKET_ROW_HEIGHT = 24;
export const VECTOR_ROW_HEIGHT = 24;
export const OUTPUT_ROW_HEIGHT = 24;
export const CONTENT_PADDING_TOP = 2;
export const INPUT_OUTPUT_GAP = 2;
export const NODE_BORDER_WIDTH = 1;
export const INPUT_CONTAINER_PADDING = 2;
export const GEOMETRY_PARAMS_HEIGHT = 24;

export const SOCKET_COLORS = {
  number: 'bg-slate-400',
  geometry: 'bg-sky-500',
  vector: 'bg-indigo-400',
  boolean: 'bg-slate-400',
  shape2d: 'bg-sky-500',
  curve: 'bg-sky-500',
  color: 'bg-slate-400',
  any: 'bg-slate-300'
};

export const getInnerBodyHeight = (type: NodeType): number => {
  switch (type) {
    case NodeType.PARAMETER: return 60;
    case NodeType.EXPRESSION: return 64;
    default: return 0;
  }
};

export const getSocketHeight = (type: string) => type === 'vector' ? VECTOR_ROW_HEIGHT : SOCKET_ROW_HEIGHT;

const hasGeometryParams = (node: NodeData): boolean => {
  if (node.type === NodeType.PARAMETER || node.type === NodeType.EXPRESSION || node.type === NodeType.GROUP) return false;
  return (node.outputs || []).some(o => o.type === 'geometry' || o.type === 'shape2d' || o.type === 'curve');
};

export const getNodeRenderHeight = (node: NodeData): number => {
  let height = NODE_BORDER_WIDTH + HEADER_HEIGHT + CONTENT_PADDING_TOP;
  height += getInnerBodyHeight(node.type);

  const inputs = node.inputs || [];
  if (inputs.length > 0) {
    height += inputs.reduce((sum, input) => sum + getSocketHeight(input.type), 0);
    height += INPUT_CONTAINER_PADDING;
  }

  if (hasGeometryParams(node)) height += GEOMETRY_PARAMS_HEIGHT;
  height += INPUT_OUTPUT_GAP;

  const outputs = node.outputs || [];
  height += outputs.length * OUTPUT_ROW_HEIGHT;

  height += NODE_BORDER_WIDTH + 4;
  return height;
};

export const calculateSocketPosition = (node: NodeData, socketId: string, isInput: boolean) => {
  let currentY = NODE_BORDER_WIDTH + HEADER_HEIGHT + getInnerBodyHeight(node.type) + CONTENT_PADDING_TOP;
  const inputs = node.inputs || [];
  const outputs = node.outputs || [];

  if (isInput) {
    for (const input of inputs) {
      const h = getSocketHeight(input.type);
      if (input.id === socketId) {
        return { x: node.position.x, y: node.position.y + currentY + h / 2 };
      }
      currentY += h;
    }
  } else {
    for (const input of inputs) currentY += getSocketHeight(input.type);
    currentY += INPUT_OUTPUT_GAP;
    for (const output of outputs) {
      if (output.id === socketId) {
        return { x: node.position.x + NODE_WIDTH, y: node.position.y + currentY + OUTPUT_ROW_HEIGHT / 2 };
      }
      currentY += OUTPUT_ROW_HEIGHT;
    }
  }
  return null;
};
