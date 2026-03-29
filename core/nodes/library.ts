import { NodeType } from '../../types';

export interface NodeLibraryCategory {
  label: string;
  items: Array<{ label: string; type: NodeType }>;
}

export const NODE_LIBRARY_CATEGORIES: NodeLibraryCategory[] = [
  {
    label: 'Basic & Params',
    items: [
      { label: 'Parameter', type: NodeType.PARAMETER },
      { label: 'Expression', type: NodeType.EXPRESSION },
    ],
  },
  {
    label: '2D Shapes',
    items: [
      { label: 'Line', type: NodeType.LINE },
      { label: 'Rectangle', type: NodeType.RECTANGLE },
      { label: 'Circle', type: NodeType.CIRCLE },
      { label: 'Arc', type: NodeType.ARC },
      { label: 'Ellipse', type: NodeType.ELLIPSE },
      { label: 'Polygon', type: NodeType.POLYGON },
      { label: 'Star', type: NodeType.STAR },
    ],
  },
  {
    label: '3D Solids',
    items: [
      { label: 'Box', type: NodeType.BOX },
      { label: 'Sphere', type: NodeType.SPHERE },
      { label: 'Capsule', type: NodeType.CAPSULE },
      { label: 'Cylinder', type: NodeType.CYLINDER },
      { label: 'Cone', type: NodeType.CONE },
      { label: 'Frustum', type: NodeType.TRUNCATED_CONE },
      { label: 'Torus', type: NodeType.TORUS },
      { label: 'Ellipsoid', type: NodeType.ELLIPSOID },
    ],
  },
  {
    label: 'Features',
    items: [
      { label: 'Fillet', type: NodeType.FILLET },
      { label: 'Extrude', type: NodeType.EXTRUDE },
      { label: 'Revolve', type: NodeType.REVOLVE },
      { label: 'Sweep', type: NodeType.SWEEP },
      { label: 'Loft', type: NodeType.LOFT },
      { label: 'Boolean', type: NodeType.BOOLEAN_OP },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { label: 'Bounding Box', type: NodeType.BOUNDING_BOX },
      { label: 'Surface Area', type: NodeType.SURFACE_AREA },
      { label: 'Volume', type: NodeType.VOLUME },
      { label: 'Centroid', type: NodeType.CENTROID },
    ],
  },
  {
    label: 'Data Flow',
    items: [
      { label: 'Number Range', type: NodeType.NUMBER_RANGE },
      { label: 'Range By Count', type: NodeType.RANGE_BY_COUNT },
      { label: 'List Create', type: NodeType.LIST_CREATE },
      { label: 'List Length', type: NodeType.LIST_LENGTH },
      { label: 'List Get Item', type: NodeType.LIST_GET_ITEM },
      { label: 'List Flatten', type: NodeType.LIST_FLATTEN },
      { label: 'List First', type: NodeType.LIST_FIRST },
      { label: 'List Last', type: NodeType.LIST_LAST },
      { label: 'List Join', type: NodeType.LIST_JOIN },
      { label: 'List Slice', type: NodeType.LIST_SLICE },
      { label: 'List Reverse', type: NodeType.LIST_REVERSE },
      { label: 'List Unique', type: NodeType.LIST_UNIQUE },
      { label: 'List Repeat', type: NodeType.LIST_REPEAT },
      { label: 'Vector Create', type: NodeType.VECTOR_CREATE },
      { label: 'Vector Add', type: NodeType.VECTOR_ADD },
      { label: 'Vector Subtract', type: NodeType.VECTOR_SUBTRACT },
      { label: 'Vector Scale', type: NodeType.VECTOR_SCALE },
      { label: 'Vector Length', type: NodeType.VECTOR_LENGTH },
      { label: 'Vector Normalize', type: NodeType.VECTOR_NORMALIZE },
      { label: 'Vector Dot', type: NodeType.VECTOR_DOT },
      { label: 'Vector Cross', type: NodeType.VECTOR_CROSS },
      { label: 'Vector Distance', type: NodeType.VECTOR_DISTANCE },
      { label: 'Vector Angle', type: NodeType.VECTOR_ANGLE },
      { label: 'Vector Lerp', type: NodeType.VECTOR_LERP },
    ],
  },
  {
    label: 'Transforms',
    items: [
      { label: 'Move', type: NodeType.TRANSLATION },
      { label: 'Rotate', type: NodeType.ROTATION },
      { label: 'Scale', type: NodeType.SCALE },
      { label: 'Mirror', type: NodeType.MIRROR },
      { label: 'Array Linear', type: NodeType.ARRAY_LINEAR },
      { label: 'Array Grid', type: NodeType.ARRAY_GRID },
      { label: 'Array Polar', type: NodeType.ARRAY_POLAR },
    ],
  },
  {
    label: 'Organization',
    items: [{ label: 'Group', type: NodeType.GROUP }],
  },
];
