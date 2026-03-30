import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();
let exportIndex = 0;

const parseGlbToThree = async (buffer: ArrayBuffer) => {
  return new Promise<THREE.Object3D>((resolve, reject) => {
    gltfLoader.parse(buffer, '', (gltf) => resolve(gltf.scene), reject);
  });
};

// 使用 OCCT 官方推荐流程：对 shape 进行网格化，写入虚拟文件系统中的 GLB，
// 再交给 Three 的 GLTFLoader 解析为场景对象。
export const occtShapeToThreeObject = async (
  oc: any,
  shape: any,
  color: string,
  meshDeviation = 0.08,
) => {
  const filename = `./occt-preview-${exportIndex++}.glb`;

  const doc = new oc.TDocStd_Document(new oc.TCollection_ExtendedString_1());
  const shapeTool = oc.XCAFDoc_DocumentTool.ShapeTool(doc.Main()).get();
  shapeTool.SetShape(shapeTool.NewShape(), shape);
  new oc.BRepMesh_IncrementalMesh_2(shape, meshDeviation, false, meshDeviation, false);

  const cafWriter = new oc.RWGltf_CafWriter(new oc.TCollection_AsciiString_2(filename), true);
  cafWriter.Perform_2(
    new oc.Handle_TDocStd_Document_2(doc),
    new oc.TColStd_IndexedDataMapOfStringString_1(),
    new oc.Message_ProgressRange_1(),
  );

  const glbFile = oc.FS.readFile(filename, { encoding: 'binary' });
  const scene = await parseGlbToThree(glbFile.buffer.slice(glbFile.byteOffset, glbFile.byteOffset + glbFile.byteLength));

  scene.traverse((child: any) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = false;
    child.material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.02,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
  });

  try { oc.FS.unlink(filename); } catch {}
  return scene;
};
