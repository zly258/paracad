import { NodeData, NodeType } from '../../types';
import { getNum, getVal, getVec } from './runtimeUtils';

interface DataContext {
  node: NodeData;
  inputs: Record<string, any>;
}

const flattenList = (list: any): any[] => {
  if (!Array.isArray(list)) return [list];
  return list.flatMap((item) => flattenList(item));
};

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
    case NodeType.RANGE_BY_COUNT: {
      const start = getNum('start', inputs, p, 0);
      const end = getNum('end', inputs, p, 100);
      const count = Math.max(1, Math.floor(getNum('count', inputs, p, 5)));
      if (count === 1) return [[Number(start.toFixed(6))]];
      const step = (end - start) / (count - 1);
      const values = Array.from({ length: count }, (_, index) => Number((start + step * index).toFixed(6)));
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
    case NodeType.LIST_FLATTEN: {
      const list = getVal('list', inputs, p, []);
      return [Array.isArray(list) ? flattenList(list) : [list]];
    }
    case NodeType.LIST_FIRST: {
      const list = getVal('list', inputs, p, []);
      return [Array.isArray(list) && list.length > 0 ? list[0] : null];
    }
    case NodeType.LIST_LAST: {
      const list = getVal('list', inputs, p, []);
      return [Array.isArray(list) && list.length > 0 ? list[list.length - 1] : null];
    }
    case NodeType.LIST_JOIN: {
      const listA = getVal('list_a', inputs, p, []);
      const listB = getVal('list_b', inputs, p, []);
      const normalizedA = Array.isArray(listA) ? listA : [listA];
      const normalizedB = Array.isArray(listB) ? listB : [listB];
      return [[...normalizedA, ...normalizedB].filter((item) => item !== undefined && item !== null)];
    }
    case NodeType.VECTOR_CREATE: {
      return [{
        x: getNum('x', inputs, p, 0),
        y: getNum('y', inputs, p, 0),
        z: getNum('z', inputs, p, 0),
      }];
    }
    case NodeType.VECTOR_ADD: {
      const a = getVec('a', inputs, p);
      const b = getVec('b', inputs, p);
      return [{ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }];
    }
    case NodeType.VECTOR_SUBTRACT: {
      const a = getVec('a', inputs, p);
      const b = getVec('b', inputs, p);
      return [{ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }];
    }
    case NodeType.VECTOR_SCALE: {
      const vector = getVec('vector', inputs, p);
      const factor = getNum('factor', inputs, p, 1);
      return [{ x: vector.x * factor, y: vector.y * factor, z: vector.z * factor }];
    }
    case NodeType.VECTOR_LENGTH: {
      const vector = getVec('vector', inputs, p);
      return [Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2)];
    }
    case NodeType.VECTOR_NORMALIZE: {
      const vector = getVec('vector', inputs, p);
      const length = Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
      if (length === 0) return [{ x: 0, y: 0, z: 0 }];
      return [{ x: vector.x / length, y: vector.y / length, z: vector.z / length }];
    }
    case NodeType.VECTOR_DOT: {
      const a = getVec('a', inputs, p);
      const b = getVec('b', inputs, p);
      return [a.x * b.x + a.y * b.y + a.z * b.z];
    }
    case NodeType.VECTOR_CROSS: {
      const a = getVec('a', inputs, p);
      const b = getVec('b', inputs, p);
      return [{
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
      }];
    }
    default:
      return null;
  }
};
