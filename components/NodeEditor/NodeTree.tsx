import React, { useCallback, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { NodeType } from '../../types';
import { useGraph } from '../../store/GraphStore';
import { NODE_LIBRARY_CATEGORIES } from '../../core/nodes/library';
import { EXAMPLE_PRESETS } from './examplePresets';

interface LibraryItem {
  label: string;
  type: NodeType;
  description?: string;
}

const NODE_DESCRIPTIONS: Partial<Record<NodeType, { zh: string; en: string }>> = {
  [NodeType.PARAMETER]: { zh: '定义可复用参数值', en: 'Define a reusable value' },
  [NodeType.EXPRESSION]: { zh: '通过表达式计算结果', en: 'Evaluate a formula from inputs' },
  [NodeType.LINE]: { zh: '由起点终点生成直线', en: 'Create a line from start to end' },
  [NodeType.RECTANGLE]: { zh: '创建矩形草图轮廓', en: 'Create rectangle profile' },
  [NodeType.CIRCLE]: { zh: '创建圆形草图轮廓', en: 'Create circle profile' },
  [NodeType.ARC]: { zh: '按角度创建圆弧', en: 'Create arc curve by angles' },
  [NodeType.ELLIPSE]: { zh: '创建椭圆草图轮廓', en: 'Create ellipse profile' },
  [NodeType.POLYGON]: { zh: '创建正多边形', en: 'Create regular polygon' },
  [NodeType.STAR]: { zh: '创建星形草图', en: 'Create star-shaped profile' },
  [NodeType.BOX]: { zh: '创建立方体实体', en: 'Create box solid' },
  [NodeType.SPHERE]: { zh: '创建球体实体', en: 'Create sphere solid' },
  [NodeType.CAPSULE]: { zh: '创建胶囊体实体', en: 'Create capsule solid' },
  [NodeType.CYLINDER]: { zh: '创建圆柱实体', en: 'Create cylinder solid' },
  [NodeType.CONE]: { zh: '创建圆锥实体', en: 'Create cone solid' },
  [NodeType.TRUNCATED_CONE]: { zh: '创建圆台实体', en: 'Create frustum solid' },
  [NodeType.TORUS]: { zh: '创建圆环体实体', en: 'Create torus solid' },
  [NodeType.ELLIPSOID]: { zh: '创建椭球体实体', en: 'Create ellipsoid solid' },
  [NodeType.FILLET]: { zh: '边倒圆或倒角', en: 'Round or chamfer edges' },
  [NodeType.EXTRUDE]: { zh: '轮廓拉伸成实体', en: 'Extrude profile to solid' },
  [NodeType.REVOLVE]: { zh: '轮廓旋转成实体', en: 'Revolve profile around axis' },
  [NodeType.SWEEP]: { zh: '轮廓沿路径扫掠', en: 'Sweep profile along path' },
  [NodeType.LOFT]: { zh: '截面之间放样成形', en: 'Blend between section profiles' },
  [NodeType.BOOLEAN_OP]: { zh: '并差交布尔运算', en: 'Union, subtract, intersect' },
  [NodeType.BOUNDING_BOX]: { zh: '读取包围盒尺寸', en: 'Read bounds and size' },
  [NodeType.SURFACE_AREA]: { zh: '计算表面积', en: 'Measure surface area' },
  [NodeType.VOLUME]: { zh: '计算几何体体积', en: 'Measure enclosed volume' },
  [NodeType.CENTROID]: { zh: '读取几何质心点', en: 'Read geometric center' },
  [NodeType.NUMBER_RANGE]: { zh: '按步长生成数列', en: 'Generate stepped numbers' },
  [NodeType.RANGE_BY_COUNT]: { zh: '按数量生成区间', en: 'Generate range by count' },
  [NodeType.LIST_CREATE]: { zh: '把值组合成列表', en: 'Compose values into list' },
  [NodeType.LIST_LENGTH]: { zh: '读取列表长度', en: 'Count list items' },
  [NodeType.LIST_GET_ITEM]: { zh: '按索引取列表项', en: 'Pick item by index' },
  [NodeType.LIST_FLATTEN]: { zh: '展平多层嵌套列表', en: 'Flatten nested lists' },
  [NodeType.LIST_FIRST]: { zh: '读取首个列表项', en: 'Read first item' },
  [NodeType.LIST_LAST]: { zh: '读取最后列表项', en: 'Read last item' },
  [NodeType.LIST_JOIN]: { zh: '合并两个列表', en: 'Join two lists' },
  [NodeType.LIST_SLICE]: { zh: '按区间切片列表', en: 'Slice list by range' },
  [NodeType.LIST_REVERSE]: { zh: '反转列表顺序', en: 'Reverse list order' },
  [NodeType.LIST_UNIQUE]: { zh: '列表元素去重', en: 'Keep unique items' },
  [NodeType.LIST_REPEAT]: { zh: '按次数重复元素', en: 'Repeat item by count' },
  [NodeType.VECTOR_CREATE]: { zh: '通过XYZ创建向量', en: 'Create vector from XYZ' },
  [NodeType.VECTOR_ADD]: { zh: '两个向量相加', en: 'Add two vectors' },
  [NodeType.VECTOR_SUBTRACT]: { zh: '两个向量相减', en: 'Subtract two vectors' },
  [NodeType.VECTOR_SCALE]: { zh: '向量按因子缩放', en: 'Scale vector by factor' },
  [NodeType.VECTOR_LENGTH]: { zh: '计算向量长度', en: 'Measure vector magnitude' },
  [NodeType.VECTOR_NORMALIZE]: { zh: '向量归一化', en: 'Normalize vector length' },
  [NodeType.VECTOR_DOT]: { zh: '计算向量点乘', en: 'Compute dot product' },
  [NodeType.VECTOR_CROSS]: { zh: '计算向量叉乘', en: 'Compute cross product' },
  [NodeType.VECTOR_DISTANCE]: { zh: '计算向量间距离', en: 'Distance between vectors' },
  [NodeType.VECTOR_ANGLE]: { zh: '计算向量夹角', en: 'Angle between vectors' },
  [NodeType.VECTOR_LERP]: { zh: '向量线性插值', en: 'Interpolate between vectors' },
  [NodeType.MATH_ADD]: { zh: '两个数值相加', en: 'Add numeric values' },
  [NodeType.MATH_SUBTRACT]: { zh: '两个数值相减', en: 'Subtract numeric values' },
  [NodeType.MATH_MULTIPLY]: { zh: '两个数值相乘', en: 'Multiply numeric values' },
  [NodeType.MATH_DIVIDE]: { zh: '两个数值相除', en: 'Divide numeric values' },
  [NodeType.MATH_POWER]: { zh: '计算幂运算', en: 'Raise to power' },
  [NodeType.MATH_ABS]: { zh: '求绝对值', en: 'Absolute value' },
  [NodeType.MATH_CLAMP]: { zh: '限制在最小最大值间', en: 'Clamp between min and max' },
  [NodeType.MATH_REMAP]: { zh: '区间重映射', en: 'Remap value range' },
  [NodeType.TRANSLATION]: { zh: '按向量平移几何', en: 'Move geometry by vector' },
  [NodeType.ROTATION]: { zh: '绕轴旋转几何', en: 'Rotate geometry around axis' },
  [NodeType.SCALE]: { zh: '统一缩放几何', en: 'Scale geometry uniformly' },
  [NodeType.MIRROR]: { zh: '按法向镜像几何', en: 'Mirror geometry by normal' },
  [NodeType.ARRAY_LINEAR]: { zh: '沿方向线性复制', en: 'Copy in linear direction' },
  [NodeType.ARRAY_GRID]: { zh: '按网格阵列复制', en: 'Copy in XY grid' },
  [NodeType.ARRAY_POLAR]: { zh: '绕中心环形复制', en: 'Copy around center' },
  [NodeType.GROUP]: { zh: '组合多个几何对象', en: 'Group multiple geometries' },
  [NodeType.CUSTOM]: { zh: '保存的自定义组件', en: 'Saved custom component' },
};

const CategoryGroup: React.FC<{
  title: string;
  items: LibraryItem[];
  t: (k: string) => string;
  forceExpanded?: boolean;
  getNodeDescription: (type: NodeType) => string;
}> = ({ title, items, t, forceExpanded = false, getNodeDescription }) => {
  const [expanded, setExpanded] = useState(true);
  const isOpen = forceExpanded || expanded;

  return (
    <div className="category-group">
      <div className="category-title" onClick={() => setExpanded(!expanded)}>
        <span>{t(title)}</span>
        <span className="flex items-center gap-2">
          <span className="category-count">{items.length}</span>
          <span>{isOpen ? '-' : '+'}</span>
        </span>
      </div>
      {isOpen && (
        <div className="category-items">
          {items.map((item) => (
            <div
              key={`${item.type}-${item.label}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('nodeType', item.type);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="category-button"
              title={t(item.label)}
            >
              <div className="category-button-text">
                <span className="category-button-name">{t(item.label)}</span>
                <span className="category-button-desc">{item.description || getNodeDescription(item.type)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ExampleScriptsGroup: React.FC<{
  title: string;
  items: { file: string; label: string }[];
  t: (k: string) => string;
  onLoad: (file: string) => void;
  isLoadingFile: string | null;
  forceExpanded?: boolean;
}> = ({ title, items, t, onLoad, isLoadingFile, forceExpanded = false }) => {
  const [expanded, setExpanded] = useState(true);
  const isOpen = forceExpanded || expanded;

  return (
    <div className="category-group">
      <div className="category-title" onClick={() => setExpanded(!expanded)}>
        <span>{t(title)}</span>
        <span className="flex items-center gap-2">
          <span className="category-count">{items.length}</span>
          <span>{isOpen ? '-' : '+'}</span>
        </span>
      </div>
      {isOpen && (
        <div className="category-items">
          {items.map((item) => (
            <div
              key={item.file}
              className="category-button cursor-pointer"
              title={`${t('Double-click to load')} ${item.label}`}
              onDoubleClick={() => onLoad(item.file)}
            >
              <div className="category-button-text">
                <span className="category-button-name">{item.label}</span>
                <span className="category-button-desc">
                  {isLoadingFile === item.file ? `${t('Loading')}...` : t('Double-click to load')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const NodeLibrary: React.FC = () => {
  const { t, language, loadGraphData } = useGraph();
  const [query, setQuery] = useState('');
  const [loadingExampleFile, setLoadingExampleFile] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const getNodeDescription = useCallback((type: NodeType) => {
    const item = NODE_DESCRIPTIONS[type];
    if (!item) return language === 'zh' ? '节点组件' : 'Node component';
    return language === 'zh' ? item.zh : item.en;
  }, [language]);

  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return NODE_LIBRARY_CATEGORIES;
    return NODE_LIBRARY_CATEGORIES
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => {
          const descZh = NODE_DESCRIPTIONS[item.type]?.zh || '';
          const descEn = NODE_DESCRIPTIONS[item.type]?.en || '';
          const currentDesc = getNodeDescription(item.type);
          const combined = `${item.label} ${t(item.label)} ${descZh} ${descEn} ${currentDesc}`.toLowerCase();
          return combined.includes(normalizedQuery);
        }),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [getNodeDescription, normalizedQuery, t]);

  const filteredExamples = useMemo(() => {
    if (!normalizedQuery) return EXAMPLE_PRESETS;
    return EXAMPLE_PRESETS.filter((item) => item.label.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery]);

  const hasResults = filteredCategories.length > 0 || filteredExamples.length > 0;

  const handleLoadExample = useCallback(async (file: string) => {
    try {
      setLoadingExampleFile(file);
      const url = `${import.meta.env.BASE_URL}examples/${file}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      loadGraphData(data, file);
    } catch (error) {
      console.error('Failed to load example', error);
    } finally {
      setLoadingExampleFile(null);
    }
  }, [loadGraphData]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="node-tree-header h-8 flex items-center px-3 text-xs font-bold sticky top-0 z-10">
        {t('Node Library')}
      </div>

      <div className="node-tree-panel-content">
        <div className="node-library-grid">
          <div className="node-library-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search Nodes')}
              className="node-search-input"
            />
            {query && (
              <button className="node-search-clear" onClick={() => setQuery('')} title={t('Clear')}>
                <X size={12} />
              </button>
            )}
          </div>

          {!hasResults && <div className="node-library-empty">{t('No matching nodes')}</div>}

          {filteredCategories.map((cat) => (
            <CategoryGroup
              key={cat.label}
              title={cat.label}
              items={cat.items as LibraryItem[]}
              t={t}
              forceExpanded={!!normalizedQuery}
              getNodeDescription={getNodeDescription}
            />
          ))}

          <ExampleScriptsGroup
            title="Example Scripts"
            items={filteredExamples}
            t={t}
            onLoad={handleLoadExample}
            isLoadingFile={loadingExampleFile}
            forceExpanded={!!normalizedQuery}
          />
          <div className="h-3 shrink-0"></div>
        </div>
        <div className="node-tree-footer px-3 py-2 text-[10px] border-t">
          {filteredCategories.reduce((sum, c) => sum + c.items.length, 0) + filteredExamples.length} items
        </div>
      </div>
    </div>
  );
};

export default React.memo(NodeLibrary);
