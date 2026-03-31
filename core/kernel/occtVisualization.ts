import * as THREE from 'three';

let exportIndex = 0;

/**
 * Extracts edges from an OCCT shape to a THREE.LineSegments object.
 */
const extractEdges = (oc: any, shape: any): THREE.LineSegments | null => {
  try {
    const edgePositions: number[] = [];
    const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);

    while (explorer.More()) {
      const edge = oc.TopoDS.Edge_1(explorer.Current());
      const adaptor = new oc.BRepAdaptor_Curve_2(edge);
      const startParam = adaptor.FirstParameter();
      const endParam = adaptor.LastParameter();

      // Ensure we get the edge's placement in the shape
      // Actually, TopoDS_Edge in a shape explorer context should already hold its positioning,
      // but let's be safe and check if it needs location applying.
      // In OCCT.js, BRepAdaptor_Curve(edge) usually handles the location.

      const divisions = 36; // More smooth for circles
      for (let i = 0; i < divisions; i++) {
        const p1 = adaptor.Value(startParam + (endParam - startParam) * (i / divisions));
        const p2 = adaptor.Value(startParam + (endParam - startParam) * ((i + 1) / divisions));
        edgePositions.push(p1.X(), p1.Y(), p1.Z());
        edgePositions.push(p2.X(), p2.Y(), p2.Z());
      }
      explorer.Next();
    }

    if (edgePositions.length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 1 });
    const segments = new THREE.LineSegments(geometry, material);
    segments.name = "OCCT_Edges";
    segments.userData = { isOcctEdge: true };
    return segments;
  } catch (e) {
    console.error("Failed to extract OCCT edges:", e);
    return null;
  }
};

/**
 * Manually extracts triangulation from OCCT shape.
 */
const extractMesh = (oc: any, shape: any): THREE.BufferGeometry | null => {
  try {
    const vertices: number[] = [];
    const indices: number[] = [];

    const meshDeviation = 0.1;
    new oc.BRepMesh_IncrementalMesh_2(shape, meshDeviation, false, meshDeviation, false);

    const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    let vertexOffset = 0;

    while (explorer.More()) {
      const face = oc.TopoDS.Face_1(explorer.Current());
      const loc = new oc.TopLoc_Location_1();
      const triangulation = oc.BRep_Tool.Triangulation(face, loc);
      if (triangulation.IsNull()) { explorer.Next(); continue; }

      const poly = triangulation.get();
      const trsf = loc.Transformation();

      const nbNodes = poly.NbNodes();
      for (let i = 1; i <= nbNodes; i++) {
        let p = poly.Node(i);
        p = p.Transformed(trsf);
        vertices.push(p.X(), p.Y(), p.Z());
      }

      const nbTriangles = poly.NbTriangles();
      for (let i = 1; i <= nbTriangles; i++) {
        const tri = poly.Triangle(i);
        let n1 = tri.Value(1), n2 = tri.Value(2), n3 = tri.Value(3);
        if (face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED) {
          indices.push(n1 - 1 + vertexOffset, n3 - 1 + vertexOffset, n2 - 1 + vertexOffset);
        } else {
          indices.push(n1 - 1 + vertexOffset, n2 - 1 + vertexOffset, n3 - 1 + vertexOffset);
        }
      }
      vertexOffset += nbNodes;
      explorer.Next();
    }

    if (vertices.length === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  } catch (e) {
    console.error("Failed to extract OCCT mesh:", e);
    return null;
  }
};

export const occtShapeToThreeObject = async (oc: any, shape: any, color: string) => {
  const group = new THREE.Group();
  group.name = `occt-shape-${exportIndex++}`;

  const geometry = extractMesh(oc, shape);
  if (geometry) {
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.05,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { isOcctMesh: true };
    group.add(mesh);
  }

  const edgeSegments = extractEdges(oc, shape);
  if (edgeSegments) {
    group.add(edgeSegments);
  }

  return group;
};
