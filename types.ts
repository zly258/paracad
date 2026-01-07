import * as THREE from 'three';

export enum NodeType {
  // Global Params & Logic
  PARAMETER = 'PARAMETER', 
  EXPRESSION = 'EXPRESSION', 
  CUSTOM = 'CUSTOM', 

  // 2D Primitives
  LINE = 'LINE',
  RECTANGLE = 'RECTANGLE',
  CIRCLE = 'CIRCLE',
  ARC = 'ARC',
  ELLIPSE = 'ELLIPSE',
  POLYGON = 'POLYGON',
  STAR = 'STAR', 

  // 3D Primitives
  BOX = 'BOX', // Restored Box
  SPHERE = 'SPHERE',
  ELLIPSOID = 'ELLIPSOID',
  CYLINDER = 'CYLINDER',
  CONE = 'CONE',
  TRUNCATED_CONE = 'TRUNCATED_CONE',
  TORUS = 'TORUS',
  CAPSULE = 'CAPSULE', 
  // Removed Polyhedrons

  // Features / Operations
  GROUP = 'GROUP', 
  FILLET = 'FILLET', // Generic Fillet
  // Removed MAKE_FACE
  EXTRUDE = 'EXTRUDE',
  REVOLVE = 'REVOLVE',
  SWEEP = 'SWEEP',
  LOFT = 'LOFT',
  BOOLEAN_OP = 'BOOLEAN_OP', 
  
  // Transformation
  TRANSLATION = 'TRANSLATION',
  ROTATION = 'ROTATION',
  SCALE = 'SCALE',
  MIRROR = 'MIRROR', 
  ARRAY_LINEAR = 'ARRAY_LINEAR', 
  ARRAY_GRID = 'ARRAY_GRID', 
  ARRAY_POLAR = 'ARRAY_POLAR'
}

export type SocketType = 'number' | 'geometry' | 'vector' | 'boolean' | 'shape2d' | 'curve' | 'any' | 'color';

export interface NodeSocket {
  id: string;
  name: string;
  type: SocketType;
  value?: any; 
}

export interface NodeData {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  inputs: NodeSocket[];
  outputs: NodeSocket[];
  label: string;
  params: Record<string, any>; 
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  sourceSocketId: string;
  targetNodeId: string;
  targetSocketId: string;
}

export interface ConnectionDraft {
  sourceNodeId: string;
  sourceSocketId: string;
  sourceType: SocketType;
  isInput: boolean;
  currentPos: { x: number, y: number };
  snappedNodeId?: string;
  snappedSocketId?: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface GraphState {
  nodes: NodeData[];
  connections: Connection[];
  selectedNodeIds: string[];
  pan: { x: number; y: number };
  zoom: number;
  logs: LogEntry[];
  connectionDraft: ConnectionDraft | null;
  language: 'zh' | 'en';
}