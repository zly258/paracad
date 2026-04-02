import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useGraph } from '../../store/GraphStore';
import NodeComponent from './NodeComponent';
import ConnectionLayer from './ConnectionLayer';
import { NodeType, NodeData, SocketType, ConnectionDraft } from '../../types';
import { LayoutGrid, Scan, Download, Upload, Undo2, Redo2, Boxes, Play } from 'lucide-react';
import { performAutoLayout } from '../../utils/autoLayout';
import { NODE_WIDTH, calculateSocketPosition, getNodeRenderHeight } from '../../constants';

const SNAP_THRESHOLD = 72;

const isSocketCompatible = (sourceType: SocketType, targetType: SocketType) =>
  sourceType === targetType || sourceType === 'any' || targetType === 'any';

const NodeCanvas: React.FC = () => {
  const {
    nodes, connections, addNode, selectNode, setNodes,
    pan, setPan, zoom, setZoom,
    removeSelectedNodes, copySelectedNodes, pasteNodes, fitView,
    selectedNodeIds, setSelectedNodes,
    connectionDraft, setConnectionDraft, addConnection,
    saveGraph, loadGraph, exportModel,
    updateNodePosition, updateNodeParam, computedResults, t,
    undo, redo, recordHistory, canUndo, canRedo,
    removeNode, removeConnection, theme, addLog, triggerCompute, isComputing
  } = useGraph();

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<any>('glb');

  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, curX: number, curY: number } | null>(null);
  const selectionStart = useRef<{ x: number, y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingCanvas = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const connectionDraftRef = useRef<ConnectionDraft | null>(connectionDraft);
  useEffect(() => {
    connectionDraftRef.current = connectionDraft;
  }, [connectionDraft]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && (e.altKey || (e.target as HTMLElement).classList.contains('canvas-root')))) {
      if (e.button === 0 && e.target === containerRef.current) {
        // Selection logic
      } else {
        isDraggingCanvas.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
        return;
      }
    }

    if (e.button === 0) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        selectionStart.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
      }
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
      let bestSnapNodeId, bestSnapSocketId;
      let bestDist = SNAP_THRESHOLD / zoom;
      let snapPos = { x: worldX, y: worldY };

      nodes.forEach(node => {
        if (node.id === connectionDraft.sourceNodeId) return;
        const cand = connectionDraft.isInput ? node.outputs : node.inputs;
        cand.forEach(sock => {
          if (!isSocketCompatible(connectionDraft.sourceType, sock.type)) return;
          const pos = calculateSocketPosition(node, sock.id, !connectionDraft.isInput);
          if (pos) {
            const dist = Math.hypot(pos.x - worldX, pos.y - worldY);
            if (dist < bestDist) {
              bestDist = dist; snapPos = pos; bestSnapNodeId = node.id; bestSnapSocketId = sock.id;
            }
          }
        });
      });

      setConnectionDraft({
        ...connectionDraft, currentPos: snapPos,
        snappedNodeId: bestSnapNodeId, snappedSocketId: bestSnapSocketId
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
        if (node.position.x < x2 && node.position.x + NODE_WIDTH > x1 &&
          node.position.y < y2 && node.position.y + getNodeRenderHeight(node) > y1) {
          idsInBox.push(node.id);
        }
      });
      if (idsInBox.length > 0) setSelectedNodes(idsInBox);
      setSelectionBox(null);
    } else if (selectionStart.current) {
      if (!e.shiftKey) selectNode(null);
    }
    selectionStart.current = null;

    if (connectionDraft) {
      if (connectionDraft.snappedNodeId && connectionDraft.snappedSocketId) {
        if (connectionDraft.isInput) addConnection(connectionDraft.snappedNodeId, connectionDraft.snappedSocketId, connectionDraft.sourceNodeId, connectionDraft.sourceSocketId);
        else addConnection(connectionDraft.sourceNodeId, connectionDraft.sourceSocketId, connectionDraft.snappedNodeId, connectionDraft.snappedSocketId);
      }
      setConnectionDraft(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const worldMouseX = (e.clientX - rect.left - pan.x) / zoom;
    const worldMouseY = (e.clientY - rect.top - pan.y) / zoom;
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.min(Math.max(0.1, zoom + delta), 3);
    setZoom(newZoom);
    setPan({ x: (e.clientX - rect.left) - worldMouseX * newZoom, y: (e.clientY - rect.top) - worldMouseY * newZoom });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType') as NodeType;
    if (type && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - pan.x) / zoom - NODE_WIDTH / 2;
      const worldY = (e.clientY - rect.top - pan.y) / zoom - 20;
      addNode(type, { x: worldX, y: worldY }, e.dataTransfer.getData('customData'));
    }
  };

  const handleSocketMouseDown = useCallback((nodeId: string, socketId: string, type: SocketType, isInput: boolean, nx: number, ny: number) => {
    const srcNode = nodes.find(n => n.id === nodeId);
    const srcPos = srcNode ? calculateSocketPosition(srcNode, socketId, isInput) : null;
    setConnectionDraft({ sourceNodeId: nodeId, sourceSocketId: socketId, sourceType: type, isInput, currentPos: srcPos || { x: nx, y: ny } });
  }, [nodes, setConnectionDraft]);

  const handleSocketMouseUpWrapper = useCallback((targetNodeId: string, targetSocketId: string, isInput: boolean) => {
    const draft = connectionDraftRef.current;
    if (draft && !draft.snappedNodeId) {
      if (draft.sourceNodeId !== targetNodeId && draft.isInput !== isInput) {
        const srcNode = nodes.find(n => n.id === (isInput ? draft.sourceNodeId : targetNodeId));
        const tarNode = nodes.find(n => n.id === (isInput ? targetNodeId : draft.sourceNodeId));
        const srcSock = srcNode?.outputs.find(s => s.id === (isInput ? draft.sourceSocketId : targetSocketId));
        const tarSock = tarNode?.inputs.find(s => s.id === (isInput ? targetSocketId : draft.sourceSocketId));
        if (srcSock && tarSock && isSocketCompatible(srcSock.type, tarSock.type)) {
          if (isInput) addConnection(draft.sourceNodeId, draft.sourceSocketId, targetNodeId, targetSocketId);
          else addConnection(targetNodeId, targetSocketId, draft.sourceNodeId, draft.sourceSocketId);
        }
      }
      setConnectionDraft(null);
    }
  }, [addConnection, nodes, setConnectionDraft]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.key === 'c') { e.preventDefault(); copySelectedNodes(); }
      if (e.ctrlKey && e.key === 'v') { e.preventDefault(); pasteNodes(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelectedNodes(); }
      if (e.ctrlKey && e.key === 'a') { e.preventDefault(); setSelectedNodes(nodes.map(n => n.id)); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, undo, redo, copySelectedNodes, pasteNodes, removeSelectedNodes, setSelectedNodes]);

  return (
    <div
      ref={containerRef}
      className="canvas-root relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing outline-none"
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onMouseLeave={handleMouseUp}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={handleDrop}
      tabIndex={0}
    >
      <div
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: '100%', height: '100%' }}
        className="relative"
      >
        <div className="canvas-grid-bg absolute -top-[50000px] -left-[50000px] w-[100000px] h-[100000px] opacity-10 pointer-events-none" />
        <ConnectionLayer nodes={nodes} connections={connections} connectionDraft={connectionDraft} onRemoveConnection={removeConnection} />
        {nodes.map(node => (
          <NodeComponent
            key={node.id} node={node} isSelected={selectedNodeIds.includes(node.id)} computedResults={computedResults} connections={connections} t={t}
            onSelect={selectNode} onUpdatePosition={updateNodePosition} onUpdateParam={updateNodeParam}
            onSocketMouseDown={handleSocketMouseDown} onSocketMouseUp={handleSocketMouseUpWrapper}
            onDragStart={() => recordHistory()} onDelete={removeNode}
          />
        ))}
      </div>

      {selectionBox && (
        <div className="absolute bg-blue-500/20 border border-blue-400 pointer-events-none" style={{ left: Math.min(selectionBox.startX, selectionBox.curX), top: Math.min(selectionBox.startY, selectionBox.curY), width: Math.abs(selectionBox.curX - selectionBox.startX), height: Math.abs(selectionBox.curY - selectionBox.startY) }} />
      )}

      <div className="canvas-toolbar">
        <button onClick={undo} disabled={!canUndo} title={t('Undo') + " (Ctrl+Z)"}><Undo2 size={16} /></button>
        <button onClick={redo} disabled={!canRedo} title={t('Redo') + " (Ctrl+Y)"}><Redo2 size={16} /></button>
        <button
          onClick={triggerCompute}
          disabled={isComputing}
          title={isComputing ? '运行中...' : '运行（强制重算）'}
          className={isComputing ? 'opacity-60' : ''}
        >
          <Play size={16} />
        </button>
        <button onClick={() => setNodes(performAutoLayout(nodes, connections))} title="自动布局"><LayoutGrid size={16} /></button>
        <button onClick={() => { if (containerRef.current) fitView(containerRef.current.clientWidth, containerRef.current.clientHeight) }} title="充满画布"><Scan size={16} /></button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button onClick={saveGraph} title="保存工程 (JSON)"><Download size={16} /></button>
        <button onClick={() => fileInputRef.current?.click()} title="打开工程 (JSON)"><Upload size={16} /></button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button onClick={() => setShowExportModal(true)} title="导出 3D 模型" className="text-blue-400"><Boxes size={16} /></button>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-6 animate-in fade-in zoom-in duration-200">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">导出 3D 模型</h3>
              <p className="text-xs text-gray-400">请选择导出格式</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'glb', label: 'GLB (Binary)', desc: 'Web & AR optimized' },
                { id: 'obj', label: 'OBJ (Wavefront)', desc: 'Legacy mesh support' }
              ].map(fmt => (
                <button
                  key={fmt.id}
                  onClick={() => setExportFormat(fmt.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${exportFormat === fmt.id
                    ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                    : 'bg-white/5 border-white/10 hover:border-white/30'
                    }`}
                >
                  <div className={`text-sm font-bold ${exportFormat === fmt.id ? 'text-blue-400' : 'text-gray-200'}`}>{fmt.label}</div>
                  <div className="text-[10px] text-gray-500 mt-1">{fmt.desc}</div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors text-sm font-medium"
                onClick={() => setShowExportModal(false)}
              >
                取消
              </button>
              <button
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 transition-all text-sm font-bold"
                onClick={() => {
                  exportModel(exportFormat);
                  setShowExportModal(false);
                }}
              >
                确认导出
              </button>
            </div>
          </div>
        </div>
      )}
      <input type="file" ref={fileInputRef} onChange={(e) => { if (e.target.files?.[0]) loadGraph(e.target.files[0]); e.target.value = ''; }} className="hidden" accept=".json" />
    </div>
  );
};

export default NodeCanvas;
