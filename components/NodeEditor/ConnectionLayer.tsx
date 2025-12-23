import React from 'react';
import { useGraph } from '../../store/GraphStore';
import { HEADER_HEIGHT, SOCKET_HEIGHT, OUTPUT_HEIGHT, NODE_WIDTH } from '../../constants';
import { NodeType } from '../../types';

const ConnectionLayer: React.FC = () => {
  const { nodes, connections, removeConnection, connectionDraft } = useGraph();

  const getNodeBodyHeight = (type: NodeType): number => {
    switch (type) {
        case NodeType.PARAMETER: return 90; 
        case NodeType.EXPRESSION: return 80;
        case NodeType.BOOLEAN_OP: return 40;
        // 2D Nodes have extra height for Plane Dropdown
        case NodeType.RECTANGLE:
        case NodeType.CIRCLE:
        case NodeType.ARC:
        case NodeType.ELLIPSE:
        case NodeType.POLYGON:
            return 40; 
        default: return 0;
    }
  };

  const getSocketPosition = (nodeId: string, socketId: string, isInput: boolean) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const bodyHeight = getNodeBodyHeight(node.type);
    const baseInputY = HEADER_HEIGHT + bodyHeight + 8; // 8px padding top of inputs

    if (isInput) {
      const socketIndex = node.inputs.findIndex(s => s.id === socketId);
      if (socketIndex === -1) return null;
      // Single Row: Centered vertically in the SOCKET_HEIGHT
      return {
        x: node.position.x,
        y: node.position.y + baseInputY + (socketIndex * SOCKET_HEIGHT) + (SOCKET_HEIGHT / 2) 
      };
    } else {
      const socketIndex = node.outputs.findIndex(s => s.id === socketId);
      if (socketIndex === -1) return null;
      
      const inputsHeight = node.inputs.length * SOCKET_HEIGHT;
      // Padding between inputs and outputs might be smaller now, check NodeComponent logic
      // NodeComponent has `pt-1 pb-2` after inputs. `pt-2` before inputs.
      const baseOutputY = baseInputY + inputsHeight + 4; 

      return {
        x: node.position.x + NODE_WIDTH,
        y: node.position.y + baseOutputY + (socketIndex * OUTPUT_HEIGHT) + (OUTPUT_HEIGHT / 2)
      };
    }
  };

  const drawPath = (startX: number, startY: number, endX: number, endY: number) => {
      const dist = Math.abs(endX - startX);
      const controlOffset = Math.max(dist * 0.5, 60);
      return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
  };

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible">
      {connections.map(conn => {
        const start = getSocketPosition(conn.sourceNodeId, conn.sourceSocketId, false);
        const end = getSocketPosition(conn.targetNodeId, conn.targetSocketId, true);

        if (!start || !end) return null;
        const pathData = drawPath(start.x, start.y, end.x, end.y);

        return (
          <g key={conn.id} className="pointer-events-auto cursor-pointer group" onClick={() => removeConnection(conn.id)}>
            <path d={pathData} stroke="transparent" strokeWidth="20" fill="none" />
            <path d={pathData} stroke="#444" strokeWidth="2" fill="none" />
            <path d={pathData} stroke="#eab308" strokeWidth="2" fill="none" className="connection-line opacity-80" />
            <path d={pathData} stroke="white" strokeWidth="3" fill="none" className="opacity-0 group-hover:opacity-40 transition-opacity" />
          </g>
        );
      })}

      {connectionDraft && (() => {
          const startSocketPos = getSocketPosition(connectionDraft.sourceNodeId, connectionDraft.sourceSocketId, connectionDraft.isInput);
          if (!startSocketPos) return null;

          const endX = connectionDraft.currentPos.x; 
          const endY = connectionDraft.currentPos.y;
          
          let pData = '';
          if (!connectionDraft.isInput) {
               pData = drawPath(startSocketPos.x, startSocketPos.y, endX, endY);
          } else {
               pData = drawPath(endX, endY, startSocketPos.x, startSocketPos.y);
          }

          return (
             <path d={pData} stroke="#fff" strokeWidth="2" strokeDasharray="5,5" fill="none" className="opacity-80 animate-pulse" />
          );
      })()}
    </svg>
  );
};

export default ConnectionLayer;