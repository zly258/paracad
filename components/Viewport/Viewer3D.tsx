import React, { useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, OrthographicCamera } from '@react-three/drei';
import { useGraph } from '../../store/GraphStore';
import * as THREE from 'three';
import { RefreshCw, Scan } from 'lucide-react';

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

  return (<group>{axes.map((line, i) => <primitive key={i} object={line} />)}</group>) as any;
};

interface SceneContentProps {
  computedResults: Map<string, any>;
  theme: ViewportTheme;
}

const SceneContent: React.FC<SceneContentProps> = ({ computedResults, theme }) => {
  const isLight = theme === 'light';
  const meshesToRender = useMemo(() => {
    const items: React.ReactNode[] = [];
    const seenObjectIds = new Set<string>();
    const collectRenderable = (value: any) => {
      if (!value) return;
      if (Array.isArray(value)) { value.forEach((item) => collectRenderable(item)); return; }
      if (value instanceof THREE.Object3D) {
        if (seenObjectIds.has(value.uuid)) return;
        seenObjectIds.add(value.uuid);
        if (value.userData?.visible === false) return;

        value.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat) {
              mat.wireframe = false;
              child.visible = true;
            }
          }
        });

        items.push(<primitive key={`obj-${value.uuid}`} object={value} />);
      }
    };
    computedResults.forEach((value) => collectRenderable(value));
    return items;
  }, [computedResults]);

  return (
    <>
      <ambientLight intensity={isLight ? 0.9 : 0.7} />
      <hemisphereLight
        args={[isLight ? '#f4f8ff' : '#8aa8ff', isLight ? '#cfd8e6' : '#0f111a', isLight ? 0.6 : 0.4]}
      />
      <pointLight position={[100, 100, 150]} intensity={0.8} />
      <directionalLight position={[-100, -100, 200]} intensity={isLight ? 1.5 : 1.2} />
      {meshesToRender}
      <InfiniteAxes theme={theme} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#e65100', '#2e7d32', '#1565c0']} labelColor={isLight ? '#333' : 'white'} />
      </GizmoHelper>
    </>
  );
};

interface Viewer3DPresenterProps {
  computedResults: Map<string, any>;
  onTriggerCompute: () => void;
}

const collectRenderableObjects = (computedResults: Map<string, any>) => {
  const objects: THREE.Object3D[] = [];
  const seenObjectIds = new Set<string>();
  const visit = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value instanceof THREE.Object3D) {
      if (seenObjectIds.has(value.uuid)) return;
      seenObjectIds.add(value.uuid);
      if (value.userData?.visible === false) return;
      objects.push(value);
    }
  };
  computedResults.forEach((value) => visit(value));
  return objects;
};

const Viewer3DPresenter = React.memo(({ computedResults, onTriggerCompute }: Viewer3DPresenterProps) => {
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const { theme } = useGraph();

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

  useEffect(() => { if (computedResults.size > 0) handleFitView(); }, [computedResults]);

  const isLight = theme === 'light';

  return (
    <div className={`w-full h-full relative group overflow-hidden transition-colors duration-300 ${isLight ? 'bg-[#f8f9fa]' : 'bg-[#0a0b10]'} border-l ${isLight ? 'border-gray-200' : 'border-white/5'}`}>
      <div className={`absolute top-4 left-4 z-10 px-2 py-1 backdrop-blur rounded text-[10px] uppercase tracking-wider font-bold border pointer-events-none ${isLight ? 'bg-white/70 text-gray-400 border-gray-200' : 'bg-black/50 text-gray-400 border-white/5'}`}>
        实时视图
      </div>

      <div className="absolute top-4 right-4 z-10 flex gap-2 items-center">
        <div className="canvas-toolbar" style={{ position: 'static', backdropFilter: 'blur(8px)' }}>
          <button onClick={onTriggerCompute} title="刷新场景"><RefreshCw size={14} /></button>
          <button onClick={handleFitView} title="充满视图"><Scan size={14} /></button>
        </div>
      </div>

      <Canvas dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }} shadows>
        <OrthographicCamera ref={cameraRef} makeDefault position={[200, -200, 200]} up={[0, 0, 1]} zoom={20} near={0.1} far={10000} />
        <SceneContent computedResults={computedResults} theme={theme} />
        <OrbitControls ref={controlsRef} makeDefault enableRotate={true} enableZoom={true} enablePan={true} target={[0, 0, 0]} enableDamping={true} dampingFactor={0.1} />
      </Canvas>
    </div>
  );
}, (prev, next) => prev.computedResults === next.computedResults);

const Viewer3D: React.FC = () => {
  const { computedResults, triggerCompute } = useGraph();
  return <Viewer3DPresenter computedResults={computedResults} onTriggerCompute={triggerCompute} />;
};

export default Viewer3D;
