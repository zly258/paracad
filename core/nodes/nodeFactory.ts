import { NodeType, NodeData, SocketType } from '../../types';
import { v4 as uuidv4 } from 'uuid';

const createSocket = (name: string, type: SocketType, value: any = null) => ({
  id: uuidv4(),
  name,
  type,
  value,
});

export const createDefaultNode = (
  type: NodeType,
  position: { x: number; y: number },
  customSpec?: string,
): NodeData => {
  const id = uuidv4();
  const baseNode = { id, type, position, label: type, inputs: [], outputs: [], params: {} } as NodeData;
  const geomParams = { color: '#888888' };

  switch (type) {
    case NodeType.PARAMETER:
      return { ...baseNode, label: 'Parameter', outputs: [createSocket('Value', 'any')], params: { name: 'Param1', type: 'number', value: 10, vecX: 0, vecY: 0, vecZ: 0, boolVal: true, stringVal: 'Text', colorVal: '#ff0000' } };
    case NodeType.EXPRESSION:
      return { ...baseNode, label: 'Expression', outputs: [createSocket('Result', 'any')], params: { expression: 'Param1 * 2' } };
    case NodeType.CUSTOM: {
      let dynamicInputs: any[] = [];
      let nodeLabel = 'Custom';
      if (customSpec) {
        try {
          const spec = JSON.parse(customSpec);
          nodeLabel = spec.name || 'Custom';
          spec.nodes.forEach((n: any) => {
            if (n.type === NodeType.PARAMETER && n.params.name) {
              dynamicInputs.push(createSocket(n.params.name, n.params.type === 'vector' ? 'vector' : 'number'));
            }
          });
        } catch (error) {
          console.error('Error parsing custom spec', error);
        }
      }
      return { ...baseNode, label: nodeLabel, inputs: dynamicInputs, outputs: [createSocket('Result', 'geometry')], params: { graphSpec: customSpec || '' } };
    }
    case NodeType.LINE:
      return { ...baseNode, label: 'Line', inputs: [createSocket('start', 'vector'), createSocket('end', 'vector')], outputs: [createSocket('curve', 'curve')], params: { start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 10, z: 0 }, plane: 'XOY', color: '#ffffff' } };
    case NodeType.RECTANGLE:
      return { ...baseNode, label: 'Rectangle', inputs: [createSocket('width', 'number'), createSocket('height', 'number'), createSocket('is_face', 'boolean')], outputs: [createSocket('shape', 'shape2d')], params: { width: 20, height: 10, plane: 'XOY', is_face: false, ...geomParams } };
    case NodeType.CIRCLE:
      return { ...baseNode, label: 'Circle', inputs: [createSocket('center', 'vector'), createSocket('radius', 'number'), createSocket('is_face', 'boolean')], outputs: [createSocket('shape', 'shape2d')], params: { center: { x: 0, y: 0, z: 0 }, radius: 10, plane: 'XOY', is_face: false, ...geomParams } };
    case NodeType.ARC:
      return { ...baseNode, label: 'Arc', inputs: [createSocket('center', 'vector'), createSocket('radius', 'number'), createSocket('start_angle', 'number'), createSocket('end_angle', 'number')], outputs: [createSocket('curve', 'curve')], params: { center: { x: 0, y: 0, z: 0 }, radius: 10, start_angle: 0, end_angle: 180, plane: 'XOY', color: '#ffffff' } };
    case NodeType.ELLIPSE:
      return { ...baseNode, label: 'Ellipse', inputs: [createSocket('center', 'vector'), createSocket('radius_x', 'number'), createSocket('radius_y', 'number'), createSocket('is_face', 'boolean')], outputs: [createSocket('shape', 'shape2d')], params: { center: { x: 0, y: 0, z: 0 }, radius_x: 15, radius_y: 8, plane: 'XOY', is_face: false, ...geomParams } };
    case NodeType.POLYGON:
      return { ...baseNode, label: 'Polygon', inputs: [createSocket('center', 'vector'), createSocket('radius', 'number'), createSocket('sides', 'number'), createSocket('is_face', 'boolean')], outputs: [createSocket('shape', 'shape2d')], params: { center: { x: 0, y: 0, z: 0 }, radius: 10, sides: 6, plane: 'XOY', is_face: false, ...geomParams } };
    case NodeType.STAR:
      return { ...baseNode, label: 'Star', inputs: [createSocket('center', 'vector'), createSocket('inner_radius', 'number'), createSocket('outer_radius', 'number'), createSocket('points', 'number'), createSocket('is_face', 'boolean')], outputs: [createSocket('shape', 'shape2d')], params: { center: { x: 0, y: 0, z: 0 }, inner_radius: 5, outer_radius: 10, points: 5, plane: 'XOY', is_face: false, ...geomParams } };
    case NodeType.BOX:
      return { ...baseNode, label: 'Box', inputs: [createSocket('base', 'vector'), createSocket('size_x', 'number'), createSocket('size_y', 'number'), createSocket('size_z', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { base: { x: 0, y: 0, z: 0 }, size_x: 10, size_y: 10, size_z: 10, ...geomParams } };
    case NodeType.SPHERE:
      return { ...baseNode, label: 'Sphere', inputs: [createSocket('center', 'vector'), createSocket('radius', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { center: { x: 0, y: 0, z: 0 }, radius: 10, ...geomParams } };
    case NodeType.ELLIPSOID:
      return { ...baseNode, label: 'Ellipsoid', inputs: [createSocket('center', 'vector'), createSocket('radius_x', 'number'), createSocket('radius_y', 'number'), createSocket('radius_z', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { center: { x: 0, y: 0, z: 0 }, radius_x: 10, radius_y: 8, radius_z: 6, ...geomParams } };
    case NodeType.CYLINDER:
      return { ...baseNode, label: 'Cylinder', inputs: [createSocket('base', 'vector'), createSocket('radius', 'number'), createSocket('height', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { base: { x: 0, y: 0, z: 0 }, radius: 5, height: 20, ...geomParams } };
    case NodeType.CONE:
      return { ...baseNode, label: 'Cone', inputs: [createSocket('base', 'vector'), createSocket('radius', 'number'), createSocket('height', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { base: { x: 0, y: 0, z: 0 }, radius: 10, height: 20, ...geomParams } };
    case NodeType.TRUNCATED_CONE:
      return { ...baseNode, label: 'Frustum', inputs: [createSocket('base', 'vector'), createSocket('radius_top', 'number'), createSocket('radius_bottom', 'number'), createSocket('height', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { base: { x: 0, y: 0, z: 0 }, radius_top: 5, radius_bottom: 10, height: 15, ...geomParams } };
    case NodeType.TORUS:
      return { ...baseNode, label: 'Torus', inputs: [createSocket('center', 'vector'), createSocket('radius_main', 'number'), createSocket('radius_tube', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { center: { x: 0, y: 0, z: 0 }, radius_main: 10, radius_tube: 3, ...geomParams } };
    case NodeType.CAPSULE:
      return { ...baseNode, label: 'Capsule', inputs: [createSocket('center', 'vector'), createSocket('radius', 'number'), createSocket('length', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { center: { x: 0, y: 0, z: 0 }, radius: 5, length: 20, ...geomParams } };
    case NodeType.GROUP:
      return { ...baseNode, label: 'Group', inputs: [createSocket('item_1', 'geometry'), createSocket('item_2', 'geometry'), createSocket('item_3', 'geometry'), createSocket('item_4', 'geometry')], outputs: [createSocket('group', 'geometry')], params: {} };
    case NodeType.FILLET:
      return { ...baseNode, label: 'Fillet', inputs: [createSocket('geometry', 'geometry'), createSocket('radius', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { radius: 1, filletType: 'round', ...geomParams } };
    case NodeType.EXTRUDE:
      return { ...baseNode, label: 'Extrude', inputs: [createSocket('shape', 'shape2d'), createSocket('height', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { height: 20, ...geomParams } };
    case NodeType.REVOLVE:
      return { ...baseNode, label: 'Revolve', inputs: [createSocket('shape', 'shape2d'), createSocket('angle', 'number'), createSocket('axis', 'vector')], outputs: [createSocket('geometry', 'geometry')], params: { angle: 360, axis: { x: 0, y: 1, z: 0 }, ...geomParams } };
    case NodeType.SWEEP:
      return { ...baseNode, label: 'Sweep', inputs: [createSocket('shape', 'shape2d'), createSocket('path', 'curve')], outputs: [createSocket('geometry', 'geometry')], params: { steps: 32, ...geomParams } };
    case NodeType.LOFT:
      return { ...baseNode, label: 'Loft', inputs: [createSocket('section_a', 'shape2d'), createSocket('section_b', 'shape2d')], outputs: [createSocket('geometry', 'geometry')], params: { steps: 1, ...geomParams } };
    case NodeType.BOOLEAN_OP:
      return { ...baseNode, label: 'Boolean', inputs: [createSocket('object_a', 'geometry'), createSocket('object_b', 'geometry')], outputs: [createSocket('geometry', 'geometry')], params: { operation: 'UNION', ...geomParams } };
    case NodeType.BOUNDING_BOX:
      return {
        ...baseNode,
        label: 'Bounding Box',
        inputs: [createSocket('geometry', 'geometry')],
        outputs: [createSocket('min', 'vector'), createSocket('max', 'vector'), createSocket('size', 'vector'), createSocket('center', 'vector')],
        params: {},
      };
    case NodeType.SURFACE_AREA:
      return {
        ...baseNode,
        label: 'Surface Area',
        inputs: [createSocket('geometry', 'geometry')],
        outputs: [createSocket('area', 'number')],
        params: {},
      };
    case NodeType.VOLUME:
      return {
        ...baseNode,
        label: 'Volume',
        inputs: [createSocket('geometry', 'geometry')],
        outputs: [createSocket('volume', 'number')],
        params: {},
      };
    case NodeType.CENTROID:
      return {
        ...baseNode,
        label: 'Centroid',
        inputs: [createSocket('geometry', 'geometry')],
        outputs: [createSocket('centroid', 'vector')],
        params: {},
      };
    case NodeType.NUMBER_RANGE:
      return {
        ...baseNode,
        label: 'Number Range',
        inputs: [createSocket('start', 'number'), createSocket('end', 'number'), createSocket('step', 'number')],
        outputs: [createSocket('list', 'any')],
        params: { start: 0, end: 100, step: 10 },
      };
    case NodeType.RANGE_BY_COUNT:
      return {
        ...baseNode,
        label: 'Range By Count',
        inputs: [createSocket('start', 'number'), createSocket('end', 'number'), createSocket('count', 'number')],
        outputs: [createSocket('list', 'any')],
        params: { start: 0, end: 100, count: 5 },
      };
    case NodeType.LIST_CREATE:
      return {
        ...baseNode,
        label: 'List Create',
        inputs: [createSocket('item_1', 'any'), createSocket('item_2', 'any'), createSocket('item_3', 'any'), createSocket('item_4', 'any')],
        outputs: [createSocket('list', 'any')],
        params: {},
      };
    case NodeType.LIST_LENGTH:
      return {
        ...baseNode,
        label: 'List Length',
        inputs: [createSocket('list', 'any')],
        outputs: [createSocket('length', 'number')],
        params: {},
      };
    case NodeType.LIST_GET_ITEM:
      return {
        ...baseNode,
        label: 'List Get Item',
        inputs: [createSocket('list', 'any'), createSocket('index', 'number')],
        outputs: [createSocket('item', 'any')],
        params: { index: 0 },
      };
    case NodeType.LIST_FLATTEN:
      return {
        ...baseNode,
        label: 'List Flatten',
        inputs: [createSocket('list', 'any')],
        outputs: [createSocket('list', 'any')],
        params: {},
      };
    case NodeType.LIST_FIRST:
      return {
        ...baseNode,
        label: 'List First',
        inputs: [createSocket('list', 'any')],
        outputs: [createSocket('item', 'any')],
        params: {},
      };
    case NodeType.LIST_LAST:
      return {
        ...baseNode,
        label: 'List Last',
        inputs: [createSocket('list', 'any')],
        outputs: [createSocket('item', 'any')],
        params: {},
      };
    case NodeType.VECTOR_CREATE:
      return {
        ...baseNode,
        label: 'Vector Create',
        inputs: [createSocket('x', 'number'), createSocket('y', 'number'), createSocket('z', 'number')],
        outputs: [createSocket('vector', 'vector')],
        params: { x: 0, y: 0, z: 0 },
      };
    case NodeType.VECTOR_ADD:
      return {
        ...baseNode,
        label: 'Vector Add',
        inputs: [createSocket('a', 'vector'), createSocket('b', 'vector')],
        outputs: [createSocket('vector', 'vector')],
        params: { a: { x: 0, y: 0, z: 0 }, b: { x: 10, y: 0, z: 0 } },
      };
    case NodeType.VECTOR_SUBTRACT:
      return {
        ...baseNode,
        label: 'Vector Subtract',
        inputs: [createSocket('a', 'vector'), createSocket('b', 'vector')],
        outputs: [createSocket('vector', 'vector')],
        params: { a: { x: 10, y: 0, z: 0 }, b: { x: 0, y: 0, z: 0 } },
      };
    case NodeType.VECTOR_SCALE:
      return {
        ...baseNode,
        label: 'Vector Scale',
        inputs: [createSocket('vector', 'vector'), createSocket('factor', 'number')],
        outputs: [createSocket('vector', 'vector')],
        params: { vector: { x: 10, y: 0, z: 0 }, factor: 2 },
      };
    case NodeType.TRANSLATION:
      return { ...baseNode, label: 'Move', inputs: [createSocket('geometry', 'geometry'), createSocket('vector', 'vector')], outputs: [createSocket('geometry', 'geometry')], params: { vector: { x: 10, y: 0, z: 0 } } };
    case NodeType.ROTATION:
      return { ...baseNode, label: 'Rotate', inputs: [createSocket('geometry', 'geometry'), createSocket('axis', 'vector'), createSocket('angle', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { axis: { x: 0, y: 0, z: 1 }, angle: 45 } };
    case NodeType.SCALE:
      return { ...baseNode, label: 'Scale', inputs: [createSocket('geometry', 'geometry'), createSocket('factor', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { factor: 2 } };
    case NodeType.MIRROR:
      return { ...baseNode, label: 'Mirror', inputs: [createSocket('geometry', 'geometry'), createSocket('plane_normal', 'vector'), createSocket('copy', 'boolean', true)], outputs: [createSocket('geometry', 'geometry')], params: { plane_normal: { x: 1, y: 0, z: 0 }, copy: true } };
    case NodeType.ARRAY_LINEAR:
      return { ...baseNode, label: 'Array Linear', inputs: [createSocket('geometry', 'geometry'), createSocket('direction', 'vector'), createSocket('count', 'number'), createSocket('spacing', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { direction: { x: 1, y: 0, z: 0 }, count: 3, spacing: 20 } };
    case NodeType.ARRAY_GRID:
      return { ...baseNode, label: 'Array Grid', inputs: [createSocket('geometry', 'geometry'), createSocket('count_x', 'number'), createSocket('count_y', 'number'), createSocket('spacing', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { count_x: 3, count_y: 3, spacing: 20 } };
    case NodeType.ARRAY_POLAR:
      return { ...baseNode, label: 'Array Polar', inputs: [createSocket('geometry', 'geometry'), createSocket('center', 'vector'), createSocket('count', 'number'), createSocket('fill_angle', 'number')], outputs: [createSocket('geometry', 'geometry')], params: { center: { x: 0, y: 0, z: 0 }, count: 6, fill_angle: 360 } };
    default:
      return baseNode;
  }
};
