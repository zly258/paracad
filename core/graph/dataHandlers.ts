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

const normalizeListInput = (value: any) => (Array.isArray(value) ? value : [value]);

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
      const normalizedA = normalizeListInput(listA);
      const normalizedB = normalizeListInput(listB);
      return [[...normalizedA, ...normalizedB].filter((item) => item !== undefined && item !== null)];
    }
    case NodeType.LIST_SLICE: {
      const list = getVal('list', inputs, p, []);
      const normalized = normalizeListInput(list);
      const startIndex = Math.max(0, Math.floor(getNum('start_index', inputs, p, 0)));
      const endIndex = Math.floor(getNum('end_index', inputs, p, normalized.length));
      return [normalized.slice(startIndex, Math.max(startIndex, endIndex))];
    }
    case NodeType.LIST_REVERSE: {
      const list = getVal('list', inputs, p, []);
      return [normalizeListInput(list).slice().reverse()];
    }
    case NodeType.LIST_UNIQUE: {
      const list = getVal('list', inputs, p, []);
      const uniqueItems = normalizeListInput(list).filter((item, index, source) =>
        source.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item)) === index,
      );
      return [uniqueItems];
    }
    case NodeType.LIST_REPEAT: {
      const item = getVal('item', inputs, p, null);
      const count = Math.max(0, Math.floor(getNum('count', inputs, p, 3)));
      return [Array.from({ length: count }, () => item)];
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
    case NodeType.VECTOR_DISTANCE: {
      const a = getVec('a', inputs, p);
      const b = getVec('b', inputs, p);
      return [Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)];
    }
    case NodeType.VECTOR_ANGLE: {
      const a = getVec('a', inputs, p);
      const b = getVec('b', inputs, p);
      const dot = a.x * b.x + a.y * b.y + a.z * b.z;
      const lengthA = Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2);
      const lengthB = Math.sqrt(b.x ** 2 + b.y ** 2 + b.z ** 2);
      if (lengthA === 0 || lengthB === 0) return [0];
      const cosTheta = Math.min(1, Math.max(-1, dot / (lengthA * lengthB)));
      return [Number(((Math.acos(cosTheta) * 180) / Math.PI).toFixed(6))];
    }
    case NodeType.VECTOR_LERP: {
      const a = getVec('a', inputs, p);
      const b = getVec('b', inputs, p);
      const t = getNum('t', inputs, p, 0.5);
      return [{
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
      }];
    }
    default:
      return null;
  }
};
