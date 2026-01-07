import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useGraph } from '../../store/GraphStore';
import NodeComponent from './NodeComponent';
import ConnectionLayer from './ConnectionLayer';
import { NodeType, NodeData, SocketType, ConnectionDraft } from '../../types';
import { Maximize, Trash2, Copy, Scan, LayoutGrid, Download, Upload, Undo2, Redo2 } from 'lucide-react';
import { performAutoLayout } from '../../utils/autoLayout';
import { NODE_WIDTH, calculateSocketPosition } from '../../constants';

const SNAP_THRESHOLD = 40; 

const NodeCanvas: React.FC = () => {
  const { 
      nodes, connections, addNode, selectNode, setNodes, 
      pan, setPan, zoom, setZoom, 
      removeSelectedNodes, duplicateSelectedNodes, fitView,
      selectedNodeIds, setSelectedNodes,
      connectionDraft, setConnectionDraft, addConnection,
      saveGraph, loadGraph,
      updateNodePosition, updateNodeParam, computedResults, t,
      undo, redo, recordHistory, canUndo, canRedo,
      removeNode, removeConnection
  } = useGraph();
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, curX: number, curY: number } | null>(null);
  const selectionStart = useRef<{ x: number, y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingCanvas = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const isDraggingNode = useRef(false); 

  const connectionDraftRef = useRef<ConnectionDraft | null>(connectionDraft);
  useEffect(() => {
      connectionDraftRef.current = connectionDraft;
  }, [connectionDraft]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContextMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { 
       isDraggingCanvas.current = true;
       lastMousePos.current = { x: e.clientX, y: e.clientY };
       e.preventDefault();
       return;
    } 
    
    if (e.button === 0) {
       const rect = containerRef.current?.getBoundingClientRect();
       if(rect) {
           selectionStart.current = {
               x: e.clientX - rect.left,
               y: e.clientY - rect.top
           };
       }
       setContextMenu(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    if (isDraggingCanvas.current) {
       const dx = e.clientX - lastMousePos.current.x;
       const dy = e.clientY - lastMousePos.current.y;
       setPan({ x: pan.x + dx, y: pan.y + dy });
       lastMousePos.current = { x: e.clientX, y: e.clientY };
    }

    if (selectionStart.current) {
        if (!selectionBox) {
            const dx = localX - selectionStart.current.x;
            const dy = localY - selectionStart.current.y;
            if (dx * dx + dy * dy > 25) {
                setSelectionBox({
                    startX: selectionStart.current.x,
                    startY: selectionStart.current.y,
                    curX: localX,
                    curY: localY
                });
            }
        } else {
            setSelectionBox(prev => prev ? { ...prev, curX: localX, curY: localY } : null);
        }
    }

    if (connectionDraft) {
        const worldX = (localX - pan.x) / zoom;
        const worldY = (localY - pan.y) / zoom;
        
        let bestSnapNodeId: string | undefined = undefined;
        let bestSnapSocketId: string | undefined = undefined;
        let bestDist = SNAP_THRESHOLD / zoom; 
        let snapPos = { x: worldX, y: worldY };

        nodes.forEach(node => {
            if (node.id === connectionDraft.sourceNodeId) return;

            const candidateSockets = connectionDraft.isInput ? node.outputs : node.inputs;
            const isTargetInput = !connectionDraft.isInput;

            candidateSockets.forEach(sock => {
                const pos = calculateSocketPosition(node, sock.id, isTargetInput);
                if (pos) {
                    const dist = Math.hypot(pos.x - worldX, pos.y - worldY);
                    if (dist < bestDist) {
                        bestDist = dist;
                        snapPos = pos;
                        bestSnapNodeId = node.id;
                        bestSnapSocketId = sock.id;
                    }
                }
            });
        });

        setConnectionDraft({ 
            ...connectionDraft, 
            currentPos: snapPos,
            snappedNodeId: bestSnapNodeId,
            snappedSocketId: bestSnapSocketId
        });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isDraggingCanvas.current = false;
    
    if (selectionBox) {
        const x1 = (Math.min(selectionBox.startX, selectionBox.curX) - pan.x) / zoom;
        const x2 = (Math.max(selectionBox.startX, selectionBox.curX) - pan.x) / zoom;
        const y1 = (Math.min(selectionBox.startY, selectionBox.curY) - pan.y) / zoom;
        const y2 = (Math.max(selectionBox.startY, selectionBox.curY) - pan.y) / zoom;

        const idsInBox: string[] = [];
        nodes.forEach(node => {
            if (node.position.x < x2 && 
                node.position.x + NODE_WIDTH > x1 &&
                node.position.y < y2 &&
                node.position.y + 100 > y1) { 
                idsInBox.push(node.id);
            }
        });
        
        if (idsInBox.length > 0) setSelectedNodes(idsInBox);
        setSelectionBox(null);
    } else if (selectionStart.current) {
        if (!e.shiftKey) {
            selectNode(null);
        }
    }

    selectionStart.current = null;

    if (connectionDraft) {
        if (connectionDraft.snappedNodeId && connectionDraft.snappedSocketId) {
            if (connectionDraft.isInput) {
                addConnection(connectionDraft.snappedNodeId, connectionDraft.snappedSocketId, connectionDraft.sourceNodeId, connectionDraft.sourceSocketId);
            } else {
                addConnection(connectionDraft.sourceNodeId, connectionDraft.sourceSocketId, connectionDraft.snappedNodeId, connectionDraft.snappedSocketId);
            }
        }
        setConnectionDraft(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldMouseX = (mouseX - pan.x) / zoom;
    const worldMouseY = (mouseY - pan.y) / zoom;
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.min(Math.max(0.1, zoom + delta), 3);
    const newPanX = mouseX - worldMouseX * newZoom;
    const newPanY = mouseY - worldMouseY * newZoom;
    setZoom(newZoom);
    setPan({x: newPanX, y: newPanY});
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('nodeType') as NodeType;
      if (type && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const worldX = (e.clientX - rect.left - pan.x) / zoom - NODE_WIDTH/2;
          const worldY = (e.clientY - rect.top - pan.y) / zoom - 20;
          if (type === NodeType.CUSTOM) {
               const customData = e.dataTransfer.getData('customData');
               addNode(type, { x: worldX, y: worldY }, customData);
          } else {
               addNode(type, { x: worldX, y: worldY });
          }
      }
  };

  const handleSocketMouseDown = useCallback((nodeId: string, socketId: string, type: SocketType, isInput: boolean, nx: number, ny: number) => {
      setConnectionDraft({
        sourceNodeId: nodeId,
        sourceSocketId: socketId,
        sourceType: type,
        isInput,
        currentPos: { x: nx, y: ny }
    });
  }, [setConnectionDraft]);

  const handleSocketMouseUpWrapper = useCallback((targetNodeId: string, targetSocketId: string, isInput: boolean) => {
      const draft = connectionDraftRef.current;
      if (draft && !draft.snappedNodeId) { 
        if (draft.sourceNodeId !== targetNodeId && draft.isInput !== isInput) {
             if (isInput) addConnection(draft.sourceNodeId, draft.sourceSocketId, targetNodeId, targetSocketId);
             else addConnection(targetNodeId, targetSocketId, draft.sourceNodeId, draft.sourceSocketId);
        }
        setConnectionDraft(null);
    }
  }, [addConnection, setConnectionDraft]);

  const handleNodeDragStart = useCallback(() => {
      recordHistory();
  }, [recordHistory]);


  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-[#1a1a1a] overflow-hidden cursor-grab active:cursor-grabbing outline-none"
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onMouseLeave={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      tabIndex={0}
      onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
          if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
          if (e.key === 'Delete' || e.key === 'Backspace') removeSelectedNodes();
      }}
    >
      <div 
        style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '100%', height: '100%'
        }}
        className="relative"
      >
          <div 
            className="absolute -top-[50000px] -left-[50000px] w-[100000px] h-[100000px] opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#888 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          />

          <ConnectionLayer nodes={nodes} connections={connections} connectionDraft={connectionDraft} onRemoveConnection={removeConnection} />

          {nodes.map(node => (
            <NodeComponent 
                key={node.id} 
                node={node} 
                isSelected={selectedNodeIds.includes(node.id)}
                computedResults={computedResults}
                connections={connections}
                t={t}
                onSelect={selectNode}
                onUpdatePosition={updateNodePosition}
                onUpdateParam={updateNodeParam}
                onSocketMouseDown={handleSocketMouseDown}
                onSocketMouseUp={handleSocketMouseUpWrapper}
                onDragStart={handleNodeDragStart} 
                onDelete={removeNode}
            />
          ))}
      </div>

      {selectionBox && (
          <div 
            className="absolute bg-blue-500/20 border border-blue-400 pointer-events-none"
            style={{
                left: Math.min(selectionBox.startX, selectionBox.curX),
                top: Math.min(selectionBox.startY, selectionBox.curY),
                width: Math.abs(selectionBox.curX - selectionBox.startX),
                height: Math.abs(selectionBox.curY - selectionBox.startY)
            }}
          />
      )}

      {/* Canvas Toolbar */}
      <div className="absolute top-4 right-4 flex gap-2">
         <button 
             onClick={undo} 
             disabled={!canUndo}
             className={`p-2 rounded backdrop-blur border border-white/10 transition-colors ${canUndo ? 'bg-black/50 hover:bg-black/80 text-white' : 'bg-black/30 text-gray-600 cursor-not-allowed'}`}
             title={t('Undo') + " (Ctrl+Z)"}
         >
             <Undo2 size={16} />
         </button>
         <button 
             onClick={redo} 
             disabled={!canRedo}
             className={`p-2 rounded backdrop-blur border border-white/10 transition-colors ${canRedo ? 'bg-black/50 hover:bg-black/80 text-white' : 'bg-black/30 text-gray-600 cursor-not-allowed'}`}
             title={t('Redo') + " (Ctrl+Y)"}
         >
             <Redo2 size={16} />
         </button>
         <div className="w-px bg-white/10 mx-1 h-8"></div>
         <button onClick={() => setNodes(performAutoLayout(nodes, connections))} className="bg-black/50 hover:bg-black/80 text-white p-2 rounded backdrop-blur border border-white/10 transition-colors" title="自动布局"><LayoutGrid size={16} /></button>
         <button onClick={() => {if(containerRef.current) fitView(containerRef.current.clientWidth, containerRef.current.clientHeight)}} className="bg-black/50 hover:bg-black/80 text-white p-2 rounded backdrop-blur border border-white/10 transition-colors" title="充满画布"><Scan size={16} /></button>
         <div className="w-px bg-white/10 mx-1 h-8"></div>
         <button onClick={saveGraph} className="bg-black/50 hover:bg-black/80 text-white p-2 rounded backdrop-blur border border-white/10 transition-colors" title="导出 JSON"><Download size={16} /></button>
         <button onClick={() => fileInputRef.current?.click()} className="bg-black/50 hover:bg-black/80 text-white p-2 rounded backdrop-blur border border-white/10 transition-colors" title="导入 JSON"><Upload size={16} /></button>
         <input type="file" ref={fileInputRef} onChange={(e) => { if(e.target.files?.[0]) loadGraph(e.target.files[0]); e.target.value = ''; }} className="hidden" accept=".json" />
      </div>

      {contextMenu && (
        <div 
          className="absolute bg-[#2a2a2a] border border-gray-600 rounded-md shadow-2xl py-1 z-50 w-40 text-gray-200"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={e => e.stopPropagation()}
        >
           <button className="w-full text-left px-4 py-2 text-xs hover:bg-blue-600 hover:text-white flex items-center gap-2" onClick={() => { duplicateSelectedNodes(); setContextMenu(null); }}><Copy size={12} /> 复制节点</button>
           <button className="w-full text-left px-4 py-2 text-xs hover:bg-red-600 hover:text-white flex items-center gap-2" onClick={() => { removeSelectedNodes(); setContextMenu(null); }}><Trash2 size={12} /> 删除节点</button>
        </div>
      )}
    </div>
  );
};

export default NodeCanvas;