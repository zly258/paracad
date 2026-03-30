import * as THREE from 'three';
import { Connection, NodeData, NodeType } from '../../types';
import { executeNode } from './nodeExecutor';

// 图求解器只负责“调度”：收集参数、准备输入、分轮执行节点。
// 真正的单节点计算逻辑由 nodeExecutor 接管，便于后续替换执行内核。
export const computeGraph = async (
  nodes: NodeData[],
  connections: Connection[],
  logCallback?: (msg: string, type?: 'info' | 'error') => void,
  depth = 0,
): Promise<Map<string, any>> => {
  const results = new Map<string, any>();

  if (depth > 5) {
    logCallback?.('自定义节点递归层级过深', 'error');
    return results;
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const hiddenByGeometryConsumerIds = new Set<string>();
  connections.forEach((conn) => {
    const targetNode = nodeMap.get(conn.targetNodeId);
    if (!targetNode) return;
    const targetProducesGeometry = targetNode.outputs.some((output) => output.type === 'geometry');
    if (targetProducesGeometry) hiddenByGeometryConsumerIds.add(conn.sourceNodeId);
  });

  const globalParams: Record<string, any> = {};
  nodes.forEach((node) => {
    if (node.type !== NodeType.PARAMETER) return;

    let value: any = 0;
    if (node.params.type === 'vector') value = { x: node.params.vecX || 0, y: node.params.vecY || 0, z: node.params.vecZ || 0 };
    else if (node.params.type === 'boolean') value = !!node.params.boolVal;
    else if (node.params.type === 'string') value = String(node.params.stringVal || '');
    else if (node.params.type === 'color') value = node.params.colorVal || '#ff0000';
    else value = Number(node.params.value || 0);

    if (node.outputs[0]) results.set(node.outputs[0].id, value);
    if (node.params.name) globalParams[node.params.name] = value;
  });

  for (let pass = 0; pass < 12; pass++) {
    let hasChanges = false;

    for (const node of nodes) {
      if (node.type === NodeType.PARAMETER) continue;
      if (node.outputs.length > 0 && results.has(node.outputs[0].id)) continue;

      const inputValues: Record<string, any> = {};
      for (const input of node.inputs) {
        const conn = connections.find((item) => item.targetSocketId === input.id);
        if (conn && results.has(conn.sourceSocketId)) {
          inputValues[input.name] = results.get(conn.sourceSocketId);
        }
      }

      try {
        const outputs = await executeNode({ node, inputs: inputValues, globalParams });
        if (!outputs?.length) continue;

        node.outputs.forEach((out, idx) => {
          const result = outputs[idx];
          if (result instanceof THREE.Object3D) {
            result.userData.nodeId = node.id;
            result.userData.visible = depth === 0 ? !hiddenByGeometryConsumerIds.has(node.id) : true;
            result.castShadow = true;
            result.receiveShadow = true;
          }
          results.set(out.id, result);
          hasChanges = true;
        });
      } catch (error) {
        console.warn(`Node ${node.label} Error:`, error);
        logCallback?.(`节点 ${node.label} 计算失败`, 'error');
      }
    }

    if (!hasChanges) break;
  }

  return results;
};
