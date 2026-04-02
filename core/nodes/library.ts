import { NodeType } from '../../types';

export interface NodeLibraryCategory {
  label: string;
  items: Array<{ label: string; type: NodeType }>;
}

export const NODE_LIBRARY_CATEGORIES: NodeLibraryCategory[] = [
  {
    label: 'Core',
    items: [
      { label: 'Parameter', type: NodeType.PARAMETER },
      { label: 'Expression', type: NodeType.EXPRESSION },
    ],
  },
  {
    label: 'Sketch 2D',
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
    label: 'Solid Primitives',
    items: [
      { label: 'Box', type: NodeType.BOX },
      { label: 'Sphere', type: NodeType.SPHERE },
      { label: 'Cylinder', type: NodeType.CYLINDER },
      { label: 'Cone', type: NodeType.CONE },
      { label: 'Frustum', type: NodeType.TRUNCATED_CONE },
      { label: 'Torus', type: NodeType.TORUS },
      { label: 'Ellipsoid', type: NodeType.ELLIPSOID },
      { label: 'Capsule', type: NodeType.CAPSULE },
    ],
  },
  {
    label: 'Solid Operations',
    items: [
      { label: 'Extrude', type: NodeType.EXTRUDE },
      { label: 'Revolve', type: NodeType.REVOLVE },
      { label: 'Sweep', type: NodeType.SWEEP },
      { label: 'Loft', type: NodeType.LOFT },
      { label: 'Boolean', type: NodeType.BOOLEAN_OP },
      { label: 'Fillet', type: NodeType.FILLET },
    ],
  },
  {
    label: 'Transform & Array',
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
    label: 'Measure',
    items: [
      { label: 'Bounding Box', type: NodeType.BOUNDING_BOX },
      { label: 'Surface Area', type: NodeType.SURFACE_AREA },
      { label: 'Volume', type: NodeType.VOLUME },
      { label: 'Centroid', type: NodeType.CENTROID },
    ],
  },
  {
    label: 'Data & Math',
    items: [
      { label: 'Number Range', type: NodeType.NUMBER_RANGE },
      { label: 'Range By Count', type: NodeType.RANGE_BY_COUNT },
      { label: 'List Create', type: NodeType.LIST_CREATE },
      { label: 'List Length', type: NodeType.LIST_LENGTH },
      { label: 'List Get Item', type: NodeType.LIST_GET_ITEM },
      { label: 'Vector Create', type: NodeType.VECTOR_CREATE },
    ],
  },
];
