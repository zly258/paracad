import * as THREE from 'three';
import { NodeData, NodeType } from '../../types';
import { cloneObject, getNum, getVal, getVec, tagKernel } from './runtimeUtils';

interface TransformContext {
  node: NodeData;
  inputs: Record<string, any>;
}

export const executeTransformNode = async ({ node, inputs }: TransformContext): Promise<any[] | null> => {
  const p = node.params;

  switch (node.type) {
    case NodeType.GROUP: {
      const group = tagKernel(new THREE.Group(), node, 'group');
      ['item_1', 'item_2', 'item_3', 'item_4'].forEach((key) => {
        const item = inputs[key];
        if (item instanceof THREE.Object3D) group.add(cloneObject(item));
      });
      return [group];
    }
    case NodeType.TRANSLATION: {
      const v = getVec('vector', inputs, p);
      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      geom.userData.visible = false;
      const cloned = tagKernel(cloneObject(geom), node, 'move');
      cloned.position.x += v.x;
      cloned.position.y += v.y;
      cloned.position.z += v.z;
      return [cloned];
    }
    case NodeType.ROTATION: {
      const axis = getVec('axis', inputs, p);
      const angleRad = THREE.MathUtils.degToRad(getNum('angle', inputs, p, 45));
      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      const cloned = tagKernel(cloneObject(geom), node, 'rotate');
      const axisVec = new THREE.Vector3(axis.x, axis.y, axis.z).normalize();
      if (axisVec.lengthSq() === 0) axisVec.set(0, 0, 1);
      cloned.applyMatrix4(new THREE.Matrix4().makeRotationAxis(axisVec, angleRad));
      return [cloned];
    }
    case NodeType.SCALE: {
      const factor = getNum('factor', inputs, p, 1);
      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      const cloned = tagKernel(cloneObject(geom), node, 'scale');
      cloned.scale.multiplyScalar(factor);
      return [cloned];
    }
    case NodeType.MIRROR: {
      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      const normalVec = getVec('plane_normal', inputs, p);
      const normal = new THREE.Vector3(normalVec.x, normalVec.y, normalVec.z).normalize();
      if (normal.lengthSq() === 0) normal.set(1, 0, 0);
      const { x, y, z } = normal;
      const matrix = new THREE.Matrix4().set(
        1 - 2 * x * x, -2 * x * y, -2 * x * z, 0,
        -2 * x * y, 1 - 2 * y * y, -2 * y * z, 0,
        -2 * x * z, -2 * y * z, 1 - 2 * z * z, 0,
        0, 0, 0, 1,
      );
      const mirrored = tagKernel(cloneObject(geom), node, 'mirror');
      mirrored.applyMatrix4(matrix);
      if (getVal('copy', inputs, p, true)) {
        const group = tagKernel(new THREE.Group(), node, 'mirror-copy');
        group.add(cloneObject(geom));
        group.add(mirrored);
        return [group];
      }
      return [mirrored];
    }
    case NodeType.ARRAY_LINEAR: {
      const dir = getVec('direction', inputs, p);
      const direction = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
      if (direction.lengthSq() === 0) direction.set(1, 0, 0);
      const count = Math.max(1, Math.floor(getNum('count', inputs, p, 3)));
      const spacing = getNum('spacing', inputs, p, 20);

      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      const group = tagKernel(new THREE.Group(), node, 'array-linear');
      for (let i = 0; i < count; i++) {
        const cloned = cloneObject(geom);
        cloned.position.add(direction.clone().multiplyScalar(spacing * i));
        group.add(cloned);
      }
      return [group];
    }
    case NodeType.ARRAY_GRID: {
      const countX = Math.max(1, Math.floor(getNum('count_x', inputs, p, 3)));
      const countY = Math.max(1, Math.floor(getNum('count_y', inputs, p, 3)));
      const spacing = getNum('spacing', inputs, p, 20);

      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      const group = tagKernel(new THREE.Group(), node, 'array-grid');
      for (let ix = 0; ix < countX; ix++) {
        for (let iy = 0; iy < countY; iy++) {
          const cloned = cloneObject(geom);
          cloned.position.x += ix * spacing;
          cloned.position.y += iy * spacing;
          group.add(cloned);
        }
      }
      return [group];
    }
    case NodeType.ARRAY_POLAR: {
      const center = getVec('center', inputs, p);
      const count = Math.max(1, Math.floor(getNum('count', inputs, p, 6)));
      const fillAngle = THREE.MathUtils.degToRad(getNum('fill_angle', inputs, p, 360));
      const paramRadius = Math.max(0, getNum('radius', inputs, p, 20));

      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      const group = tagKernel(new THREE.Group(), node, 'array-polar');
      const radius = paramRadius > 0
        ? paramRadius
        : Math.max(1, geom.position.distanceTo(new THREE.Vector3(center.x, center.y, geom.position.z)));
      for (let i = 1; i <= count; i++) {
        const angle = count === 1 ? fillAngle : (fillAngle / count) * i;
        const cloned = cloneObject(geom);
        cloned.position.set(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, cloned.position.z);
        cloned.rotateZ(angle);
        group.add(cloned);
      }
      return [group];
    }
    default:
      return null;
  }
};
