import * as THREE from 'three';
import { Connection, NodeData, NodeType } from '../../types';
import { executeNode } from './nodeExecutor';

/**
 * 图求解器负责“调度”：
 * 1. 递归层级保护。
 * 2. 收集参数并将它们注入到计算上下文中。
 * 3. 循环执行节点直到结果稳定（支持表达式相互依赖）。
 */
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

  // 几何流隐藏逻辑：如果一个几何体的输出连接到了另一个几何处理节点，则通常隐藏上游预览。
  connections.forEach((conn) => {
    const targetNode = nodeMap.get(conn.targetNodeId);
    if (!targetNode) return;
    const targetProducesGeometry = targetNode.outputs.some((output) => output.type === 'geometry');
    if (targetProducesGeometry) hiddenByGeometryConsumerIds.add(conn.sourceNodeId);
  });

  const globalParams: Record<string, any> = {};

  // 1. 初始化显式参数节点结果
  nodes.forEach((node) => {
    if (node.type !== NodeType.PARAMETER) return;

    let value: any = 0;
    if (node.params.type === 'vector') {
      value = { x: node.params.vecX || 0, y: node.params.vecY || 0, z: node.params.vecZ || 0 };
    } else if (node.params.type === 'boolean') {
      value = !!node.params.boolVal;
    } else if (node.params.type === 'string') {
      value = String(node.params.stringVal || '');
    } else if (node.params.type === 'color') {
      value = node.params.colorVal || '#ff0000';
    } else {
      value = Number(node.params.value || 0);
    }

    if (node.outputs[0]) results.set(node.outputs[0].id, value);
    if (node.params.name) globalParams[node.params.name] = value;
  });

  // 2. 多轮执行，使表达式依赖得以传播
  const MAX_PASSES = 16;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let hasChangesInThisPass = false;

    for (const node of nodes) {
      if (node.type === NodeType.PARAMETER) continue;

      // 如果这个节点的所有输出都已经在 results 中，且我们不是强制重算的模式，理论上可以跳过。
      // 但对于表达式，因为 globalParams 可能变化，我们需要至少尝试。
      const outputsAlreadyComputed = node.outputs.length > 0 && node.outputs.every(out => results.has(out.id));
      if (outputsAlreadyComputed && node.type !== NodeType.EXPRESSION) continue;

      const inputValues: Record<string, any> = {};
      for (const input of node.inputs) {
        const conn = connections.find((item) => item.targetSocketId === input.id);
        if (conn && results.has(conn.sourceSocketId)) {
          inputValues[input.name] = results.get(conn.sourceSocketId);
        }
      }

      try {
        const outputs = await executeNode({ node, inputs: inputValues, globalParams });
        if (!outputs || outputs.length === 0) continue;

        node.outputs.forEach((out, idx) => {
          const result = outputs[idx];

          // 如果结果没变（针对原始值），减少不必要的 hasChanges 标记。
          const prevResult = results.get(out.id);
          if (prevResult === result && typeof result !== 'object') return;

          if (result instanceof THREE.Object3D) {
            result.userData.nodeId = node.id;
            result.userData.visible = depth === 0 ? !hiddenByGeometryConsumerIds.has(node.id) : true;
            result.castShadow = false;
            result.receiveShadow = false;
          }

          results.set(out.id, result);
          hasChangesInThisPass = true;

          // 核心逻辑：允许表达式结果作为后续表达式的全局参数命名引用。
          // 只有带有 name 参数的节点（通常是 Parameter 和 Expression）会暴露给 globalParams。
          if (node.params.name && out.type !== 'geometry') {
            globalParams[node.params.name] = result;
          }
        });
      } catch (error) {
        console.warn(`Node ${node.label} Error:`, error);
        // 不在这里报错，避免阻断整个图的渲染，但在 UI 日志中体现。
      }
    }

    if (!hasChangesInThisPass) break;

    if (pass === MAX_PASSES - 1) {
      logCallback?.('检测到循环依赖或计算链路过长，已停止计算', 'error');
    }
  }

  return results;
};
