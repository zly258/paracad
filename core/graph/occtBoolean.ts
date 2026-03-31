import { createOcctInstance } from './occtHelpers';

export type OcctBooleanOperation = 'UNION' | 'SUBTRACT' | 'INTERSECT';

export const buildOcctBooleanShape = (
  oc: any,
  shapeA: any,
  shapeB: any,
  operation: OcctBooleanOperation,
) => {
  // Attempt to create progress range, but don't fail if it's missing in this build.
  let progress: any = null;
  try {
    progress = createOcctInstance(oc, ['Message_ProgressRange_1', 'Message_ProgressRange'], []);
  } catch (e) {
    // In some builds, Message_ProgressRange is not exposed or not required for simple ops.
    // We'll proceed with progress = null.
  }

  const constructorNames = (() => {
    switch (operation) {
      case 'SUBTRACT': return ['BRepAlgoAPI_Cut_3', 'BRepAlgoAPI_Cut_2', 'BRepAlgoAPI_Cut'];
      case 'INTERSECT': return ['BRepAlgoAPI_Common_3', 'BRepAlgoAPI_Common_2', 'BRepAlgoAPI_Common'];
      case 'UNION':
      default: return ['BRepAlgoAPI_Fuse_3', 'BRepAlgoAPI_Fuse_2', 'BRepAlgoAPI_Fuse'];
    }
  })();

  // Try with 3 arguments (including progress) first if progress exists.
  if (progress) {
    try {
      return createOcctInstance(oc, constructorNames, [shapeA, shapeB, progress]).Shape();
    } catch (e) {
      // If 3-arg fails, fallback to 2-arg.
    }
  }

  // Fallback to 2 arguments.
  return createOcctInstance(oc, constructorNames, [shapeA, shapeB]).Shape();
};
