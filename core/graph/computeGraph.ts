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
  externalCache?: Map<string, { hash: string, outputs: any[] }>
): Promise<Map<string, any>> => {
  const results = new Map<string, any>();
  const nodeExecutionCache = externalCache || new Map<string, { hash: string, outputs: any[] }>();

  if (depth > 5) {
    logCallback?.('自定义节点递归层级过深', 'error');
    return results;
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const hiddenByGeometryConsumerIds = new Set<string>();

  // 几何流隐藏逻辑：如果一个几何体的输出连接到了另一个几何处理节点，则通常隐藏上游预览。
  connections.forEach((conn) => {
    const sourceNode = nodeMap.get(conn.sourceNodeId);
    const targetNode = nodeMap.get(conn.targetNodeId);
    if (!sourceNode || !targetNode) return;
    const sourceSocket = sourceNode.outputs.find((output) => output.id === conn.sourceSocketId);
    const targetProducesGeometry = targetNode.outputs.some((output) => output.type === 'geometry');
    const sourceIsSketchPrimitive = sourceSocket?.type === 'shape2d' || sourceSocket?.type === 'curve';
    if (targetProducesGeometry || sourceIsSketchPrimitive) hiddenByGeometryConsumerIds.add(conn.sourceNodeId);
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

      const inputValues: Record<string, any> = {};
      const missingInputs: string[] = [];

      for (const input of (node.inputs || [])) {
        const conn = connections.find((item) => item.targetSocketId === input.id);
        if (conn && results.has(conn.sourceSocketId)) {
          inputValues[input.name] = results.get(conn.sourceSocketId);
        } else if (conn) {
          missingInputs.push(input.name);
        }
      }

      // 生成输入哈希，用于跳过未变更节点的重复计算
      const inputConnectionState = Object.fromEntries(
        (node.inputs || []).map((input) => {
          const conn = connections.find((item) => item.targetSocketId === input.id);
          return [input.name, conn ? `${conn.sourceNodeId}:${conn.sourceSocketId}` : null];
        }),
      );
      const currentHash = JSON.stringify({
        inputs: Object.fromEntries(
          Object.entries(inputValues).map(([k, v]) => [k, (v instanceof THREE.Object3D ? v.uuid : v)]),
        ),
        connections: inputConnectionState,
        missingInputs: [...missingInputs].sort(),
        params: node.params,
      });

      const cached = nodeExecutionCache.get(node.id);
      if (cached && cached.hash === currentHash) {
        // 如果输入未变且已有结果，则根据结果状态更新 results
        cached.outputs.forEach((res, idx) => {
          const outId = node.outputs?.[idx]?.id;
          if (outId && !results.has(outId)) {
            results.set(outId, res);
            hasChangesInThisPass = true;
          }
        });
        continue;
      }

      try {
        const outputs = await executeNode({ node, inputs: inputValues, globalParams });

        if (!outputs || outputs.length === 0) {
          throw new Error(missingInputs.length > 0 ? `缺少关键输入: ${missingInputs.join(', ')}` : '节点执行未返回结果');
        }

        // 缓存本次成功执行的结果
        nodeExecutionCache.set(node.id, { hash: currentHash, outputs });

        (node.outputs || []).forEach((out, idx) => {
          const result = outputs[idx];
          if (!out) return;

          const prevResult = results.get(out.id);

          if (typeof result === 'number' && typeof prevResult === 'number') {
            if (Math.abs(result - prevResult) < 1e-6) return;
          } else if (prevResult === result && typeof result !== 'object') {
            return;
          }

          if (result instanceof THREE.Object3D) {
            result.userData.nodeId = node.id;
            result.userData.visible = depth === 0 ? !hiddenByGeometryConsumerIds.has(node.id) : true;
            result.castShadow = false;
            result.receiveShadow = false;
          }

          results.set(out.id, result);
          hasChangesInThisPass = true;

          if (node.params.name && out.type !== 'geometry') {
            globalParams[node.params.name] = result;
          }
        });
      } catch (error: any) {
        // 静默处理轮询中的错误
      }
    }

    if (!hasChangesInThisPass) break;
  }

  // 最终验证：如果没有产生任何可见几何体，可选在此低频提示
  const hasGeometry = Array.from(results.values()).some(v => v instanceof THREE.Object3D);
  if (!hasGeometry && nodes.length > 0) {
    const hasGeometryOp = nodes.some(n => n.outputs.some(o => o.type === 'geometry'));
    if (hasGeometryOp) {
      // logCallback?.('未生成可视几何体', 'info'); // 也可选择静默
    }
  }

  return results;
};
