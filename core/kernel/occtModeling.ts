// 说明：OCCT.js 的运行时只允许在这一层被动态导入。
// 这样可以把重量级的 wasm 依赖收敛到“核心建模入口”，
// 其余模块只通过抽象状态和执行接口访问内核，不直接感知 OCCT 实现细节。
export const loadOcctModelingRuntime = async () => {
  const [{ default: occtFactory }, { default: wasmUrl }] = await Promise.all([
    import('opencascade.js/dist/opencascade.wasm.js'),
    import('opencascade.js/dist/opencascade.wasm.wasm?url'),
  ]);

  return occtFactory({
    locateFile(path: string) {
      return path.endsWith('.wasm') ? wasmUrl : path;
    },
  });
};
