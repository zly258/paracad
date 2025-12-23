import React, { useRef } from 'react';
import { NodeData, NodeType, SocketType } from '../../types';
import { useGraph } from '../../store/GraphStore';
import { SOCKET_COLORS, NODE_WIDTH, SOCKET_HEIGHT, OUTPUT_HEIGHT } from '../../constants';
import { Check, Play } from 'lucide-react';

interface NodeComponentProps {
  node: NodeData;
}

const NodeComponent: React.FC<NodeComponentProps> = ({ node }) => {
  const { 
      updateNodePosition, selectNode, updateNodeParam, addConnection, 
      selectedNodeIds, setConnectionDraft, connectionDraft, connections, computedResults, t
  } = useGraph();
  
  const draggingRef = useRef<{ startX: number, startY: number, initX: number, initY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    selectNode(node.id, e.shiftKey);
    draggingRef.current = { startX: e.clientX, startY: e.clientY, initX: node.position.x, initY: node.position.y };
    
    const handleMouseMove = (mv: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = (mv.clientX - draggingRef.current.startX);
      const dy = (mv.clientY - draggingRef.current.startY);
      updateNodePosition(node.id, { x: draggingRef.current.initX + dx, y: draggingRef.current.initY + dy });
    };
    const handleMouseUp = () => {
      draggingRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSocketMouseDown = (e: React.MouseEvent, socketId: string, isInput: boolean, type: SocketType) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0) return; 

    setConnectionDraft({
        sourceNodeId: node.id,
        sourceSocketId: socketId,
        sourceType: type,
        isInput,
        currentPos: { x: node.position.x, y: node.position.y }
    });
  };

  const handleSocketMouseUp = (e: React.MouseEvent, socketId: string, isInput: boolean) => {
    e.stopPropagation();
    if (connectionDraft) {
        if (connectionDraft.sourceNodeId !== node.id && connectionDraft.isInput !== isInput) {
             if (isInput) addConnection(connectionDraft.sourceNodeId, connectionDraft.sourceSocketId, node.id, socketId);
             else addConnection(node.id, socketId, connectionDraft.sourceNodeId, connectionDraft.sourceSocketId);
        }
        setConnectionDraft(null);
    }
  };

  const isSelected = selectedNodeIds.includes(node.id);
  const getConnectedSocketId = (socketId: string) => {
     const conn = connections.find(c => c.targetNodeId === node.id && c.targetSocketId === socketId);
     return conn ? conn.sourceSocketId : null;
  };

  const formatLinkedValue = (val: any) => {
      if (val === undefined || val === null) return 'null';
      if (typeof val === 'number') return val.toFixed(2);
      if (typeof val === 'string') return `"${val.length > 8 ? val.substring(0,8)+'..' : val}"`;
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      if (typeof val === 'object') {
          if ('x' in val && 'y' in val) return `V(${val.x.toFixed(1)},${val.y.toFixed(1)},${val.z||0})`;
          if (val.isMesh) return 'Mesh';
          if (val.isGroup) return 'Group';
          return 'Object';
      }
      return String(val);
  };

  const renderInputField = (input: any) => {
      const type = input.type;
      const paramValue = node.params[input.name];
      if (type === 'number') {
          return (
            <input 
                type="number" 
                step="0.01"
                className="w-full bg-black/40 border border-gray-600 rounded px-1 py-0.5 text-[10px] text-blue-300 outline-none hover:border-blue-500 transition-colors" 
                value={paramValue ?? 0} 
                onChange={(e) => updateNodeParam(node.id, input.name, parseFloat(e.target.value))} 
                onMouseDown={(e) => e.stopPropagation()} 
            />
          );
      }
      if (type === 'vector') {
          const v = paramValue || {x:0,y:0,z:0};
          return (
            <div className="flex gap-1" onMouseDown={(e) => e.stopPropagation()}>
                <div className="flex items-center bg-black/40 border border-gray-600 rounded overflow-hidden flex-1">
                     <span className="text-[8px] text-red-500 px-0.5 bg-white/5 h-full flex items-center select-none">X</span>
                     <input type="number" step="0.1" className="w-full bg-transparent px-0.5 text-[9px] text-gray-200 outline-none min-w-0" value={v.x} onChange={e=>updateNodeParam(node.id, input.name, {...v, x: parseFloat(e.target.value)})} />
                </div>
                <div className="flex items-center bg-black/40 border border-gray-600 rounded overflow-hidden flex-1">
                     <span className="text-[8px] text-green-500 px-0.5 bg-white/5 h-full flex items-center select-none">Y</span>
                     <input type="number" step="0.1" className="w-full bg-transparent px-0.5 text-[9px] text-gray-200 outline-none min-w-0" value={v.y} onChange={e=>updateNodeParam(node.id, input.name, {...v, y: parseFloat(e.target.value)})} />
                </div>
                <div className="flex items-center bg-black/40 border border-gray-600 rounded overflow-hidden flex-1">
                     <span className="text-[8px] text-blue-500 px-0.5 bg-white/5 h-full flex items-center select-none">Z</span>
                     <input type="number" step="0.1" className="w-full bg-transparent px-0.5 text-[9px] text-gray-200 outline-none min-w-0" value={v.z} onChange={e=>updateNodeParam(node.id, input.name, {...v, z: parseFloat(e.target.value)})} />
                </div>
            </div>
          );
      }
      if (type === 'boolean') return <input type="checkbox" checked={!!paramValue} onChange={e => updateNodeParam(node.id, input.name, e.target.checked)} onMouseDown={e => e.stopPropagation()} />;
      if (type === 'string') return <input type="text" value={paramValue || ''} onChange={e => updateNodeParam(node.id, input.name, e.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-1 py-0.5 text-[10px] text-yellow-500 outline-none" onMouseDown={e => e.stopPropagation()} />;
      
      if (type === 'any') {
         return <div className="text-[9px] text-gray-500 italic">No Input</div>;
      }
      return null;
  };

  const is2DNode = [NodeType.RECTANGLE, NodeType.CIRCLE, NodeType.ARC, NodeType.ELLIPSE, NodeType.POLYGON, NodeType.STAR].includes(node.type);

  return (
    <div 
      className={`absolute flex flex-col rounded-md shadow-lg overflow-hidden border node-component transition-shadow ${isSelected ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'border-gray-700 shadow-black/40'}`}
      style={{
        width: NODE_WIDTH,
        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
        backgroundColor: '#262626'
      }}
    >
      <div 
        className={`h-8 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing border-b ${isSelected ? 'bg-yellow-900/40 border-yellow-600' : 'bg-[#333] border-gray-700'}`}
        onMouseDown={handleMouseDown}
      >
        <span className={`text-xs font-bold truncate select-none ${isSelected ? 'text-yellow-100' : 'text-gray-200'}`}>{t(node.label)}</span>
      </div>

      <div className="flex flex-col">
        {node.type === NodeType.PARAMETER && (
             <div className="px-3 py-2 space-y-2 h-[90px] box-border border-b border-white/5">
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-8">{t('name')}</span>
                    <input type="text" value={node.params.name} onChange={e => updateNodeParam(node.id, 'name', e.target.value)} className="flex-1 bg-black/30 border border-gray-600 rounded px-1 text-xs text-yellow-500 outline-none" onMouseDown={e => e.stopPropagation()} />
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-8">{t('type')}</span>
                    <select 
                        value={node.params.type} 
                        onChange={e => updateNodeParam(node.id, 'type', e.target.value)} 
                        className="flex-1 bg-[#222] border border-gray-600 rounded px-1 text-xs text-gray-300 outline-none hover:border-blue-500" 
                        onMouseDown={e => e.stopPropagation()}
                    >
                        <option value="number">Number</option>
                        <option value="vector">Vector</option>
                        <option value="boolean">Boolean</option>
                        <option value="string">Text</option>
                    </select>
                 </div>
                 <div className="pt-1 h-8 flex items-center">
                    {node.params.type === 'vector' ? (
                         <div className="flex gap-1 w-full" onMouseDown={e => e.stopPropagation()}>
                            <input type="number" className="w-full bg-black/30 border border-gray-600 rounded px-0.5 text-[10px]" value={node.params.vecX} onChange={e=>updateNodeParam(node.id, 'vecX', parseFloat(e.target.value))} />
                            <input type="number" className="w-full bg-black/30 border border-gray-600 rounded px-0.5 text-[10px]" value={node.params.vecY} onChange={e=>updateNodeParam(node.id, 'vecY', parseFloat(e.target.value))} />
                            <input type="number" className="w-full bg-black/30 border border-gray-600 rounded px-0.5 text-[10px]" value={node.params.vecZ} onChange={e=>updateNodeParam(node.id, 'vecZ', parseFloat(e.target.value))} />
                        </div>
                    ) : node.params.type === 'boolean' ? (
                        <div className="flex items-center gap-2 w-full">
                             <span className="text-[10px] text-gray-500 w-8">{t('val')}</span>
                             <input type="checkbox" checked={node.params.boolVal} onChange={e => updateNodeParam(node.id, 'boolVal', e.target.checked)} onMouseDown={e => e.stopPropagation()} />
                        </div>
                    ) : node.params.type === 'string' ? (
                        <div className="flex items-center gap-2 w-full">
                            <span className="text-[10px] text-gray-500 w-8">{t('content')}</span>
                            <input type="text" value={node.params.stringVal} onChange={e => updateNodeParam(node.id, 'stringVal', e.target.value)} className="flex-1 bg-black/30 border border-gray-600 rounded px-1 text-xs text-yellow-500 outline-none" onMouseDown={e => e.stopPropagation()} />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 w-full">
                            <span className="text-[10px] text-gray-500 w-8">{t('val')}</span>
                            <input type="number" value={node.params.value} onChange={e => updateNodeParam(node.id, 'value', parseFloat(e.target.value))} className="flex-1 bg-black/30 border border-gray-600 rounded px-1 text-xs text-blue-400 outline-none" onMouseDown={e => e.stopPropagation()} />
                        </div>
                    )}
                 </div>
             </div>
        )}

        {node.type === NodeType.EXPRESSION && (
             <div className="px-3 py-2 h-[80px] box-border border-b border-white/5 relative flex flex-col">
                 <div className="text-[9px] text-gray-500 mb-1">{t('expression')}: {node.params.expression}</div>
                 <textarea 
                    value={node.params.expression} 
                    onChange={(e) => updateNodeParam(node.id, 'expression', e.target.value)} 
                    className="w-full flex-1 bg-black/30 text-xs text-yellow-500 font-mono border border-gray-600 rounded px-1 py-1 outline-none resize-none mb-1" 
                    onMouseDown={e => e.stopPropagation()} 
                    placeholder="e.g. Width * Height / 2"
                 />
                 <div className="flex items-center justify-between">
                     <span className="text-[10px] text-gray-400 bg-black/50 px-1 rounded border border-white/10 truncate max-w-[150px]" title="Result">
                        = {(() => {
                            const val = computedResults.get(node.outputs[0]?.id);
                            return formatLinkedValue(val);
                        })()}
                     </span>
                     <button 
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded px-2 py-0.5 text-[10px] transition-colors flex items-center gap-1 shadow-sm border border-transparent"
                        title={t('Run')}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => {}}
                     >
                         <Play size={8} fill="currentColor" /> {t('Run')}
                     </button>
                 </div>
             </div>
        )}

        {node.type === NodeType.BOOLEAN_OP && (
          <div className="px-3 py-2 h-[40px] box-border border-b border-white/5 flex items-center">
             <select className="w-full bg-[#222] text-xs text-gray-300 border border-gray-600 rounded px-1 py-1 outline-none" value={node.params.operation} onChange={(e) => updateNodeParam(node.id, 'operation', e.target.value)} onMouseDown={e => e.stopPropagation()} >
               <option value="UNION">{t('Union')}</option>
               <option value="SUBTRACT">{t('Subtract')} (A-B)</option>
               <option value="INTERSECT">{t('Intersect')}</option>
             </select>
          </div>
        )}

        {is2DNode && (
             <div className="px-3 py-2 h-[40px] box-border border-b border-white/5 flex items-center gap-2">
                 <span className="text-[10px] text-gray-400 whitespace-nowrap">{t('plane')}</span>
                 <select className="flex-1 bg-[#222] text-xs text-gray-300 border border-gray-600 rounded px-1 py-1 outline-none" value={node.params.plane || 'XOY'} onChange={(e) => updateNodeParam(node.id, 'plane', e.target.value)} onMouseDown={e => e.stopPropagation()} >
                   <option value="XOY">XOY (Top)</option>
                   <option value="XOZ">XOZ (Front)</option>
                   <option value="YOZ">YOZ (Right)</option>
                 </select>
             </div>
        )}

        <div className="pt-2"> 
            {node.inputs.map(input => {
                const sourceSocketId = getConnectedSocketId(input.id);
                const connectedValue = sourceSocketId ? computedResults.get(sourceSocketId) : undefined;
                
                return (
                    <div key={input.id} className="relative flex items-center px-3 group" style={{ height: SOCKET_HEIGHT }}>
                        <div 
                            className="w-4 h-4 -ml-4 mr-2 flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform shrink-0"
                            onMouseDown={(e) => handleSocketMouseDown(e, input.id, true, input.type)}
                            onMouseUp={(e) => handleSocketMouseUp(e, input.id, true)}
                        >
                            <div className={`w-3 h-3 rounded-full border border-gray-600 ${SOCKET_COLORS[input.type] || 'bg-gray-400'} ${sourceSocketId ? 'bg-opacity-100' : 'bg-opacity-50'}`} />
                        </div>
                        
                        <span className="text-[11px] text-gray-300 select-none mr-2 w-14 shrink-0 truncate" title={t(input.name)}>{t(input.name)}</span>

                        <div className="flex-1 min-w-0">
                             {!sourceSocketId ? (
                                 renderInputField(input)
                             ) : (
                                 <div className="text-[9px] text-green-400/70 italic truncate px-1 border border-transparent hover:border-white/10 rounded" title={String(connectedValue)}>
                                     {formatLinkedValue(connectedValue)}
                                 </div>
                             )}
                        </div>
                    </div>
                );
            })}
        </div>

        <div className="pt-1 pb-2">
            {node.outputs.map(output => (
                <div key={output.id} className="relative flex items-center justify-end px-3 group" style={{ height: OUTPUT_HEIGHT }}>
                    <span className="text-[11px] text-gray-400 mr-2 select-none group-hover:text-gray-200">{t(output.name)}</span>
                    <div 
                        className="w-4 h-4 -mr-4 ml-2 flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform"
                        onMouseDown={(e) => handleSocketMouseDown(e, output.id, false, output.type)}
                        onMouseUp={(e) => handleSocketMouseUp(e, output.id, false)}
                    >
                        <div className={`w-3 h-3 rounded-full border border-gray-600 ${SOCKET_COLORS[output.type] || 'bg-gray-400'}`} />
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default NodeComponent;