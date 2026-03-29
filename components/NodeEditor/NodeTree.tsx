import React, { useState } from 'react';
import { Package, Trash2, Boxes } from 'lucide-react';
import { NodeType } from '../../types';
import { useGraph } from '../../store/GraphStore';
import { NODE_LIBRARY_CATEGORIES } from '../../core/nodes/library';

const CategoryGroup: React.FC<{ title: string, items: any[], isCustom?: boolean, onDelete?: (id: string) => void, t: (k:string)=>string }> = ({ title, items, isCustom, onDelete, t }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="category-group">
      <div className="category-title" onClick={() => setExpanded(!expanded)}>
        <span>{t(title)}</span>
        <span>{expanded ? '-' : '+'}</span>
      </div>
      {expanded && (
        <div className="category-items">
          {items.map(item => (
            <div 
              key={item.uniqueId || item.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('nodeType', item.type);
                if (item.customData) {
                  e.dataTransfer.setData('customData', JSON.stringify(item.customData));
                }
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="category-button"
            >
              {isCustom ? <Package size={16} className="mb-1 text-purple-400" /> : <Boxes size={16} className="mb-1 text-yellow-400" />}
              <span>{t(item.label)}</span>
              {isCustom && onDelete && (
                <div 
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded hover:bg-red-600 text-gray-300 hover:text-white transition-opacity"
                  onClick={(e) => { e.stopPropagation(); onDelete(item.uniqueId); }}
                  title={t('Delete Component')}
                >
                  <Trash2 size={10} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const NodeLibrary: React.FC = () => {
  const { savedCustomNodes, deleteCustomNode, t } = useGraph();

  return (
    <div className="node-library-grid">
      {NODE_LIBRARY_CATEGORIES.map((cat) => (
        <CategoryGroup key={cat.label} title={cat.label} items={cat.items} t={t} />
      ))}
      {savedCustomNodes.length > 0 && (
        <CategoryGroup
          title="Custom Nodes"
          items={savedCustomNodes.map(node => ({ label: node.name, type: NodeType.CUSTOM, customData: { nodes: node.nodes, connections: node.connections }, uniqueId: node.id }))}
          isCustom
          onDelete={deleteCustomNode}
          t={t}
        />
      )}
      {savedCustomNodes.length === 0 && (
        <div className="category-group">
          <div className="category-title">
            <span>{t('Custom Nodes')}</span>
            <span>+</span>
          </div>
          <div className="category-items">
            <div className="text-[10px] text-gray-500 text-center italic px-2 py-3">
              {t('Save in Canvas')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(NodeLibrary);
