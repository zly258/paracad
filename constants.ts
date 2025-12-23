import { NodeType, NodeData } from './types';
import { v4 as uuidv4 } from 'uuid';

export const GRID_SIZE = 20;
export const NODE_WIDTH = 280; 
export const HEADER_HEIGHT = 32;
export const SOCKET_HEIGHT = 36;
export const OUTPUT_HEIGHT = 36; 

export const SOCKET_COLORS = {
  number: 'bg-blue-500',
  geometry: 'bg-green-500',
  vector: 'bg-purple-500',
  boolean: 'bg-red-500',
  shape2d: 'bg-yellow-500',
  curve: 'bg-orange-500',
  any: 'bg-gray-400'
};

export const createDefaultNode = (type: NodeType, position: { x: number, y: number }, customSpec?: string): NodeData => {
  const id = uuidv4();
  
  const createSocket = (name: string, type: 'number' | 'geometry' | 'vector' | 'boolean' | 'shape2d' | 'curve' | 'any', value: any = null) => ({
    id: uuidv4(),
    name,
    type,
    value
  });

  const baseNode = {
    id, type, position, label: type, inputs: [], outputs: [], params: {}
  };

  switch (type) {
    // --- Global Params ---
    case NodeType.PARAMETER:
      return { 
          ...baseNode, 
          label: 'Parameter', 
          outputs: [createSocket('Value', 'any')], 
          params: { name: 'Param1', type: 'number', value: 10.0, vecX: 0, vecY: 0, vecZ: 0, boolVal: true, stringVal: 'Text' } 
      };
    case NodeType.EXPRESSION:
      return { 
          ...baseNode, 
          label: 'Expression', 
          inputs: [], 
          outputs: [createSocket('Result', 'any')], 
          params: { expression: 'Param1 * 2' } 
      };
    
    // --- Custom (Instantiated) ---
    case NodeType.CUSTOM:
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
          } catch(e) { console.error("Error parsing custom spec", e); }
      }
      return {
          ...baseNode,
          label: nodeLabel,
          inputs: dynamicInputs, 
          outputs: [createSocket('Result', 'geometry')],
          params: { graphSpec: customSpec || '' } 
      };

    // --- 2D ---
    case NodeType.LINE:
      return { ...baseNode, label: 'Line', 
        inputs: [createSocket('start', 'vector'), createSocket('end', 'vector')], 
        outputs: [createSocket('curve', 'curve')],
        params: { 'start': {x:0,y:0,z:0}, 'end': {x:10,y:10,z:0} } 
      };
    case NodeType.RECTANGLE:
      return { ...baseNode, label: 'Rectangle', 
        inputs: [createSocket('width', 'number'), createSocket('height', 'number')], 
        outputs: [createSocket('shape', 'shape2d')],
        params: { 'width': 20, 'height': 10, plane: 'XOY' } 
      };
    case NodeType.CIRCLE:
      return { ...baseNode, label: 'Circle', 
        inputs: [createSocket('center', 'vector'), createSocket('radius', 'number')], 
        outputs: [createSocket('shape', 'shape2d')],
        params: { 'center': {x:0,y:0,z:0}, 'radius': 10, plane: 'XOY' }
      };
    case NodeType.ARC:
      return { ...baseNode, label: 'Arc', 
        inputs: [createSocket('center', 'vector'), createSocket('radius', 'number'), createSocket('start_angle', 'number'), createSocket('end_angle', 'number')], 
        outputs: [createSocket('curve', 'curve')],
        params: { 'center': {x:0,y:0,z:0}, 'radius': 10, 'start_angle': 0, 'end_angle': 180, plane: 'XOY' }
      };
    case NodeType.ELLIPSE:
      return { ...baseNode, label: 'Ellipse', 
        inputs: [createSocket('center', 'vector'), createSocket('radius_x', 'number'), createSocket('radius_y', 'number')], 
        outputs: [createSocket('shape', 'shape2d')],
        params: { 'center': {x:0,y:0,z:0}, 'radius_x': 15, 'radius_y': 8, plane: 'XOY' }
      };
    case NodeType.POLYGON:
      return { ...baseNode, label: 'Polygon', 
        inputs: [createSocket('center', 'vector'), createSocket('radius', 'number'), createSocket('sides', 'number')], 
        outputs: [createSocket('shape', 'shape2d')],
        params: { 'center': {x:0,y:0,z:0}, 'radius': 10, 'sides': 6, plane: 'XOY' }
      };
    case NodeType.STAR:
        return { ...baseNode, label: 'Star', 
          inputs: [createSocket('center', 'vector'), createSocket('inner_radius', 'number'), createSocket('outer_radius', 'number'), createSocket('points', 'number')], 
          outputs: [createSocket('shape', 'shape2d')],
          params: { 'center': {x:0,y:0,z:0}, 'inner_radius': 5, 'outer_radius': 10, 'points': 5, plane: 'XOY' }
        };
    
    // --- 3D ---
    case NodeType.BOX:
      return { ...baseNode, label: 'Box', 
        inputs: [createSocket('base', 'vector'), createSocket('size_x', 'number'), createSocket('size_y', 'number'), createSocket('size_z', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'base': {x:0,y:0,z:0}, 'size_x': 10, 'size_y': 10, 'size_z': 10 }
      };
    case NodeType.SPHERE:
      return { ...baseNode, label: 'Sphere', 
        inputs: [createSocket('center', 'vector'), createSocket('radius', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'center': {x:0,y:0,z:0}, 'radius': 10 }
      };
    case NodeType.ELLIPSOID:
      return { ...baseNode, label: 'Ellipsoid', 
        inputs: [createSocket('center', 'vector'), createSocket('radius_x', 'number'), createSocket('radius_y', 'number'), createSocket('radius_z', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'center': {x:0,y:0,z:0}, 'radius_x': 10, 'radius_y': 8, 'radius_z': 6 }
      };
    case NodeType.CYLINDER:
      return { ...baseNode, label: 'Cylinder', 
        inputs: [createSocket('base', 'vector'), createSocket('radius', 'number'), createSocket('height', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'base': {x:0,y:0,z:0}, 'radius': 5, 'height': 20 }
      };
    case NodeType.CONE:
      return { ...baseNode, label: 'Cone', 
        inputs: [createSocket('base', 'vector'), createSocket('radius', 'number'), createSocket('height', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'base': {x:0,y:0,z:0}, 'radius': 10, 'height': 20 }
      };
    case NodeType.TRUNCATED_CONE:
      return { ...baseNode, label: 'Frustum', 
        inputs: [createSocket('base', 'vector'), createSocket('radius_top', 'number'), createSocket('radius_bottom', 'number'), createSocket('height', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'base': {x:0,y:0,z:0}, 'radius_top': 5, 'radius_bottom': 10, 'height': 15 }
      };
    case NodeType.TORUS:
      return { ...baseNode, label: 'Torus', 
        inputs: [createSocket('center', 'vector'), createSocket('radius_main', 'number'), createSocket('radius_tube', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'center': {x:0,y:0,z:0}, 'radius_main': 10, 'radius_tube': 3 }
      };
    case NodeType.CAPSULE:
      return { ...baseNode, label: 'Capsule', 
        inputs: [createSocket('center', 'vector'), createSocket('radius', 'number'), createSocket('length', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'center': {x:0,y:0,z:0}, 'radius': 5, 'length': 20 }
      };
    case NodeType.TETRAHEDRON:
      return { ...baseNode, label: 'Tetrahedron', 
        inputs: [createSocket('center', 'vector'), createSocket('radius', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'center': {x:0,y:0,z:0}, 'radius': 10 }
      };
    case NodeType.OCTAHEDRON:
      return { ...baseNode, label: 'Octahedron', 
        inputs: [createSocket('center', 'vector'), createSocket('radius', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'center': {x:0,y:0,z:0}, 'radius': 10 }
      };
    case NodeType.ICOSAHEDRON:
      return { ...baseNode, label: 'Icosahedron', 
        inputs: [createSocket('center', 'vector'), createSocket('radius', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'center': {x:0,y:0,z:0}, 'radius': 10 }
      };

    // --- Ops ---
    case NodeType.EXTRUDE:
      return { ...baseNode, label: 'Extrude', 
        inputs: [createSocket('shape', 'shape2d'), createSocket('height', 'number'), createSocket('cap', 'boolean')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'height': 20, 'cap': true }
      };
    case NodeType.REVOLVE:
      return { ...baseNode, label: 'Revolve', 
        inputs: [createSocket('shape', 'shape2d'), createSocket('angle', 'number'), createSocket('axis', 'vector')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'angle': 360, 'axis': {x:0,y:1,z:0} }
      };
    case NodeType.SWEEP:
      return { ...baseNode, label: 'Sweep', 
        inputs: [createSocket('shape', 'shape2d'), createSocket('path', 'curve')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: {}
      };
    case NodeType.LOFT:
      return { ...baseNode, label: 'Loft', 
        inputs: [createSocket('section_a', 'shape2d'), createSocket('section_b', 'shape2d')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: {}
      };
    case NodeType.BOOLEAN_OP:
      return { ...baseNode, label: 'Boolean', 
        inputs: [createSocket('object_a', 'geometry'), createSocket('object_b', 'geometry')], 
        outputs: [createSocket('geometry', 'geometry')], params: { operation: 'UNION' } };

    // --- Transforms ---
    case NodeType.TRANSLATION:
      return { ...baseNode, label: 'Move', 
        inputs: [createSocket('geometry', 'geometry'), createSocket('vector', 'vector')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'vector': {x:10,y:0,z:0} }
      };
    case NodeType.ROTATION:
      return { ...baseNode, label: 'Rotate', 
        inputs: [createSocket('geometry', 'geometry'), createSocket('axis', 'vector'), createSocket('angle', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'axis': {x:0,y:0,z:1}, 'angle': 45 }
      };
    case NodeType.SCALE:
      return { ...baseNode, label: 'Scale', 
        inputs: [createSocket('geometry', 'geometry'), createSocket('factor', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'factor': 2.0 }
      };
    case NodeType.MIRROR:
      return { ...baseNode, label: 'Mirror', 
        inputs: [createSocket('geometry', 'geometry'), createSocket('plane_normal', 'vector'), createSocket('copy', 'boolean', true)], 
        outputs: [createSocket('geometry', 'geometry')], 
        params: { 'plane_normal': {x:1,y:0,z:0}, 'copy': true }
      };
    case NodeType.ARRAY_LINEAR:
      return { ...baseNode, label: 'Array Linear', 
        inputs: [createSocket('geometry', 'geometry'), createSocket('direction', 'vector'), createSocket('count', 'number'), createSocket('spacing', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'direction': {x:1,y:0,z:0}, 'count': 3, 'spacing': 20 }
      };
    case NodeType.ARRAY_GRID:
      return { ...baseNode, label: 'Array Grid', 
        inputs: [createSocket('geometry', 'geometry'), createSocket('count_x', 'number'), createSocket('count_y', 'number'), createSocket('spacing', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'count_x': 3, 'count_y': 3, 'spacing': 20 }
      };
    case NodeType.ARRAY_POLAR:
      return { ...baseNode, label: 'Array Polar', 
        inputs: [createSocket('geometry', 'geometry'), createSocket('center', 'vector'), createSocket('count', 'number'), createSocket('fill_angle', 'number')], 
        outputs: [createSocket('geometry', 'geometry')],
        params: { 'center': {x:0,y:0,z:0}, 'count': 6, 'fill_angle': 360 }
      };

    default:
      return baseNode;
  }
};