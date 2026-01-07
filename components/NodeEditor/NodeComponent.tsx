import React, { useRef } from 'react';
import { NodeData, NodeType, SocketType, Connection, ConnectionDraft } from '../../types';
import { SOCKET_COLORS, NODE_WIDTH, HEADER_HEIGHT, getSocketHeight, OUTPUT_ROW_HEIGHT, getInnerBodyHeight, CONTENT_PADDING_TOP, INPUT_OUTPUT_GAP } from '../../constants';
import { Play, Trash2 } from 'lucide-react';

interface NodeComponentProps {
  node: NodeData;
  isSelected: boolean;
  computedResults: Map<string, any>;
  connections: Connection[];
  t: (key: string) => string;
  // Actions
  onSelect: (id: string, multi: boolean) => void;
  onUpdatePosition: (id: string, pos: { x: number, y: number }) => void;
  onUpdateParam: (id: string, key: string, value: any) => void;
  onSocketMouseDown: (nodeId: string, socketId: string, type: SocketType, isInput: boolean, x: number, y: number) => void;
  onSocketMouseUp: (nodeId: string, socketId: string, isInput: boolean) => void;
  onDragStart?: () => void;
  onDelete: (id: string) => void;
}

const NodeComponent: React.FC<NodeComponentProps> = ({ 
    node, isSelected, computedResults, connections, t,
    onSelect, onUpdatePosition, onUpdateParam, onSocketMouseDown, onSocketMouseUp, onDragStart, onDelete
}) => {
  
  const draggingRef = useRef<{ startX: number, startY: number, initX: number, initY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    e.preventDefault(); 
    if (e.button !== 0) return;

    onSelect(node.id, e.shiftKey);
    if(onDragStart) onDragStart();
    draggingRef.current = { startX: e.clientX, startY: e.clientY, initX: node.position.x, initY: node.position.y };
    
    const handleMouseMove = (mv: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = (mv.clientX - draggingRef.current.startX);
      const dy = (mv.clientY - draggingRef.current.startY);
      onUpdatePosition(node.id, { x: draggingRef.current.initX + dx, y: draggingRef.current.initY + dy });
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const getConnectedSocketId = (socketId: string) => {
     const conn = connections.find(c => c.targetNodeId === node.id && c.targetSocketId === socketId);
     return conn ? conn.sourceSocketId : null;
  };

  const formatLinkedValue = (val: any) => {
      if (val === undefined || val === null) return 'null';
      if (typeof val === 'number') return val.toFixed(2);
      if (typeof val === 'string') return `"${val.length > 5 ? val.substring(0,5)+'..' : val}"`;
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      if (typeof val === 'object') {
          if ('x' in val && 'y' in val) return `V(${val.x.toFixed(1)},${val.y.toFixed(1)}..)`;
          if (val.isMesh) return 'Mesh';
          if (val.isGroup) return 'Group';
          return 'Object';
      }
      return String(val);
  };

  const renderInputField = (input: any) => {
      const type = input.type;
      const paramValue = node.params[input.name];
      const stop = (e: React.MouseEvent) => e.stopPropagation();
      // Disable wheel value change
      const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur();

      if (type === 'number') {
          return (
            <input 
                type="number" 
                step="0.01"
                className="w-full bg-black/40 border border-gray-600 rounded px-2 text-[10px] text-blue-300 outline-none hover:border-blue-500 transition-colors h-5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                value={paramValue ?? 0} 
                onChange={(e) => onUpdateParam(node.id, input.name, parseFloat(e.target.value))} 
                onMouseDown={stop}
                onWheel={blurOnWheel}
            />
          );
      }
      
      if (type === 'vector') {
          const v = paramValue || {x:0,y:0,z:0};
          return (
            <div className="flex flex-row gap-1 w-full" onMouseDown={stop}>
                 <input type="number" step="0.1" placeholder="X" onWheel={blurOnWheel} className="flex-1 min-w-0 bg-black/30 border-l-2 border-l-red-500/80 border-y border-r border-gray-700 rounded-r px-1 text-[10px] text-gray-300 outline-none h-5 focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={v.x} onChange={e=>onUpdateParam(node.id, input.name, {...v, x: parseFloat(e.target.value)})} />
                 <input type="number" step="0.1" placeholder="Y" onWheel={blurOnWheel} className="flex-1 min-w-0 bg-black/30 border-l-2 border-l-green-500/80 border-y border-r border-gray-700 rounded-r px-1 text-[10px] text-gray-300 outline-none h-5 focus:border-green-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={v.y} onChange={e=>onUpdateParam(node.id, input.name, {...v, y: parseFloat(e.target.value)})} />
                 <input type="number" step="0.1" placeholder="Z" onWheel={blurOnWheel} className="flex-1 min-w-0 bg-black/30 border-l-2 border-l-blue-500/80 border-y border-r border-gray-700 rounded-r px-1 text-[10px] text-gray-300 outline-none h-5 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={v.z} onChange={e=>onUpdateParam(node.id, input.name, {...v, z: parseFloat(e.target.value)})} />
            </div>
          );
      }
      if (type === 'boolean') return <input type="checkbox" className="h-4 w-4 rounded border-gray-600 bg-black/40" checked={!!paramValue} onChange={e => onUpdateParam(node.id, input.name, e.target.checked)} onMouseDown={stop} />;
      if (type === 'string') return <input type="text" value={paramValue || ''} onChange={e => onUpdateParam(node.id, input.name, e.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-2 text-[10px] text-yellow-500 outline-none h-5" onMouseDown={stop} />;
      
      if (type === 'color') {
          return <div className="flex gap-2 w-full h-5 items-center" onMouseDown={stop}>
              <input type="color" value={paramValue || '#888888'} onChange={e => onUpdateParam(node.id, input.name, e.target.value)} className="w-8 h-full rounded border-none p-0 cursor-pointer bg-transparent" />
              <span className="text-[10px] text-gray-400 font-mono flex-1">{paramValue || '#888888'}</span>
          </div>;
      }

      if (type === 'any') {
         return <div className="text-[10px] text-gray-600 italic">No Input</div>;
      }
      return null;
  };

  const is2DNode = [NodeType.RECTANGLE, NodeType.CIRCLE, NodeType.ARC, NodeType.ELLIPSE, NodeType.POLYGON, NodeType.STAR].includes(node.type);

  // Common Label Style
  const LabelCell = ({ text }: { text: string }) => (
      <span className="text-[10px] text-gray-400 select-none truncate shrink-0 w-[60px] text-right mr-3" title={text}>
          {text}
      </span>
  );
  
  // Render extra params that are not sockets (Color only)
  const renderGeometryParams = () => {
       const isGeometryNode = (node.type !== NodeType.PARAMETER && node.type !== NodeType.EXPRESSION && node.type !== NodeType.GROUP && node.outputs.some(o => o.type === 'geometry' || o.type === 'shape2d' || o.type === 'curve'));
       if (!isGeometryNode) return null;

       return (
           <div className="px-3 py-1.5 border-b border-white/5 flex flex-col gap-1.5 shrink-0">
                <div className="flex items-center gap-1 h-5">
                    <LabelCell text={t('Color')} />
                    <div className="flex-1 flex items-center gap-2" onMouseDown={e => e.stopPropagation()}>
                        <input type="color" value={node.params.color || '#888888'} onChange={e => onUpdateParam(node.id, 'color', e.target.value)} className="w-6 h-5 rounded border border-gray-600 p-0 cursor-pointer bg-transparent" />
                        <span className="text-[10px] text-gray-500 font-mono uppercase">{node.params.color || '#888'}</span>
                    </div>
                </div>
           </div>
       );
  };

  return (
    <div 
      className={`absolute flex flex-col rounded-lg shadow-xl overflow-hidden border node-component transition-shadow select-none ${isSelected ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'border-gray-800 shadow-black/60'}`}
      style={{
        width: NODE_WIDTH,
        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
        backgroundColor: '#1f1f1f'
      }}
    >
      {/* Header */}
      <div 
        className={`flex items-center justify-between pl-3 pr-1 cursor-grab active:cursor-grabbing border-b shrink-0 ${isSelected ? 'bg-yellow-900/40 border-yellow-600' : 'bg-[#2a2a2a] border-gray-800'}`}
        style={{ height: HEADER_HEIGHT }}
        onMouseDown={handleMouseDown}
      >
        <span className={`text-xs font-bold truncate select-none ${isSelected ? 'text-yellow-100' : 'text-gray-200'}`}>{t(node.label)}</span>
        
        <button 
           className="p-1 text-gray-500 hover:text-red-500 hover:bg-white/10 rounded transition-colors"
           onMouseDown={(e) => { e.stopPropagation(); onDelete(node.id); }}
           title={t('Delete Node')}
        >
            <Trash2 size={12} />
        </button>
      </div>

      <div style={{ paddingTop: CONTENT_PADDING_TOP }}>
        
        {/* Custom Body Content */}
        {node.type === NodeType.PARAMETER && (
             <div className="px-3 space-y-2 box-border border-b border-white/5 shrink-0" style={{ height: getInnerBodyHeight(node.type) }}>
                 <div className="flex items-center gap-2 h-6">
                    <span className="text-[10px] text-gray-500 w-[60px] text-right">{t('name')}</span>
                    <input type="text" value={node.params.name} onChange={e => onUpdateParam(node.id, 'name', e.target.value)} className="flex-1 bg-black/30 border border-gray-600 rounded px-2 text-[10px] text-yellow-500 outline-none h-5" onMouseDown={e => e.stopPropagation()} />
                 </div>
                 <div className="flex items-center gap-2 h-6">
                    <span className="text-[10px] text-gray-500 w-[60px] text-right">{t('type')}</span>
                    <select 
                        value={node.params.type} 
                        onChange={e => onUpdateParam(node.id, 'type', e.target.value)} 
                        className="flex-1 bg-[#111] border border-gray-600 rounded px-1 text-[10px] text-gray-300 outline-none h-5" 
                        onMouseDown={e => e.stopPropagation()}
                    >
                        <option value="number">{t('Num')}</option>
                        <option value="vector">{t('Vec')}</option>
                        <option value="boolean">{t('Bool')}</option>
                        <option value="string">{t('Str')}</option>
                        <option value="color">{t('Color')}</option>
                    </select>
                 </div>
                 <div className="flex items-center gap-2 h-6">
                    <span className="text-[10px] text-gray-500 w-[60px] text-right">{t('Value')}</span>
                    <div className="flex-1 min-w-0">
                    {node.params.type === 'vector' ? (
                         <div className="flex gap-1 w-full" onMouseDown={e => e.stopPropagation()}>
                            <input type="number" onWheel={e=>e.currentTarget.blur()} className="flex-1 min-w-0 bg-black/30 border border-gray-600 rounded px-1 text-[10px] h-5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={node.params.vecX} onChange={e=>onUpdateParam(node.id, 'vecX', parseFloat(e.target.value))} />
                            <input type="number" onWheel={e=>e.currentTarget.blur()} className="flex-1 min-w-0 bg-black/30 border border-gray-600 rounded px-1 text-[10px] h-5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={node.params.vecY} onChange={e=>onUpdateParam(node.id, 'vecY', parseFloat(e.target.value))} />
                            <input type="number" onWheel={e=>e.currentTarget.blur()} className="flex-1 min-w-0 bg-black/30 border border-gray-600 rounded px-1 text-[10px] h-5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={node.params.vecZ} onChange={e=>onUpdateParam(node.id, 'vecZ', parseFloat(e.target.value))} />
                        </div>
                    ) : node.params.type === 'boolean' ? (
                        <div className="flex items-center gap-2 w-full h-5">
                             <input type="checkbox" checked={node.params.boolVal} onChange={e => onUpdateParam(node.id, 'boolVal', e.target.checked)} onMouseDown={e => e.stopPropagation()} />
                             <span className="text-[10px] text-gray-400">{node.params.boolVal ? 'TRUE' : 'FALSE'}</span>
                        </div>
                    ) : node.params.type === 'string' ? (
                        <input type="text" value={node.params.stringVal} onChange={e => onUpdateParam(node.id, 'stringVal', e.target.value)} className="w-full bg-black/30 border border-gray-600 rounded px-2 text-[10px] text-yellow-500 outline-none h-5" onMouseDown={e => e.stopPropagation()} />
                    ) : node.params.type === 'color' ? (
                        <div className="flex items-center gap-2 w-full h-5">
                            <input type="color" value={node.params.colorVal} onChange={e => onUpdateParam(node.id, 'colorVal', e.target.value)} className="w-full h-full p-0 border-none bg-transparent" onMouseDown={e => e.stopPropagation()} />
                        </div>
                    ) : (
                        <input type="number" onWheel={e=>e.currentTarget.blur()} value={node.params.value} onChange={e => onUpdateParam(node.id, 'value', parseFloat(e.target.value))} className="w-full bg-black/30 border border-gray-600 rounded px-2 text-[10px] text-blue-400 outline-none h-5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" onMouseDown={e => e.stopPropagation()} />
                    )}
                    </div>
                 </div>
             </div>
        )}

        {node.type === NodeType.EXPRESSION && (
             <div className="px-3 py-2 box-border border-b border-white/5 relative flex flex-col gap-2 shrink-0" style={{ height: getInnerBodyHeight(node.type) }}>
                 <textarea 
                    value={node.params.expression} 
                    onChange={(e) => onUpdateParam(node.id, 'expression', e.target.value)} 
                    className="w-full flex-1 bg-black/30 text-[10px] text-yellow-500 font-mono border border-gray-600 rounded px-2 py-1 outline-none resize-none leading-tight" 
                    onMouseDown={e => e.stopPropagation()} 
                    placeholder="Expr"
                 />
                 <div className="flex items-center justify-between h-6">
                     <span className="text-[10px] text-gray-400 bg-black/50 px-2 py-0.5 rounded border border-white/10 truncate max-w-[120px]">
                        = {(() => {
                            const val = computedResults.get(node.outputs[0]?.id);
                            return formatLinkedValue(val);
                        })()}
                     </span>
                     <button 
                        className="bg-blue-700 hover:bg-blue-600 text-white rounded px-2 py-0.5 text-[10px] flex items-center gap-1"
                        onMouseDown={e => e.stopPropagation()}
                     >
                         <Play size={8} fill="currentColor" /> {t('Run')}
                     </button>
                 </div>
             </div>
        )}

        {node.type === NodeType.BOOLEAN_OP && (
          <div className="px-3 border-b border-white/5 flex items-center shrink-0" style={{ height: getInnerBodyHeight(node.type) }}>
             <span className="text-[10px] text-gray-400 mr-2 w-[60px] text-right">{t('operation')}</span>
             <select className="flex-1 bg-[#111] text-[10px] text-gray-300 border border-gray-700 rounded px-2 py-0 outline-none h-6" value={node.params.operation} onChange={(e) => onUpdateParam(node.id, 'operation', e.target.value)} onMouseDown={e => e.stopPropagation()} >
               <option value="UNION">{t('Union')}</option>
               <option value="SUBTRACT">{t('Subtract')}</option>
               <option value="INTERSECT">{t('Intersect')}</option>
             </select>
          </div>
        )}

        {node.type === NodeType.FILLET && (
          <div className="px-3 border-b border-white/5 flex items-center shrink-0" style={{ height: getInnerBodyHeight(node.type) }}>
             <span className="text-[10px] text-gray-400 mr-2 w-[60px] text-right">{t('type')}</span>
             <select className="flex-1 bg-[#111] text-[10px] text-gray-300 border border-gray-700 rounded px-2 py-0 outline-none h-6" value={node.params.filletType || 'round'} onChange={(e) => onUpdateParam(node.id, 'filletType', e.target.value)} onMouseDown={e => e.stopPropagation()} >
               <option value="round">{t('Round')}</option>
               <option value="chamfer">{t('Chamfer')}</option>
             </select>
          </div>
        )}

        {is2DNode && (
             <div className="px-3 py-1 border-b border-white/5 flex flex-col gap-1 justify-center shrink-0" style={{ height: getInnerBodyHeight(node.type) }}>
                 <div className="flex items-center gap-2 h-6">
                    <span className="text-[10px] text-gray-500 whitespace-nowrap w-[60px] text-right">{t('plane')}</span>
                    <select className="flex-1 bg-[#111] text-[10px] text-gray-300 border border-gray-700 rounded px-2 py-0 outline-none h-5" value={node.params.plane || 'XOY'} onChange={(e) => onUpdateParam(node.id, 'plane', e.target.value)} onMouseDown={e => e.stopPropagation()} >
                        <option value="XOY">XOY ({t('Top')})</option>
                        <option value="XOZ">XOZ ({t('Front')})</option>
                        <option value="YOZ">YOZ ({t('Right')})</option>
                    </select>
                 </div>
             </div>
        )}

        {/* Inputs - Conditionally Rendered to match Layout Calculations */}
        {node.inputs.length > 0 && (
            <div className="flex flex-col border-b border-white/5 pb-1 shrink-0"> 
                {node.inputs.map(input => {
                    const sourceSocketId = getConnectedSocketId(input.id);
                    const connectedValue = sourceSocketId ? computedResults.get(sourceSocketId) : undefined;
                    const height = getSocketHeight(input.type);
                    
                    return (
                        <div key={input.id} className="relative flex px-3 group items-center hover:bg-white/5 transition-colors shrink-0" style={{ height: height }}>
                            {/* Socket Dot - Absolute Positioned */}
                            <div 
                                className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform z-10"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (e.button === 0) onSocketMouseDown(node.id, input.id, input.type, true, node.position.x, node.position.y);
                                }}
                                onMouseUp={(e) => {
                                    e.stopPropagation();
                                    onSocketMouseUp(node.id, input.id, true);
                                }}
                            >
                                <div className={`w-2.5 h-2.5 rounded-full border border-gray-600 ${SOCKET_COLORS[input.type] || 'bg-gray-400'} ${sourceSocketId ? 'bg-opacity-100' : 'bg-opacity-50'}`} />
                            </div>
                            
                            {/* Aligned Layout: Label | Control */}
                            <div className={`flex-1 min-w-0 flex items-center`}>
                                <LabelCell text={t(input.name)} />
                                
                                <div className="flex-1 min-w-0 flex justify-start h-full items-center">
                                    {sourceSocketId ? (
                                        <div className="text-[10px] text-green-500/90 italic truncate max-w-[100px] bg-black/20 px-2 py-0.5 rounded border border-green-900/30 w-full text-center" title={String(connectedValue)}>
                                            {formatLinkedValue(connectedValue)}
                                        </div>
                                    ) : (
                                        renderInputField(input)
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* Render extra geometry params */}
        {renderGeometryParams()}
        
        {/* Output Gap */}
        <div style={{ height: INPUT_OUTPUT_GAP }} className="shrink-0"></div>

        {/* Outputs */}
        <div className="pb-1 shrink-0">
            {node.outputs.map(output => (
                <div key={output.id} className="relative flex items-center justify-end px-3 group hover:bg-white/5 transition-colors shrink-0" style={{ height: OUTPUT_ROW_HEIGHT }}>
                    <span className="text-[10px] text-gray-400 mr-2 select-none group-hover:text-gray-200">{t(output.name)}</span>
                    <div 
                        className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform z-10"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (e.button === 0) onSocketMouseDown(node.id, output.id, output.type, false, node.position.x, node.position.y);
                        }}
                        onMouseUp={(e) => {
                            e.stopPropagation();
                            onSocketMouseUp(node.id, output.id, false);
                        }}
                    >
                        <div className={`w-2.5 h-2.5 rounded-full border border-gray-600 ${SOCKET_COLORS[output.type] || 'bg-gray-400'}`} />
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(NodeComponent, (prev, next) => {
    return (
        prev.node === next.node &&
        prev.isSelected === next.isSelected &&
        prev.computedResults === next.computedResults &&
        prev.connections === next.connections &&
        prev.t === next.t
    );
});