import { Connection, NodeData } from '../types';

const CUSTOM_NODE_KEY = 'paracad_custom_nodes';

export interface GraphSnapshot {
  nodes: NodeData[];
  connections: Connection[];
}

// 用结构化克隆的思路保存历史快照，避免引用共享导致撤销栈被污染。
export const cloneGraphSnapshot = (nodes: NodeData[], connections: Connection[]): GraphSnapshot => ({
  nodes: JSON.parse(JSON.stringify(nodes)),
  connections: JSON.parse(JSON.stringify(connections)),
});

export const loadCustomNodeStorage = <T>() => {
  const stored = localStorage.getItem(CUSTOM_NODE_KEY);
  if (!stored) return [] as T[];
  return JSON.parse(stored) as T[];
};

export const saveCustomNodeStorage = <T>(items: T[]) => {
  localStorage.setItem(CUSTOM_NODE_KEY, JSON.stringify(items));
};
