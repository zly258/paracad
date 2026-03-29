import { callOcctMethod, createOcctInstance, getOcctShapeEnum } from './occtHelpers';

const collectOcctSubShapes = (oc: any, shape: any, kind: 'EDGE' | 'FACE') => {
  const explorer = createOcctInstance(oc, ['TopExp_Explorer_2', 'TopExp_Explorer_1', 'TopExp_Explorer'], [
    shape,
    getOcctShapeEnum(oc, kind),
    getOcctShapeEnum(oc, 'SHAPE'),
  ]);
  const items: any[] = [];
  while (explorer.More()) {
    items.push(explorer.Current());
    explorer.Next();
  }
  return items;
};

// 真实特征构建统一收敛在这里，便于后续继续补 Shell / Draft / Offset 等能力。
export const buildOcctFilletShape = (oc: any, sourceShape: any, radius: number) => {
  const filletBuilder = createOcctInstance(oc, ['BRepFilletAPI_MakeFillet_2', 'BRepFilletAPI_MakeFillet_1', 'BRepFilletAPI_MakeFillet'], [sourceShape]);
  const edges = collectOcctSubShapes(oc, sourceShape, 'EDGE');
  if (!edges.length) return null;

  for (const edge of edges) {
    try {
      callOcctMethod(filletBuilder, ['Add_2', 'Add_1', 'Add'], [radius, edge]);
    } catch {
      continue;
    }
  }

  try {
    callOcctMethod(filletBuilder, ['Build'], []);
  } catch {
    // 有些绑定在 Shape() 前不要求显式 Build，这里容错即可。
  }

  return callOcctMethod(filletBuilder, ['Shape'], []);
};

export const buildOcctChamferShape = (oc: any, sourceShape: any, distance: number) => {
  const chamferBuilder = createOcctInstance(oc, ['BRepFilletAPI_MakeChamfer_2', 'BRepFilletAPI_MakeChamfer_1', 'BRepFilletAPI_MakeChamfer'], [sourceShape]);
  const edges = collectOcctSubShapes(oc, sourceShape, 'EDGE');
  const faces = collectOcctSubShapes(oc, sourceShape, 'FACE');
  if (!edges.length || !faces.length) return null;

  let added = 0;
  for (const face of faces) {
    for (const edge of edges) {
      try {
        callOcctMethod(chamferBuilder, ['Add_3', 'Add_2', 'Add_1', 'Add'], [distance, edge, face]);
        added += 1;
      } catch {
        continue;
      }
    }
  }

  if (!added) return null;

  try {
    callOcctMethod(chamferBuilder, ['Build'], []);
  } catch {
    // 与圆角保持一致，尽量允许不同绑定在 Shape() 时自行构建。
  }

  return callOcctMethod(chamferBuilder, ['Shape'], []);
};
