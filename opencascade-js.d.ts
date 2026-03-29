declare module 'opencascade.js/dist/opencascade.wasm.js' {
  const occtFactory: (options?: Record<string, any>) => Promise<any>;
  export default occtFactory;
}

declare module 'opencascade.js/dist/opencascade.wasm.wasm?url' {
  const wasmUrl: string;
  export default wasmUrl;
}
