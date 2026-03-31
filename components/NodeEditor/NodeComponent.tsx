import React, { useRef, useState, useEffect, useCallback } from 'react';
import { NodeData, NodeType, SocketType, Connection } from '../../types';
import { SOCKET_COLORS, NODE_WIDTH, HEADER_HEIGHT, getSocketHeight, OUTPUT_ROW_HEIGHT, CONTENT_PADDING_TOP, INPUT_OUTPUT_GAP } from '../../constants';
import { Trash2, Edit2 } from 'lucide-react';

interface NodeComponentProps {
    node: NodeData;
    isSelected: boolean;
    computedResults: Map<string, any>;
    connections: Connection[];
    t: (key: string) => string;
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
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState(node.params.name || node.label);

    useEffect(() => {
        setTempName(node.params.name || (node.params.customLabel || node.label));
    }, [node.params.name, node.params.customLabel, node.label]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (e.button !== 0) return;

        onSelect(node.id, e.shiftKey);
        if (onDragStart) onDragStart();
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

    const saveName = () => {
        setEditingName(false);
        const nameVal = node.params.name || (node.params.customLabel || node.label);
        if (tempName !== nameVal) {
            if (node.type === NodeType.PARAMETER || node.type === NodeType.EXPRESSION) {
                onUpdateParam(node.id, 'name', tempName);
            } else {
                onUpdateParam(node.id, 'customLabel', tempName);
            }
        }
    };

    const getConnectedSocketId = (socketId: string) => {
        const conn = connections.find(c => c.targetNodeId === node.id && c.targetSocketId === socketId);
        return conn ? conn.sourceSocketId : null;
    };

    const formatLinkedValue = (val: any) => {
        if (val === undefined || val === null) return 'null';
        if (typeof val === 'number') return Number.isInteger(val) ? val.toString() : val.toFixed(2);
        if (typeof val === 'string') return `"${val.length > 5 ? val.substring(0, 5) + '..' : val}"`;
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        if (typeof val === 'object') {
            if ('x' in val && 'y' in val) return `V(${val.x.toFixed(1)},${val.y.toFixed(1)}..)`;
            if (val.isMesh) return 'Mesh';
            if (val.isGroup) return 'Group';
            return 'Object';
        }
        return String(val);
    };

    const handleNumberChange = useCallback((val: string, key: string, isVec = false, vecKey?: string) => {
        if (val === '' || val === '-') {
            onUpdateParam(node.id, key, val);
            return;
        }
        const num = parseFloat(val);
        if (isNaN(num)) return;
        if (isVec && vecKey) {
            const v = typeof node.params[key] === 'object' ? node.params[key] : { x: 0, y: 0, z: 0 };
            onUpdateParam(node.id, key, { ...v, [vecKey]: num });
        } else {
            onUpdateParam(node.id, key, num);
        }
    }, [node.id, node.params, onUpdateParam]);

    const renderInputField = (input: any) => {
        const type = input.type;
        const paramValue = node.params[input.name];
        const stop = (e: React.MouseEvent) => e.stopPropagation();

        const inputClasses = "node-field w-full outline-none transition-colors h-6 leading-none";

        if (type === 'number') return <input type="text" className={inputClasses} value={paramValue ?? 0} onChange={(e) => handleNumberChange(e.target.value, input.name)} onMouseDown={stop} />;
        if (type === 'vector') {
            const v = typeof paramValue === 'object' ? paramValue : { x: 0, y: 0, z: 0 };
            const baseV = "node-field flex-1 min-w-0 outline-none h-6 leading-none focus:border-blue-500 rounded-none border-l-2 border-l-white/10";
            return (
                <div className="flex flex-row gap-1 w-full" onMouseDown={stop}>
                    <input type="text" placeholder="X" className={baseV} value={v.x} onChange={e => handleNumberChange(e.target.value, input.name, true, 'x')} />
                    <input type="text" placeholder="Y" className={baseV} value={v.y} onChange={e => handleNumberChange(e.target.value, input.name, true, 'y')} />
                    <input type="text" placeholder="Z" className={baseV} value={v.z} onChange={e => handleNumberChange(e.target.value, input.name, true, 'z')} />
                </div>
            );
        }
        if (type === 'boolean') return <input type="checkbox" className="h-3 w-3 rounded accent-blue-500" checked={!!paramValue} onChange={e => onUpdateParam(node.id, input.name, e.target.checked)} onMouseDown={stop} />;
        if (type === 'string') return <input type="text" value={paramValue || ''} onChange={e => onUpdateParam(node.id, input.name, e.target.value)} className={inputClasses} onMouseDown={stop} />;
        if (type === 'color') return <div className="flex gap-2 w-full h-6 items-center" onMouseDown={stop}><input type="color" value={paramValue || '#888888'} onChange={e => onUpdateParam(node.id, input.name, e.target.value)} className="w-8 h-4 rounded border-none p-0 cursor-pointer bg-transparent" /><span className="text-[10px] opacity-40 font-mono flex-1">{paramValue || '#888888'}</span></div>;
        if (type === 'any') return <div className="text-[10px] opacity-30 italic">No Input</div>;
        return null;
    };

    const isPreviewOutputType = (type: SocketType) => !['geometry', 'shape2d', 'curve'].includes(type);
    const displayLabel = node.params.name || (node.params.customLabel || node.label);

    return (
        <div
            className={`node-card node-component ${isSelected ? 'node-card-active' : ''}`}
            style={{ position: 'absolute', width: NODE_WIDTH, transform: `translate(${node.position.x}px, ${node.position.y}px)` }}
        >
            <div
                className={`node-card-header flex items-center justify-between cursor-grab active:cursor-grabbing ${isSelected ? 'node-card-header-selected' : ''}`}
                style={{ height: HEADER_HEIGHT }}
                onMouseDown={handleMouseDown}
                onDoubleClick={() => setEditingName(true)}
            >
                <div className="flex-1 flex items-center min-w-0 mr-2">
                    {editingName ? (
                        <input autoFocus className="node-field w-full outline-none" value={tempName} onChange={e => setTempName(e.target.value)} onBlur={saveName} onKeyDown={e => e.key === 'Enter' && saveName()} onMouseDown={e => e.stopPropagation()} />
                    ) : (
                        <>
                            <Edit2 size={10} className="mr-1.5 opacity-40 shrink-0" />
                            <span className="text-xs font-bold truncate select-none" style={{ color: 'var(--node-header-text)' }}>
                                {t(displayLabel)}
                            </span>
                        </>
                    )}
                </div>
                <button className="p-1 opacity-40 hover:opacity-100 hover:text-red-500 transition-all shrink-0" onMouseDown={(e) => { e.stopPropagation(); onDelete(node.id); }}><Trash2 size={12} /></button>
            </div>

            <div className="node-card-body" style={{ paddingTop: CONTENT_PADDING_TOP }}>

                {node.type === NodeType.PARAMETER && (
                    <div className="px-2.5 space-y-1.5 box-border border-b shrink-0 flex flex-col justify-center" style={{ minHeight: 60, borderColor: 'var(--node-divider)' }}>
                        <div className="flex items-center gap-1.5 h-6">
                            <span className="node-label w-[40px] text-right">{t('type')}</span>
                            <select value={node.params.type} onChange={e => onUpdateParam(node.id, 'type', e.target.value)} className="node-field flex-1 outline-none h-6 leading-none" onMouseDown={e => e.stopPropagation()}>
                                <option value="number">{t('Num')}</option>
                                <option value="vector">{t('Vec')}</option>
                                <option value="boolean">{t('Bool')}</option>
                                <option value="string">{t('Str')}</option>
                                <option value="color">{t('Color')}</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-1.5 h-6">
                            <span className="node-label w-[40px] text-right">{t('Value')}</span>
                            <div className="flex-1 min-w-0">
                                {node.params.type === 'vector' ? (
                                    <div className="flex gap-1 w-full" onMouseDown={e => e.stopPropagation()}>
                                        <input type="text" className="node-field flex-1 min-w-0 h-6 leading-none" value={node.params.vecX} onChange={e => handleNumberChange(e.target.value, 'vecX')} />
                                        <input type="text" className="node-field flex-1 min-w-0 h-6 leading-none" value={node.params.vecY} onChange={e => handleNumberChange(e.target.value, 'vecY')} />
                                        <input type="text" className="node-field flex-1 min-w-0 h-6 leading-none" value={node.params.vecZ} onChange={e => handleNumberChange(e.target.value, 'vecZ')} />
                                    </div>
                                ) : node.params.type === 'boolean' ? (
                                    <div className="flex items-center gap-2 w-full h-6"><input type="checkbox" checked={node.params.boolVal} onChange={e => onUpdateParam(node.id, 'boolVal', e.target.checked)} onMouseDown={e => e.stopPropagation()} /><span className="text-[10px] opacity-70">{node.params.boolVal ? 'TRUE' : 'FALSE'}</span></div>
                                ) : node.params.type === 'string' ? (
                                    <input type="text" value={node.params.stringVal} onChange={e => onUpdateParam(node.id, 'stringVal', e.target.value)} className="node-field w-full outline-none h-6 leading-none" onMouseDown={e => e.stopPropagation()} />
                                ) : node.params.type === 'color' ? (
                                    <div className="flex items-center gap-2 w-full h-6"><input type="color" value={node.params.colorVal} onChange={e => onUpdateParam(node.id, 'colorVal', e.target.value)} className="w-full h-3 p-0 border-none bg-transparent" onMouseDown={e => e.stopPropagation()} /></div>
                                ) : (
                                    <input type="text" value={node.params.value} onChange={e => handleNumberChange(e.target.value, 'value')} className="node-field w-full outline-none h-6 leading-none font-bold" onMouseDown={e => e.stopPropagation()} />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {node.type === NodeType.EXPRESSION && (
                    <div className="px-2.5 py-2 box-border border-b relative shrink-0" style={{ minHeight: 64, borderColor: 'var(--node-divider)' }}>
                        <textarea value={node.params.expression} onChange={(e) => onUpdateParam(node.id, 'expression', e.target.value)} className="node-field w-full h-full font-mono resize-none leading-tight" onMouseDown={e => e.stopPropagation()} placeholder="Math Expression" />
                        <div className="absolute bottom-3 right-3.5 pointer-events-none">
                            <span className="node-value-chip shadow-sm">
                                = {formatLinkedValue(computedResults.get(node.outputs?.[0]?.id))}
                            </span>
                        </div>
                    </div>
                )}

                {(node.inputs || []).map(input => {
                    const sourceId = getConnectedSocketId(input.id);
                    const val = sourceId ? computedResults.get(sourceId) : undefined;
                    return (
                        <div key={input.id} className="node-row shrink-0" style={{ height: getSocketHeight(input.type) }}>
                            <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 flex items-center justify-center cursor-crosshair z-10" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); if (e.button === 0) onSocketMouseDown(node.id, input.id, input.type, true, node.position.x, node.position.y); }} onMouseUp={(e) => { e.stopPropagation(); onSocketMouseUp(node.id, input.id, true); }}>
                                <div className={`w-2.5 h-2.5 rounded-full border border-black/10 ${SOCKET_COLORS[input.type] || 'bg-gray-400'} ${sourceId ? 'opacity-100 shadow-sm' : 'opacity-30'}`} />
                            </div>
                            <div className="flex-1 min-w-0 flex items-center">
                                <span className="node-label w-[48px] text-right mr-2 truncate">{t(input.name)}</span>
                                <div className="flex-1 min-w-0 flex justify-start items-center h-full">
                                    {sourceId ? (
                                        <div className="node-value-chip truncate w-full text-center">
                                            {formatLinkedValue(val)}
                                        </div>
                                    ) : renderInputField(input)}
                                </div>
                            </div>
                        </div>
                    );
                })}

                <div style={{ height: INPUT_OUTPUT_GAP }} className="shrink-0"></div>
                <div className="pb-1 shrink-0">
                    {(node.outputs || []).map(output => (
                        <div key={output.id} className="node-row justify-end shrink-0" style={{ height: OUTPUT_ROW_HEIGHT }}>
                            {isPreviewOutputType(output.type) && computedResults.has(output.id) && (
                                <span className="node-value-chip mr-2 truncate max-w-[100px] shadow-sm">
                                    {formatLinkedValue(computedResults.get(output.id))}
                                </span>
                            )}
                            <span className="node-label mr-2 transition-colors">{t(output.name)}</span>
                            <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 flex items-center justify-center cursor-crosshair z-10" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); if (e.button === 0) onSocketMouseDown(node.id, output.id, output.type, false, node.position.x, node.position.y); }} onMouseUp={(e) => { e.stopPropagation(); onSocketMouseUp(node.id, output.id, false); }}>
                                <div className={`w-2.5 h-2.5 rounded-full border border-black/10 ${SOCKET_COLORS[output.type] || 'bg-gray-400'}`} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default React.memo(NodeComponent);
