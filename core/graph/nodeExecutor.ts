import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';
import { NodeData, NodeType } from '../../types';
import { executeAnalysisNode } from './analysisHandlers';
import { executeDataNode } from './dataHandlers';
import { getKernelStatus } from '../kernel';
import {
  createOcctDir,
  createOcctInstance,
  createOcctPoint,
  createOcctVec,
  planeToNormal,
} from './occtHelpers';
import { buildOcctBooleanShape } from './occtBoolean';
import { executeFeatureNode } from './featureHandlers';
import { tryOcct } from './occtRuntime';
import { executeSketchNode } from './sketchHandlers';
import { executeSolidNode } from './solidHandlers';
import { executeTransformNode } from './transformHandlers';
import {
  cloneObject,
  getMaterial,
  getNum,
  getVal,
  getVec,
  tagKernel,
} from './runtimeUtils';

const csgEvaluator = new Evaluator();
csgEvaluator.attributes = ['position', 'normal', 'uv'];

export interface NodeExecutionContext {
  node: NodeData;
  inputs: Record<string, any>;
  globalParams: Record<string, any>;
}

const extractOcctShape = (input: any) => input?.userData?.occtShape;
const extractOcctWire = (input: any) => input?.userData?.occtWire || input?.userData?.occtShape;

// 节点执行器：负责把“节点类型 + 输入参数”翻译成几何结果。
// 当前主要承担浏览器预览职责，后续可逐步替换为 OCCT BRep 路径。
export const executeNode = async ({ node, inputs, globalParams }: NodeExecutionContext): Promise<any[]> => {
  const p = node.params;
  const color = p.color || '#888888';

  const createMesh = (geom: THREE.BufferGeometry, detail: string) =>
    tagKernel(new THREE.Mesh(geom, getMaterial(color)), node, detail);

  switch (node.type) {
    case NodeType.EXPRESSION: {
      try {
        const keys = Object.keys(globalParams).filter(k => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k));
        const values = keys.map(k => globalParams[k]);
        // 使用 new Function(...keys, body) 配合 try...catch 处理未定义引用
        const fn = new Function(...keys, `
          try { 
            const result = (${p.expression || '0'}); 
            return (result !== undefined && result !== null) ? result : 0;
          } catch(e) { 
            return 0; 
          }
        `);
        const result = fn(...values);
        return [result];
      } catch (err) {
        return [0];
      }
    }
    case NodeType.CUSTOM:
      return [null];
    case NodeType.LINE:
    case NodeType.ARC:
    case NodeType.STAR:
    case NodeType.RECTANGLE:
    case NodeType.CIRCLE:
    case NodeType.POLYGON:
    case NodeType.ELLIPSE: {
      const sketchResult = await executeSketchNode({ node, inputs });
      if (sketchResult) return sketchResult;
      return [null];
    }
    case NodeType.FILLET:
    case NodeType.EXTRUDE:
    case NodeType.REVOLVE:
    case NodeType.SWEEP:
    case NodeType.LOFT: {
      const featureResult = await executeFeatureNode({ node, inputs });
      if (featureResult) return featureResult;
      return [null];
    }
    case NodeType.BOX:
    case NodeType.SPHERE:
    case NodeType.ELLIPSOID:
    case NodeType.CAPSULE:
    case NodeType.CYLINDER:
    case NodeType.CONE:
    case NodeType.TRUNCATED_CONE:
    case NodeType.TORUS: {
      const solidResult = await executeSolidNode({ node, inputs });
      if (solidResult) return solidResult;
      return [null];
    }
    case NodeType.BOUNDING_BOX:
    case NodeType.SURFACE_AREA:
    case NodeType.VOLUME:
    case NodeType.CENTROID: {
      const analysisResult = await executeAnalysisNode({ node, inputs });
      if (analysisResult) return analysisResult;
      return [null];
    }
    case NodeType.NUMBER_RANGE:
    case NodeType.RANGE_BY_COUNT:
    case NodeType.LIST_CREATE:
    case NodeType.LIST_LENGTH:
    case NodeType.LIST_FLATTEN:
    case NodeType.LIST_FIRST:
    case NodeType.LIST_LAST:
    case NodeType.LIST_JOIN:
    case NodeType.LIST_SLICE:
    case NodeType.LIST_REVERSE:
    case NodeType.LIST_UNIQUE:
    case NodeType.LIST_REPEAT:
    case NodeType.LIST_GET_ITEM:
    case NodeType.VECTOR_CREATE:
    case NodeType.VECTOR_ADD:
    case NodeType.VECTOR_SUBTRACT:
    case NodeType.VECTOR_SCALE:
    case NodeType.VECTOR_LENGTH:
    case NodeType.VECTOR_NORMALIZE:
    case NodeType.VECTOR_DOT:
    case NodeType.VECTOR_CROSS:
    case NodeType.VECTOR_DISTANCE:
    case NodeType.VECTOR_ANGLE:
    case NodeType.MATH_ADD:
    case NodeType.MATH_SUBTRACT:
    case NodeType.MATH_MULTIPLY:
    case NodeType.MATH_DIVIDE:
    case NodeType.MATH_POWER:
    case NodeType.MATH_ABS:
    case NodeType.MATH_CLAMP:
    case NodeType.VECTOR_LERP:
    case NodeType.MATH_REMAP: {
      const dataResult = executeDataNode({ node, inputs });
      if (dataResult) return dataResult;
      return [null];
    }
    case NodeType.GROUP:
    case NodeType.TRANSLATION:
    case NodeType.ROTATION:
    case NodeType.SCALE:
    case NodeType.MIRROR:
    case NodeType.ARRAY_LINEAR:
    case NodeType.ARRAY_GRID:
    case NodeType.ARRAY_POLAR: {
      const transformResult = await executeTransformNode({ node, inputs });
      if (transformResult) return transformResult;
      return [null];
    }
    case NodeType.BOOLEAN_OP: {
      const occtShapeA = extractOcctShape(inputs.object_a);
      const occtShapeB = extractOcctShape(inputs.object_b);
      if (occtShapeA && occtShapeB && getKernelStatus().backend === 'occt.js' && getKernelStatus().occt) {
        const occtObject = await tryOcct(node, color, (oc) => {
          const op = (p.operation || 'UNION') as 'UNION' | 'SUBTRACT' | 'INTERSECT';
          return buildOcctBooleanShape(oc, occtShapeA, occtShapeB, op);
        }, `occt-boolean-${(p.operation || 'UNION').toLowerCase()}`);
        if (occtObject) return [occtObject];
      }

      const objA = inputs.object_a as THREE.Mesh;
      const objB = inputs.object_b as THREE.Mesh;
      if (!objA?.isMesh || !objB?.isMesh) return [null];
      objA.updateMatrixWorld();
      objB.updateMatrixWorld();
      const brushA = new Brush(objA.geometry, objA.material);
      brushA.applyMatrix4(objA.matrixWorld);
      const brushB = new Brush(objB.geometry, objB.material);
      brushB.applyMatrix4(objB.matrixWorld);
      const op = p.operation || 'UNION';
      const result = op === 'SUBTRACT'
        ? csgEvaluator.evaluate(brushA, brushB, SUBTRACTION)
        : op === 'INTERSECT'
          ? csgEvaluator.evaluate(brushA, brushB, INTERSECTION)
          : csgEvaluator.evaluate(brushA, brushB, ADDITION);
      return [result ? createMesh(result.geometry, `boolean-${op.toLowerCase()}`) : null];
    }
    default:
      return [];
  }
};
