import * as THREE from 'three';
import { NodeData, NodeType } from '../../types';
import { createOcctPoint } from './occtHelpers';
import { tryOcct } from './occtRuntime';
import { getMaterial, getNum, getVec, tagKernel } from './runtimeUtils';

interface SolidContext {
  node: NodeData;
  inputs: Record<string, any>;
}

// 基础体与实体节点执行器分组，后续可以继续扩展为导出节点或分析节点的前置输入源。
export const executeSolidNode = async ({ node, inputs }: SolidContext): Promise<any[] | null> => {
  const p = node.params;
  const color = p.color || '#888888';
  const SEGMENTS = 64;

  const createMesh = (geom: THREE.BufferGeometry, detail: string) =>
    tagKernel(new THREE.Mesh(geom, getMaterial(color)), node, detail);

  switch (node.type) {
    case NodeType.BOX: {
      const c = getVec('base', inputs, p);
      const occtObject = await tryOcct(node, color, (oc) => new oc.BRepPrimAPI_MakeBox_3(
        createOcctPoint(oc, c.x, c.y, c.z),
        getNum('size_x', inputs, p, 10),
        getNum('size_y', inputs, p, 10),
        getNum('size_z', inputs, p, 10),
      ).Shape(), 'occt-box');
      if (occtObject) return [occtObject];

      const mesh = createMesh(new THREE.BoxGeometry(getNum('size_x', inputs, p, 10), getNum('size_y', inputs, p, 10), getNum('size_z', inputs, p, 10)), 'box');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.SPHERE: {
      const c = getVec('center', inputs, p);
      const occtObject = await tryOcct(node, color, (oc) => new oc.BRepPrimAPI_MakeSphere_5(
        createOcctPoint(oc, c.x, c.y, c.z),
        getNum('radius', inputs, p, 10),
      ).Shape(), 'occt-sphere');
      if (occtObject) return [occtObject];

      const mesh = createMesh(new THREE.SphereGeometry(getNum('radius', inputs, p, 10), SEGMENTS, Math.floor(SEGMENTS / 2)), 'sphere');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.ELLIPSOID: {
      const geom = new THREE.SphereGeometry(1, SEGMENTS, Math.floor(SEGMENTS / 2));
      geom.scale(getNum('radius_x', inputs, p, 10), getNum('radius_y', inputs, p, 8), getNum('radius_z', inputs, p, 6));
      const mesh = createMesh(geom, 'ellipsoid');
      const c = getVec('center', inputs, p);
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.CAPSULE: {
      const mesh = createMesh(new THREE.CapsuleGeometry(getNum('radius', inputs, p, 5), getNum('length', inputs, p, 20), 8, 16), 'capsule');
      const c = getVec('center', inputs, p);
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.CYLINDER: {
      const c = getVec('base', inputs, p);
      const occtObject = await tryOcct(node, color, (oc) => new oc.BRepPrimAPI_MakeCylinder_3(
        createOcctPoint(oc, c.x, c.y, c.z),
        getNum('radius', inputs, p, 5),
        getNum('height', inputs, p, 20),
      ).Shape(), 'occt-cylinder');
      if (occtObject) return [occtObject];

      const geom = new THREE.CylinderGeometry(getNum('radius', inputs, p, 5), getNum('radius', inputs, p, 5), getNum('height', inputs, p, 20), SEGMENTS);
      geom.rotateX(Math.PI / 2);
      const mesh = createMesh(geom, 'cylinder');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.CONE: {
      const c = getVec('base', inputs, p);
      const occtObject = await tryOcct(node, color, (oc) => new oc.BRepPrimAPI_MakeCone_3(
        createOcctPoint(oc, c.x, c.y, c.z),
        0,
        getNum('radius', inputs, p, 10),
        getNum('height', inputs, p, 20),
      ).Shape(), 'occt-cone');
      if (occtObject) return [occtObject];

      const geom = new THREE.ConeGeometry(getNum('radius', inputs, p, 10), getNum('height', inputs, p, 20), SEGMENTS);
      geom.rotateX(Math.PI / 2);
      const mesh = createMesh(geom, 'cone');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.TRUNCATED_CONE: {
      const c = getVec('base', inputs, p);
      const occtObject = await tryOcct(node, color, (oc) => new oc.BRepPrimAPI_MakeCone_3(
        createOcctPoint(oc, c.x, c.y, c.z),
        getNum('radius_top', inputs, p, 5),
        getNum('radius_bottom', inputs, p, 10),
        getNum('height', inputs, p, 15),
      ).Shape(), 'occt-frustum');
      if (occtObject) return [occtObject];

      const geom = new THREE.CylinderGeometry(getNum('radius_top', inputs, p, 5), getNum('radius_bottom', inputs, p, 10), getNum('height', inputs, p, 15), SEGMENTS);
      geom.rotateX(Math.PI / 2);
      const mesh = createMesh(geom, 'frustum');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.TORUS: {
      const c = getVec('center', inputs, p);
      const occtObject = await tryOcct(node, color, (oc) => new oc.BRepPrimAPI_MakeTorus_2(
        getNum('radius_main', inputs, p, 10),
        getNum('radius_tube', inputs, p, 3),
        Math.PI * 2,
      ).Shape(), 'occt-torus');
      if (occtObject) {
        occtObject.position.set(c.x, c.y, c.z);
        return [occtObject];
      }

      const mesh = createMesh(new THREE.TorusGeometry(getNum('radius_main', inputs, p, 10), getNum('radius_tube', inputs, p, 3), 16, SEGMENTS), 'torus');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    default:
      return null;
  }
};
