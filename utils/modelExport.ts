import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

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

export const exportComputedModel = async (computedResults: Map<string, any>, format: ExportFormat) => {
  const objects = collectRenderableObjects(computedResults);
  if (objects.length === 0) {
    throw new Error('当前没有可导出的模型');
  }

  if (format === 'obj') return exportObj(objects);
  if (format === 'glb') return exportGlb(objects);
  throw new Error('当前仅支持 GLB/OBJ 导出');
};
