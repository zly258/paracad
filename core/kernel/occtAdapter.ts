import { loadOcctModelingRuntime } from './occtModeling';

export type KernelBackend = 'occt.js' | 'three-fallback';

export interface KernelStatus {
  ready: boolean;
  backend: KernelBackend;
  message: string;
  occt: any | null;
}

let kernelStatus: KernelStatus = {
  ready: false,
  backend: 'three-fallback',
  message: 'OCCT.js 未初始化，当前使用 Three.js 回退路径',
  occt: null,
};

// 统一初始化内核。
// 当前策略是：优先加载 OCCT.js，如果失败则自动回退到 Three 路径，保证编辑器可用。
export const initOCCT = async (): Promise<KernelStatus> => {
  try {
    const occt = await loadOcctModelingRuntime();
    kernelStatus = {
      ready: true,
      backend: 'occt.js',
      message: 'OCCT.js 内核已加载，当前采用 OCCT 初始化 + Three 渲染混合架构',
      occt,
    };
  } catch (error) {
    console.warn('OCCT.js init failed, fallback to Three.js runtime.', error);
    kernelStatus = {
      ready: true,
      backend: 'three-fallback',
      message: 'OCCT.js 加载失败，已回退到 Three.js 几何执行路径',
      occt: null,
    };
  }

  return kernelStatus;
};

export const getKernelStatus = (): KernelStatus => kernelStatus;
