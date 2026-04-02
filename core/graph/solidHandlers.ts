import * as THREE from 'three';
import { NodeData, NodeType } from '../../types';
import { getMaterial, getNum, getVec, tagKernel } from './runtimeUtils';

interface SolidContext {
  node: NodeData;
  inputs: Record<string, any>;
}

export const executeSolidNode = async ({ node, inputs }: SolidContext): Promise<any[] | null> => {
  const p = node.params;
  const color = p.color || '#888888';
  const SEGMENTS = 32;

  const createMesh = (geom: THREE.BufferGeometry, detail: string) =>
    tagKernel(new THREE.Mesh(geom, getMaterial(color)), node, detail);

  switch (node.type) {
    case NodeType.BOX: {
      const c = getVec('base', inputs, p);
      const dx = getNum('size_x', inputs, p, 10);
      const dy = getNum('size_y', inputs, p, 10);
      const dz = getNum('size_z', inputs, p, 10);
      const geom = new THREE.BoxGeometry(dx, dy, dz);
      geom.translate(dx / 2, dy / 2, dz / 2);
      const mesh = createMesh(geom, 'box');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.SPHERE: {
      const c = getVec('center', inputs, p);
      const radius = getNum('radius', inputs, p, 10);
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
      const mesh = createMesh(new THREE.CapsuleGeometry(radius, length, 8, 16), 'capsule');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.CYLINDER: {
      const c = getVec('base', inputs, p);
      const radius = getNum('radius', inputs, p, 5);
      const height = getNum('height', inputs, p, 20);
      const geom = new THREE.CylinderGeometry(radius, radius, height, SEGMENTS);
      geom.rotateX(Math.PI / 2);
      geom.translate(0, 0, height / 2);
      const mesh = createMesh(geom, 'cylinder');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.CONE: {
      const c = getVec('base', inputs, p);
      const radius = getNum('radius', inputs, p, 10);
      const height = getNum('height', inputs, p, 20);
      const geom = new THREE.ConeGeometry(radius, height, SEGMENTS);
      geom.rotateX(Math.PI / 2);
      geom.translate(0, 0, height / 2);
      const mesh = createMesh(geom, 'cone');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.TRUNCATED_CONE: {
      const c = getVec('base', inputs, p);
      const radiusTop = getNum('radius_top', inputs, p, 5);
      const radiusBottom = getNum('radius_bottom', inputs, p, 10);
      const height = getNum('height', inputs, p, 15);
      const geom = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, SEGMENTS);
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
      const mesh = createMesh(new THREE.TorusGeometry(r1, r2, 16, SEGMENTS), 'torus');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    default:
      return null;
  }
};
