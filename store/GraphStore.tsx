import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { NodeData, Connection, NodeType, GraphState, LogEntry, ConnectionDraft } from '../types';
import { createDefaultNode, NODE_WIDTH, HEADER_HEIGHT } from '../constants';
import { computeGraph, initOCCT } from '../utils/geometryEngine';
import { v4 as uuidv4 } from 'uuid';
import { translations } from '../translations';

export interface CustomNodeDef {
  id: string;
  name: string;
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
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
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
  triggerCompute: () => void; 
  isComputing: boolean;
  kernelReady: boolean;
  savedCustomNodes: CustomNodeDef[];
  saveAsCustomNode: (name: string) => void;
  deleteCustomNode: (id: string) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const GraphContext = createContext<GraphContextType | null>(null);

export const useGraph = () => {
  const context = useContext(GraphContext);
  if (!context) throw new Error("useGraph must be used within a GraphProvider");
  return context;
};

export const GraphProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nodes, setNodesState] = useState<NodeData[]>(() => [
    createDefaultNode(NodeType.PARAMETER, { x: 50, y: 50 }),
    createDefaultNode(NodeType.BOX, { x: 350, y: 50 }),
    createDefaultNode(NodeType.SPHERE, { x: 350, y: 350 }),
    createDefaultNode(NodeType.BOOLEAN_OP, { x: 700, y: 200 })
  ]);
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
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');

  // Custom Nodes Management
  const [savedCustomNodes, setSavedCustomNodes] = useState<CustomNodeDef[]>([]);

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => prev === 'zh' ? 'en' : 'zh');
  }, []);

  const t = useCallback((key: string): string => {
     if (language === 'en') return key; // Default keys are English
     return translations['zh'][key] || key;
  }, [language]);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => [{
      id: uuidv4(),
      timestamp: new Date(),
      message,
      type
    }, ...prev].slice(0, 50));
  }, []);

  // Load Custom Nodes on Mount
  useEffect(() => {
    const stored = localStorage.getItem('paracad_custom_nodes');
    if (stored) {
      try {
        setSavedCustomNodes(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load custom nodes", e);
      }
    }
  }, []);

  // Initialize Kernel
  useEffect(() => {
      const init = async () => {
          await initOCCT();
          setKernelReady(true);
          addLog("Three.js Engine Ready", 'success');
      };
      init();
  }, [addLog]);

  const setNodes = useCallback((newNodes: NodeData[]) => {
      setNodesState(newNodes);
  }, []);
  
  const triggerCompute = useCallback(() => {
      setComputeTrigger(prev => prev + 1);
      addLog('Compute Triggered', 'info');
  }, [addLog]);

  useEffect(() => {
    if (!kernelReady) return; 

    let active = true;
    setIsComputing(true);
    
    const timer = setTimeout(() => {
        computeGraph(nodes, connections, (msg, type) => {
             if(active) addLog(msg, type || 'error');
        }).then(results => {
             if(active) {
                 setComputedResults(results);
                 setIsComputing(false);
             }
        }).catch(err => {
             if(active) {
                 addLog(`Error: ${err}`, 'error');
                 setIsComputing(false);
             }
        });
    }, 50);

    return () => { active = false; clearTimeout(timer); };
  }, [nodes, connections, computeTrigger, addLog, kernelReady]); 

  const addNode = useCallback((type: NodeType, position: { x: number; y: number }, customSpec?: string) => {
    const newNode = createDefaultNode(type, position, customSpec);
    
    setNodesState(prev => {
        // Auto-generate unique name for Parameters
        if (type === NodeType.PARAMETER) {
            let counter = 1;
            let newName = `Param${counter}`;
            const existingNames = new Set(prev.filter(n => n.type === NodeType.PARAMETER).map(n => n.params.name));
            while (existingNames.has(newName)) {
                counter++;
                newName = `Param${counter}`;
            }
            newNode.params.name = newName;
        }
        return [...prev, newNode];
    });
    // addLog(`Node Added: ${newNode.label}`, 'success'); 
  }, [addLog]);

  const removeNode = useCallback((id: string) => {
    setNodesState(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.sourceNodeId !== id && c.targetNodeId !== id));
    setSelectedNodeIds(prev => prev.filter(nid => nid !== id));
    addLog('Node Deleted', 'info');
  }, [addLog]);

  const removeSelectedNodes = useCallback(() => {
    setSelectedNodeIds(currentSelected => {
        if (currentSelected.length === 0) return currentSelected;
        
        setNodesState(prev => prev.filter(n => !currentSelected.includes(n.id)));
        setConnections(prev => prev.filter(c => !currentSelected.includes(c.sourceNodeId) && !currentSelected.includes(c.targetNodeId)));
        addLog(`Deleted ${currentSelected.length} nodes`, 'info');
        return [];
    });
  }, [addLog]);

  const duplicateSelectedNodes = useCallback(() => {
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
                         while (existingParamNames.has(newName)) {
                             counter++;
                             newName = `${baseName}${counter}`;
                         }
                         newNode.params.name = newName;
                         existingParamNames.add(newName);
                     }

                     newNodes.push(newNode);
                 }
             });
             addLog(`Duplicated ${newNodes.length} nodes`, 'success');
             return [...prevNodes, ...newNodes];
         });
         
         return currentSelected;
     });
  }, [addLog]);

  const fitView = useCallback((w: number, h: number) => {
    setPan({x: 50, y: 50});
    setZoom(1);
  }, []);

  const updateNodePosition = useCallback((id: string, position: { x: number; y: number }) => {
    setNodesState(prev => prev.map(n => n.id === id ? { ...n, position } : n));
  }, []);

  const updateNodeParam = useCallback((id: string, key: string, value: any) => {
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
  }, []);

  const addConnection = useCallback((sourceNodeId: string, sourceSocketId: string, targetNodeId: string, targetSocketId: string) => {
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
    // addLog('Connected', 'info');
  }, [addLog]);

  const removeConnection = useCallback((id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
  }, []);

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

  const loadGraph = useCallback((file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const raw = e.target?.result as string;
              const data = JSON.parse(raw);
              if (data.nodes && Array.isArray(data.nodes)) {
                  setNodesState(data.nodes);
                  setConnections(data.connections || []);
                  addLog(`Imported ${data.nodes.length} nodes`, 'success');
              } else {
                  throw new Error("Invalid Format");
              }
          } catch(err) {
              addLog('Import Failed', 'error');
          }
      };
      reader.readAsText(file);
  }, [addLog]);

  const saveAsCustomNode = useCallback((name: string) => {
      if (!name) return;
      const paramNames = new Set<string>();
      for (const n of nodes) {
          if (n.type === NodeType.PARAMETER) {
               const pName = n.params.name;
               if (!pName) continue;
               if (paramNames.has(pName)) {
                   alert(`Duplicate param name: "${pName}"`);
                   return;
               }
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
          localStorage.setItem('paracad_custom_nodes', JSON.stringify(updated));
          return updated;
      });
      addLog(`Component "${name}" saved`, 'success');
  }, [nodes, connections, addLog]);

  const deleteCustomNode = useCallback((id: string) => {
      setSavedCustomNodes(prev => {
          const updated = prev.filter(n => n.id !== id);
          localStorage.setItem('paracad_custom_nodes', JSON.stringify(updated));
          return updated;
      });
      addLog('Custom component deleted', 'info');
  }, [addLog]);

  const contextValue = useMemo(() => ({
      nodes,
      connections,
      selectedNodeIds,
      pan,
      zoom,
      computedResults,
      logs,
      connectionDraft,
      isComputing,
      kernelReady,
      savedCustomNodes,
      language,
      addLog,
      setNodes,
      addNode,
      removeNode,
      removeSelectedNodes,
      duplicateSelectedNodes,
      fitView,
      updateNodePosition,
      updateNodeParam,
      addConnection,
      removeConnection,
      setPan,
      setZoom,
      selectNode,
      setSelectedNodes,
      setConnectionDraft,
      saveGraph,
      loadGraph,
      triggerCompute,
      saveAsCustomNode,
      deleteCustomNode,
      toggleLanguage,
      t
  }), [
      nodes, connections, selectedNodeIds, pan, zoom, computedResults, logs, connectionDraft, isComputing, kernelReady, savedCustomNodes, language,
      addLog, setNodes, addNode, removeNode, removeSelectedNodes, duplicateSelectedNodes, fitView, updateNodePosition, updateNodeParam, addConnection, removeConnection, setPan, setZoom, selectNode, setSelectedNodes, setConnectionDraft, saveGraph, loadGraph, triggerCompute, saveAsCustomNode, deleteCustomNode, toggleLanguage, t
  ]);

  return (
    <GraphContext.Provider value={contextValue}>
      {children}
    </GraphContext.Provider>
  );
};
export default GraphProvider;