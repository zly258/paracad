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
