import React, { useState, useRef, useEffect } from 'react';
import NodeCanvas from './components/NodeEditor/NodeCanvas';
import NodeTree from './components/NodeEditor/NodeTree';
import Viewer3D from './components/Viewport/Viewer3D';
import { GraphProvider, useGraph } from './store/GraphStore';
import { Boxes, Terminal, AlertCircle, CheckCircle, Info, Loader2, Globe } from 'lucide-react';

const LogPanel: React.FC = () => {
  const { logs, t } = useGraph();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-[#111] font-mono text-xs overflow-hidden">
      <div className="h-6 bg-[#222] border-b border-black flex items-center px-2 gap-2 text-gray-400">
        <Terminal size={12} />
        <span className="font-bold">{t('Console')}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 border-b border-white/5 pb-1 last:border-0">
            <span className="text-gray-600 shrink-0">[{log.timestamp.toLocaleTimeString()}]</span>
            <span className={`flex items-center gap-1 ${
              log.type === 'error' ? 'text-red-400' : 
              log.type === 'success' ? 'text-green-400' : 
              log.type === 'warning' ? 'text-yellow-400' : 'text-gray-300'
            }`}>
              {log.type === 'error' && <AlertCircle size={10} />}
              {log.type === 'success' && <CheckCircle size={10} />}
              {log.type === 'info' && <Info size={10} />}
              {log.message}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

const MainLayout: React.FC = () => {
  const [leftWidth, setLeftWidth] = useState(250); 
  const [rightSplit, setRightSplit] = useState(70); 
  const { kernelReady, toggleLanguage, t } = useGraph();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden text-gray-100 bg-[#1a1a1a]">
      {/* Loading Overlay */}
      {!kernelReady && (
         <div className="absolute inset-0 z-50 bg-[#1a1a1a] flex flex-col items-center justify-center space-y-4">
             <div className="flex items-center gap-2 text-blue-500">
                 <Loader2 size={40} className="animate-spin" />
             </div>
             <div className="text-gray-300 font-bold text-lg">{t('Initializing...')}</div>
             <div className="text-gray-500 text-xs">{t('Loading Kernel')}</div>
         </div>
      )}

      {/* Header */}
      <header className="h-10 bg-[#2a2a2a] border-b border-black flex items-center px-4 justify-between shrink-0 z-10 shadow-md">
        <div className="flex items-center gap-2">
          <Boxes className="text-blue-500" size={20} />
          <h1 className="font-bold text-base tracking-wide text-gray-100">ParaCad <span className="text-[10px] bg-blue-600 text-white px-1 rounded ml-1 font-bold">Three.js</span></h1>
        </div>
        
        <button 
           onClick={toggleLanguage} 
           className="flex items-center gap-1 bg-[#333] hover:bg-[#444] text-gray-200 px-2 py-1 rounded text-xs border border-gray-600 transition-colors"
           title="Switch Language"
        >
            <Globe size={12} />
            {t('Language')}
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Panel: Node Tree */}
        <div style={{ width: leftWidth }} className="shrink-0 relative z-10">
            <NodeTree />
            <div 
              className="absolute right-0 top-0 h-full w-1 hover:bg-blue-600 cursor-col-resize z-20"
              onMouseDown={(e) => {
                const startX = e.clientX;
                const startW = leftWidth;
                const onMove = (mv: MouseEvent) => setLeftWidth(Math.max(150, Math.min(400, startW + (mv.clientX - startX))));
                const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            />
        </div>

        {/* Center Panel: Node Editor */}
        <div 
          className="h-full relative z-0 flex flex-col border-l border-r border-black" 
          style={{ flex: 1 }}
        >
          <div className="flex-1 relative">
            <NodeCanvas />
          </div>
        </div>

        {/* Right Panel: 3D View & Logs */}
        <div 
           className="h-full flex flex-col relative z-0 shrink-0"
           style={{ width: '40%' }} // Fixed roughly or dynamic
        >
          <div style={{ height: `${rightSplit}%` }} className="relative">
             <Viewer3D />
          </div>

          <div 
            className="h-1 bg-[#000] hover:bg-blue-600 cursor-row-resize z-20 transition-colors opacity-50 hover:opacity-100"
            onMouseDown={(e) => {
               const startY = e.clientY;
               const rect = e.currentTarget.parentElement?.getBoundingClientRect();
               if (!rect) return;
               const onMove = (mv: MouseEvent) => {
                 const relY = mv.clientY - rect.top;
                 setRightSplit(Math.max(20, Math.min(80, (relY / rect.height) * 100)));
               };
               const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
               window.addEventListener('mousemove', onMove);
               window.addEventListener('mouseup', onUp);
            }}
          />

          <div className="flex-1 bg-[#111] overflow-hidden">
             <LogPanel />
          </div>
        </div>

      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <GraphProvider>
      <MainLayout />
    </GraphProvider>
  );
};

export default App;