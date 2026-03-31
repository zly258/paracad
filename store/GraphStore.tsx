import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { NodeData, Connection, NodeType, GraphState, LogEntry, ConnectionDraft } from '../types';
import { createDefaultNode, NODE_WIDTH, getNodeRenderHeight } from '../constants';
import { computeGraph, initOCCT } from '../utils/geometryEngine';
import { KernelBackend } from '../core/kernel';
import { v4 as uuidv4 } from 'uuid';
import { translations } from '../translations';
import { cloneGraphSnapshot, loadCustomNodeStorage, saveCustomNodeStorage } from './graphPersistence';
import { resolveNodeOverlaps } from '../utils/autoLayout';
import { exportComputedModel, ExportFormat } from '../utils/modelExport';

export interface CustomNodeDef {
  id: string;
  name: string;
  nodes: NodeData[];
  connections: Connection[];
}

interface HistoryState {
  nodes: NodeData[];
  connections: Connection[];
}

interface GraphContextType extends GraphState {
  setNodes: (nodes: NodeData[]) => void;
  addNode: (type: NodeType, position: { x: number; y: number }, customSpec?: string) => void;
  removeNode: (id: string) => void;
  removeSelectedNodes: () => void;
  copySelectedNodes: () => void;
  pasteNodes: () => void;
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
  clearLogs: () => void;
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
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  recordHistory: () => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  exportModel: (format: ExportFormat) => Promise<void>;
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
  const [kernelMessage, setKernelMessage] = useState('初始化中...');
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');

  const [history, setHistory] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('paracad-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const clipboardRef = useRef<{ nodes: NodeData[], connections: Connection[] } | null>(null);

  const [savedCustomNodes, setSavedCustomNodes] = useState<CustomNodeDef[]>([]);
  const lastComputedKeyRef = useRef('');
  const lastComputeTriggerRef = useRef(0);

  const toggleLanguage = useCallback(() => setLanguage(prev => prev === 'zh' ? 'en' : 'zh'), []);
  const t = useCallback((key: string): string => {
    if (!key) return '';
    if (language === 'en') return key;

    // 优先尝试精确匹配
    if (translations['zh'][key]) return translations['zh'][key];

    // 尝试忽略大小写的匹配（处理 JSON 格式不统一的问题）
    const lowerKey = key.toLowerCase();
    const foundKey = Object.keys(translations['zh']).find(k => k.toLowerCase() === lowerKey);
    if (foundKey) return translations['zh'][foundKey];

    return key;
  }, [language]);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => {
      const newLog = { id: uuidv4(), timestamp: new Date(), message, type };
      const updated = [...prev, newLog];
      return updated.length > 50 ? updated.slice(updated.length - 50) : updated;
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
    recordHistory();
    const previous = history[history.length - 1];
    const current = cloneGraphSnapshot(nodes, connections);
    setFuture(prev => [current, ...prev]);
    setNodesState(previous.nodes);
    setConnections(previous.connections);
    setHistory(prev => prev.slice(0, -1));
  }, [history, nodes, connections, recordHistory]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const current = cloneGraphSnapshot(nodes, connections);
    setHistory(prev => [...prev, current]);
    setNodesState(next.nodes);
    setConnections(next.connections);
    setFuture(prev => prev.slice(1));
  }, [future, nodes, connections]);

  useEffect(() => {
    try { setSavedCustomNodes(loadCustomNodeStorage<CustomNodeDef>()); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('paracad-theme', theme);
  }, [theme]);

  useEffect(() => {
    const init = async () => {
      const status = await initOCCT();
      setKernelReady(true);
      setKernelBackend(status.backend);
      setKernelMessage(status.message);
      if (status.backend !== 'occt.js') {
        addLog(status.message, 'warning');
      }
    };
    init();
  }, [addLog]);

  const setNodes = useCallback((newNodes: NodeData[]) => { setNodesState(newNodes); }, []);
  const clearLogs = useCallback(() => { setLogs([]); }, []);
  const setTheme = useCallback((t: 'dark' | 'light') => setThemeState(t), []);

  const exportModel = useCallback(async (format: ExportFormat) => {
    try {
      await exportComputedModel(computedResults, format);
      addLog(`Exported as ${format.toUpperCase()}`, 'success');
    } catch (err: any) {
      addLog(`Export Failed: ${err.message}`, 'error');
    }
  }, [computedResults, addLog]);
  const triggerCompute = useCallback(() => { setComputeTrigger(prev => prev + 1); }, []);

  const computeModelKey = useMemo(() => {
    const normalizedNodes = nodes.map(n => ({ id: n.id, type: n.type, params: n.params })).sort((a, b) => a.id.localeCompare(b.id));
    const normalizedConns = connections.map(c => ({ id: c.id, sourceNodeId: c.sourceNodeId, targetNodeId: c.targetNodeId })).sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify({ normalizedNodes, normalizedConns });
  }, [nodes, connections]);

  const nodeExecutionCacheRef = useRef<Map<string, { hash: string, outputs: any[] }>>(new Map());

  useEffect(() => {
    if (!kernelReady) return;
    if (computeTrigger === lastComputeTriggerRef.current && computeModelKey === lastComputedKeyRef.current) return;

    let active = true;
    setIsComputing(true);
    const timer = setTimeout(() => {
      computeGraph(nodes, connections, (msg, type) => { if (active) addLog(msg, type || 'error'); }, 0, nodeExecutionCacheRef.current)
        .then(results => {
          if (active) {
            setComputedResults(results);
            setIsComputing(false);
            lastComputedKeyRef.current = computeModelKey;
            lastComputeTriggerRef.current = computeTrigger;
          }
        })
        .catch((err) => {
          if (active) {
            // 静默处理拖拽产生的碎片化计算中断。主要错误已由节点自身状态体现。
            setComputedResults(new Map());
            setIsComputing(false);
          }
        });
    }, 120);
    return () => { active = false; clearTimeout(timer); };
  }, [nodes, connections, computeTrigger, computeModelKey, addLog, kernelReady]);

  const addNode = useCallback((type: NodeType, position: { x: number; y: number }, customSpec?: string) => {
    recordHistory();
    const newNode = createDefaultNode(type, position, customSpec);
    setNodesState(prev => {
      if (type === NodeType.PARAMETER || type === NodeType.EXPRESSION) {
        let counter = 1;
        let baseName = type === NodeType.PARAMETER ? 'Param' : 'Expr';
        let newName = `${baseName}${counter}`;
        const existingNames = new Set(prev.filter(n => n.type === NodeType.PARAMETER || n.type === NodeType.EXPRESSION).map(n => n.params.name));
        while (existingNames.has(newName)) { counter++; newName = `${baseName}${counter}`; }
        newNode.params.name = newName;
      }
      return [...prev, newNode];
    });
  }, [recordHistory]);

  const removeNode = useCallback((id: string) => {
    recordHistory();
    setNodesState(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.sourceNodeId !== id && c.targetNodeId !== id));
    setSelectedNodeIds(prev => prev.filter(nid => nid !== id));
  }, [recordHistory]);

  const removeSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    recordHistory();
    setNodesState(prev => prev.filter(n => !selectedNodeIds.includes(n.id)));
    setConnections(prev => prev.filter(c => !selectedNodeIds.includes(c.sourceNodeId) && !selectedNodeIds.includes(c.targetNodeId)));
    setSelectedNodeIds([]);
  }, [selectedNodeIds, recordHistory]);

  const copySelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const copiedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    const copiedConnections = connections.filter(c => selectedNodeIds.includes(c.sourceNodeId) && selectedNodeIds.includes(c.targetNodeId));
    clipboardRef.current = JSON.parse(JSON.stringify({ nodes: copiedNodes, connections: copiedConnections }));
    addLog(`Copied ${copiedNodes.length} nodes`, 'info');
  }, [nodes, connections, selectedNodeIds, addLog]);

  const pasteNodes = useCallback(() => {
    if (!clipboardRef.current) return;
    recordHistory();
    const clip = JSON.parse(JSON.stringify(clipboardRef.current));
    const idMap: Record<string, string> = {};
    const socketMap: Record<string, string> = {};

    // Assign new IDs
    clip.nodes.forEach((n: NodeData) => {
      const oldId = n.id;
      n.id = uuidv4();
      idMap[oldId] = n.id;
      n.position.x += 40;
      n.position.y += 40;
      n.inputs.forEach(s => { const o = s.id; s.id = uuidv4(); socketMap[o] = s.id; });
      n.outputs.forEach(s => { const o = s.id; s.id = uuidv4(); socketMap[o] = s.id; });
    });

    clip.connections.forEach((c: Connection) => {
      c.id = uuidv4();
      c.sourceNodeId = idMap[c.sourceNodeId];
      c.targetNodeId = idMap[c.targetNodeId];
      c.sourceSocketId = socketMap[c.sourceSocketId];
      c.targetSocketId = socketMap[c.targetSocketId];
    });

    setNodesState(prev => [...prev, ...clip.nodes]);
    setConnections(prev => [...prev, ...clip.connections]);
    setSelectedNodeIds(clip.nodes.map((n: NodeData) => n.id));
    addLog(`Pasted ${clip.nodes.length} nodes`, 'success');
  }, [recordHistory, addLog]);

  const duplicateSelectedNodes = useCallback(() => {
    copySelectedNodes();
    pasteNodes();
  }, [copySelectedNodes, pasteNodes]);

  const fitView = useCallback(() => { setPan({ x: 50, y: 50 }); setZoom(1); }, []);

  const updateNodePosition = useCallback((id: string, position: { x: number; y: number }, snapshot = false) => {
    if (snapshot) recordHistory();
    setNodesState(prev => prev.map(n => n.id === id ? { ...n, position } : n));
  }, [recordHistory]);

  const updateNodeParam = useCallback((id: string, key: string, value: any) => {
    recordHistory();
    setNodesState(prev => {
      if (key === 'name') {
        const exists = prev.some(n => n.id !== id && (n.type === NodeType.PARAMETER || n.type === NodeType.EXPRESSION) && n.params.name === value);
        if (exists) { addLog(`标识符 "${value}" 已被占用`, 'warning'); return prev; }
      }
      return prev.map(n => n.id === id ? { ...n, params: { ...n.params, [key]: value } } : n);
    });
  }, [recordHistory, addLog]);

  const addConnection = useCallback((sourceNodeId: string, sourceSocketId: string, targetNodeId: string, targetSocketId: string) => {
    recordHistory();
    setConnections(prev => {
      const filtered = prev.filter(c => c.targetSocketId !== targetSocketId);
      return [...filtered, { id: uuidv4(), sourceNodeId, sourceSocketId, targetNodeId, targetSocketId }];
    });
  }, [recordHistory]);

  const removeConnection = useCallback((id: string) => { recordHistory(); setConnections(prev => prev.filter(c => c.id !== id)); }, [recordHistory]);

  const selectNode = useCallback((id: string | null, multi: boolean = false) => {
    if (id === null) { if (!multi) setSelectedNodeIds([]); return; }
    setSelectedNodeIds(prev => multi ? (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]) : [id]);
  }, []);

  const setSelectedNodes = useCallback((ids: string[]) => { setSelectedNodeIds(ids); }, []);
  const saveGraph = useCallback(() => {
    const data = { nodes, connections };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paracad-graph-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, connections]);

  const loadGraphData = useCallback((data: { nodes: NodeData[]; connections?: Connection[] }) => {
    if (!data?.nodes || !Array.isArray(data.nodes)) return;
    recordHistory();
    nodeExecutionCacheRef.current.clear();
    setNodesState(resolveNodeOverlaps(data.nodes));
    setConnections(Array.isArray(data.connections) ? data.connections : []);
  }, [recordHistory]);

  const loadFromJSON = useCallback((jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.nodes && data.connections) {
        nodeExecutionCacheRef.current.clear(); // 加载新示例时清空缓存，防止 ID 冲突或残留
        setNodes(data.nodes);
        setConnections(data.connections);
        addLog('脚本已成功加载', 'info');
      }
    } catch (err) {
      addLog(`加载失败: ${err}`, 'error');
    }
  }, [addLog]);

  const loadGraph = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { loadGraphData(JSON.parse(e.target?.result as string)); } catch (err) { addLog('Import Failed', 'error'); }
    };
    reader.readAsText(file);
  }, [addLog, loadGraphData]);

  const saveAsCustomNode = useCallback((name: string) => {
    if (!name) return;
    const newDef: CustomNodeDef = { id: uuidv4(), name, nodes: JSON.parse(JSON.stringify(nodes)), connections: JSON.parse(JSON.stringify(connections)) };
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
  }, []);

  const contextValue = useMemo(() => ({
    nodes, connections, selectedNodeIds, pan, zoom, computedResults, logs, connectionDraft, isComputing, kernelReady, kernelBackend, kernelMessage, savedCustomNodes, language,
    history, future, canUndo: history.length > 0, canRedo: future.length > 0,
    addLog, setNodes, addNode, removeNode, removeSelectedNodes, copySelectedNodes, pasteNodes, duplicateSelectedNodes, fitView, updateNodePosition, updateNodeParam,
    addConnection, removeConnection, setPan, setZoom, selectNode, setSelectedNodes, setConnectionDraft, saveGraph, loadGraph, loadGraphData, triggerCompute,
    saveAsCustomNode, deleteCustomNode, toggleLanguage, t, undo, redo, recordHistory, clearLogs, theme, setTheme, exportModel
  }), [
    nodes, connections, selectedNodeIds, pan, zoom, computedResults, logs, connectionDraft, isComputing, kernelReady, kernelBackend, kernelMessage, savedCustomNodes, language, history, future,
    addLog, setNodes, addNode, removeNode, removeSelectedNodes, copySelectedNodes, pasteNodes, duplicateSelectedNodes, fitView, updateNodePosition, updateNodeParam,
    addConnection, removeConnection, setPan, setZoom, selectNode, setSelectedNodes, setConnectionDraft, saveGraph, loadGraph, loadGraphData, triggerCompute,
    saveAsCustomNode, deleteCustomNode, toggleLanguage, t, undo, redo, recordHistory, clearLogs, theme, setTheme, exportModel
  ]);
  return <GraphContext.Provider value={contextValue}>{children}</GraphContext.Provider>;
};
export default GraphProvider;
