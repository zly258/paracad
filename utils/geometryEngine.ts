import * as THREE from 'three';
import { NodeData, Connection, NodeType } from '../types';
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';

// CSG Evaluator Instance
const csgEvaluator = new Evaluator();
csgEvaluator.attributes = ['position', 'normal', 'uv']; 

export const initOCCT = async () => {
  return Promise.resolve();
};

// Helper: Input Parsers
const getVal = (inputName: string, inputs: Record<string, any>, params: Record<string, any>, defaultVal: any) => {
    if (inputs[inputName] !== undefined) return inputs[inputName];
    if (params && params[inputName] !== undefined) return params[inputName];
    return defaultVal;
};

const getNum = (inputName: string, inputs: Record<string, any>, params: Record<string, any>, defaultVal = 0): number => {
    const val = getVal(inputName, inputs, params, defaultVal);
    const n = Number(val);
    return isNaN(n) ? defaultVal : n;
};

const getVec = (inputName: string, inputs: Record<string, any>, params: Record<string, any>, defaultZ = 0) => {
    const val = getVal(inputName, inputs, params, null);
    if (val && typeof val === 'object' && 'x' in val) return { x: val.x, y: val.y, z: val.z || 0 };
    return { x: 0, y: 0, z: defaultZ };
};

// Material Factory
const getMaterial = (color: number = 0xaaaaaa, opacity: number = 1) => {
    return new THREE.MeshStandardMaterial({ 
        color, 
        metalness: 0.1, 
        roughness: 0.5, 
        transparent: opacity < 1,
        opacity: opacity,
        side: THREE.DoubleSide,
        flatShading: false
    });
};

// Helper to apply plane rotation to 2D shapes
const applyPlane = (obj: THREE.Object3D, plane: string) => {
    if (!plane || plane === 'XOY') return; 
    if (plane === 'XOZ') obj.rotateX(-Math.PI / 2);
    else if (plane === 'YOZ') obj.rotateY(Math.PI / 2);
    obj.updateMatrix();
};

export const computeGraph = async (
  nodes: NodeData[],
  connections: Connection[],
  logCallback?: (msg: string, type?: 'info' | 'error') => void,
  depth: number = 0
): Promise<Map<string, any>> => {

  const results = new Map<string, any>(); 
  
  if (depth > 5) {
      logCallback?.("Max recursion depth reached in Custom Node", 'error');
      return results;
  }

  const consumedNodeIds = new Set<string>();
  connections.forEach(conn => consumedNodeIds.add(conn.sourceNodeId));

  // Global Parameter Map for Expressions
  const globalParams: Record<string, any> = {};

  // 1. Params
  nodes.forEach(node => {
    if (node.type === NodeType.PARAMETER) {
      const name = node.params.name || 'var';
      let val: any = 0;
      if (node.params.type === 'vector') {
          val = { x: node.params.vecX||0, y: node.params.vecY||0, z: node.params.vecZ||0 };
      } else if (node.params.type === 'boolean') {
          val = !!node.params.boolVal;
      } else if (node.params.type === 'string') {
          val = String(node.params.stringVal || '');
      } else {
          val = Number(node.params.value || 0);
      }
      
      if (node.outputs[0]) results.set(node.outputs[0].id, val);
      
      if (node.params.name) {
          globalParams[node.params.name] = val;
      }
    } 
  });

  // 2. Compute Passes
  const MAX_PASSES = 12;

  try {
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        let hasChanges = false;

        for (const node of nodes) {
          if (node.type === NodeType.PARAMETER) continue;

          const inputsValues: Record<string, any> = {};
          
          for (const input of node.inputs) {
              const conn = connections.find(c => c.targetSocketId === input.id);
              if (conn) {
                 if (results.has(conn.sourceSocketId)) {
                    inputsValues[input.name] = results.get(conn.sourceSocketId);
                 }
              }
          }

          if (node.outputs.length > 0 && results.has(node.outputs[0].id)) continue;
          
          try {
             const outputs = await computeNodeLogic(node, inputsValues, logCallback, depth, globalParams);
             
             if (outputs && outputs.length > 0) {
                 node.outputs.forEach((out, idx) => {
                     const res = outputs[idx];
                     
                     if (res instanceof THREE.Object3D) {
                         res.userData.nodeId = node.id;
                         if (depth === 0) {
                             res.userData.visible = !consumedNodeIds.has(node.id); 
                         } else {
                             res.userData.visible = true; 
                         }
                         res.castShadow = true;
                         res.receiveShadow = true;
                         
                         if (res instanceof THREE.Mesh && !res.material) res.material = getMaterial();
                         
                         results.set(out.id, res);
                     } else {
                         results.set(out.id, res);
                     }
                     hasChanges = true;
                 });
             }
          } catch(e) {
             console.warn(`Node ${node.label} Error:`, e);
          }
        }
        if (!hasChanges) break;
      }
  } catch(e) {
      console.error(e);
      if(logCallback) logCallback("Compute Error: " + e, 'error');
  }

  return results;
};

const computeNodeLogic = async (
    node: NodeData, 
    inputs: Record<string, any>, 
    logCallback: any,
    depth: number,
    globalParams: Record<string, any> 
): Promise<any[]> => {
    const p = node.params;
    
    const createMesh = (geom: THREE.BufferGeometry) => {
        if (!geom.attributes.normal) geom.computeVertexNormals();
        return new THREE.Mesh(geom, getMaterial());
    };
    const SEGMENTS = 64; 

    switch (node.type) {
        // --- LOGIC ---
        case NodeType.EXPRESSION: {
            const expr = p.expression || '';
            const paramNames = Object.keys(globalParams);
            const paramValues = Object.values(globalParams);

            try {
                const func = new Function(...paramNames, `
                    with (Math) {
                        return ${expr};
                    }
                `);
                const res = func(...paramValues);
                return [res];
            } catch (e) {
                return [NaN]; 
            }
        }
        
        // --- CUSTOM NODE LOGIC ---
        case NodeType.CUSTOM: {
            const specStr = p.graphSpec;
            if (!specStr) return [null];
            
            try {
                const spec = JSON.parse(specStr);
                const subNodes: NodeData[] = spec.nodes || [];
                const subConns: Connection[] = spec.connections || [];
                
                subNodes.forEach(n => {
                    if (n.type === NodeType.PARAMETER && n.params.name) {
                        const inputVal = inputs[n.params.name];
                        if (inputVal !== undefined) {
                            if (n.params.type === 'vector') {
                                n.params.vecX = inputVal.x; n.params.vecY = inputVal.y; n.params.vecZ = inputVal.z;
                            } else if (n.params.type === 'boolean') {
                                n.params.boolVal = inputVal;
                            } else if (n.params.type === 'string') {
                                n.params.stringVal = inputVal;
                            } else {
                                n.params.value = inputVal;
                            }
                        }
                    }
                });

                const clonedNodes = JSON.parse(JSON.stringify(subNodes));
                const innerResults = await computeGraph(clonedNodes, subConns, logCallback, depth + 1);

                let lastGeo = null;
                for (let i = clonedNodes.length - 1; i >= 0; i--) {
                    const n = clonedNodes[i];
                    if (n.outputs.length > 0) {
                         const val = innerResults.get(n.outputs[0].id);
                         if (val instanceof THREE.Object3D) {
                             lastGeo = val;
                             break;
                         }
                    }
                }
                
                return [lastGeo ? lastGeo.clone() : null];

            } catch (e) {
                console.error("Custom node execution failed", e);
                return [null];
            }
        }

        case NodeType.LOFT: {
            return [null]; 
        }
        
        case NodeType.EXTRUDE: {
            const shapeSource = inputs['shape'];
            let shapes: THREE.Shape[] = [];

            if (shapeSource instanceof THREE.Object3D && shapeSource.userData && shapeSource.userData.shapes) {
                shapes = shapeSource.userData.shapes;
            } 
            
            if (!shapes || shapes.length === 0) return [null];

            const depth = getNum('height', inputs, p, 20);
            const cap = getVal('cap', inputs, p, true);
            
            const extrudeSettings = {
                depth,
                bevelEnabled: false,
                curveSegments: 24
            };
            
            const geom = new THREE.ExtrudeGeometry(shapes, extrudeSettings);
            const mesh = createMesh(geom);
            return [mesh];
        }

        // --- 2D Shapes ---
        case NodeType.STAR: {
            const r1 = getNum('inner_radius', inputs, p, 5);
            const r2 = getNum('outer_radius', inputs, p, 10);
            const pts = getNum('points', inputs, p, 5);
            const c = getVec('center', inputs, p);
            
            const shape = new THREE.Shape();
            const step = Math.PI / pts;
            for(let i=0; i<2*pts; i++){
                const r = (i%2 === 0) ? r2 : r1;
                const a = i * step;
                const x = Math.cos(a) * r;
                const y = Math.sin(a) * r;
                if(i===0) shape.moveTo(x, y);
                else shape.lineTo(x, y);
            }
            shape.closePath();
            
            const points = shape.getPoints();
            const geom = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.LineLoop(geom, new THREE.LineBasicMaterial({ color: 0xffff00 }));
            
            line.position.set(c.x, c.y, c.z);
            line.userData.shapes = [shape];
            applyPlane(line, p.plane);

            return [line];
        }
        case NodeType.RECTANGLE: {
            const w = getNum('width', inputs, p, 20);
            const h = getNum('height', inputs, p, 10);
            
            const shape = new THREE.Shape();
            shape.moveTo(-w/2, -h/2);
            shape.lineTo(w/2, -h/2);
            shape.lineTo(w/2, h/2);
            shape.lineTo(-w/2, h/2);
            shape.closePath();

            const points = shape.getPoints();
            const geom = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.LineLoop(geom, new THREE.LineBasicMaterial({ color: 0xffff00 }));
            
            line.userData.shapes = [shape];
            applyPlane(line, p.plane);
            return [line];
        }
        case NodeType.CIRCLE: {
            const r = getNum('radius', inputs, p, 10);
            const c = getVec('center', inputs, p);
            
            const shape = new THREE.Shape();
            shape.absarc(0, 0, r, 0, Math.PI * 2, false);

            const points = shape.getPoints(SEGMENTS);
            const geom = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.LineLoop(geom, new THREE.LineBasicMaterial({ color: 0xffff00 }));
            
            line.position.set(c.x, c.y, c.z);
            line.userData.shapes = [shape];
            applyPlane(line, p.plane);
            return [line];
        }
        case NodeType.POLYGON: {
            const r = getNum('radius', inputs, p, 10);
            const sides = getNum('sides', inputs, p, 6);
            const c = getVec('center', inputs, p);
            
            const shape = new THREE.Shape();
            const step = 2 * Math.PI / sides;
            for(let i=0; i<sides; i++){
                const a = i * step;
                const x = r * Math.cos(a);
                const y = r * Math.sin(a);
                if(i===0) shape.moveTo(x, y);
                else shape.lineTo(x, y);
            }
            shape.closePath();

            const points = shape.getPoints();
            const geom = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.LineLoop(geom, new THREE.LineBasicMaterial({ color: 0xffff00 }));
            
            line.position.set(c.x, c.y, c.z);
            line.userData.shapes = [shape];
            applyPlane(line, p.plane);
            return [line];
        }
        case NodeType.ELLIPSE: {
             const rx = getNum('radius_x', inputs, p, 15);
             const ry = getNum('radius_y', inputs, p, 8);
             const c = getVec('center', inputs, p);
             
             const shape = new THREE.Shape();
             shape.absellipse(0, 0, rx, ry, 0, 2*Math.PI, false, 0);

             const points = shape.getPoints(SEGMENTS);
             const geom = new THREE.BufferGeometry().setFromPoints(points);
             const line = new THREE.LineLoop(geom, new THREE.LineBasicMaterial({ color: 0xffff00 }));
             
             line.position.set(c.x, c.y, c.z);
             line.userData.shapes = [shape];
             applyPlane(line, p.plane);
             return [line];
        }
        // --- 3D Shapes ---
        case NodeType.BOX: {
            const x = getNum('size_x', inputs, p, 10);
            const y = getNum('size_y', inputs, p, 10);
            const z = getNum('size_z', inputs, p, 10);
            const c = getVec('base', inputs, p);
            const geom = new THREE.BoxGeometry(x, y, z);
            const mesh = createMesh(geom);
            mesh.position.set(c.x, c.y, c.z);
            mesh.updateMatrix(); 
            return [mesh];
        }
        case NodeType.SPHERE: {
            const r = getNum('radius', inputs, p, 10);
            const c = getVec('center', inputs, p);
            const geom = new THREE.SphereGeometry(r, SEGMENTS, Math.floor(SEGMENTS/2));
            const mesh = createMesh(geom);
            mesh.position.set(c.x, c.y, c.z);
            return [mesh];
        }
        case NodeType.CAPSULE: {
            const r = getNum('radius', inputs, p, 5);
            const l = getNum('length', inputs, p, 20);
            const c = getVec('center', inputs, p);
            const geom = new THREE.CapsuleGeometry(r, l, 8, 16);
            const mesh = createMesh(geom);
            mesh.position.set(c.x, c.y, c.z);
            return [mesh];
        }
        case NodeType.TETRAHEDRON: {
            const r = getNum('radius', inputs, p, 10);
            const c = getVec('center', inputs, p);
            const geom = new THREE.TetrahedronGeometry(r);
            const mesh = createMesh(geom);
            mesh.position.set(c.x, c.y, c.z);
            return [mesh];
        }
        case NodeType.OCTAHEDRON: {
            const r = getNum('radius', inputs, p, 10);
            const c = getVec('center', inputs, p);
            const geom = new THREE.OctahedronGeometry(r);
            const mesh = createMesh(geom);
            mesh.position.set(c.x, c.y, c.z);
            return [mesh];
        }
        case NodeType.ICOSAHEDRON: {
            const r = getNum('radius', inputs, p, 10);
            const c = getVec('center', inputs, p);
            const geom = new THREE.IcosahedronGeometry(r);
            const mesh = createMesh(geom);
            mesh.position.set(c.x, c.y, c.z);
            return [mesh];
        }
        case NodeType.CYLINDER: {
            const r = getNum('radius', inputs, p, 5);
            const h = getNum('height', inputs, p, 20);
            const c = getVec('base', inputs, p);
            const geom = new THREE.CylinderGeometry(r, r, h, SEGMENTS);
            geom.rotateX(Math.PI / 2); 
            const mesh = createMesh(geom);
            mesh.position.set(c.x, c.y, c.z);
            return [mesh];
        }
        case NodeType.CONE: {
            const r = getNum('radius', inputs, p, 10);
            const h = getNum('height', inputs, p, 20);
            const c = getVec('base', inputs, p);
            const geom = new THREE.ConeGeometry(r, h, SEGMENTS);
            geom.rotateX(Math.PI / 2); 
            const mesh = createMesh(geom);
            mesh.position.set(c.x, c.y, c.z);
            return [mesh];
        }
        case NodeType.TORUS: {
            const r = getNum('radius_main', inputs, p, 10);
            const t = getNum('radius_tube', inputs, p, 3);
            const c = getVec('center', inputs, p);
            const geom = new THREE.TorusGeometry(r, t, Math.floor(SEGMENTS/2), SEGMENTS);
            const mesh = createMesh(geom);
            mesh.position.set(c.x, c.y, c.z);
            return [mesh];
        }
        case NodeType.BOOLEAN_OP: {
            const objA = inputs['object_a'] as THREE.Mesh;
            const objB = inputs['object_b'] as THREE.Mesh;
            const op = p.operation || 'UNION';
            
            if (!objA || !objB || !objA.isMesh || !objB.isMesh) {
                return [null];
            }
            
            objA.updateMatrixWorld();
            objB.updateMatrixWorld();

            const brushA = new Brush(objA.geometry, objA.material);
            brushA.applyMatrix4(objA.matrixWorld);

            const brushB = new Brush(objB.geometry, objB.material);
            brushB.applyMatrix4(objB.matrixWorld);

            let resultBrush: Brush | null = null;

            if (op === 'SUBTRACT') {
                resultBrush = csgEvaluator.evaluate(brushA, brushB, SUBTRACTION);
            } else if (op === 'INTERSECT') {
                resultBrush = csgEvaluator.evaluate(brushA, brushB, INTERSECTION);
            } else {
                resultBrush = csgEvaluator.evaluate(brushA, brushB, ADDITION);
            }

            if (resultBrush) {
                 const resMesh = new THREE.Mesh(resultBrush.geometry, getMaterial());
                 resMesh.castShadow = true;
                 resMesh.receiveShadow = true;
                 return [resMesh];
            }
            return [null];
        }
        case NodeType.TRANSLATION: {
            const geom = inputs['geometry'] as THREE.Object3D;
            const vec = getVec('vector', inputs, p);
            if (!geom) return [null];
            
            const cloned = geom.clone();
            cloned.position.x += vec.x;
            cloned.position.y += vec.y;
            cloned.position.z += vec.z;
            return [cloned];
        }
        case NodeType.ROTATION: {
             const geom = inputs['geometry'] as THREE.Object3D;
             const axis = getVec('axis', inputs, p);
             const deg = getNum('angle', inputs, p, 45);
             if (!geom) return [null];

             const cloned = geom.clone();
             const axisVec = new THREE.Vector3(axis.x, axis.y, axis.z).normalize();
             if (axisVec.lengthSq() === 0) axisVec.set(0,0,1);
             const rotMatrix = new THREE.Matrix4().makeRotationAxis(axisVec, deg * Math.PI / 180);
             cloned.applyMatrix4(rotMatrix);

             return [cloned];
        }
        case NodeType.SCALE: {
            const geom = inputs['geometry'] as THREE.Object3D;
            const factor = getNum('factor', inputs, p, 1);
            if (!geom) return [null];
            const cloned = geom.clone();
            cloned.scale.multiplyScalar(factor);
            return [cloned];
        }
        case NodeType.MIRROR: {
            const geom = inputs['geometry'] as THREE.Object3D;
            const planeNormal = getVec('plane_normal', inputs, p);
            const copy = getVal('copy', inputs, p, true);
            
            if (!geom) return [null];

            const normal = new THREE.Vector3(planeNormal.x, planeNormal.y, planeNormal.z).normalize();
            if (normal.lengthSq() === 0) normal.set(1,0,0);
            
            const mirrorMatrix = new THREE.Matrix4();
            const { x, y, z } = normal;
            mirrorMatrix.set(
                1 - 2*x*x, -2*x*y, -2*x*z, 0,
                -2*x*y, 1 - 2*y*y, -2*y*z, 0,
                -2*x*z, -2*y*z, 1 - 2*z*z, 0,
                0, 0, 0, 1
            );

            const mirrored = geom.clone();
            mirrored.applyMatrix4(mirrorMatrix);
            
            if (copy) {
                const group = new THREE.Group();
                group.add(geom.clone());
                group.add(mirrored);
                return [group];
            } else {
                return [mirrored];
            }
        }
        default: return [];
    }
}