import dagre from 'dagre';
import { NodeData, Connection } from '../types';
import { NODE_WIDTH, HEADER_HEIGHT, SOCKET_HEIGHT, OUTPUT_HEIGHT } from '../constants';

export const performAutoLayout = (nodes: NodeData[], connections: Connection[]) => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', align: 'UL', nodesep: 60, ranksep: 120 });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes
  nodes.forEach(node => {
    // Estimate height
    const inputHeight = node.inputs.length * SOCKET_HEIGHT;
    const outputHeight = node.outputs.length * OUTPUT_HEIGHT;
    const height = HEADER_HEIGHT + inputHeight + outputHeight + 60; // +60 for params/padding

    g.setNode(node.id, { width: NODE_WIDTH, height: height });
  });

  // Add edges
  connections.forEach(conn => {
    g.setEdge(conn.sourceNodeId, conn.targetNodeId);
  });

  dagre.layout(g);

  // Return new positions
  return nodes.map(node => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - (pos.height / 2)
      }
    };
  });
};