import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { NodeData, NodeType } from '../../types';
import {
  createOcctDir,
  createOcctInstance,
  createOcctPoint,
  createOcctVec,
  planeToNormal,
  planeToPoint,
} from './occtHelpers';
import { buildOcctChamferShape, buildOcctFilletShape } from './occtFeatures';
import { tryOcct } from './occtRuntime';
import {
  buildLoftGeometry,
  cloneObject,
  getMaterial,
  getNum,
  getVec,
  tagKernel,
} from './runtimeUtils';

interface FeatureContext {
  node: NodeData;
  inputs: Record<string, any>;
}

const extractOcctShape = (input: any) => input?.userData?.occtShape;
const extractOcctWire = (input: any) => input?.userData?.occtWire || input?.userData?.occtShape;

// 特征节点统一收敛在这里，后续继续补 Shell / Draft / Offset 时可以直接扩展。
export const executeFeatureNode = async ({ node, inputs }: FeatureContext): Promise<any[] | null> => {
  const p = node.params;
  const color = p.color || '#888888';

  const createMesh = (geom: THREE.BufferGeometry, detail: string) =>
    tagKernel(new THREE.Mesh(geom, getMaterial(color)), node, detail);

  switch (node.type) {
    case NodeType.FILLET: {
      const radius = getNum('radius', inputs, p, 1);
      const occtShape = extractOcctShape(inputs.geometry);
      const occtObject = await tryOcct(node, color, (oc) => {
        if (!occtShape) return null;
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
    default:
      return null;
  }
};
