import {
  createOcctDir,
  createOcctInstance,
  createOcctPoint,
  planeLocalPointToWorld,
  planeToNormal,
  planeToPoint,
} from './occtHelpers';

const buildOcctAxis3 = (oc: any, plane: string, center: { x: number; y: number; z: number }) => {
  const origin = planeToPoint(plane, center);
  const normal = planeToNormal(plane);
  const ax3 = createOcctInstance(oc, ['gp_Ax3_2', 'gp_Ax3_1'], [
    createOcctPoint(oc, origin.x, origin.y, origin.z),
    createOcctDir(oc, normal.x, normal.y, normal.z),
  ]);
  return { ax3, origin, normal };
};

const buildOcctAxis2 = (oc: any, plane: string, center: { x: number; y: number; z: number }) => {
  const origin = planeToPoint(plane, center);
  const normal = planeToNormal(plane);
  const ax2 = createOcctInstance(oc, ['gp_Ax2_3', 'gp_Ax2_2', 'gp_Ax2_1'], [
    createOcctPoint(oc, origin.x, origin.y, origin.z),
    createOcctDir(oc, normal.x, normal.y, normal.z),
  ]);
  return { ax2, origin, normal };
};

const makeOcctEdge = (oc: any, ...args: any[]) =>
  createOcctInstance(oc, ['BRepBuilderAPI_MakeEdge_30', 'BRepBuilderAPI_MakeEdge_29', 'BRepBuilderAPI_MakeEdge_24', 'BRepBuilderAPI_MakeEdge_9', 'BRepBuilderAPI_MakeEdge_8', 'BRepBuilderAPI_MakeEdge_1'], args);

const makeOcctWire = (oc: any, ...args: any[]) =>
  createOcctInstance(oc, ['BRepBuilderAPI_MakeWire_4', 'BRepBuilderAPI_MakeWire_1', 'BRepBuilderAPI_MakeWire'], args);

// 草图与路径构建统一放在这里，便于后续继续扩展约束草图、工作平面与复合轮廓。
export const buildOcctPolygonProfile = (
  oc: any,
  points: Array<{ x: number; y: number }>,
  plane: string,
  center: { x: number; y: number; z: number },
) => {
  const { ax3, origin } = buildOcctAxis3(oc, plane, center);
  const polygon = createOcctInstance(oc, ['BRepBuilderAPI_MakePolygon_1', 'BRepBuilderAPI_MakePolygon'], []);
  for (const point of points) {
    polygon.Add_1(createOcctPoint(oc, origin.x + point.x, origin.y + point.y, origin.z));
  }
  polygon.Close();

  const wire = polygon.Wire();
  const faceBuilder = createOcctInstance(oc, ['BRepBuilderAPI_MakeFace_15', 'BRepBuilderAPI_MakeFace_16', 'BRepBuilderAPI_MakeFace_1'], [wire, true]);
  const face = faceBuilder.Face ? faceBuilder.Face() : faceBuilder.Shape();
  return { wire, face, axis: ax3 };
};

export const buildOcctCircleProfile = (
  oc: any,
  radius: number,
  plane: string,
  center: { x: number; y: number; z: number },
) => {
  const { ax3 } = buildOcctAxis3(oc, plane, center);
  const circleBuilder = createOcctInstance(oc, ['GC_MakeCircle_6', 'GC_MakeCircle_5', 'GC_MakeCircle_1', 'GC_MakeCircle'], [ax3, radius]);
  const circle = circleBuilder.Value ? circleBuilder.Value() : circleBuilder;
  const edgeBuilder = makeOcctEdge(oc, circle);
  const edge = edgeBuilder.Edge ? edgeBuilder.Edge() : edgeBuilder.Shape();
  const wireBuilder = makeOcctWire(oc, edge);
  const wire = wireBuilder.Wire ? wireBuilder.Wire() : wireBuilder.Shape();
  const faceBuilder = createOcctInstance(oc, ['BRepBuilderAPI_MakeFace_15', 'BRepBuilderAPI_MakeFace_16', 'BRepBuilderAPI_MakeFace_1'], [wire, true]);
  const face = faceBuilder.Face ? faceBuilder.Face() : faceBuilder.Shape();
  return { wire, face, axis: ax3 };
};

export const buildOcctEllipseProfile = (
  oc: any,
  radiusX: number,
  radiusY: number,
  plane: string,
  center: { x: number; y: number; z: number },
) => {
  const major = Math.max(radiusX, radiusY);
  const minor = Math.min(radiusX, radiusY);
  const { ax2 } = buildOcctAxis2(oc, plane, center);
  const ellipseBuilder = createOcctInstance(oc, ['GC_MakeEllipse_5', 'GC_MakeEllipse_4', 'GC_MakeEllipse_1', 'GC_MakeEllipse'], [ax2, major, minor]);
  const ellipse = ellipseBuilder.Value ? ellipseBuilder.Value() : ellipseBuilder;
  const edgeBuilder = makeOcctEdge(oc, ellipse);
  const edge = edgeBuilder.Edge ? edgeBuilder.Edge() : edgeBuilder.Shape();
  const wireBuilder = makeOcctWire(oc, edge);
  const wire = wireBuilder.Wire ? wireBuilder.Wire() : wireBuilder.Shape();
  const faceBuilder = createOcctInstance(oc, ['BRepBuilderAPI_MakeFace_15', 'BRepBuilderAPI_MakeFace_16', 'BRepBuilderAPI_MakeFace_1'], [wire, true]);
  const face = faceBuilder.Face ? faceBuilder.Face() : faceBuilder.Shape();
  return { wire, face };
};

export const buildOcctLinePath = (
  oc: any,
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
) => {
  const edgeBuilder = makeOcctEdge(
    oc,
    createOcctPoint(oc, start.x, start.y, start.z),
    createOcctPoint(oc, end.x, end.y, end.z),
  );
  const edge = edgeBuilder.Edge ? edgeBuilder.Edge() : edgeBuilder.Shape();
  const wireBuilder = makeOcctWire(oc, edge);
  const wire = wireBuilder.Wire ? wireBuilder.Wire() : wireBuilder.Shape();
  return { edge, wire };
};

export const buildOcctArcPath = (
  oc: any,
  plane: string,
  center: { x: number; y: number; z: number },
  radius: number,
  startAngle: number,
  endAngle: number,
) => {
  const middleAngle = (startAngle + endAngle) / 2;
  const start = planeLocalPointToWorld(plane, center, Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
  const middle = planeLocalPointToWorld(plane, center, Math.cos(middleAngle) * radius, Math.sin(middleAngle) * radius);
  const end = planeLocalPointToWorld(plane, center, Math.cos(endAngle) * radius, Math.sin(endAngle) * radius);
  const arcBuilder = createOcctInstance(oc, ['GC_MakeArcOfCircle_4', 'GC_MakeArcOfCircle_3', 'GC_MakeArcOfCircle_1', 'GC_MakeArcOfCircle'], [
    createOcctPoint(oc, start.x, start.y, start.z),
    createOcctPoint(oc, middle.x, middle.y, middle.z),
    createOcctPoint(oc, end.x, end.y, end.z),
  ]);
  const arc = arcBuilder.Value ? arcBuilder.Value() : arcBuilder;
  const edgeBuilder = makeOcctEdge(oc, arc);
  const edge = edgeBuilder.Edge ? edgeBuilder.Edge() : edgeBuilder.Shape();
  const wireBuilder = makeOcctWire(oc, edge);
  const wire = wireBuilder.Wire ? wireBuilder.Wire() : wireBuilder.Shape();
  return { edge, wire };
};

export const attachOcctProfileData = (
  object: any,
  built: { face?: any; wire?: any; edge?: any } | null,
  plane: string,
  center: { x: number; y: number; z: number },
) => {
  if (built?.face) object.userData.occtShape = built.face;
  if (built?.wire) object.userData.occtWire = built.wire;
  object.userData.profilePlane = plane;
  object.userData.profileCenter = center;
  return object;
};
