import * as THREE from 'three';
import { NodeData, NodeType } from '../../types';
import { createOcctAx2, createOcctInstance, createOcctPoint } from './occtHelpers';
import { tryOcct } from './occtRuntime';
import { getMaterial, getNum, getVec, tagKernel } from './runtimeUtils';

interface SolidContext {
  node: NodeData;
  inputs: Record<string, any>;
}

/**
 * 实体节点执行器：负责将“参数 + 输入”转换为 3D 几何对象。
 * 为保证 OCCT 与 Three.js 路径的一致性：
 * 1. Box：以 corner (base) 为起点。
 * 2. Cylinder/Cone：以 base 为圆心，垂直方向为 Z/平面法向。
 * 3. Sphere：以 center 为球心。
 */
export const executeSolidNode = async ({ node, inputs }: SolidContext): Promise<any[] | null> => {
  const p = node.params;
  const color = p.color || '#888888';
  const SEGMENTS = 64;

  const createMesh = (geom: THREE.BufferGeometry, detail: string) =>
    tagKernel(new THREE.Mesh(geom, getMaterial(color)), node, detail);

  switch (node.type) {
    case NodeType.BOX: {
      const c = getVec('base', inputs, p);
      const dx = getNum('size_x', inputs, p, 10);
      const dy = getNum('size_y', inputs, p, 10);
      const dz = getNum('size_z', inputs, p, 10);

      const occtObject = await tryOcct(node, color, (oc) => {
        const pnt = createOcctPoint(oc, c.x, c.y, c.z);
        // MakeBox_4(Pnt, dx, dy, dz)
        return createOcctInstance(oc, ['BRepPrimAPI_MakeBox_4', 'BRepPrimAPI_MakeBox_2', 'BRepPrimAPI_MakeBox'], [pnt, dx, dy, dz]).Shape();
      }, 'occt-box');
      if (occtObject) return [occtObject];

      const geom = new THREE.BoxGeometry(dx, dy, dz);
      // Align to corner (Pnt)
      geom.translate(dx / 2, dy / 2, dz / 2);
      const mesh = createMesh(geom, 'box');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.SPHERE: {
      const c = getVec('center', inputs, p);
      const radius = getNum('radius', inputs, p, 10);

      const occtObject = await tryOcct(node, color, (oc) => {
        const pnt = createOcctPoint(oc, c.x, c.y, c.z);
        return createOcctInstance(oc, ['BRepPrimAPI_MakeSphere_5', 'BRepPrimAPI_MakeSphere_4', 'BRepPrimAPI_MakeSphere_1', 'BRepPrimAPI_MakeSphere'], [pnt, radius]).Shape();
      }, 'occt-sphere');
      if (occtObject) return [occtObject];

      const mesh = createMesh(new THREE.SphereGeometry(radius, SEGMENTS, Math.floor(SEGMENTS / 2)), 'sphere');
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
      const c = getVec('center', inputs, p);
      const radius = getNum('radius', inputs, p, 5);
      const length = getNum('length', inputs, p, 20);
      const occtObject = await tryOcct(node, color, (oc) => {
        const bottom = createOcctPoint(oc, c.x, c.y, c.z - length / 2);
        const top = createOcctPoint(oc, c.x, c.y, c.z + length / 2);
        const ax2 = createOcctAx2(oc, { x: c.x, y: c.y, z: c.z - length / 2 }, { x: 0, y: 0, z: 1 });
        const cylinder = createOcctInstance(oc, ['BRepPrimAPI_MakeCylinder_3', 'BRepPrimAPI_MakeCylinder_2', 'BRepPrimAPI_MakeCylinder'], [ax2, radius, length]).Shape();
        const bottomSphere = createOcctInstance(oc, ['BRepPrimAPI_MakeSphere_5', 'BRepPrimAPI_MakeSphere'], [bottom, radius]).Shape();
        const topSphere = createOcctInstance(oc, ['BRepPrimAPI_MakeSphere_5', 'BRepPrimAPI_MakeSphere'], [top, radius]).Shape();
        const progress = createOcctInstance(oc, ['Message_ProgressRange_1', 'Message_ProgressRange'], []);
        const fusedBottom = createOcctInstance(oc, ['BRepAlgoAPI_Fuse_3', 'BRepAlgoAPI_Fuse_2', 'BRepAlgoAPI_Fuse'], [
          cylinder,
          bottomSphere,
          progress,
        ]).Shape();
        return createOcctInstance(oc, ['BRepAlgoAPI_Fuse_3', 'BRepAlgoAPI_Fuse_2', 'BRepAlgoAPI_Fuse'], [
          fusedBottom,
          topSphere,
          progress,
        ]).Shape();
      }, 'occt-capsule');
      if (occtObject) return [occtObject];

      const mesh = createMesh(new THREE.CapsuleGeometry(radius, length, 8, 16), 'capsule');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.CYLINDER: {
      const c = getVec('base', inputs, p);
      const radius = getNum('radius', inputs, p, 5);
      const height = getNum('height', inputs, p, 20);

      const occtObject = await tryOcct(node, color, (oc) => {
        const ax2 = createOcctAx2(oc, c, { x: 0, y: 0, z: 1 });
        return createOcctInstance(oc, ['BRepPrimAPI_MakeCylinder_3', 'BRepPrimAPI_MakeCylinder_2', 'BRepPrimAPI_MakeCylinder'], [ax2, radius, height]).Shape();
      }, 'occt-cylinder');
      if (occtObject) return [occtObject];

      const geom = new THREE.CylinderGeometry(radius, radius, height, SEGMENTS);
      // Align base to c: Three centers cylinders along Y. Move up by half height.
      geom.rotateX(Math.PI / 2); // Now along Z
      geom.translate(0, 0, height / 2);
      const mesh = createMesh(geom, 'cylinder');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.CONE: {
      const c = getVec('base', inputs, p);
      const radius = getNum('radius', inputs, p, 10);
      const height = getNum('height', inputs, p, 20);

      const occtObject = await tryOcct(node, color, (oc) => {
        const ax2 = createOcctAx2(oc, c, { x: 0, y: 0, z: 1 });
        return createOcctInstance(oc, ['BRepPrimAPI_MakeCone_3', 'BRepPrimAPI_MakeCone_2', 'BRepPrimAPI_MakeCone'], [ax2, 0, radius, height]).Shape();
      }, 'occt-cone');
      if (occtObject) return [occtObject];

      const geom = new THREE.ConeGeometry(radius, height, SEGMENTS);
      geom.rotateX(Math.PI / 2);
      geom.translate(0, 0, height / 2);
      const mesh = createMesh(geom, 'cone');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.TRUNCATED_CONE: {
      const c = getVec('base', inputs, p);
      const radius_top = getNum('radius_top', inputs, p, 5);
      const radius_bottom = getNum('radius_bottom', inputs, p, 10);
      const height = getNum('height', inputs, p, 15);

      const occtObject = await tryOcct(node, color, (oc) => {
        const ax2 = createOcctAx2(oc, c, { x: 0, y: 0, z: 1 });
        return createOcctInstance(oc, ['BRepPrimAPI_MakeCone_3', 'BRepPrimAPI_MakeCone_2', 'BRepPrimAPI_MakeCone'], [ax2, radius_top, radius_bottom, height]).Shape();
      }, 'occt-frustum');
      if (occtObject) return [occtObject];

      const geom = new THREE.CylinderGeometry(radius_top, radius_bottom, height, SEGMENTS);
      geom.rotateX(Math.PI / 2);
      geom.translate(0, 0, height / 2);
      const mesh = createMesh(geom, 'frustum');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.TORUS: {
      const c = getVec('center', inputs, p);
      const r1 = getNum('radius_main', inputs, p, 10);
      const r2 = getNum('radius_tube', inputs, p, 3);

      const occtObject = await tryOcct(node, color, (oc) => {
        const ax2 = createOcctAx2(oc, c, { x: 0, y: 0, z: 1 });
        return createOcctInstance(oc, ['BRepPrimAPI_MakeTorus_3', 'BRepPrimAPI_MakeTorus_2', 'BRepPrimAPI_MakeTorus'], [ax2, r1, r2]).Shape();
      }, 'occt-torus');
      if (occtObject) return [occtObject];

      const mesh = createMesh(new THREE.TorusGeometry(r1, r2, 16, SEGMENTS), 'torus');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    default:
      return null;
  }
};
