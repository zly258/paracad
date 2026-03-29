import React, { useState, useRef, useEffect } from 'react';
import NodeCanvas from './components/NodeEditor/NodeCanvas';
import NodeTree from './components/NodeEditor/NodeTree';
import Viewer3D from './components/Viewport/Viewer3D';
import { GraphProvider, useGraph } from './store/GraphStore';
import { Terminal, AlertCircle, CheckCircle, Info, Loader2, Globe, Undo2, Redo2, RefreshCw, Scan } from 'lucide-react';
import './styles/workbench.css';

const LogPanel = React.memo(() => {
  const { logs, t } = useGraph();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="log-card">
      <header>
        <div className="flex items-center gap-2">
          <Terminal size={14} />
          <span>{t('Console')}</span>
        </div>
        <span>{logs.length} 条记录</span>
      </header>
      <div className="log-panel">
        <div className="flex-1 overflow-y-auto px-2 space-y-2 h-full">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-2 border-b border-white/5 pb-1 last:border-0">
              <span className="text-xs text-gray-500 shrink-0">[{log.timestamp.toLocaleTimeString()}]</span>
              <span className={`flex items-center gap-1 text-[11px] ${
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
    </div>
  );
});

const Header: React.FC = () => {
  const { kernelReady, kernelBackend, toggleLanguage, t, undo, redo, canUndo, canRedo } = useGraph();
  return (
    <header className="workbench-header">
      <div className="workbench-brand">
        <div>
          <div className="text-sm text-gray-300">{t('ParaCad')}</div>
          <h1>参数化工作台</h1>
        </div>
        <div className="tagline">OCCT JS 探索 · 节点驱动 · 专业 CAD</div>
      </div>
      <div className="workbench-actions">
        <button className="status-pill" aria-label="Kernel status">
          内核 {kernelReady ? (kernelBackend === 'occt.js' ? 'OCCT.js' : 'Three Fallback') : '启动中'}
        </button>
        <div className="flex gap-1">
          <button onClick={undo} disabled={!canUndo} className="action-chip" title={t('Undo') + ' (Ctrl+Z)'}>
            <Undo2 size={14} />
            {t('Undo')}
          </button>
          <button onClick={redo} disabled={!canRedo} className="action-chip" title={t('Redo') + ' (Ctrl+Y)'}>
            <Redo2 size={14} />
            {t('Redo')}
          </button>
        </div>
        <button onClick={toggleLanguage} className="action-chip">
          <Globe size={14} />
          {t('Language')}
        </button>
      </div>
    </header>
  );
};

const MainLayout: React.FC = () => {
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightSplit, setRightSplit] = useState(70);
  const viewerRef = useRef<HTMLDivElement>(null);
  const { kernelReady, kernelMessage, t, nodes, connections, logs, triggerCompute, fitView } = useGraph();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!kernelReady) {
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 6;
        if (p > 95) p = 95;
        setProgress(p);
      }, 60);
      return () => clearInterval(interval);
    }
    setProgress(100);
  }, [kernelReady]);

  return (
    <div className="workbench-shell">
      {!kernelReady && (
        <div className="overlay-loading">
          <Loader2 size={32} className="animate-spin" />
          <div className="text-sm">{t('Initializing...')}</div>
          <div className="loader-bar"><span style={{ width: `${Math.min(progress + 12, 100)}%` }} /></div>
          <div className="text-xs text-gray-400">{t('Loading Kernel')} {Math.floor(progress)}%</div>
          <div className="text-xs text-gray-500">{kernelMessage}</div>
        </div>
      )}

      <Header />

      <div className="workbench-body">
        <div className="workbench-panel node-tree-panel" style={{ width: leftWidth }}>
          <div className="panel-header">
            <h2>{t('Node Library')}</h2>
            <div className="header-subtitle">算术 · 几何 · 特征 · 阵列</div>
          </div>
          <div className="panel-body">
            <NodeTree />
          </div>
          <div className="panel-footer">
            {nodes.length} 个节点 · {connections.length} 条连接 · {logs.length} 条日志
          </div>
          <div
            className="absolute right-0 top-0 h-full w-1"
            style={{ cursor: 'ew-resize' }}
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

        <div className="workbench-panel workbench-main">
          <div className="canvas-stage">
            <NodeCanvas />
          </div>
        </div>

        <div className="right-panel">
          <div className="viewer-shell" style={{ flexGrow: rightSplit / 100 }} ref={viewerRef}>
            <div className="viewer-toolbar">
              <button onClick={triggerCompute} title="刷新场景">
                <RefreshCw size={16} />
              </button>
              <button title="视角归零" onClick={() => {
                const rect = viewerRef.current?.getBoundingClientRect();
                fitView(rect?.width ?? 1200, rect?.height ?? 800);
              }}>
                <Scan size={16} />
              </button>
            </div>
            <Viewer3D />
          </div>

          <div className="log-host" style={{ flexGrow: (100 - rightSplit) / 100 }}>
            <LogPanel />
          </div>
          <div
            className="split-handle"
            style={{ height: 4, cursor: 'ns-resize', background: 'transparent' }}
            onMouseDown={(e) => {
              const rect = e.currentTarget.parentElement?.getBoundingClientRect();
              if (!rect) return;
              const onMove = (mv: MouseEvent) => {
                const relY = mv.clientY - rect.top;
                const percent = (relY / rect.height) * 100;
                setRightSplit(Math.max(30, Math.min(80, percent)));
              };
              const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          />
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
