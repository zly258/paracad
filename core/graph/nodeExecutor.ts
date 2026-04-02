import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';
import { CSG } from 'three-csg-ts';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getManifoldModule, setWasmUrl } from 'manifold-3d/lib/wasm.js';
import manifoldWasmUrl from 'manifold-3d/manifold.wasm?url';
import { NodeData, NodeType } from '../../types';
import { executeAnalysisNode } from './analysisHandlers';
import { executeDataNode } from './dataHandlers';
import { executeFeatureNode } from './featureHandlers';
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
setWasmUrl(manifoldWasmUrl);

let manifoldModulePromise: Promise<any> | null = null;

const getManifold = async () => {
  if (!manifoldModulePromise) {
    manifoldModulePromise = getManifoldModule();
  }
  return manifoldModulePromise;
};

export interface NodeExecutionContext {
  node: NodeData;
  inputs: Record<string, any>;
  globalParams: Record<string, any>;
}

const toFiniteNumber = (value: any, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clampNum = (value: any, min: any, max: any): number => {
  const v = toFiniteNumber(value, 0);
  const a = toFiniteNumber(min, 0);
  const b = toFiniteNumber(max, 1);
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return Math.min(high, Math.max(low, v));
};

const remapNum = (value: any, inMin: any, inMax: any, outMin: any, outMax: any): number => {
  const v = toFiniteNumber(value, 0);
  const i0 = toFiniteNumber(inMin, 0);
  const i1 = toFiniteNumber(inMax, 1);
  const o0 = toFiniteNumber(outMin, 0);
  const o1 = toFiniteNumber(outMax, 1);
  if (Math.abs(i1 - i0) < 1e-9) return o0;
  const t = (v - i0) / (i1 - i0);
  return o0 + (o1 - o0) * t;
};

const roundTo = (value: any, digits = 0): number => {
  const v = toFiniteNumber(value, 0);
  const d = Math.max(0, Math.min(12, Math.floor(toFiniteNumber(digits, 0))));
  const factor = 10 ** d;
  return Math.round(v * factor) / factor;
};

const fixedToNumber = (value: any, digits = 2): number => {
  const v = toFiniteNumber(value, 0);
  const d = Math.max(0, Math.min(12, Math.floor(toFiniteNumber(digits, 2))));
  return Number(v.toFixed(d));
};

const EXPRESSION_HELPERS = {
  abs: (x: any) => Math.abs(toFiniteNumber(x, 0)),
  floor: (x: any) => Math.floor(toFiniteNumber(x, 0)),
  ceil: (x: any) => Math.ceil(toFiniteNumber(x, 0)),
  round: (x: any) => Math.round(toFiniteNumber(x, 0)),
  trunc: (x: any) => Math.trunc(toFiniteNumber(x, 0)),
  roundTo,
  toFixed: fixedToNumber,
  fixed: fixedToNumber,
  sin: (x: any) => Math.sin(toFiniteNumber(x, 0)),
  cos: (x: any) => Math.cos(toFiniteNumber(x, 0)),
  tan: (x: any) => Math.tan(toFiniteNumber(x, 0)),
  asin: (x: any) => Math.asin(toFiniteNumber(x, 0)),
  acos: (x: any) => Math.acos(toFiniteNumber(x, 0)),
  atan: (x: any) => Math.atan(toFiniteNumber(x, 0)),
  atan2: (y: any, x: any) => Math.atan2(toFiniteNumber(y, 0), toFiniteNumber(x, 0)),
  sqrt: (x: any) => Math.sqrt(Math.max(0, toFiniteNumber(x, 0))),
  pow: (a: any, b: any) => Math.pow(toFiniteNumber(a, 0), toFiniteNumber(b, 1)),
  exp: (x: any) => Math.exp(toFiniteNumber(x, 0)),
  log: (x: any) => Math.log(Math.max(1e-12, toFiniteNumber(x, 1))),
  min: (...values: any[]) => Math.min(...values.map((v) => toFiniteNumber(v, 0))),
  max: (...values: any[]) => Math.max(...values.map((v) => toFiniteNumber(v, 0))),
  clamp: clampNum,
  remap: remapNum,
  deg: (rad: any) => toFiniteNumber(rad, 0) * (180 / Math.PI),
  rad: (deg: any) => toFiniteNumber(deg, 0) * (Math.PI / 180),
  sign: (x: any) => Math.sign(toFiniteNumber(x, 0)),
  PI: Math.PI,
  E: Math.E,
  Math,
} as const;

const collectMeshes = (input: any): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  const visit = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value instanceof THREE.Mesh) {
      meshes.push(value);
      return;
    }
    if (value instanceof THREE.Object3D) {
      value.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
      });
    }
  };
  visit(input);
  return meshes;
};

const toWorldBrush = (mesh: THREE.Mesh) => {
  mesh.updateMatrixWorld(true);
  const worldGeometry = mesh.geometry.clone();
  worldGeometry.applyMatrix4(mesh.matrixWorld);
  worldGeometry.computeVertexNormals();
  const brush = new Brush(worldGeometry, mesh.material);
  return brush;
};

const toWorldMesh = (mesh: THREE.Mesh): THREE.Mesh => {
  mesh.updateMatrixWorld(true);
  const worldGeometry = mesh.geometry.clone();
  worldGeometry.applyMatrix4(mesh.matrixWorld);
  worldGeometry.computeVertexNormals();
  const material = Array.isArray(mesh.material)
    ? mesh.material[0]?.clone() || new THREE.MeshStandardMaterial()
    : mesh.material?.clone() || new THREE.MeshStandardMaterial();
  const worldMesh = new THREE.Mesh(worldGeometry, material);
  worldMesh.updateMatrixWorld(true);
  return worldMesh;
};

const toIndexedWorldGeometry = (mesh: THREE.Mesh): THREE.BufferGeometry => {
  mesh.updateMatrixWorld(true);
  let geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry = mergeVertices(geometry, 1e-5);

  if (!geometry.getIndex()) {
    const count = geometry.getAttribute('position')?.count ?? 0;
    const indices = new Uint32Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  geometry.computeVertexNormals();
  return geometry;
};

const toManifoldMesh = (module: any, mesh: THREE.Mesh) => {
  const geometry = toIndexedWorldGeometry(mesh);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const index = geometry.getIndex();
  if (!position || !index) return null;

  const triVerts = new Uint32Array(index.array as ArrayLike<number>);
  const vertProperties = new Float32Array(position.array as ArrayLike<number>);
  return new module.Mesh({
    numProp: 3,
    triVerts,
    vertProperties,
  });
};

const manifoldToThreeGeometry = (manifold: any): THREE.BufferGeometry | null => {
  const mesh = manifold.getMesh();
  const triVerts: Uint32Array = mesh?.triVerts;
  const vertProperties: Float32Array = mesh?.vertProperties;
  const numProp: number = mesh?.numProp ?? 3;
  if (!triVerts || !vertProperties || triVerts.length === 0 || vertProperties.length === 0) return null;

  const numVerts = Math.floor(vertProperties.length / numProp);
  const positions = new Float32Array(numVerts * 3);
  if (numProp === 3) {
    positions.set(vertProperties);
  } else {
    for (let i = 0; i < numVerts; i++) {
      const src = i * numProp;
      const dst = i * 3;
      positions[dst] = vertProperties[src];
      positions[dst + 1] = vertProperties[src + 1];
      positions[dst + 2] = vertProperties[src + 2];
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(triVerts), 1));
  geometry.computeVertexNormals();
  return geometry;
};

const manifoldUnionAll = (module: any, manifolds: any[]) => {
  if (manifolds.length === 0) return null;
  let result = manifolds[0];
  for (let i = 1; i < manifolds.length; i++) result = result.add(manifolds[i]);
  return result;
};

const tryBuildTubeFallback = (meshA: THREE.Mesh, meshB: THREE.Mesh): THREE.BufferGeometry | null => {
  const typeA = meshA.geometry?.type || '';
  const typeB = meshB.geometry?.type || '';
  const isCylinderPair =
    typeA.includes('CylinderGeometry') &&
    typeB.includes('CylinderGeometry');
  if (!isCylinderPair) return null;

  const boxA = new THREE.Box3().setFromObject(meshA);
  const boxB = new THREE.Box3().setFromObject(meshB);
  if (boxA.isEmpty() || boxB.isEmpty()) return null;

  const centerA = boxA.getCenter(new THREE.Vector3());
  const centerB = boxB.getCenter(new THREE.Vector3());
  const eps = 1e-3;
  if (Math.abs(centerA.x - centerB.x) > eps || Math.abs(centerA.y - centerB.y) > eps) return null;

  const radiusA = Math.max(boxA.max.x - boxA.min.x, boxA.max.y - boxA.min.y) * 0.5;
  const radiusB = Math.max(boxB.max.x - boxB.min.x, boxB.max.y - boxB.min.y) * 0.5;
  const outerR = Math.max(radiusA, radiusB);
  const innerR = Math.min(radiusA, radiusB);
  if (!(outerR > innerR + eps)) return null;

  const zMin = Math.max(boxA.min.z, boxB.min.z);
  const zMax = Math.min(boxA.max.z, boxB.max.z);
  const height = zMax - zMin;
  if (!(height > eps)) return null;

  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 48,
    steps: 1,
  });
  geometry.translate(centerA.x, centerA.y, zMin);
  geometry.computeVertexNormals();
  return geometry;
};

// 节点执行器：负责把“节点类型 + 输入参数”翻译成几何结果。
// 当前主要承担浏览器实时预览职责。
export const executeNode = async ({ node, inputs, globalParams }: NodeExecutionContext): Promise<any[]> => {
  const p = node.params;
  const color = p.color || '#888888';

  const createMesh = (geom: THREE.BufferGeometry, detail: string) =>
    tagKernel(new THREE.Mesh(geom, getMaterial(color)), node, detail);

  switch (node.type) {
    case NodeType.EXPRESSION: {
      try {
        const helperEntries = Object.entries(EXPRESSION_HELPERS);
        const helperKeys = helperEntries.map(([k]) => k);
        const helperValues = helperEntries.map(([, v]) => v);
        const keys = Object.keys(globalParams).filter((k) =>
          /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) && !helperKeys.includes(k),
        );
        const values = keys.map((k) => globalParams[k]);
        // Expression 支持三目运算（JS 原生 ? :），并注入常用数学函数
        const fn = new Function(...helperKeys, ...keys, `
          try { 
            const result = (${p.expression || '0'}); 
            return (result !== undefined && result !== null) ? result : 0;
          } catch(e) { 
            return 0; 
          }
        `);
        const result = fn(...helperValues, ...values);
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
      const meshesA = collectMeshes(inputs.object_a);
      const meshesB = collectMeshes(inputs.object_b);
      if (meshesA.length === 0 || meshesB.length === 0) return [null];

      const op = p.operation || 'UNION';
      // 同轴双圆柱差集优先走解析圆管生成，避免 CSG 在共面端面上的拓扑伪影。
      if (op === 'SUBTRACT' && meshesA.length === 1 && meshesB.length === 1) {
        const analyticTube = tryBuildTubeFallback(meshesA[0], meshesB[0]);
        if (analyticTube) return [createMesh(analyticTube, 'boolean-analytic-tube')];
      }

      try {
        // 主实现：manifold-3d，连续布尔稳定性更高。
        const module = await getManifold();
        const manifoldsA = meshesA
          .map((mesh) => toManifoldMesh(module, mesh))
          .filter(Boolean)
          .map((mesh) => new module.Manifold(mesh));
        const manifoldsB = meshesB
          .map((mesh) => toManifoldMesh(module, mesh))
          .filter(Boolean)
          .map((mesh) => new module.Manifold(mesh));

        if (manifoldsA.length > 0 && manifoldsB.length > 0) {
          const unionA = manifoldUnionAll(module, manifoldsA);
          if (!unionA) throw new Error('manifold union A failed');
          let result = unionA;

          if (op === 'SUBTRACT') {
            const unionB = manifoldUnionAll(module, manifoldsB);
            if (!unionB) throw new Error('manifold union B failed');
            result = result.subtract(unionB);
          } else if (op === 'INTERSECT') {
            for (const other of manifoldsB) result = result.intersect(other);
          } else {
            const unionB = manifoldUnionAll(module, manifoldsB);
            if (!unionB) throw new Error('manifold union B failed');
            result = result.add(unionB);
          }

          const manifoldGeometry = manifoldToThreeGeometry(result);
          if (manifoldGeometry) return [createMesh(manifoldGeometry, `boolean-${op.toLowerCase()}-manifold`)];
        }
      } catch (manifoldError) {
        // keep fallback chain below
      }

      try {
        // fallback #1: three-csg-ts
        let resultMesh = toWorldMesh(meshesA[0]);
        for (let i = 1; i < meshesA.length; i++) {
          resultMesh = CSG.union(resultMesh, toWorldMesh(meshesA[i]));
        }

        if (op === 'SUBTRACT') {
          let cuttersUnion = toWorldMesh(meshesB[0]);
          for (let i = 1; i < meshesB.length; i++) {
            cuttersUnion = CSG.union(cuttersUnion, toWorldMesh(meshesB[i]));
          }
          resultMesh = CSG.subtract(resultMesh, cuttersUnion);
        } else if (op === 'INTERSECT') {
          for (const meshB of meshesB) {
            resultMesh = CSG.intersect(resultMesh, toWorldMesh(meshB));
          }
        } else {
          let unionB = toWorldMesh(meshesB[0]);
          for (let i = 1; i < meshesB.length; i++) {
            unionB = CSG.union(unionB, toWorldMesh(meshesB[i]));
          }
          resultMesh = CSG.union(resultMesh, unionB);
        }

        return [resultMesh ? createMesh(resultMesh.geometry, `boolean-${op.toLowerCase()}-csgts`) : null];
      } catch (error) {
        try {
          // secondary fallback: three-bvh-csg
          let resultBrush = toWorldBrush(meshesA[0]);
          for (let i = 1; i < meshesA.length; i++) {
            resultBrush = csgEvaluator.evaluate(resultBrush, toWorldBrush(meshesA[i]), ADDITION);
          }

          if (op === 'SUBTRACT') {
            let cuttersUnion = toWorldBrush(meshesB[0]);
            for (let i = 1; i < meshesB.length; i++) {
              cuttersUnion = csgEvaluator.evaluate(cuttersUnion, toWorldBrush(meshesB[i]), ADDITION);
            }
            resultBrush = csgEvaluator.evaluate(resultBrush, cuttersUnion, SUBTRACTION);
          } else if (op === 'INTERSECT') {
            for (const meshB of meshesB) {
              resultBrush = csgEvaluator.evaluate(resultBrush, toWorldBrush(meshB), INTERSECTION);
            }
          } else {
            let unionB = toWorldBrush(meshesB[0]);
            for (let i = 1; i < meshesB.length; i++) {
              unionB = csgEvaluator.evaluate(unionB, toWorldBrush(meshesB[i]), ADDITION);
            }
            resultBrush = csgEvaluator.evaluate(resultBrush, unionB, ADDITION);
          }
          return [resultBrush ? createMesh(resultBrush.geometry, `boolean-${op.toLowerCase()}-bvh`) : null];
        } catch (error2) {
          if (op === 'SUBTRACT' && meshesA.length === 1 && meshesB.length === 1) {
            const tube = tryBuildTubeFallback(meshesA[0], meshesB[0]);
            if (tube) return [createMesh(tube, 'boolean-fallback-tube')];
          }
          console.warn('Boolean CSG failed in both engines, fallback to input A.', error, error2);
          // 避免布尔失败导致整个图节点链中断，至少保留输入 A 的可视结果。
          const fallback = meshesA[0].geometry.clone();
          fallback.applyMatrix4(meshesA[0].matrixWorld);
          fallback.computeVertexNormals();
          return [createMesh(fallback, 'boolean-fallback')];
        }
      }
    }
    default:
      return [];
  }
};

