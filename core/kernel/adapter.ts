export type KernelBackend = 'three';

export interface KernelStatus {
  ready: boolean;
  backend: KernelBackend;
  message: string;
}

let kernelStatus: KernelStatus = {
  ready: false,
  backend: 'three',
  message: 'Three.js 内核待初始化',
};

export const initKernel = async (): Promise<KernelStatus> => {
  kernelStatus = {
    ready: true,
    backend: 'three',
    message: 'Three.js 内核已启用',
  };

  return kernelStatus;
};

export const getKernelStatus = (): KernelStatus => kernelStatus;
