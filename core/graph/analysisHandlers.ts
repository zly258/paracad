import * as THREE from 'three';
import { NodeData, NodeType } from '../../types';

interface AnalysisContext {
  node: NodeData;
  inputs: Record<string, any>;
}

const collectMeshGeometries = (root: THREE.Object3D) => {
  root.updateMatrixWorld(true);
  const meshes: THREE.BufferGeometry[] = [];

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;
    const source = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    source.applyMatrix4(child.matrixWorld);
    meshes.push(source);
  });

  return meshes;
};

const triangleArea = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
  new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() * 0.5;

const signedTetraVolume = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
  a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;

const computeSurfaceArea = (meshes: THREE.BufferGeometry[]) => {
  let area = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  for (const geometry of meshes) {
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position as any, i);
      b.fromBufferAttribute(position as any, i + 1);
      c.fromBufferAttribute(position as any, i + 2);
      area += triangleArea(a, b, c);
    }
  }

  return area;
};

const computeVolume = (meshes: THREE.BufferGeometry[]) => {
  let volume = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  for (const geometry of meshes) {
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position as any, i);
      b.fromBufferAttribute(position as any, i + 1);
      c.fromBufferAttribute(position as any, i + 2);
      volume += signedTetraVolume(a, b, c);
    }
  }

  return Math.abs(volume);
};

const vecToPlain = (vec: THREE.Vector3) => ({ x: vec.x, y: vec.y, z: vec.z });

// Dynamo 风格分析节点：从几何读出数值和向量结果，便于后续驱动参数或做校核。
export const executeAnalysisNode = async ({ node, inputs }: AnalysisContext): Promise<any[] | null> => {
  const geometry = inputs.geometry as THREE.Object3D;
  if (!geometry) return [null];

  const box = new THREE.Box3().setFromObject(geometry);
  const min = box.min.clone();
  const max = box.max.clone();
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const meshes = collectMeshGeometries(geometry);

  switch (node.type) {
    case NodeType.BOUNDING_BOX:
      return [vecToPlain(min), vecToPlain(max), vecToPlain(size), vecToPlain(center)];
    case NodeType.SURFACE_AREA:
      return [meshes.length ? computeSurfaceArea(meshes) : 0];
    case NodeType.VOLUME:
      return [meshes.length ? computeVolume(meshes) : 0];
    case NodeType.CENTROID:
      return [vecToPlain(center)];
    default:
      return null;
  }
};
