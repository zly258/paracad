import * as THREE from 'three';
import type { NodeData } from '../../types';
import { getKernelStatus, occtShapeToThreeObject } from '../kernel';
import { tagKernel } from './runtimeUtils';

export const withOcctMetadata = (obj: THREE.Object3D, shape: any, node: NodeData, detail: string) => {
  obj.userData.occtShape = shape;
  return tagKernel(obj, node, detail);
};

// 通用 OCCT 运行时桥：负责内核可用性判断、shape 可视化转换和统一回退日志。
export const tryOcct = async (
  node: NodeData,
  color: string,
  builder: (oc: any) => any,
  detail: string,
) => {
  const kernel = getKernelStatus();
  if (kernel.backend !== 'occt.js' || !kernel.occt) return null;

  try {
    const shape = builder(kernel.occt);
    if (!shape) return null;
    const object = await occtShapeToThreeObject(kernel.occt, shape, color);
    return withOcctMetadata(object, shape, node, detail);
  } catch (error) {
    console.warn(`OCCT execution failed for ${node.label}, fallback to Three path.`, error);
    return null;
  }
};
