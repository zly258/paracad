import type { NodeData } from '../../types';
import { occtShapeToThreeObject } from '../kernel';
import { withOcctMetadata } from './occtRuntime';

// BRep 级变换桥：输入源 shape + gp_Trsf 构造逻辑，输出可继续参与节点链的 Three 对象。
export const transformOcctShape = async (
  node: NodeData,
  color: string,
  sourceShape: any,
  detail: string,
  kernel: { backend: string; occt: any | null },
  buildTrsf: (oc: any, trsf: any) => void,
) => {
  if (!sourceShape) return null;
  if (kernel.backend !== 'occt.js' || !kernel.occt) return null;

  try {
    const oc = kernel.occt;
    const trsf = new oc.gp_Trsf_1();
    buildTrsf(oc, trsf);
    const shape = new oc.BRepBuilderAPI_Transform_2(sourceShape, trsf, true).Shape();
    const object = await occtShapeToThreeObject(oc, shape, color);
    return withOcctMetadata(object, shape, node, detail);
  } catch (error) {
    console.warn(`OCCT transform failed for ${node.label}, fallback to Three path.`, error);
    return null;
  }
};
