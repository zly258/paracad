import React, { useState, useRef, useEffect } from 'react';
import NodeCanvas from './components/NodeEditor/NodeCanvas';
import NodeTree from './components/NodeEditor/NodeTree';
import Viewer3D from './components/Viewport/Viewer3D';
import { GraphProvider, useGraph } from './store/GraphStore';
import { Boxes, Terminal, AlertCircle, CheckCircle, Info, Loader2, Globe, Undo2, Redo2, SunMoon, Eraser } from 'lucide-react';
import './styles/workbench.css';

const LogPanel = React.memo(() => {
  const { logs, t, clearLogs } = useGraph();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="log-panel-root flex flex-col h-full font-mono text-xs overflow-hidden">
      <div className="log-panel-header h-6 border-b flex items-center px-2 gap-2">
        <Terminal size={12} />
        <span className="font-bold flex-1">{t('Console')}</span>
        <button
          onClick={clearLogs}
          className="log-clear-btn px-1.5 h-5 rounded text-[10px] inline-flex items-center gap-1 border transition-colors"
          title={t('Clear Logs')}
        >
          <Eraser size={10} />
          {t('Clear')}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 border-b border-white/5 pb-1 last:border-0">
            <span className="text-gray-600 shrink-0">[{log.timestamp.toLocaleTimeString()}]</span>
            <span
              className={`flex items-center gap-1 ${
                log.type === 'error'
                  ? 'text-red-400'
                  : log.type === 'success'
                    ? 'text-green-400'
                    : log.type === 'warning'
                      ? 'text-yellow-400'
                      : 'text-gray-300'
              }`}
            >
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
});

const Header: React.FC<{ theme: 'dark' | 'light'; onToggleTheme: () => void }> = ({ theme, onToggleTheme }) => {
  const { kernelReady, kernelBackend, toggleLanguage, t, undo, redo, canUndo, canRedo } = useGraph();
  return (
    <header className="app-header h-10 border-b flex items-center px-4 justify-between shrink-0 z-10 shadow-md">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Boxes className="text-blue-500" size={20} />
          <h1 className="app-header-title font-bold text-base tracking-wide">
            ParaCad <span className="text-[10px] bg-blue-600 text-white px-1 rounded ml-1 font-bold">{kernelReady ? (kernelBackend === 'occt.js' ? 'OCCT.js' : 'Three.js') : 'Booting'}</span>
          </h1>
        </div>

        <div className="h-4 w-px bg-white/10 mx-2" />

        <div className="flex gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`p-1.5 rounded transition-colors ${canUndo ? 'text-gray-200 hover:bg-gray-600 hover:text-white' : 'text-gray-600 cursor-not-allowed'}`}
            title={t('Undo') + ' (Ctrl+Z)'}
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`p-1.5 rounded transition-colors ${canRedo ? 'text-gray-200 hover:bg-gray-600 hover:text-white' : 'text-gray-600 cursor-not-allowed'}`}
            title={t('Redo') + ' (Ctrl+Y)'}
          >
            <Redo2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          className="app-pill-btn flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors"
          title={t('Theme Demo')}
        >
          <SunMoon size={12} />
          {theme === 'dark' ? t('Light') : t('Dark')}
        </button>
        <button
          onClick={toggleLanguage}
          className="app-pill-btn flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors"
          title="Switch Language"
        >
          <Globe size={12} />
          {t('Language')}
        </button>
      </div>
    </header>
  );
};

const MainLayout: React.FC = () => {
  const [leftWidth, setLeftWidth] = useState(280);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('paracad-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const { kernelReady, t } = useGraph();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!kernelReady) {
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 5;
        if (p > 90) p = 90;
        setProgress(p);
      }, 50);
      return () => clearInterval(interval);
    }
    setProgress(100);
  }, [kernelReady]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('paracad-theme', theme);
  }, [theme]);

  return (
    <div className="app-root flex flex-col h-screen w-screen overflow-hidden text-gray-100">
      {!kernelReady && (
        <div className="absolute inset-0 z-50 bg-[#1a1a1a] flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <Boxes size={50} className="text-blue-500 animate-pulse" />
          </div>
          <div className="text-gray-300 font-bold text-lg">{t('Initializing...')}</div>

          <div className="w-64 h-1 bg-gray-800 rounded overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="text-gray-500 text-xs font-mono">{t('Loading Kernel')}... {Math.floor(progress)}%</div>
        </div>
      )}

      <Header theme={theme} onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))} />

      <div className="flex-1 flex overflow-hidden relative">
        <div style={{ width: leftWidth }} className="left-panel shrink-0 relative z-10 h-full border-r">
          <NodeTree />
          <div
            className="absolute right-0 top-0 h-full w-1 hover:bg-blue-600 cursor-col-resize z-20"
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startW = leftWidth;
              const onMove = (mv: MouseEvent) => setLeftWidth(Math.max(220, Math.min(420, startW + (mv.clientX - startX))));
              const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          />
        </div>

        <div className="center-panel h-full relative z-0 flex flex-col border-l border-r" style={{ flex: 1, minWidth: 0 }}>
          <div className="flex-1 relative">
            <NodeCanvas />
          </div>
        </div>

        <div className="right-panel-shell h-full flex flex-col relative z-0 shrink-0" style={{ width: '38%', minWidth: 320 }}>
          <div style={{ height: '50%' }} className="relative min-h-0">
            <Viewer3D />
          </div>

          <div className="split-bar h-1 z-20 opacity-50" />

          <div className="log-shell flex-1 overflow-hidden min-h-0">
            <LogPanel />
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <GraphProvider>
    <MainLayout />
  </GraphProvider>
);

export default App;
