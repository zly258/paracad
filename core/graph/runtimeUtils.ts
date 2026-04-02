import * as THREE from 'three';
import { NodeData } from '../../types';
import { getKernelStatus } from '../kernel';

export const getVal = (name: string, inputs: Record<string, any>, params: Record<string, any>, fallback: any) => {
  if (inputs[name] !== undefined) return inputs[name];
  if (params?.[name] !== undefined) return params[name];
  return fallback;
};

export const getNum = (name: string, inputs: Record<string, any>, params: Record<string, any>, fallback = 0) => {
  const n = Number(getVal(name, inputs, params, fallback));
  return Number.isNaN(n) ? fallback : n;
};

export const getVec = (name: string, inputs: Record<string, any>, params: Record<string, any>, defaultZ = 0) => {
  const value = getVal(name, inputs, params, null);
  if (value && typeof value === 'object' && 'x' in value) {
    return { x: Number(value.x) || 0, y: Number(value.y) || 0, z: Number(value.z) || 0 };
  }
  return {
    x: getNum('x', inputs, params, 0),
    y: getNum('y', inputs, params, 0),
    z: getNum(name === 'vector' ? 'z' : 'axis_z', inputs, params, defaultZ)
  };
};

export const getMaterial = (color: string | number = 0xaaaaaa, wireframe = false) => wireframe
  ? new THREE.LineBasicMaterial({ color: color as any })
  : new THREE.MeshStandardMaterial({ color, metalness: 0.02, roughness: 0.45, side: THREE.DoubleSide });

export const applyPlane = (obj: THREE.Object3D, plane: string) => {
  if (!plane || plane === 'XOY') return;
  if (plane === 'XOZ') obj.rotateX(-Math.PI / 2);
  else if (plane === 'YOZ') obj.rotateY(Math.PI / 2);
  obj.updateMatrix();
};

export const tagKernel = (obj: THREE.Object3D, node: NodeData, detail: string) => {
  const kernel = getKernelStatus();
  obj.userData.kernel = kernel.backend;
  obj.userData.kernelMessage = kernel.message;
  obj.userData.kernelDetail = detail;
  obj.userData.nodeType = node.type;
  return obj;
};

export const cloneObject = <T extends THREE.Object3D>(obj: T): T => {
  const cloned = obj.clone() as T;
  cloned.userData = {
    ...(obj.userData ?? {}),
    curve3d: obj.userData?.curve3d,
    shapes: obj.userData?.shapes,
  };
  return cloned;
};

export const create2DObject = (
  shape: THREE.Shape,
  plane: string,
  isFace: boolean,
  center: { x: number; y: number; z: number },
  color = '#ffffff',
  curve?: THREE.Curve<THREE.Vector3>,
) => {
  const obj = isFace
    ? new THREE.Mesh(new THREE.ShapeGeometry(shape), getMaterial(color))
    : new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(shape.getPoints(64)), getMaterial(color, true));
  obj.position.set(center.x, center.y, center.z);
  obj.userData.shapes = [shape];
  if (curve) obj.userData.curve3d = curve;
  applyPlane(obj, plane);
  return obj;
};

export const createCurveObject = (
  points: THREE.Vector3[],
  color: string,
  plane: string,
  center: { x: number; y: number; z: number },
  curve: THREE.Curve<THREE.Vector3>,
) => {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), getMaterial(color, true));
  line.position.set(center.x, center.y, center.z);
  line.userData.curve3d = curve;
  applyPlane(line, plane);
  return line;
};

export const buildLoftGeometry = (shapeA: THREE.Shape, shapeB: THREE.Shape) => {
  const pointsA = shapeA.getSpacedPoints(64);
  const pointsB = shapeB.getSpacedPoints(64);
  const count = Math.min(pointsA.length, pointsB.length);
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < count; i++) {
    const a = pointsA[i];
    const b = pointsB[i];
    vertices.push(a.x, a.y, 0, b.x, b.y, 20);
  }

  for (let i = 0; i < count - 1; i++) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
};
