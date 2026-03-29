import * as THREE from 'three';
import { NodeData, NodeType } from '../../types';
import {
  attachOcctProfileData,
  buildOcctArcPath,
  buildOcctCircleProfile,
  buildOcctEllipseProfile,
  buildOcctLinePath,
  buildOcctPolygonProfile,
} from './occtSketch';
import { tryOcct } from './occtRuntime';
import {
  create2DObject,
  createCurveObject,
  getNum,
  getVal,
  getVec,
  tagKernel,
} from './runtimeUtils';

interface SketchContext {
  node: NodeData;
  inputs: Record<string, any>;
}

// 2D 草图与路径节点先集中在这里，后续可以继续扩展为独立注册表。
export const executeSketchNode = async ({ node, inputs }: SketchContext): Promise<any[] | null> => {
  const p = node.params;
  const color = p.color || '#888888';

  switch (node.type) {
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
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
      const center = getVec('center', inputs, p);
      const object = tagKernel(create2DObject(shape, p.plane, getVal('is_face', inputs, p, false), center, color), node, 'shape-star');
      const builtProfile = await tryOcct(node, color, (oc) => buildOcctPolygonProfile(oc, polygonPoints, p.plane || 'XOY', center).face, 'occt-profile-star');
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
      const points = [
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 },
      ];
      const occtProfile = await tryOcct(node, color, (oc) => buildOcctPolygonProfile(oc, points, p.plane || 'XOY', center).face, 'occt-profile-rectangle');
      attachOcctProfileData(object, occtProfile?.userData?.occtShape ? { face: occtProfile.userData.occtShape } : null, p.plane || 'XOY', center);
      const occtWire = await tryOcct(node, color, (oc) => buildOcctPolygonProfile(oc, points, p.plane || 'XOY', center).wire, 'occt-wire-rectangle');
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
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
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
    default:
      return null;
  }
};
