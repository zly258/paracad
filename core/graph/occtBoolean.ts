import { createOcctInstance } from './occtHelpers';

export type OcctBooleanOperation = 'UNION' | 'SUBTRACT' | 'INTERSECT';

// 真实布尔统一收敛在这里，后续方便继续接容差控制、历史追踪和更细的错误分级。
export const buildOcctBooleanShape = (
  oc: any,
  shapeA: any,
  shapeB: any,
  operation: OcctBooleanOperation,
) => {
  const progress = createOcctInstance(oc, ['Message_ProgressRange_1', 'Message_ProgressRange'], []);
  if (operation === 'SUBTRACT') {
    return createOcctInstance(oc, ['BRepAlgoAPI_Cut_3', 'BRepAlgoAPI_Cut_2', 'BRepAlgoAPI_Cut'], [
      shapeA,
      shapeB,
      progress,
    ]).Shape();
  }
  if (operation === 'INTERSECT') {
    return createOcctInstance(oc, ['BRepAlgoAPI_Common_3', 'BRepAlgoAPI_Common_2', 'BRepAlgoAPI_Common'], [
      shapeA,
      shapeB,
      progress,
    ]).Shape();
  }
  return createOcctInstance(oc, ['BRepAlgoAPI_Fuse_3', 'BRepAlgoAPI_Fuse_2', 'BRepAlgoAPI_Fuse'], [
    shapeA,
    shapeB,
    progress,
  ]).Shape();
};
