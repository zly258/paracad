import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { NodeData, NodeType } from '../../types';
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

export const executeFeatureNode = async ({ node, inputs }: FeatureContext): Promise<any[] | null> => {
  const p = node.params;
  const color = p.color || '#888888';

  const createMesh = (geom: THREE.BufferGeometry, detail: string) =>
    tagKernel(new THREE.Mesh(geom, getMaterial(color)), node, detail);

  switch (node.type) {
    case NodeType.FILLET: {
      const radius = getNum('radius', inputs, p, 1);
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
      const height = getNum('height', inputs, p, 20);
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
      const angle = THREE.MathUtils.degToRad(getNum('angle', inputs, p, 360));
      const shapes: THREE.Shape[] = source?.userData?.shapes || [];
      if (!shapes.length) return [null];
      const profile = shapes[0].getSpacedPoints(64).map((pt) => new THREE.Vector2(Math.abs(pt.x), pt.y));
      return [createMesh(new THREE.LatheGeometry(profile, 48, 0, angle), 'revolve')];
    }
    case NodeType.SWEEP: {
      const source = inputs.shape;
      const pathSource = inputs.path;
      const shapes: THREE.Shape[] = source?.userData?.shapes || [];
      const curve = pathSource?.userData?.curve3d;
      if (!shapes.length || !curve) return [null];
      return [createMesh(new THREE.ExtrudeGeometry(shapes, { steps: Math.max(8, Math.floor(getNum('steps', inputs, p, 32))), bevelEnabled: false, extrudePath: curve }), 'sweep')];
    }
    case NodeType.LOFT: {
      const shapeA: THREE.Shape | undefined = inputs.section_a?.userData?.shapes?.[0];
      const shapeB: THREE.Shape | undefined = inputs.section_b?.userData?.shapes?.[0];
      return shapeA && shapeB ? [createMesh(buildLoftGeometry(shapeA, shapeB), 'loft')] : [null];
    }
    default:
      return null;
  }
};
