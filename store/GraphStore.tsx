import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { NodeData, Connection, NodeType, GraphState, LogEntry, ConnectionDraft } from '../types';
import { createDefaultNode, NODE_WIDTH, getNodeRenderHeight } from '../constants';
import { computeGraph, initOCCT } from '../utils/geometryEngine';
import { KernelBackend } from '../core/kernel';
import { v4 as uuidv4 } from 'uuid';
import { translations } from '../translations';
import { cloneGraphSnapshot, loadCustomNodeStorage, saveCustomNodeStorage } from './graphPersistence';
import { resolveNodeOverlaps } from '../utils/autoLayout';

export interface CustomNodeDef {
  id: string;
  name: string;
  nodes: NodeData[];
  connections: Connection[];
}

// History Snapshot
interface HistoryState {
    nodes: NodeData[];
    connections: Connection[];
}

interface GraphContextType extends GraphState {
  setNodes: (nodes: NodeData[]) => void;
  addNode: (type: NodeType, position: { x: number; y: number }, customSpec?: string) => void;
  removeNode: (id: string) => void;
  removeSelectedNodes: () => void;
  duplicateSelectedNodes: () => void;
  fitView: (containerWidth: number, containerHeight: number) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }, snapshot?: boolean) => void;
  updateNodeParam: (id: string, key: string, value: any) => void;
  addConnection: (sourceNodeId: string, sourceSocketId: string, targetNodeId: string, targetSocketId: string) => void;
  removeConnection: (id: string) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  selectNode: (id: string | null, multi?: boolean) => void;
  setSelectedNodes: (ids: string[]) => void;
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
  computedResults: Map<string, any>; 
  setConnectionDraft: (draft: ConnectionDraft | null) => void;
  saveGraph: () => void;
  loadGraph: (file: File) => void;
  loadGraphData: (data: { nodes: NodeData[]; connections?: Connection[] }, sourceLabel?: string) => void;
  triggerCompute: () => void; 
  isComputing: boolean;
  kernelReady: boolean;
  kernelBackend: KernelBackend;
  kernelMessage: string;
  savedCustomNodes: CustomNodeDef[];
  saveAsCustomNode: (name: string) => void;
  deleteCustomNode: (id: string) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  recordHistory: () => void;
}

const GraphContext = createContext<GraphContextType | null>(null);

export const useGraph = () => {
  const context = useContext(GraphContext);
  if (!context) throw new Error("useGraph must be used within a GraphProvider");
  return context;
};

export const GraphProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nodes, setNodesState] = useState<NodeData[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [computedResults, setComputedResults] = useState<Map<string, any>>(new Map());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [computeTrigger, setComputeTrigger] = useState(0); 
  const [kernelReady, setKernelReady] = useState(false); 
  const [kernelBackend, setKernelBackend] = useState<KernelBackend>('three-fallback');
  const [kernelMessage, setKernelMessage] = useState('内核尚未初始化');
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');

  // History
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

  // Custom Nodes Management
  const [savedCustomNodes, setSavedCustomNodes] = useState<CustomNodeDef[]>([]);
  const lastComputedKeyRef = useRef('');
  const lastComputeTriggerRef = useRef(0);

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => prev === 'zh' ? 'en' : 'zh');
  }, []);

  const t = useCallback((key: string): string => {
     if (language === 'en') return key; 
     return translations['zh'][key] || key;
  }, [language]);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => {
        const newLog = {
          id: uuidv4(),
          timestamp: new Date(),
          message,
          type
        };
        const updated = [...prev, newLog];
        if (updated.length > 50) return updated.slice(updated.length - 50);
        return updated;
    });
  }, []);

  const recordHistory = useCallback(() => {
      setHistory(prev => {
          const snapshot = cloneGraphSnapshot(nodes, connections);
          return [...prev.slice(-19), snapshot];
      });
      setFuture([]);
  }, [nodes, connections]);

  const undo = useCallback(() => {
      if (history.length === 0) return;
      const previous = history[history.length - 1];
      const current = cloneGraphSnapshot(nodes, connections);
      
      setFuture(prev => [current, ...prev]);
      setNodesState(previous.nodes);
      setConnections(previous.connections);
      setHistory(prev => prev.slice(0, -1));
      addLog('Undo', 'info');
  }, [history, nodes, connections, addLog]);

  const redo = useCallback(() => {
      if (future.length === 0) return;
      const next = future[0];
      const current = cloneGraphSnapshot(nodes, connections);

      setHistory(prev => [...prev, current]);
      setNodesState(next.nodes);
      setConnections(next.connections);
      setFuture(prev => prev.slice(1));
      addLog('Redo', 'info');
  }, [future, nodes, connections, addLog]);

  // 启动时恢复本地保存的自定义节点。
  useEffect(() => {
    try {
      setSavedCustomNodes(loadCustomNodeStorage<CustomNodeDef>());
    } catch (e) {
      console.error("Failed to load custom nodes", e);
    }
  }, []);
  // 内核初始化与回退逻辑统一放在 store 层，界面只消费状态。
  useEffect(() => {
      const init = async () => {
          const status = await initOCCT();
          setKernelReady(true);
          setKernelBackend(status.backend);
          setKernelMessage(status.message);
          addLog(status.message, status.backend === 'occt.js' ? 'success' : 'warning');
      };
      init();
  }, [addLog]);

  const setNodes = useCallback((newNodes: NodeData[]) => {
      setNodesState(newNodes);
  }, []);
  
  const triggerCompute = useCallback(() => {
      setComputeTrigger(prev => prev + 1);
  }, []);

  const computeModelKey = useMemo(() => {
    const normalizedNodes = nodes
      .map((node) => ({
        id: node.id,
        type: node.type,
        params: node.params,
        inputs: node.inputs.map((input) => ({ id: input.id, type: input.type, name: input.name })),
        outputs: node.outputs.map((output) => ({ id: output.id, type: output.type, name: output.name })),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const normalizedConnections = connections
      .map((conn) => ({
        id: conn.id,
        sourceNodeId: conn.sourceNodeId,
        sourceSocketId: conn.sourceSocketId,
        targetNodeId: conn.targetNodeId,
        targetSocketId: conn.targetSocketId,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify({ normalizedNodes, normalizedConnections });
  }, [nodes, connections]);

  // 图求解调度：仅模型参数/连接变化或用户手动刷新时重新计算，避免拖拽位置导致反复求解。
  useEffect(() => {
    if (!kernelReady) return; 
    const forcedByTrigger = computeTrigger !== lastComputeTriggerRef.current;
    if (!forcedByTrigger && computeModelKey === lastComputedKeyRef.current) return;

    let active = true;
    setIsComputing(true);
    
    const timer = setTimeout(() => {
        computeGraph(nodes, connections, (msg, type) => {
             if(active) addLog(msg, type || 'error');
        }).then(results => {
             if(active) {
                 setComputedResults(results);
                 setIsComputing(false);
                 lastComputedKeyRef.current = computeModelKey;
                 lastComputeTriggerRef.current = computeTrigger;
             }
        }).catch(err => {
             if(active) {
                 addLog(`Error: ${err}`, 'error');
                 setIsComputing(false);
             }
        });
    }, 120);

    return () => { active = false; clearTimeout(timer); };
  }, [nodes, connections, computeTrigger, computeModelKey, addLog, kernelReady]); 

  const addNode = useCallback((type: NodeType, position: { x: number; y: number }, customSpec?: string) => {
    recordHistory(); // Snapshot before change
    const newNode = createDefaultNode(type, position, customSpec);
    setNodesState(prev => {
        if (type === NodeType.PARAMETER) {
            let counter = 1;
            let newName = `Param${counter}`;
            const existingNames = new Set(prev.filter(n => n.type === NodeType.PARAMETER).map(n => n.params.name));
            while (existingNames.has(newName)) { counter++; newName = `Param${counter}`; }
            newNode.params.name = newName;
        }
        const occupied = prev.map((node) => ({
          left: node.position.x,
          right: node.position.x + NODE_WIDTH,
          top: node.position.y,
          bottom: node.position.y + getNodeRenderHeight(node),
        }));
        const newHeight = getNodeRenderHeight(newNode);
        const horizontalOverlaps = (left: number, right: number, box: { left: number; right: number }) => left < box.right && right > box.left;
        let x = newNode.position.x;
        let y = newNode.position.y;
        let attempts = 0;
        while (attempts < 120) {
          const left = x;
          const right = x + NODE_WIDTH;
          const top = y;
          const bottom = y + newHeight;
          const hit = occupied.some((box) => horizontalOverlaps(left, right, box) && top < box.bottom + 20 && bottom > box.top - 20);
          if (!hit) break;
          y += 36;
          attempts += 1;
        }
        newNode.position = { x, y };
        return [...prev, newNode];
    });
  }, [addLog, recordHistory]);

  const removeNode = useCallback((id: string) => {
    recordHistory();
    setNodesState(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.sourceNodeId !== id && c.targetNodeId !== id));
    setSelectedNodeIds(prev => prev.filter(nid => nid !== id));
    addLog('Node Deleted', 'info');
  }, [addLog, recordHistory]);

  const removeSelectedNodes = useCallback(() => {
    recordHistory();
    setSelectedNodeIds(currentSelected => {
        if (currentSelected.length === 0) return currentSelected;
        setNodesState(prev => prev.filter(n => !currentSelected.includes(n.id)));
        setConnections(prev => prev.filter(c => !currentSelected.includes(c.sourceNodeId) && !currentSelected.includes(c.targetNodeId)));
        return [];
    });
  }, [addLog, recordHistory]);

  const duplicateSelectedNodes = useCallback(() => {
     recordHistory();
     setSelectedNodeIds(currentSelected => {
         if (currentSelected.length === 0) return currentSelected;
         setNodesState(prevNodes => {
             const newNodes: NodeData[] = [];
             const existingParamNames = new Set(prevNodes.filter(n => n.type === NodeType.PARAMETER).map(n => n.params.name));
             prevNodes.forEach(node => {
                 if (currentSelected.includes(node.id)) {
                     const newNode = JSON.parse(JSON.stringify(node));
                     newNode.id = uuidv4();
                     newNode.position.x += 50;
                     newNode.position.y += 50;
                     newNode.inputs.forEach((s: any) => s.id = uuidv4());
                     newNode.outputs.forEach((s: any) => s.id = uuidv4());
                     if (newNode.type === NodeType.PARAMETER) {
                         let counter = 1;
                         let baseName = newNode.params.name.replace(/\d+$/, ''); 
                         if (!baseName) baseName = 'Param';
                         let newName = `${baseName}${counter}`;
                         while (existingParamNames.has(newName)) { counter++; newName = `${baseName}${counter}`; }
                         newNode.params.name = newName;
                         existingParamNames.add(newName);
                     }
                     newNodes.push(newNode);
                 }
             });
             return [...prevNodes, ...newNodes];
         });
         return currentSelected;
     });
  }, [addLog, recordHistory]);

  const fitView = useCallback((w: number, h: number) => {
    setPan({x: 50, y: 50});
    setZoom(1);
  }, []);

  const updateNodePosition = useCallback((id: string, position: { x: number; y: number }, snapshot = false) => {
    if (snapshot) recordHistory();
    setNodesState(prev => prev.map(n => n.id === id ? { ...n, position } : n));
  }, [recordHistory]);

  const updateNodeParam = useCallback((id: string, key: string, value: any) => {
    // Note: For sliders/input typing, this records every stroke. 
    // Optimization: In a real app, debounce or use onBlur. For this prototype, we record.
    recordHistory();
    setNodesState(prev => {
        if (key === 'name') {
            const node = prev.find(n => n.id === id);
            if (node && node.type === NodeType.PARAMETER) {
                const exists = prev.some(n => n.id !== id && n.type === NodeType.PARAMETER && n.params.name === value);
                if (exists) {
                    alert(`Param name "${value}" already exists.`);
                    return prev;
                }
            }
        }
        return prev.map(n => n.id === id ? { ...n, params: { ...n.params, [key]: value } } : n);
    });
  }, [recordHistory]);

  const addConnection = useCallback((sourceNodeId: string, sourceSocketId: string, targetNodeId: string, targetSocketId: string) => {
    recordHistory();
    setConnections(prev => {
      const filtered = prev.filter(c => c.targetSocketId !== targetSocketId);
      return [...filtered, {
        id: uuidv4(),
        sourceNodeId,
        sourceSocketId,
        targetNodeId,
        targetSocketId
      }];
    });
  }, [addLog, recordHistory]);

  const removeConnection = useCallback((id: string) => {
    recordHistory();
    setConnections(prev => prev.filter(c => c.id !== id));
  }, [recordHistory]);

  const selectNode = useCallback((id: string | null, multi: boolean = false) => {
    if (id === null) {
        if (!multi) setSelectedNodeIds([]);
        return;
    }
    setSelectedNodeIds(prev => {
        if (multi) {
            if (prev.includes(id)) return prev.filter(i => i !== id);
            return [...prev, id];
        }
        return [id];
    });
  }, []);

  const setSelectedNodes = useCallback((ids: string[]) => {
      setSelectedNodeIds(ids);
  }, []);

  const saveGraph = useCallback(() => {
    const data = { nodes, connections };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paracad-graph-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('Export JSON Success', 'success');
  }, [nodes, connections, addLog]);

  const loadGraphData = useCallback((data: { nodes: NodeData[]; connections?: Connection[] }, sourceLabel = 'JSON') => {
      if (!data?.nodes || !Array.isArray(data.nodes)) {
          addLog('Import Failed', 'error');
          return;
      }
      recordHistory();
      setNodesState(resolveNodeOverlaps(data.nodes));
      setConnections(Array.isArray(data.connections) ? data.connections : []);
      addLog(`Imported ${data.nodes.length} nodes from ${sourceLabel}`, 'success');
  }, [addLog, recordHistory]);

  const loadGraph = useCallback((file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const raw = e.target?.result as string;
              const data = JSON.parse(raw);
              loadGraphData(data, file.name);
          } catch(err) {
              addLog('Import Failed', 'error');
          }
      };
      reader.readAsText(file);
  }, [addLog, loadGraphData]);

  const saveAsCustomNode = useCallback((name: string) => {
      if (!name) return;
      const paramNames = new Set<string>();
      for (const n of nodes) {
          if (n.type === NodeType.PARAMETER) {
               const pName = n.params.name;
               if (!pName) continue;
               if (paramNames.has(pName)) { alert(`Duplicate: "${pName}"`); return; }
               paramNames.add(pName);
          }
      }
      const newDef: CustomNodeDef = {
          id: uuidv4(),
          name,
          nodes: JSON.parse(JSON.stringify(nodes)),
          connections: JSON.parse(JSON.stringify(connections))
      };
      setSavedCustomNodes(prev => {
          const updated = [...prev, newDef];
          saveCustomNodeStorage(updated);
          return updated;
      });
      addLog(`Component "${name}" saved`, 'success');
  }, [nodes, connections, addLog]);

  const deleteCustomNode = useCallback((id: string) => {
      setSavedCustomNodes(prev => {
          const updated = prev.filter(n => n.id !== id);
          saveCustomNodeStorage(updated);
          return updated;
      });
      addLog('Custom component deleted', 'info');
  }, [addLog]);

  const contextValue = useMemo(() => ({
      nodes, connections, selectedNodeIds, pan, zoom, computedResults, logs, connectionDraft, isComputing, kernelReady, kernelBackend, kernelMessage, savedCustomNodes, language,
      history, future, canUndo: history.length > 0, canRedo: future.length > 0,
      addLog, setNodes, addNode, removeNode, removeSelectedNodes, duplicateSelectedNodes, fitView, updateNodePosition, updateNodeParam, 
      addConnection, removeConnection, setPan, setZoom, selectNode, setSelectedNodes, setConnectionDraft, saveGraph, loadGraph, loadGraphData, triggerCompute, 
      saveAsCustomNode, deleteCustomNode, toggleLanguage, t, undo, redo, recordHistory
  }), [
      nodes, connections, selectedNodeIds, pan, zoom, computedResults, logs, connectionDraft, isComputing, kernelReady, kernelBackend, kernelMessage, savedCustomNodes, language, history, future,
      addLog, setNodes, addNode, removeNode, removeSelectedNodes, duplicateSelectedNodes, fitView, updateNodePosition, updateNodeParam, 
      addConnection, removeConnection, setPan, setZoom, selectNode, setSelectedNodes, setConnectionDraft, saveGraph, loadGraph, loadGraphData, triggerCompute, 
      saveAsCustomNode, deleteCustomNode, toggleLanguage, t, undo, redo, recordHistory
  ]);

  return (
    <GraphContext.Provider value={contextValue}>
      {children}
    </GraphContext.Provider>
  );
};
export default GraphProvider;



