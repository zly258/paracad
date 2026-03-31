import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, GizmoHelper, GizmoViewport, OrthographicCamera } from '@react-three/drei';
import { useGraph } from '../../store/GraphStore';
import * as THREE from 'three';
import { RefreshCw, Scan, Download, Layers, Box, Sun, Moon } from 'lucide-react';
import { exportComputedModel, ExportFormat } from '../../utils/modelExport';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      primitive: any;
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      [elemName: string]: any;
    }
  }
}

type RenderMode = 'shaded' | 'wireframe';
type ViewportTheme = 'light' | 'dark';

const InfiniteAxes: React.FC<{ theme: ViewportTheme }> = ({ theme }) => {
  const isLight = theme === 'light';
  const axes = useMemo(() => {
    const opacity = isLight ? 0.3 : 0.6;
    const materialX = new THREE.LineBasicMaterial({ color: 0xaa2222, opacity, transparent: true });
    const materialY = new THREE.LineBasicMaterial({ color: 0x22aa22, opacity, transparent: true });
    const materialZ = new THREE.LineBasicMaterial({ color: 0x2222aa, opacity, transparent: true });

    const points = [new THREE.Vector3(-10000, 0, 0), new THREE.Vector3(10000, 0, 0)];
    const lineX = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), materialX);

    const pointsY = [new THREE.Vector3(0, -10000, 0), new THREE.Vector3(0, 10000, 0)];
    const lineY = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsY), materialY);

    const pointsZ = [new THREE.Vector3(0, 0, -10000), new THREE.Vector3(0, 0, 10000)];
    const lineZ = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsZ), materialZ);

    return [lineX, lineY, lineZ];
  }, [isLight]);

  // @ts-ignore
  return (<group>{axes.map((line, i) => <primitive key={i} object={line} />)}</group>) as any;
};

interface SceneContentProps {
  computedResults: Map<string, any>;
  renderMode: RenderMode;
  theme: ViewportTheme;
}

const SceneContent: React.FC<SceneContentProps> = ({ computedResults, renderMode, theme }) => {
  const isLight = theme === 'light';
  const meshesToRender = useMemo(() => {
    const items: React.ReactNode[] = [];
    const collectRenderable = (value: any) => {
      if (!value) return;
      if (Array.isArray(value)) { value.forEach((item) => collectRenderable(item)); return; }
      if (value instanceof THREE.Object3D) {
        if (value.userData?.visible === false) return;

        value.traverse((child) => {
          const isOcctMesh = child.userData?.isOcctMesh;
          const isOcctEdge = child.userData?.isOcctEdge;

          if (isOcctMesh) {
            child.visible = renderMode === 'shaded';
            if ((child as THREE.Mesh).isMesh) {
              const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
              if (mat) mat.wireframe = false;
            }
          }
          if (isOcctEdge) {
            child.visible = renderMode === 'wireframe';
            if ((child as THREE.LineSegments).isLineSegments) {
              const mat = (child as THREE.LineSegments).material as THREE.LineBasicMaterial;
              mat.color.set(isLight ? 0x333333 : 0xcccccc);
              mat.opacity = isLight ? 1 : 0.8;
            }
          }

          if (!(isOcctMesh || isOcctEdge) && (child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat) {
              mat.wireframe = renderMode === 'wireframe';
              child.visible = true;
            }
          }
        });
        // @ts-ignore
        items.push(<primitive key={`obj-${value.uuid}`} object={value} />);
      }
    };
    computedResults.forEach((value) => collectRenderable(value));
    return items;
  }, [computedResults, renderMode, isLight]);

  return (
    <>
      {/* @ts-ignore */}
      <ambientLight intensity={isLight ? 0.9 : 0.7} />
      {/* @ts-ignore */}
      <pointLight position={[100, 100, 150]} intensity={0.8} />
      {/* @ts-ignore */}
      <directionalLight position={[-100, -100, 200]} intensity={isLight ? 1.5 : 1.2} />
      {meshesToRender}
      <InfiniteAxes theme={theme} />
      <Environment preset={isLight ? "apartment" : "city"} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#e65100', '#2e7d32', '#1565c0']} labelColor={isLight ? "#333" : "white"} />
      </GizmoHelper>
    </>
  );
};

interface Viewer3DPresenterProps {
  computedResults: Map<string, any>;
  onTriggerCompute: () => void;
  onAddLog: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
  kernelBackend: 'occt.js' | 'three-fallback';
}

const collectRenderableObjects = (computedResults: Map<string, any>) => {
  const objects: THREE.Object3D[] = [];
  const visit = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value instanceof THREE.Object3D) {
      if (value.userData?.visible === false) return;
      objects.push(value);
    }
  };
  computedResults.forEach((value) => visit(value));
  return objects;
};

const Viewer3DPresenter = React.memo(({ computedResults, onTriggerCompute, onAddLog, kernelBackend }: Viewer3DPresenterProps) => {
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>('shaded');
  const { theme, setTheme, exportModel } = useGraph();

  useEffect(() => {
    if (THREE.Object3D && (THREE.Object3D as any).DefaultUp) {
      (THREE.Object3D as any).DefaultUp.set(0, 0, 1);
    }
  }, []);

  const handleFitView = () => {
    const controls = controlsRef.current as any;
    const camera = cameraRef.current;
    if (!controls || !camera) return;
    const objects = collectRenderableObjects(computedResults);
    if (objects.length === 0) { controls.reset(); return; }
    const box = new THREE.Box3();
    objects.forEach((obj) => box.expandByObject(obj));
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 20);
    camera.zoom = 1.0;
    const fitZoom = Math.min(800 / (Math.max(size.x, 1) * 1.5), 800 / (Math.max(size.y, 1) * 1.5)) * 0.5;
    camera.zoom = Math.max(0.01, Math.min(500, fitZoom));
    const distance = maxDim * 5;
    camera.position.copy(center).addScaledVector(new THREE.Vector3(1, -1, 1).normalize(), distance);
    camera.near = 0.1;
    camera.far = distance * 10;
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
  };

  useEffect(() => { if (computedResults.size > 0) handleFitView(); }, [computedResults.size === 0]);


  const isLight = theme === 'light';
  const toolbarBase = isLight ? "flex bg-white shadow-lg rounded-lg border border-gray-200 p-1" : "flex bg-black/60 backdrop-blur-md rounded-lg border border-white/10 p-1 shadow-2xl";
  const itemBase = "flex items-center gap-1.5 p-1.5 rounded-md transition-all border border-transparent active:scale-95 ";
  const itemNormal = isLight ? "text-gray-600 hover:text-black hover:bg-gray-100" : "text-gray-300 hover:text-white hover:bg-white/10";
  const itemActive = isLight ? "bg-blue-50 text-blue-600 border-blue-200 shadow-sm" : "bg-blue-600/20 text-blue-400 border-blue-500/30";

  return (
    <div className={`w-full h-full relative group overflow-hidden transition-colors duration-300 ${isLight ? 'bg-[#f8f9fa]' : 'bg-[#0a0b10]'} border-l ${isLight ? 'border-gray-200' : 'border-white/5'}`}>
      <div className={`absolute top-4 left-4 z-10 px-2 py-1 backdrop-blur rounded text-[10px] uppercase tracking-wider font-bold border pointer-events-none ${isLight ? 'bg-white/70 text-gray-400 border-gray-200' : 'bg-black/50 text-gray-400 border-white/5'}`}>
        实时视图
      </div>

      <div className="absolute top-4 right-4 z-10 flex gap-2 items-center">
        <div className="canvas-toolbar" style={{ position: 'static', backdropFilter: 'blur(8px)' }}>
          <button onClick={() => setRenderMode('shaded')} className={renderMode === 'shaded' ? 'opacity-100 bg-blue-500/20 text-blue-400' : ''} title="着色模式">
            <Box size={14} />
          </button>
          <button onClick={() => setRenderMode('wireframe')} className={renderMode === 'wireframe' ? 'opacity-100 bg-blue-500/20 text-blue-400' : ''} title="线框模式">
            <Layers size={14} />
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          <button onClick={onTriggerCompute} title="刷新场景"><RefreshCw size={14} /></button>
          <button onClick={handleFitView} title="充满视图"><Scan size={14} /></button>
        </div>
      </div>

      <Canvas dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }} shadows>
        <OrthographicCamera ref={cameraRef} makeDefault position={[200, -200, 200]} up={[0, 0, 1]} zoom={20} near={0.1} far={10000} />
        <SceneContent computedResults={computedResults} renderMode={renderMode} theme={theme} />
        <OrbitControls ref={controlsRef} makeDefault enableRotate={true} enableZoom={true} enablePan={true} target={[0, 0, 0]} enableDamping={true} dampingFactor={0.1} />
      </Canvas>
    </div>
  );
}, (prev, next) => prev.computedResults === next.computedResults);

const Viewer3D: React.FC = () => {
  const { computedResults, triggerCompute, addLog, kernelBackend } = useGraph();
  return <Viewer3DPresenter computedResults={computedResults} onTriggerCompute={triggerCompute} onAddLog={addLog} kernelBackend={kernelBackend} />;
};

export default Viewer3D;
