import React, { useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, GizmoHelper, GizmoViewport, OrthographicCamera } from '@react-three/drei';
import { useGraph } from '../../store/GraphStore';
import * as THREE from 'three';
import { RefreshCw, Scan, Download } from 'lucide-react';
import { exportComputedModel, ExportFormat } from '../../utils/modelExport';

// Fix for missing JSX types in the current environment.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

const InfiniteAxes: React.FC = () => {
  const axes = useMemo(() => {
    const materialX = new THREE.LineBasicMaterial({ color: 0xaa2222, opacity: 0.6, transparent: true });
    const materialY = new THREE.LineBasicMaterial({ color: 0x22aa22, opacity: 0.6, transparent: true });
    const materialZ = new THREE.LineBasicMaterial({ color: 0x2222aa, opacity: 0.6, transparent: true });

    const pointsX = [new THREE.Vector3(-10000, 0, 0), new THREE.Vector3(10000, 0, 0)];
    const geomX = new THREE.BufferGeometry().setFromPoints(pointsX);
    const lineX = new THREE.Line(geomX, materialX);

    const pointsY = [new THREE.Vector3(0, -10000, 0), new THREE.Vector3(0, 10000, 0)];
    const geomY = new THREE.BufferGeometry().setFromPoints(pointsY);
    const lineY = new THREE.Line(geomY, materialY);

    const pointsZ = [new THREE.Vector3(0, 0, -10000), new THREE.Vector3(0, 0, 10000)];
    const geomZ = new THREE.BufferGeometry().setFromPoints(pointsZ);
    const lineZ = new THREE.Line(geomZ, materialZ);

    return [lineX, lineY, lineZ];
  }, []);

  return (
    <group>
      {axes.map((line, i) => <primitive key={i} object={line} />)}
    </group>
  );
};

interface SceneContentProps {
  computedResults: Map<string, any>;
}

// Extract SceneContent to be pure
const SceneContent: React.FC<SceneContentProps> = ({ computedResults }) => {
  const meshesToRender = useMemo(() => {
    const items: React.ReactNode[] = [];
    const collectRenderable = (value: any) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach((item) => collectRenderable(item));
        return;
      }
      if (value instanceof THREE.Object3D) {
        // 默认可见，只有显式设置 visible=false 时隐藏。
        const visibleFlag = value.userData?.visible;
        if (visibleFlag === false) return;
        items.push(<primitive key={`obj-${value.uuid}`} object={value} />);
      }
    };
    computedResults.forEach((value, socketId) => {
      collectRenderable(value);
    });
    return items;
  }, [computedResults]);

  return (
    <>
        <ambientLight intensity={0.7} />
        <pointLight position={[50, 50, 100]} intensity={0.8} />
        
        <directionalLight 
            position={[-50, -50, 80]} 
            intensity={1.0}
        />
        
        {meshesToRender}

        <InfiniteAxes />
        <Environment preset="city" />
        
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport 
                axisColors={['#e65100', '#2e7d32', '#1565c0']} 
                labelColor="white" 
            />
        </GizmoHelper>
    </>
  );
};

interface Viewer3DPresenterProps {
    computedResults: Map<string, any>;
    onTriggerCompute: () => void;
    onAddLog: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

const collectRenderableObjects = (computedResults: Map<string, any>) => {
  const objects: THREE.Object3D[] = [];
  const visit = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value instanceof THREE.Object3D) {
      const visibleFlag = value.userData?.visible;
      if (visibleFlag === false) return;
      objects.push(value);
    }
  };
  computedResults.forEach((value) => visit(value));
  return objects;
};

// Memoized Presenter Component
const Viewer3DPresenter = React.memo(({ computedResults, onTriggerCompute, onAddLog }: Viewer3DPresenterProps) => {
    const controlsRef = useRef<any>(null);
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const exportFormatRef = useRef<ExportFormat>('glb');
    
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
         if (objects.length === 0) {
           controls.reset();
           controls.update();
           return;
         }

         const box = new THREE.Box3();
         objects.forEach((obj) => box.expandByObject(obj));
         if (box.isEmpty()) {
           controls.reset();
           controls.update();
           return;
         }

         const center = box.getCenter(new THREE.Vector3());
         const size = box.getSize(new THREE.Vector3());
         const margin = 1.2;
         const width = Math.max(size.x * margin, 1e-3);
         const height = Math.max(size.y * margin, 1e-3);
         const depth = Math.max(size.z * margin, 1e-3);
         const baseHeight = Math.abs(camera.top - camera.bottom) || 1;
         const baseWidth = baseHeight * (camera.aspect || 1);
         const fitZoom = Math.min(baseWidth / width, baseHeight / height);
         camera.zoom = Math.max(0.05, Math.min(200, fitZoom));

         const direction = new THREE.Vector3().subVectors(camera.position, controls.target);
         if (direction.lengthSq() < 1e-6) direction.set(1, -1, 1);
         direction.normalize();
         const distance = Math.max(120, depth * 2.2);

         camera.position.copy(center.clone().addScaledVector(direction, distance));
         camera.near = Math.max(0.01, distance - depth * 4);
         camera.far = distance + depth * 6;
         camera.updateProjectionMatrix();

         controls.target.copy(center);
         controls.update();
      };

      const handleExport = async () => {
        const format = exportFormatRef.current;
        try {
          await exportComputedModel(computedResults, format);
          onAddLog(`导出成功: ${format.toUpperCase()}`, 'success');
        } catch (error: any) {
          onAddLog(`导出失败: ${error?.message || 'unknown error'}`, 'error');
        }
      };

    return (
        <div className="viewer-root w-full h-full relative group border-l">
          {/* Scene Toolbar */}
        <div className="viewer-label">实时视图</div>
        <div className="absolute top-4 right-4 z-10 flex gap-2">
               <button onClick={onTriggerCompute} className="viewer-btn p-1.5 rounded backdrop-blur border transition-colors" title="刷新场景">
                   <RefreshCw size={14} />
               </button>
               <button onClick={handleFitView} className="viewer-btn p-1.5 rounded backdrop-blur border transition-colors" title="充满视图">
                   <Scan size={14} />
               </button>
               <select
                 className="viewer-export-select px-2 rounded border text-xs"
                 defaultValue="glb"
                 onChange={(e) => {
                   exportFormatRef.current = e.target.value as ExportFormat;
                 }}
                 title="导出格式"
               >
                 <option value="glb">GLB</option>
                 <option value="obj">OBJ</option>
                 <option value="stp">STP</option>
                 <option value="igs">IGS</option>
               </select>
               <button onClick={handleExport} className="viewer-btn p-1.5 rounded backdrop-blur border transition-colors" title="导出模型">
                 <Download size={14} />
               </button>
          </div>
    
          <Canvas dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
            <OrthographicCamera ref={cameraRef} makeDefault position={[50, -50, 50]} up={[0, 0, 1]} zoom={10} near={0.1} far={4000} />
            
            <SceneContent computedResults={computedResults} />
            
            <OrbitControls 
                ref={controlsRef}
                makeDefault 
                enableRotate={true} 
                enableZoom={true} 
                enablePan={true}
                target={[0,0,0]}
                enableDamping={false} 
            />
          </Canvas>
        </div>
      );
}, (prev, next) => prev.computedResults === next.computedResults); 
// Custom comparison: Only re-render if computedResults reference changes

const Viewer3D: React.FC = () => {
  const { computedResults, triggerCompute, addLog } = useGraph(); 
  
  // We pass the data down to the memoized component.
  // Even if 'useGraph' triggers a re-render of this container due to Pan/Zoom/NodeMove,
  // 'Viewer3DPresenter' will NOT re-render because 'computedResults' reference remains stable 
  // until a computation actually finishes.
  return <Viewer3DPresenter computedResults={computedResults} onTriggerCompute={triggerCompute} onAddLog={addLog} />;
};

export default Viewer3D;
