import React, { useState } from 'react';
import { Box, Circle, Type, FileDigit, MousePointer2, ChevronDown, ChevronRight, LayoutTemplate, Copy, Package, Trash2 } from 'lucide-react';
import { NodeType } from '../../types';
import { useGraph } from '../../store/GraphStore';

const CategoryGroup: React.FC<{ title: string, items: any[], isCustom?: boolean, onDelete?: (id: string) => void, t: (k:string)=>string }> = ({ title, items, isCustom, onDelete, t }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-1 select-none">
      <div 
        className="flex items-center px-2 py-2 text-xs font-bold text-gray-300 bg-[#252525] hover:bg-[#333] cursor-pointer border-l-2 border-transparent hover:border-yellow-600 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={10} className="mr-1"/> : <ChevronRight size={10} className="mr-1"/>}
        {t(title)}
      </div>
      
      {expanded && (
        <div className="grid grid-cols-2 gap-1 p-1">
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
              className="relative flex flex-col items-center justify-center p-2 rounded cursor-grab active:cursor-grabbing bg-[#2a2a2a] hover:bg-[#3a3a3a] hover:text-yellow-400 border border-transparent hover:border-gray-600 transition-all group"
            >
              {isCustom ? <Package size={16} className="mb-1 text-purple-500 group-hover:text-purple-400" /> : <Box size={16} className="mb-1 text-gray-500 group-hover:text-yellow-500" />}
              <span className="text-[10px] text-gray-400 text-center leading-tight truncate w-full px-1">{t(item.label)}</span>
              
              {isCustom && onDelete && (
                  <div 
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded hover:bg-red-600 text-gray-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onDelete(item.uniqueId); }}
                    title={t('Delete Component')}
                  >
                      <Trash2 size={10} />
                  </div>
              )}
            </div>
          ))}
          {isCustom && items.length === 0 && (
              <div className="col-span-2 text-[10px] text-gray-600 text-center py-2 italic">
                  {t('No Custom Nodes')}<br/>{t('Save in Canvas')}
              </div>
          )}
        </div>
      )}
    </div>
  );
};

const NodeLibrary: React.FC = () => {
  const { savedCustomNodes, deleteCustomNode, t } = useGraph();

  // Static Categories
  const libraryCategories = [
    {
      label: 'Basic & Params',
      items: [
        { label: 'Parameter', type: NodeType.PARAMETER },
        { label: 'Expression', type: NodeType.EXPRESSION },
      ]
    },
    {
      label: '2D Shapes',
      items: [
        { label: 'Line', type: NodeType.LINE },
        { label: 'Rectangle', type: NodeType.RECTANGLE },
        { label: 'Circle', type: NodeType.CIRCLE },
        { label: 'Arc', type: NodeType.ARC },
        { label: 'Ellipse', type: NodeType.ELLIPSE },
        { label: 'Polygon', type: NodeType.POLYGON },
        { label: 'Star', type: NodeType.STAR },
      ]
    },
    {
      label: '3D Solids',
      items: [
        { label: 'Box', type: NodeType.BOX }, // Replaced Rounded Box
        { label: 'Sphere', type: NodeType.SPHERE },
        { label: 'Capsule', type: NodeType.CAPSULE },
        { label: 'Cylinder', type: NodeType.CYLINDER },
        { label: 'Cone', type: NodeType.CONE },
        { label: 'Frustum', type: NodeType.TRUNCATED_CONE },
        { label: 'Torus', type: NodeType.TORUS },
        { label: 'Ellipsoid', type: NodeType.ELLIPSOID },
      ]
    },
    {
      label: 'Features',
      items: [
        { label: 'Fillet', type: NodeType.FILLET },
        { label: 'Extrude', type: NodeType.EXTRUDE },
        { label: 'Revolve', type: NodeType.REVOLVE },
        { label: 'Sweep', type: NodeType.SWEEP },
        { label: 'Loft', type: NodeType.LOFT },
        { label: 'Boolean', type: NodeType.BOOLEAN_OP },
      ]
    },
    {
      label: 'Transforms',
      items: [
        { label: 'Move', type: NodeType.TRANSLATION },
        { label: 'Rotate', type: NodeType.ROTATION },
        { label: 'Scale', type: NodeType.SCALE },
        { label: 'Mirror', type: NodeType.MIRROR },
        { label: 'Array Linear', type: NodeType.ARRAY_LINEAR },
        { label: 'Array Grid', type: NodeType.ARRAY_GRID },
        { label: 'Array Polar', type: NodeType.ARRAY_POLAR },
      ]
    },
    {
      label: 'Organization',
      items: [
        { label: 'Group', type: NodeType.GROUP },
      ]
    }
  ];

  return (
    <div className="w-full h-full bg-[#181818] overflow-y-auto border-r border-black select-none">
      <div className="h-8 flex items-center px-3 text-xs font-bold text-gray-300 bg-[#222] border-b border-black sticky top-0 z-10">
        <LayoutTemplate size={12} className="mr-2 text-yellow-600"/> {t('Node Library')}
      </div>
      
      <div className="py-1">
         {libraryCategories.map((cat) => (
            <CategoryGroup 
              key={cat.label} 
              title={cat.label} 
              items={cat.items} 
              t={t}
            />
         ))}
      </div>
    </div>
  );
};

export default React.memo(NodeLibrary);