import { NodeData, NodeType } from '../../types';
import { getNum, getVal } from './runtimeUtils';

interface DataContext {
  node: NodeData;
  inputs: Record<string, any>;
}

// 数据流节点保持纯值计算，方便后续继续扩展 Dynamo 风格的列表处理与批量驱动能力。
export const executeDataNode = ({ node, inputs }: DataContext): any[] | null => {
  const p = node.params;

  switch (node.type) {
    case NodeType.NUMBER_RANGE: {
      const start = getNum('start', inputs, p, 0);
      const end = getNum('end', inputs, p, 100);
      const step = Math.abs(getNum('step', inputs, p, 10));
      if (step === 0) return [[]];

      const values: number[] = [];
      if (start <= end) {
        for (let current = start; current <= end; current += step) {
          values.push(Number(current.toFixed(6)));
        }
      } else {
        for (let current = start; current >= end; current -= step) {
          values.push(Number(current.toFixed(6)));
        }
      }
      return [values];
    }
    case NodeType.LIST_CREATE: {
      const list = ['item_1', 'item_2', 'item_3', 'item_4']
        .map((key) => inputs[key])
        .filter((item) => item !== undefined && item !== null);
      return [list];
    }
    case NodeType.LIST_LENGTH: {
      const list = getVal('list', inputs, p, []);
      return [Array.isArray(list) ? list.length : 0];
    }
    case NodeType.LIST_GET_ITEM: {
      const list = getVal('list', inputs, p, []);
      const index = Math.floor(getNum('index', inputs, p, 0));
      if (!Array.isArray(list) || list.length === 0) return [null];
      const safeIndex = Math.min(Math.max(index, 0), list.length - 1);
      return [list[safeIndex]];
    }
    default:
      return null;
  }
};
