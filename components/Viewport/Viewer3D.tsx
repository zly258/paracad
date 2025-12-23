import React, { useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, GizmoHelper, GizmoViewport, OrthographicCamera } from '@react-three/drei';
import { useGraph } from '../../store/GraphStore';
import * as THREE from 'three';
import { RefreshCw, Scan } from 'lucide-react';

// Fix for missing JSX types in the current environment
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      primitive: any;
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      orthographicCamera: any;
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      primitive: any;
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      orthographicCamera: any;
    }
  }
}

const InfiniteAxes: React.FC = () => {
  const axes = useMemo(() => {
    const materialX = new THREE.LineBasicMaterial({ color: 0xaa2222, opacity: 0.6, transparent: true });
    const materialY = new THREE.LineBasicMaterial({ color: 0x22aa22, opacity: 0.6, transparent: true });
    const materialZ = new THREE.LineBasicMaterial({ color: 0x2222aa, opacity: 0.6, transparent: true });

    // X Axis (Red)
    const pointsX = [new THREE.Vector3(-10000, 0, 0), new THREE.Vector3(10000, 0, 0)];
    const geomX = new THREE.BufferGeometry().setFromPoints(pointsX);
    const lineX = new THREE.Line(geomX, materialX);

    // Y Axis (Green)
    const pointsY = [new THREE.Vector3(0, -10000, 0), new THREE.Vector3(0, 10000, 0)];
    const geomY = new THREE.BufferGeometry().setFromPoints(pointsY);
    const lineY = new THREE.Line(geomY, materialY);

    // Z Axis (Blue) - Vertical
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

const SceneContent: React.FC<SceneContentProps> = ({ computedResults }) => {
  const meshesToRender = useMemo(() => {
    const items: React.ReactNode[] = [];
    computedResults.forEach((value, socketId) => {
        if (value instanceof THREE.Object3D) {
            if (value.userData && value.userData.visible) {
                 items.push(
                     <primitive 
                       key={`obj-${value.uuid}`} 
                       object={value} 
                     />
                   );
            }
        }
    });
    return items;
  }, [computedResults]);

  return (
    <>
        <ambientLight intensity={0.7} />
        <pointLight position={[50, 50, 100]} intensity={0.8} />
        
        <directionalLight 
            position={[-50, -50, 80]} 
            intensity={1.2} 
            castShadow 
            shadow-mapSize={[2048, 2048]} 
            shadow-normalBias={0.04} 
        >
            <orthographicCamera attach="shadow-camera" args={[-200, 200, 200, -200, 0.1, 1000]} />
        </directionalLight>
        
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

const Viewer3D: React.FC = () => {
  const { computedResults, triggerCompute } = useGraph(); 
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (THREE.Object3D && (THREE.Object3D as any).DefaultUp) {
       (THREE.Object3D as any).DefaultUp.set(0, 0, 1);
    }
  }, []);

  const handleFitView = () => {
     if (controlsRef.current) {
         controlsRef.current.reset();
         // In a real app, we would calculate bbox of all objects and fit
     }
  };

  return (
    <div className="w-full h-full bg-[#050505] relative group border-l border-black">
      {/* Scene Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
           <button onClick={() => triggerCompute()} className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded backdrop-blur border border-white/10 transition-colors" title="刷新场景">
               <RefreshCw size={14} />
           </button>
           <button onClick={handleFitView} className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded backdrop-blur border border-white/10 transition-colors" title="充满视图">
               <Scan size={14} />
           </button>
      </div>

      <Canvas shadows>
        <OrthographicCamera makeDefault position={[50, -50, 50]} up={[0, 0, 1]} zoom={10} near={-2000} far={2000} />
        
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
};

export default Viewer3D;