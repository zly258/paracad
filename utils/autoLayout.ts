import dagre from 'dagre';
import { NodeData, Connection } from '../types';
import { NODE_WIDTH, getNodeRenderHeight } from '../constants';

const OVERLAP_PADDING_X = 36;
const OVERLAP_PADDING_Y = 28;

const isOverlapping = (a: NodeData, b: NodeData, paddingX = OVERLAP_PADDING_X, paddingY = OVERLAP_PADDING_Y) => {
  const ax1 = a.position.x - paddingX / 2;
  const ay1 = a.position.y - paddingY / 2;
  const ax2 = a.position.x + NODE_WIDTH + paddingX / 2;
  const ay2 = a.position.y + getNodeRenderHeight(a) + paddingY / 2;

  const bx1 = b.position.x;
  const by1 = b.position.y;
  const bx2 = b.position.x + NODE_WIDTH;
  const by2 = b.position.y + getNodeRenderHeight(b);

  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
};

export const resolveNodeOverlaps = (nodes: NodeData[]) => {
  if (nodes.length <= 1) return nodes;
  const arranged = nodes.map((node) => ({ ...node, position: { ...node.position } }));
  arranged.sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);

  for (let iteration = 0; iteration < 8; iteration++) {
    let moved = false;
    for (let i = 0; i < arranged.length; i++) {
      const current = arranged[i];
      for (let j = 0; j < i; j++) {
        const fixed = arranged[j];
        if (!isOverlapping(fixed, current)) continue;
        current.position.y = fixed.position.y + getNodeRenderHeight(fixed) + OVERLAP_PADDING_Y;
        moved = true;
      }
    }
    if (!moved) break;
  }

  return arranged;
};

export const performAutoLayout = (nodes: NodeData[], connections: Connection[]) => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', align: 'UL', nodesep: 90, ranksep: 170, marginx: 40, marginy: 30 });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes
  nodes.forEach(node => {
    const height = getNodeRenderHeight(node);
    g.setNode(node.id, { width: NODE_WIDTH, height: height });
  });

  // Add edges
  connections.forEach(conn => {
    g.setEdge(conn.sourceNodeId, conn.targetNodeId);
  });

  dagre.layout(g);

  const laidOut = nodes.map(node => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - (pos.height / 2)
      }
    };
  });

  return resolveNodeOverlaps(laidOut);
};
