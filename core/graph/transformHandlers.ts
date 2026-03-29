import * as THREE from 'three';
import { NodeData, NodeType } from '../../types';
import { getKernelStatus } from '../kernel';
import { createOcctDir, createOcctPoint, createOcctVec } from './occtHelpers';
import { transformOcctShape } from './occtTransforms';
import { cloneObject, getNum, getVal, getVec, tagKernel } from './runtimeUtils';

interface TransformContext {
  node: NodeData;
  inputs: Record<string, any>;
}

const extractOcctShape = (input: any) => input?.userData?.occtShape;

// 变换、阵列和成组节点统一放在这里，后续可继续补坐标系变换和更高级复制策略。
export const executeTransformNode = async ({ node, inputs }: TransformContext): Promise<any[] | null> => {
  const p = node.params;
  const color = p.color || '#888888';

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
      const occtShape = extractOcctShape(inputs.geometry);
      const v = getVec('vector', inputs, p);
      const occtObject = await transformOcctShape(node, color, occtShape, 'occt-move', getKernelStatus(), (oc, trsf) => {
        trsf.SetTranslation_1(createOcctVec(oc, v.x, v.y, v.z));
      });
      if (occtObject) return [occtObject];

      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      const cloned = tagKernel(cloneObject(geom), node, 'move');
      cloned.position.x += v.x;
      cloned.position.y += v.y;
      cloned.position.z += v.z;
      return [cloned];
    }
    case NodeType.ROTATION: {
      const occtShape = extractOcctShape(inputs.geometry);
      const axis = getVec('axis', inputs, p);
      const angleRad = THREE.MathUtils.degToRad(getNum('angle', inputs, p, 45));
      const occtObject = await transformOcctShape(node, color, occtShape, 'occt-rotate', getKernelStatus(), (oc, trsf) => {
        const dir = createOcctDir(oc, axis.x || 0, axis.y || 0, axis.z || 1);
        const ax1 = new oc.gp_Ax1_2(createOcctPoint(oc, 0, 0, 0), dir);
        trsf.SetRotation_1(ax1, angleRad);
      });
      if (occtObject) return [occtObject];

      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      const cloned = tagKernel(cloneObject(geom), node, 'rotate');
      const axisVec = new THREE.Vector3(axis.x, axis.y, axis.z).normalize();
      if (axisVec.lengthSq() === 0) axisVec.set(0, 0, 1);
      cloned.applyMatrix4(new THREE.Matrix4().makeRotationAxis(axisVec, angleRad));
      return [cloned];
    }
    case NodeType.SCALE: {
      const occtShape = extractOcctShape(inputs.geometry);
      const factor = getNum('factor', inputs, p, 1);
      const occtObject = await transformOcctShape(node, color, occtShape, 'occt-scale', getKernelStatus(), (oc, trsf) => {
        trsf.SetScale(createOcctPoint(oc, 0, 0, 0), factor);
      });
      if (occtObject) return [occtObject];

      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      const cloned = tagKernel(cloneObject(geom), node, 'scale');
      cloned.scale.multiplyScalar(factor);
      return [cloned];
    }
    case NodeType.MIRROR: {
      const occtShape = extractOcctShape(inputs.geometry);
      const normalVec = getVec('plane_normal', inputs, p);
      const occtObject = await transformOcctShape(node, color, occtShape, 'occt-mirror', getKernelStatus(), (oc, trsf) => {
        const dir = createOcctDir(oc, normalVec.x || 1, normalVec.y || 0, normalVec.z || 0);
        const ax2 = new oc.gp_Ax2_3(createOcctPoint(oc, 0, 0, 0), dir);
        trsf.SetMirror_3(ax2);
      });
      if (occtObject) {
        if (getVal('copy', inputs, p, true)) {
          const group = tagKernel(new THREE.Group(), node, 'occt-mirror-copy');
          const sourceObject = inputs.geometry as THREE.Object3D;
          if (sourceObject) group.add(cloneObject(sourceObject));
          group.add(occtObject);
          return [group];
        }
        return [occtObject];
      }

      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
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
      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      const group = tagKernel(new THREE.Group(), node, 'array-linear');
      const dir = getVec('direction', inputs, p);
      const direction = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
      if (direction.lengthSq() === 0) direction.set(1, 0, 0);
      const count = Math.max(1, Math.floor(getNum('count', inputs, p, 3)));
      const spacing = getNum('spacing', inputs, p, 20);
      for (let i = 0; i < count; i++) {
        const cloned = cloneObject(geom);
        cloned.position.add(direction.clone().multiplyScalar(spacing * i));
        group.add(cloned);
      }
      return [group];
    }
    case NodeType.ARRAY_GRID: {
      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      const group = tagKernel(new THREE.Group(), node, 'array-grid');
      const countX = Math.max(1, Math.floor(getNum('count_x', inputs, p, 3)));
      const countY = Math.max(1, Math.floor(getNum('count_y', inputs, p, 3)));
      const spacing = getNum('spacing', inputs, p, 20);
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
      const geom = inputs.geometry as THREE.Object3D;
      if (!geom) return [null];
      const group = tagKernel(new THREE.Group(), node, 'array-polar');
      const center = getVec('center', inputs, p);
      const count = Math.max(1, Math.floor(getNum('count', inputs, p, 6)));
      const fillAngle = THREE.MathUtils.degToRad(getNum('fill_angle', inputs, p, 360));
      const radius = Math.max(1, geom.position.distanceTo(new THREE.Vector3(center.x, center.y, geom.position.z)));
      for (let i = 0; i < count; i++) {
        const angle = count === 1 ? 0 : (fillAngle / count) * i;
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
