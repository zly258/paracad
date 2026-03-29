import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { NodeData, NodeType } from '../../types';
import { getKernelStatus, occtShapeToThreeObject } from '../kernel';
import {
  createOcctDir,
  createOcctInstance,
  createOcctPoint,
  createOcctVec,
  planeToNormal,
} from './occtHelpers';
import { buildOcctChamferShape, buildOcctFilletShape } from './occtFeatures';
import {
  attachOcctProfileData,
  buildOcctArcPath,
  buildOcctCircleProfile,
  buildOcctEllipseProfile,
  buildOcctLinePath,
  buildOcctPolygonProfile,
} from './occtSketch';
import {
  buildLoftGeometry,
  cloneObject,
  create2DObject,
  createCurveObject,
  getMaterial,
  getNum,
  getVal,
  getVec,
  tagKernel,
} from './runtimeUtils';

const csgEvaluator = new Evaluator();
csgEvaluator.attributes = ['position', 'normal', 'uv'];

export interface NodeExecutionContext {
  node: NodeData;
  inputs: Record<string, any>;
  globalParams: Record<string, any>;
}

const withOcctMetadata = (obj: THREE.Object3D, shape: any, node: NodeData, detail: string) => {
  obj.userData.occtShape = shape;
  return tagKernel(obj, node, detail);
};

const tryOcct = async (
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

const extractOcctShape = (input: any) => input?.userData?.occtShape;
const extractOcctWire = (input: any) => input?.userData?.occtWire || input?.userData?.occtShape;

const transformOcctShape = async (
  node: NodeData,
  color: string,
  sourceShape: any,
  detail: string,
  buildTrsf: (oc: any, trsf: any) => void,
) => {
  if (!sourceShape) return null;

  return tryOcct(node, color, (oc) => {
    const trsf = new oc.gp_Trsf_1();
    buildTrsf(oc, trsf);
    return new oc.BRepBuilderAPI_Transform_2(sourceShape, trsf, true).Shape();
  }, detail);
};

// 节点执行器：负责把“节点类型 + 输入参数”翻译成几何结果。
// 当前主要承担浏览器预览职责，后续可逐步替换为 OCCT BRep 路径。
export const executeNode = async ({ node, inputs, globalParams }: NodeExecutionContext): Promise<any[]> => {
  const p = node.params;
  const color = p.color || '#888888';
  const SEGMENTS = 64;

  const createMesh = (geom: THREE.BufferGeometry, detail: string) =>
    tagKernel(new THREE.Mesh(geom, getMaterial(color)), node, detail);

  switch (node.type) {
    case NodeType.EXPRESSION: {
      try {
        const fn = new Function(...Object.keys(globalParams), `with (Math) { return ${p.expression || ''}; }`);
        return [fn(...Object.values(globalParams))];
      } catch {
        return [NaN];
      }
    }
    case NodeType.CUSTOM:
      return [null];
    case NodeType.GROUP: {
      const group = tagKernel(new THREE.Group(), node, 'group');
      ['item_1', 'item_2', 'item_3', 'item_4'].forEach((key) => {
        const item = inputs[key];
        if (item instanceof THREE.Object3D) group.add(cloneObject(item));
      });
      return [group];
    }
    case NodeType.LINE: {
      const start = getVec('start', inputs, p);
      const end = getVec('end', inputs, p);
      const points = [new THREE.Vector3(start.x, start.y, start.z), new THREE.Vector3(end.x, end.y, end.z)];
      const object = tagKernel(createCurveObject(points, color, p.plane, { x: 0, y: 0, z: 0 }, new THREE.LineCurve3(points[0], points[1])), node, 'line');
      const occtPath = await tryOcct(node, color, (oc) => buildOcctLinePath(oc, start, end).wire, 'occt-path-line');
      if (occtPath?.userData?.occtShape) {
        object.userData.occtShape = occtPath.userData.occtShape;
        object.userData.occtWire = occtPath.userData.occtShape;
      }
      return [object];
    }
    case NodeType.ARC: {
      const center = getVec('center', inputs, p);
      const radius = getNum('radius', inputs, p, 10);
      const startAngle = THREE.MathUtils.degToRad(getNum('start_angle', inputs, p, 0));
      const endAngle = THREE.MathUtils.degToRad(getNum('end_angle', inputs, p, 180));
      const curve2d = new THREE.ArcCurve(0, 0, radius, startAngle, endAngle, false);
      const points = curve2d.getPoints(64).map((pt) => new THREE.Vector3(pt.x, pt.y, 0));
      const object = tagKernel(createCurveObject(points, color, p.plane, center, new THREE.CatmullRomCurve3(points)), node, 'arc');
      const occtPath = await tryOcct(node, color, (oc) => buildOcctArcPath(oc, p.plane || 'XOY', center, radius, startAngle, endAngle).wire, 'occt-path-arc');
      if (occtPath?.userData?.occtShape) {
        object.userData.occtShape = occtPath.userData.occtShape;
        object.userData.occtWire = occtPath.userData.occtShape;
      }
      return [object];
    }
    case NodeType.FILLET: {
      const radius = getNum('radius', inputs, p, 1);
      const occtShape = extractOcctShape(inputs.geometry);
      const occtObject = await tryOcct(node, color, (oc) => {
        if (!occtShape) return null;
        // 真实特征优先：圆角和倒角都先尝试 BRep 路径，失败后退回预览几何。
        return p.filletType === 'chamfer'
          ? buildOcctChamferShape(oc, occtShape, radius)
          : buildOcctFilletShape(oc, occtShape, radius);
      }, 'occt-fillet');
      if (occtObject) return [occtObject];

      const geom = inputs.geometry as THREE.Mesh;
      if (!geom?.isMesh) return [null];
      if (geom.geometry.type === 'BoxGeometry') {
        const g = geom.geometry as any;
        const rounded = new RoundedBoxGeometry(g.parameters.width, g.parameters.height, g.parameters.depth, p.filletType === 'chamfer' ? 1 : 4, radius);
        const mesh = createMesh(rounded, 'fillet');
        mesh.position.copy(geom.position);
        mesh.rotation.copy(geom.rotation);
        mesh.scale.copy(geom.scale);
        return [mesh];
      }
      return [tagKernel(cloneObject(geom), node, 'fillet-clone')];
    }
    case NodeType.EXTRUDE: {
      const source = inputs.shape;
      const occtProfile = extractOcctShape(source);
      const profilePlane = source?.userData?.profilePlane || p.plane || 'XOY';
      const height = getNum('height', inputs, p, 20);
      const occtObject = await tryOcct(node, color, (oc) => {
        if (!occtProfile) return null;
        // OCCT 路径直接沿草图平面的法线方向做 Prism，失败后再退回 Three 预览几何。
        const normal = planeToNormal(profilePlane);
        const prismBuilder = createOcctInstance(oc, ['BRepPrimAPI_MakePrism_1', 'BRepPrimAPI_MakePrism'], [
          occtProfile,
          createOcctVec(oc, normal.x * height, normal.y * height, normal.z * height),
          true,
          true,
        ]);
        return prismBuilder.Shape();
      }, 'occt-extrude');
      if (occtObject) return [occtObject];

      const shapes: THREE.Shape[] = source?.userData?.shapes || [];
      if (!shapes.length) return [null];
      const geom = new THREE.ExtrudeGeometry(shapes, { depth: height, bevelEnabled: false, curveSegments: 24 });
      const mesh = createMesh(geom, 'extrude');
      if (source instanceof THREE.Object3D) {
        mesh.position.copy(source.position);
        mesh.rotation.copy(source.rotation);
      }
      return [mesh];
    }
    case NodeType.REVOLVE: {
      const source = inputs.shape;
      const occtProfile = extractOcctShape(source);
      const profilePlane = source?.userData?.profilePlane || p.plane || 'XOY';
      const profileCenter = source?.userData?.profileCenter || getVec('center', inputs, p);
      const angle = THREE.MathUtils.degToRad(getNum('angle', inputs, p, 360));
      const occtObject = await tryOcct(node, color, (oc) => {
        if (!occtProfile) return null;
        const axisOrigin = planeToPoint(profilePlane, profileCenter);
        // 这里先采用与现有 Three 预览一致的主轴旋转策略，后面再扩展为“自定义轴线”。
        const axisDir = profilePlane === 'YOZ'
          ? { x: 0, y: 1, z: 0 }
          : { x: 0, y: 0, z: 1 };
        const revolAxis = createOcctInstance(oc, ['gp_Ax1_2', 'gp_Ax1_1'], [
          createOcctPoint(oc, axisOrigin.x, axisOrigin.y, axisOrigin.z),
          createOcctDir(oc, axisDir.x, axisDir.y, axisDir.z),
        ]);
        const revolBuilder = createOcctInstance(oc, ['BRepPrimAPI_MakeRevol_2', 'BRepPrimAPI_MakeRevol_1', 'BRepPrimAPI_MakeRevol'], [
          occtProfile,
          revolAxis,
          angle,
          true,
        ]);
        return revolBuilder.Shape();
      }, 'occt-revolve');
      if (occtObject) return [occtObject];

      const shapes: THREE.Shape[] = source?.userData?.shapes || [];
      if (!shapes.length) return [null];
      const profile = shapes[0].getSpacedPoints(64).map((pt) => new THREE.Vector2(Math.abs(pt.x), pt.y));
      return [createMesh(new THREE.LatheGeometry(profile, 48, 0, angle), 'revolve')];
    }
    case NodeType.SWEEP: {
      const source = inputs.shape;
      const pathSource = inputs.path;
      const occtProfile = extractOcctShape(source);
      const occtPath = extractOcctWire(pathSource);
      const occtObject = await tryOcct(node, color, (oc) => {
        if (!occtProfile || !occtPath) return null;
        // 先以 Pipe 打通“截面 + 路径”主链，后续再补更复杂的管壳与姿态控制。
        const pipeBuilder = createOcctInstance(oc, ['BRepOffsetAPI_MakePipe_1', 'BRepOffsetAPI_MakePipe'], [
          occtPath,
          occtProfile,
        ]);
        return pipeBuilder.Shape();
      }, 'occt-sweep');
      if (occtObject) return [occtObject];

      const shapes: THREE.Shape[] = source?.userData?.shapes || [];
      const curve = pathSource?.userData?.curve3d;
      if (!shapes.length || !curve) return [null];
      return [createMesh(new THREE.ExtrudeGeometry(shapes, { steps: Math.max(8, Math.floor(getNum('steps', inputs, p, 32))), bevelEnabled: false, extrudePath: curve }), 'sweep')];
    }
    case NodeType.LOFT: {
      const occtWireA = extractOcctWire(inputs.section_a);
      const occtWireB = extractOcctWire(inputs.section_b);
      const occtObject = await tryOcct(node, color, (oc) => {
        if (!occtWireA || !occtWireB) return null;
        const thruSections = createOcctInstance(oc, ['BRepOffsetAPI_ThruSections_1', 'BRepOffsetAPI_ThruSections'], [true, false, 1.0e-6]);
        thruSections.AddWire(occtWireA);
        thruSections.AddWire(occtWireB);
        thruSections.Build();
        return thruSections.Shape();
      }, 'occt-loft');
      if (occtObject) return [occtObject];

      const shapeA: THREE.Shape | undefined = inputs.section_a?.userData?.shapes?.[0];
      const shapeB: THREE.Shape | undefined = inputs.section_b?.userData?.shapes?.[0];
      return shapeA && shapeB ? [createMesh(buildLoftGeometry(shapeA, shapeB), 'loft')] : [null];
    }
    case NodeType.STAR: {
      const shape = new THREE.Shape();
      const pts = getNum('points', inputs, p, 5);
      const step = Math.PI / pts;
      const polygonPoints: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < 2 * pts; i++) {
        const r = i % 2 === 0 ? getNum('outer_radius', inputs, p, 10) : getNum('inner_radius', inputs, p, 5);
        const a = i * step;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        polygonPoints.push({ x, y });
        if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      shape.closePath();
      const center = getVec('center', inputs, p);
      const object = tagKernel(create2DObject(shape, p.plane, getVal('is_face', inputs, p, false), center, color), node, 'shape-star');
      const builtProfile = await tryOcct(node, color, (oc) => {
        const built = buildOcctPolygonProfile(oc, polygonPoints, p.plane || 'XOY', center);
        return built.face;
      }, 'occt-profile-star');
      attachOcctProfileData(object, builtProfile?.userData?.occtShape ? { face: builtProfile.userData.occtShape } : null, p.plane || 'XOY', center);
      const builtWire = await tryOcct(node, color, (oc) => buildOcctPolygonProfile(oc, polygonPoints, p.plane || 'XOY', center).wire, 'occt-wire-star');
      if (builtWire?.userData?.occtShape) object.userData.occtWire = builtWire.userData.occtShape;
      return [object];
    }
    case NodeType.RECTANGLE: {
      const w = getNum('width', inputs, p, 20);
      const h = getNum('height', inputs, p, 10);
      const shape = new THREE.Shape().moveTo(-w / 2, -h / 2).lineTo(w / 2, -h / 2).lineTo(w / 2, h / 2).lineTo(-w / 2, h / 2).closePath();
      const center = { x: 0, y: 0, z: 0 };
      const object = tagKernel(create2DObject(shape, p.plane, getVal('is_face', inputs, p, false), center, color), node, 'shape-rectangle');
      const occtProfile = await tryOcct(node, color, (oc) => buildOcctPolygonProfile(oc, [
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 },
      ], p.plane || 'XOY', center).face, 'occt-profile-rectangle');
      attachOcctProfileData(object, occtProfile?.userData?.occtShape ? { face: occtProfile.userData.occtShape } : null, p.plane || 'XOY', center);
      const occtWire = await tryOcct(node, color, (oc) => buildOcctPolygonProfile(oc, [
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 },
      ], p.plane || 'XOY', center).wire, 'occt-wire-rectangle');
      if (occtWire?.userData?.occtShape) object.userData.occtWire = occtWire.userData.occtShape;
      return [object];
    }
    case NodeType.CIRCLE: {
      const shape = new THREE.Shape();
      const radius = getNum('radius', inputs, p, 10);
      const center = getVec('center', inputs, p);
      shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
      const object = tagKernel(create2DObject(shape, p.plane, getVal('is_face', inputs, p, false), center, color), node, 'shape-circle');
      const occtProfile = await tryOcct(node, color, (oc) => buildOcctCircleProfile(oc, radius, p.plane || 'XOY', center).face, 'occt-profile-circle');
      attachOcctProfileData(object, occtProfile?.userData?.occtShape ? { face: occtProfile.userData.occtShape } : null, p.plane || 'XOY', center);
      const occtWire = await tryOcct(node, color, (oc) => buildOcctCircleProfile(oc, radius, p.plane || 'XOY', center).wire, 'occt-wire-circle');
      if (occtWire?.userData?.occtShape) object.userData.occtWire = occtWire.userData.occtShape;
      return [object];
    }
    case NodeType.POLYGON: {
      const shape = new THREE.Shape();
      const sides = Math.max(3, Math.floor(getNum('sides', inputs, p, 6)));
      const r = getNum('radius', inputs, p, 10);
      const step = (2 * Math.PI) / sides;
      const center = getVec('center', inputs, p);
      const polygonPoints: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < sides; i++) {
        const a = i * step;
        const x = r * Math.cos(a);
        const y = r * Math.sin(a);
        polygonPoints.push({ x, y });
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      const object = tagKernel(create2DObject(shape, p.plane, getVal('is_face', inputs, p, false), center, color), node, 'shape-polygon');
      const occtProfile = await tryOcct(node, color, (oc) => buildOcctPolygonProfile(oc, polygonPoints, p.plane || 'XOY', center).face, 'occt-profile-polygon');
      attachOcctProfileData(object, occtProfile?.userData?.occtShape ? { face: occtProfile.userData.occtShape } : null, p.plane || 'XOY', center);
      const occtWire = await tryOcct(node, color, (oc) => buildOcctPolygonProfile(oc, polygonPoints, p.plane || 'XOY', center).wire, 'occt-wire-polygon');
      if (occtWire?.userData?.occtShape) object.userData.occtWire = occtWire.userData.occtShape;
      return [object];
    }
    case NodeType.ELLIPSE: {
      const shape = new THREE.Shape();
      const radiusX = getNum('radius_x', inputs, p, 15);
      const radiusY = getNum('radius_y', inputs, p, 8);
      const center = getVec('center', inputs, p);
      shape.absellipse(0, 0, radiusX, radiusY, 0, 2 * Math.PI, false, 0);
      const object = tagKernel(create2DObject(shape, p.plane, getVal('is_face', inputs, p, false), center, color), node, 'shape-ellipse');
      const occtProfile = await tryOcct(node, color, (oc) => buildOcctEllipseProfile(oc, radiusX, radiusY, p.plane || 'XOY', center).face, 'occt-profile-ellipse');
      attachOcctProfileData(object, occtProfile?.userData?.occtShape ? { face: occtProfile.userData.occtShape } : null, p.plane || 'XOY', center);
      const occtWire = await tryOcct(node, color, (oc) => buildOcctEllipseProfile(oc, radiusX, radiusY, p.plane || 'XOY', center).wire, 'occt-wire-ellipse');
      if (occtWire?.userData?.occtShape) object.userData.occtWire = occtWire.userData.occtShape;
      return [object];
    }
    case NodeType.BOX: {
      const c = getVec('base', inputs, p);
      const occtObject = await tryOcct(node, color, (oc) => new oc.BRepPrimAPI_MakeBox_3(
        createOcctPoint(oc, c.x, c.y, c.z),
        getNum('size_x', inputs, p, 10),
        getNum('size_y', inputs, p, 10),
        getNum('size_z', inputs, p, 10),
      ).Shape(), 'occt-box');
      if (occtObject) return [occtObject];

      const mesh = createMesh(new THREE.BoxGeometry(getNum('size_x', inputs, p, 10), getNum('size_y', inputs, p, 10), getNum('size_z', inputs, p, 10)), 'box');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.SPHERE: {
      const c = getVec('center', inputs, p);
      const occtObject = await tryOcct(node, color, (oc) => new oc.BRepPrimAPI_MakeSphere_5(
        createOcctPoint(oc, c.x, c.y, c.z),
        getNum('radius', inputs, p, 10),
      ).Shape(), 'occt-sphere');
      if (occtObject) return [occtObject];

      const mesh = createMesh(new THREE.SphereGeometry(getNum('radius', inputs, p, 10), SEGMENTS, Math.floor(SEGMENTS / 2)), 'sphere');
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
      const mesh = createMesh(new THREE.CapsuleGeometry(getNum('radius', inputs, p, 5), getNum('length', inputs, p, 20), 8, 16), 'capsule');
      const c = getVec('center', inputs, p);
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.CYLINDER: {
      const c = getVec('base', inputs, p);
      const occtObject = await tryOcct(node, color, (oc) => new oc.BRepPrimAPI_MakeCylinder_3(
        createOcctPoint(oc, c.x, c.y, c.z),
        getNum('radius', inputs, p, 5),
        getNum('height', inputs, p, 20),
      ).Shape(), 'occt-cylinder');
      if (occtObject) return [occtObject];

      const geom = new THREE.CylinderGeometry(getNum('radius', inputs, p, 5), getNum('radius', inputs, p, 5), getNum('height', inputs, p, 20), SEGMENTS);
      geom.rotateX(Math.PI / 2);
      const mesh = createMesh(geom, 'cylinder');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.CONE: {
      const c = getVec('base', inputs, p);
      const occtObject = await tryOcct(node, color, (oc) => new oc.BRepPrimAPI_MakeCone_3(
        createOcctPoint(oc, c.x, c.y, c.z),
        0,
        getNum('radius', inputs, p, 10),
        getNum('height', inputs, p, 20),
      ).Shape(), 'occt-cone');
      if (occtObject) return [occtObject];

      const geom = new THREE.ConeGeometry(getNum('radius', inputs, p, 10), getNum('height', inputs, p, 20), SEGMENTS);
      geom.rotateX(Math.PI / 2);
      const mesh = createMesh(geom, 'cone');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.TRUNCATED_CONE: {
      const c = getVec('base', inputs, p);
      const occtObject = await tryOcct(node, color, (oc) => new oc.BRepPrimAPI_MakeCone_3(
        createOcctPoint(oc, c.x, c.y, c.z),
        getNum('radius_top', inputs, p, 5),
        getNum('radius_bottom', inputs, p, 10),
        getNum('height', inputs, p, 15),
      ).Shape(), 'occt-frustum');
      if (occtObject) return [occtObject];

      const geom = new THREE.CylinderGeometry(getNum('radius_top', inputs, p, 5), getNum('radius_bottom', inputs, p, 10), getNum('height', inputs, p, 15), SEGMENTS);
      geom.rotateX(Math.PI / 2);
      const mesh = createMesh(geom, 'frustum');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.TORUS: {
      const c = getVec('center', inputs, p);
      const occtObject = await tryOcct(node, color, (oc) => new oc.BRepPrimAPI_MakeTorus_2(
        getNum('radius_main', inputs, p, 10),
        getNum('radius_tube', inputs, p, 3),
        Math.PI * 2,
      ).Shape(), 'occt-torus');
      if (occtObject) {
        occtObject.position.set(c.x, c.y, c.z);
        return [occtObject];
      }

      const mesh = createMesh(new THREE.TorusGeometry(getNum('radius_main', inputs, p, 10), getNum('radius_tube', inputs, p, 3), 16, SEGMENTS), 'torus');
      mesh.position.set(c.x, c.y, c.z);
      return [mesh];
    }
    case NodeType.BOOLEAN_OP: {
      const occtShapeA = extractOcctShape(inputs.object_a);
      const occtShapeB = extractOcctShape(inputs.object_b);
      if (occtShapeA && occtShapeB && getKernelStatus().backend === 'occt.js' && getKernelStatus().occt) {
        const occtObject = await tryOcct(node, color, (oc) => {
          const op = p.operation || 'UNION';
          if (op === 'SUBTRACT') return new oc.BRepAlgoAPI_Cut_3(occtShapeA, occtShapeB, new oc.Message_ProgressRange_1()).Shape();
          if (op === 'INTERSECT') return new oc.BRepAlgoAPI_Common_3(occtShapeA, occtShapeB, new oc.Message_ProgressRange_1()).Shape();
          return new oc.BRepAlgoAPI_Fuse_3(occtShapeA, occtShapeB, new oc.Message_ProgressRange_1()).Shape();
        }, `occt-boolean-${(p.operation || 'UNION').toLowerCase()}`);
        if (occtObject) return [occtObject];
      }

      const objA = inputs.object_a as THREE.Mesh;
      const objB = inputs.object_b as THREE.Mesh;
      if (!objA?.isMesh || !objB?.isMesh) return [null];
      objA.updateMatrixWorld();
      objB.updateMatrixWorld();
      const brushA = new Brush(objA.geometry, objA.material);
      brushA.applyMatrix4(objA.matrixWorld);
      const brushB = new Brush(objB.geometry, objB.material);
      brushB.applyMatrix4(objB.matrixWorld);
      const op = p.operation || 'UNION';
      const result = op === 'SUBTRACT'
        ? csgEvaluator.evaluate(brushA, brushB, SUBTRACTION)
        : op === 'INTERSECT'
          ? csgEvaluator.evaluate(brushA, brushB, INTERSECTION)
          : csgEvaluator.evaluate(brushA, brushB, ADDITION);
      return [result ? createMesh(result.geometry, `boolean-${op.toLowerCase()}`) : null];
    }
    case NodeType.TRANSLATION: {
      const occtShape = extractOcctShape(inputs.geometry);
      const v = getVec('vector', inputs, p);
      const occtObject = await transformOcctShape(node, color, occtShape, 'occt-move', (oc, trsf) => {
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
      const occtObject = await transformOcctShape(node, color, occtShape, 'occt-rotate', (oc, trsf) => {
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
      const occtObject = await transformOcctShape(node, color, occtShape, 'occt-scale', (oc, trsf) => {
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
      const occtObject = await transformOcctShape(node, color, occtShape, 'occt-mirror', (oc, trsf) => {
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
      return [];
  }
};

