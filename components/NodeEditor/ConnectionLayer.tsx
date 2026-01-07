import React from 'react';
import { calculateSocketPosition } from '../../constants';
import { NodeData, Connection, ConnectionDraft } from '../../types';

interface ConnectionLayerProps {
    nodes: NodeData[];
    connections: Connection[];
    connectionDraft: ConnectionDraft | null;
    onRemoveConnection: (id: string) => void;
}

const ConnectionLayer: React.FC<ConnectionLayerProps> = ({ nodes, connections, connectionDraft, onRemoveConnection }) => {
  
  const getSocketPos = (nodeId: string, socketId: string, isInput: boolean) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    return calculateSocketPosition(node, socketId, isInput);
  };

  const drawPath = (startX: number, startY: number, endX: number, endY: number) => {
      const dist = Math.abs(endX - startX);
      const controlOffset = Math.max(dist * 0.5, 60);
      return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
  };

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible">
      {connections.map(conn => {
        const start = getSocketPos(conn.sourceNodeId, conn.sourceSocketId, false);
        const end = getSocketPos(conn.targetNodeId, conn.targetSocketId, true);

        if (!start || !end) return null;
        const pathData = drawPath(start.x, start.y, end.x, end.y);

        return (
          <g 
             key={conn.id} 
             className="pointer-events-auto cursor-pointer group" 
             onDoubleClick={(e) => { e.stopPropagation(); onRemoveConnection(conn.id); }}
          >
            <path d={pathData} stroke="transparent" strokeWidth="20" fill="none" />
            <path d={pathData} stroke="#444" strokeWidth="2" fill="none" />
            <path d={pathData} stroke="#eab308" strokeWidth="2" fill="none" className="connection-line opacity-80" />
            <path d={pathData} stroke="red" strokeWidth="3" fill="none" className="opacity-0 group-hover:opacity-40 transition-opacity" />
          </g>
        );
      })}

      {connectionDraft && (() => {
          const startSocketPos = getSocketPos(connectionDraft.sourceNodeId, connectionDraft.sourceSocketId, connectionDraft.isInput);
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
             <g>
               <path d={pData} stroke="#fff" strokeWidth="2" strokeDasharray="5,5" fill="none" className="opacity-80 animate-pulse" />
               {connectionDraft.snappedSocketId && (
                   <g transform={`translate(${endX}, ${endY})`}>
                       <circle r="8" fill="none" stroke="#eab308" strokeWidth="2" className="animate-ping" opacity="0.5" />
                       <circle r="5" fill="#eab308" />
                   </g>
               )}
             </g>
          );
      })()}
    </svg>
  );
};

export default React.memo(ConnectionLayer);