// OCCT 执行辅助：统一管理构造器重载、方法重载和基础坐标工具
export const createOcctInstance = (oc: any, names: string[], args: any[]) => {
  for (const name of names) {
    const Ctor = oc[name];
    if (!Ctor) continue;
    try {
      return new Ctor(...args);
    } catch (e) {
      // console.warn(`Failed to instantiate ${name}:`, e.message);
      continue;
    }
  }
  throw new Error(`Unable to resolve OCCT constructor: ${names.join(', ')} (tried ${args.length} args)`);
};

export const callOcctMethod = (target: any, names: string[], args: any[]) => {
  for (const name of names) {
    const method = target?.[name];
    if (typeof method !== 'function') continue;
    try {
      return method.apply(target, args);
    } catch {
      continue;
    }
  }
  throw new Error(`Unable to resolve OCCT method: ${names.join(', ')}`);
};

export const createOcctPoint = (oc: any, x: number, y: number, z: number) =>
  createOcctInstance(oc, ['gp_Pnt_3', 'gp_Pnt_2', 'gp_Pnt_1', 'gp_Pnt'], [x, y, z]);

export const createOcctDir = (oc: any, x: number, y: number, z: number) =>
  createOcctInstance(oc, ['gp_Dir_4', 'gp_Dir_3', 'gp_Dir_2', 'gp_Dir_1', 'gp_Dir'], [x, y, z]);

export const createOcctVec = (oc: any, x: number, y: number, z: number) =>
  createOcctInstance(oc, ['gp_Vec_4', 'gp_Vec_3', 'gp_Vec_2', 'gp_Vec_1', 'gp_Vec'], [x, y, z]);

export const createOcctAx2 = (oc: any, center: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }) => {
  const pnt = createOcctPoint(oc, center.x, center.y, center.z);
  const vdir = createOcctDir(oc, dir.x, dir.y, dir.z);
  return createOcctInstance(oc, ['gp_Ax2_3', 'gp_Ax2_2', 'gp_Ax2_1', 'gp_Ax2'], [pnt, vdir]);
};

export const createOcctAx3 = (oc: any, center: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }) => {
  const pnt = createOcctPoint(oc, center.x, center.y, center.z);
  const vdir = createOcctDir(oc, dir.x, dir.y, dir.z);
  return createOcctInstance(oc, ['gp_Ax3_4', 'gp_Ax3_3', 'gp_Ax3_2', 'gp_Ax3_1', 'gp_Ax3'], [pnt, vdir]);
};

export const getOcctShapeEnum = (oc: any, key: 'EDGE' | 'FACE' | 'SHAPE') => {
  if (typeof oc[`TopAbs_${key}`] === 'number') return oc[`TopAbs_${key}`];
  if (oc.TopAbs_ShapeEnum?.[`TopAbs_${key}`] !== undefined) return oc.TopAbs_ShapeEnum[`TopAbs_${key}`];
  if (key === 'EDGE') return 6;
  if (key === 'FACE') return 4;
  return 8;
};

export const planeToPoint = (plane: string, center: { x: number; y: number; z: number }) => {
  if (plane === 'XOZ') return { x: center.x, y: center.z, z: center.y };
  if (plane === 'YOZ') return { x: center.z, y: center.x, z: center.y };
  return center;
};

export const planeToNormal = (plane: string) => {
  if (plane === 'XOZ') return { x: 0, y: 1, z: 0 };
  if (plane === 'YOZ') return { x: 1, y: 0, z: 0 };
  return { x: 0, y: 0, z: 1 };
};

export const planeVectorToWorld = (plane: string, x: number, y: number, z = 0) => {
  if (plane === 'XOZ') return { x, y: z, z: y };
  if (plane === 'YOZ') return { x: z, y: x, z: y };
  return { x, y, z };
};

export const planeLocalPointToWorld = (
  plane: string,
  center: { x: number; y: number; z: number },
  x: number,
  y: number,
  z = 0,
) => {
  const mappedCenter = planeToPoint(plane, center);
  const mappedOffset = planeVectorToWorld(plane, x, y, z);
  return {
    x: mappedCenter.x + mappedOffset.x,
    y: mappedCenter.y + mappedOffset.y,
    z: mappedCenter.z + mappedOffset.z,
  };
};
