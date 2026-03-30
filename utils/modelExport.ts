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
  if (shapes.length === 0) throw new Error('当前模型不含 OCCT Shape。请使用 OCCT 几何节点重建后再导出 STP/IGS');

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
