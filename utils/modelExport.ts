import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { getKernelStatus } from '../core/kernel';

export type ExportFormat = 'glb' | 'obj' | 'stp' | 'igs';

const collectRenderableObjects = (computedResults: Map<string, any>) => {
  const objects: THREE.Object3D[] = [];
  const visit = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value instanceof THREE.Object3D) {
      if (value.userData?.visible === false) return;
      objects.push(value);
    }
  };
  computedResults.forEach((value) => visit(value));
  return objects;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const buildThreeExportRoot = (objects: THREE.Object3D[]) => {
  const root = new THREE.Group();
  objects.forEach((obj) => {
    root.add(obj.clone(true));
  });
  root.updateMatrixWorld(true);
  return root;
};

const exportObj = async (objects: THREE.Object3D[]) => {
  const root = buildThreeExportRoot(objects);
  const text = new OBJExporter().parse(root);
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `paracad-${Date.now()}.obj`);
};

const exportGlb = async (objects: THREE.Object3D[]) => {
  const root = buildThreeExportRoot(objects);
  const exporter = new GLTFExporter();
  await new Promise<void>((resolve, reject) => {
    exporter.parse(
      root,
      (result) => {
        if (result instanceof ArrayBuffer) {
          downloadBlob(new Blob([result], { type: 'model/gltf-binary' }), `paracad-${Date.now()}.glb`);
          resolve();
          return;
        }
        reject(new Error('GLB 导出失败'));
      },
      (error) => reject(error),
      { binary: true, onlyVisible: true },
    );
  });
};

const createOcctInstance = (oc: any, names: string[], args: any[]) => {
  for (const name of names) {
    const Ctor = oc?.[name];
    if (typeof Ctor !== 'function') continue;
    try {
      return new Ctor(...args);
    } catch {
      continue;
    }
  }
  throw new Error(`OCCT class not found: ${names.join(', ')}`);
};

const callOcctMethod = (target: any, names: string[], args: any[]) => {
  for (const name of names) {
    const fn = target?.[name];
    if (typeof fn !== 'function') continue;
    try {
      return fn.apply(target, args);
    } catch {
      continue;
    }
  }
  throw new Error(`OCCT method not found: ${names.join(', ')}`);
};

const createOcctPoint = (oc: any, x: number, y: number, z: number) => {
  const names = ['gp_Pnt_3', 'gp_Pnt_2', 'gp_Pnt_1', 'gp_Pnt'];
  for (const name of names) {
    const Ctor = oc?.[name];
    if (typeof Ctor !== 'function') continue;
    try {
      return new Ctor(x, y, z);
    } catch {
      continue;
    }
  }
  throw new Error('OCCT gp_Pnt constructor not found');
};

const buildOcctFacetedCompoundFromMeshes = (oc: any, objects: THREE.Object3D[]) => {
  const builder = createOcctInstance(oc, ['BRep_Builder', 'BRep_Builder_1'], []);
  const compound = createOcctInstance(oc, ['TopoDS_Compound', 'TopoDS_Compound_1'], []);
  callOcctMethod(builder, ['MakeCompound', 'MakeCompound_1'], [compound]);

  const localA = new THREE.Vector3();
  const localB = new THREE.Vector3();
  const localC = new THREE.Vector3();
  const worldA = new THREE.Vector3();
  const worldB = new THREE.Vector3();
  const worldC = new THREE.Vector3();
  const edgeAB = new THREE.Vector3();
  const edgeAC = new THREE.Vector3();
  const normal = new THREE.Vector3();

  const addTriangleFace = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => {
    localA.set(ax, ay, az);
    localB.set(bx, by, bz);
    localC.set(cx, cy, cz);
    worldA.copy(localA).applyMatrix4(currentWorldMatrix);
    worldB.copy(localB).applyMatrix4(currentWorldMatrix);
    worldC.copy(localC).applyMatrix4(currentWorldMatrix);

    edgeAB.subVectors(worldB, worldA);
    edgeAC.subVectors(worldC, worldA);
    normal.crossVectors(edgeAB, edgeAC);
    if (normal.lengthSq() < 1e-16) return;

    const polygon = createOcctInstance(oc, ['BRepBuilderAPI_MakePolygon_1', 'BRepBuilderAPI_MakePolygon'], []);
    callOcctMethod(polygon, ['Add_1', 'Add'], [createOcctPoint(oc, worldA.x, worldA.y, worldA.z)]);
    callOcctMethod(polygon, ['Add_1', 'Add'], [createOcctPoint(oc, worldB.x, worldB.y, worldB.z)]);
    callOcctMethod(polygon, ['Add_1', 'Add'], [createOcctPoint(oc, worldC.x, worldC.y, worldC.z)]);
    callOcctMethod(polygon, ['Close', 'Close_1'], []);

    const wire = callOcctMethod(polygon, ['Wire', 'Wire_1'], []);
    const faceBuilder = createOcctInstance(oc, ['BRepBuilderAPI_MakeFace_15', 'BRepBuilderAPI_MakeFace_16', 'BRepBuilderAPI_MakeFace_1'], [wire, true]);
    const face = typeof faceBuilder.Face === 'function' ? faceBuilder.Face() : faceBuilder.Shape();
    callOcctMethod(builder, ['Add', 'Add_2', 'Add_1'], [compound, face]);
    facetedFaceCount += 1;
  };

  let facetedFaceCount = 0;
  const currentWorldMatrix = new THREE.Matrix4();
  objects.forEach((obj) => {
    obj.updateMatrixWorld(true);
    obj.traverse((child: any) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (child.userData?.visible === false) return;
      const geometry = child.geometry as THREE.BufferGeometry | undefined;
      const position = geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!geometry || !position || position.count < 3) return;

      currentWorldMatrix.copy(child.matrixWorld);
      const index = geometry.getIndex();
      if (index) {
        for (let i = 0; i + 2 < index.count; i += 3) {
          const i0 = index.getX(i);
          const i1 = index.getX(i + 1);
          const i2 = index.getX(i + 2);
          addTriangleFace(
            position.getX(i0), position.getY(i0), position.getZ(i0),
            position.getX(i1), position.getY(i1), position.getZ(i1),
            position.getX(i2), position.getY(i2), position.getZ(i2),
          );
        }
        return;
      }

      for (let i = 0; i + 2 < position.count; i += 3) {
        addTriangleFace(
          position.getX(i), position.getY(i), position.getZ(i),
          position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1),
          position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2),
        );
      }
    });
  });

  if (facetedFaceCount === 0) return null;
  return compound;
};

const exportBrepByOcct = async (objects: THREE.Object3D[], format: 'stp' | 'igs') => {
  const { occt: oc } = getKernelStatus();
  if (!oc) throw new Error('当前未启用 OCCT 内核，无法导出 STP/IGS');

  const shapeSet = new Set<any>();
  objects.forEach((obj) => {
    obj.traverse((child: any) => {
      const shape = child?.userData?.occtShape;
      if (shape) shapeSet.add(shape);
    });
  });
  const shapes = Array.from(shapeSet);
  if (shapes.length === 0) {
    const faceted = buildOcctFacetedCompoundFromMeshes(oc, objects);
    if (!faceted) throw new Error('当前模型不含可导出的几何体');
    shapes.push(faceted);
  }

  let targetShape = shapes[0];
  if (shapes.length > 1) {
    const builder = createOcctInstance(oc, ['BRep_Builder', 'BRep_Builder_1'], []);
    const compound = createOcctInstance(oc, ['TopoDS_Compound', 'TopoDS_Compound_1'], []);
    callOcctMethod(builder, ['MakeCompound', 'MakeCompound_1'], [compound]);
    shapes.forEach((shape) => {
      callOcctMethod(builder, ['Add', 'Add_2', 'Add_1'], [compound, shape]);
    });
    targetShape = compound;
  }

  const filename = `./paracad-export-${Date.now()}.${format}`;
  if (format === 'stp') {
    const writer = createOcctInstance(oc, ['STEPControl_Writer', 'STEPControl_Writer_1'], []);
    const mode =
      oc?.STEPControl_StepModelType?.STEPControl_AsIs ??
      oc?.STEPControl_AsIs ??
      0;
    try {
      callOcctMethod(writer, ['Transfer', 'Transfer_1', 'Transfer_2'], [targetShape, mode]);
    } catch {
      callOcctMethod(writer, ['Transfer', 'Transfer_1', 'Transfer_2'], [targetShape]);
    }
    callOcctMethod(writer, ['Write', 'Write_1'], [filename]);
    const file = oc.FS.readFile(filename, { encoding: 'binary' });
    downloadBlob(new Blob([file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)], { type: 'model/step' }), `paracad-${Date.now()}.stp`);
    try { oc.FS.unlink(filename); } catch {}
    return;
  }

  const writer = createOcctInstance(oc, ['IGESControl_Writer', 'IGESControl_Writer_1'], []);
  try {
    callOcctMethod(writer, ['AddShape', 'AddShape_1'], [targetShape]);
  } catch {
    callOcctMethod(writer, ['Transfer', 'Transfer_1'], [targetShape]);
  }
  callOcctMethod(writer, ['Write', 'Write_1'], [filename]);
  const file = oc.FS.readFile(filename, { encoding: 'binary' });
  downloadBlob(new Blob([file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)], { type: 'model/iges' }), `paracad-${Date.now()}.igs`);
  try { oc.FS.unlink(filename); } catch {}
};

export const exportComputedModel = async (computedResults: Map<string, any>, format: ExportFormat) => {
  const objects = collectRenderableObjects(computedResults);
  if (objects.length === 0) {
    throw new Error('当前没有可导出的模型');
  }

  if (format === 'obj') return exportObj(objects);
  if (format === 'glb') return exportGlb(objects);
  return exportBrepByOcct(objects, format);
};
