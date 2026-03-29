# 架构与模块说明

ParaCad 当前采用“节点图调度 + 内核适配 + 视图渲染”三层架构，目标是在保证浏览器实时交互的同时，为后续 OCCT BRep 建模迁移保留清晰边界。

## 1. 目录分层
- `core/kernel/`：建模内核适配层。
  - `occtModeling.ts`：唯一允许动态导入 OCCT.js wasm 的入口。
  - `occtAdapter.ts`：负责内核初始化、状态回退、运行时信息暴露。
- `core/graph/`：图求解层。
  - `computeGraph.ts`：只做图迭代调度。
  - `nodeExecutor.ts`：只做单节点执行。
  - `occtHelpers.ts`：OCCT 构造器、方法重载与坐标映射兼容层。
  - `occtRuntime.ts`：OCCT 运行时可用性判断、shape 可视化转换与统一回退日志。
  - `occtBoolean.ts`：真实布尔运算桥。
  - `occtSketch.ts`：草图轮廓与路径的 OCCT 构建辅助。
  - `occtFeatures.ts`：Fillet / Chamfer 等 OCCT 特征构建辅助。
  - `occtTransforms.ts`：BRep 级平移、旋转、缩放、镜像变换桥。
  - `sketchHandlers.ts`：2D 草图与开放路径节点执行器分组。
  - `featureHandlers.ts`：特征节点执行器分组。
  - `solidHandlers.ts`：基础体与实体节点执行器分组。
  - `analysisHandlers.ts`：分析读取节点执行器分组。
  - `runtimeUtils.ts`：参数读取、对象标记、Three 侧辅助工具。
- `core/nodes/`：节点定义层。
  - `nodeFactory.ts`：默认节点与 socket 初始化。
  - `library.ts`：节点库分类与展示源。
- `store/`：状态层，目前以 `GraphStore.tsx` 为中心。
- `components/`：界面层，按 NodeEditor / Viewport 分区。
- `docs/` 与 `.codex/`：计划、规范、协作说明。

## 2. 数据流
1. 用户在 `NodeCanvas` 中编辑节点与连接。
2. `GraphStore` 更新图状态、记录历史，并触发计算。
3. `computeGraph` 负责多轮求解图依赖关系。
4. 每个节点交给 `nodeExecutor` 生成基础值或 `THREE.Object3D`。
5. `Viewer3D` 只渲染被标记为 `visible` 的结果对象。

## 3. 当前内核策略
- **已接入**：`OCCT.js` 已作为真实内核运行时被加载，并通过 Vite 友好的 wasm URL 方式打包。
- **当前职责**：OCCT 目前已经承担基础体、布尔、BRep 级变换，以及部分“草图到特征”主链；可视化桥和其余节点求解仍由 Three.js 承担。
- **收敛原则**：除 `core/kernel/occtModeling.ts` 外，其他模块不得直接导入 OCCT.js。
- **迁移目标**：后续逐步把 `Sweep / Loft / Fillet`、更多草图轮廓与导出能力迁移为 OCCT BRep 执行器。

## 3.1 当前已落地的真实 BRep 路径
- 基础体：`Box / Sphere / Cylinder / Cone / Truncated Cone / Torus`
- 布尔：`Union / Subtract / Intersect`
- 变换：`Translation / Rotation / Scale / Mirror`
- 草图轮廓载体：`Star / Rectangle / Circle / Polygon / Ellipse`
- 开放路径载体：`Line / Arc`
- 特征：`Extrude / Revolve / Sweep / Loft`
- 特征尝试：`Fillet / Chamfer` 已接入 OCCT 优先路径，运行失败时回退到预览特征逻辑

说明：
- 所有 OCCT 路径都保留了失败回退逻辑，避免浏览器预览被运行时差异直接打断。
- 2D 草图节点当前会优先挂载闭合面的 `occtShape`，作为后续实体特征的统一输入载体。
- 需要保留给扫掠、放样使用的轮廓时，会额外挂载 `occtWire`，避免后续节点只能消费面而不能消费线框。
- `core/graph/occtHelpers.ts` 负责吸收 OCCT 重载构造器、方法名和坐标映射的兼容细节。
- `core/graph/occtRuntime.ts` 负责把 OCCT shape 统一转换为前端可消费对象，并挂载统一元数据。
- `core/graph/occtBoolean.ts` 负责真实布尔路径，便于后续继续补容差和诊断信息。
- `core/graph/occtSketch.ts` 负责草图轮廓、开放路径与后续工作平面输入的统一构建。
- `core/graph/occtFeatures.ts` 负责真实特征能力的聚合，避免执行器主文件继续膨胀。
- `core/graph/occtTransforms.ts` 负责把 `gp_Trsf` 变换桥封装成可复用能力，便于后续继续扩展坐标系变换。
- `core/graph/sketchHandlers.ts` 负责把草图节点从主执行器中拆开，作为后续按类别注册的第一步。
- `core/graph/featureHandlers.ts` 负责 `Fillet / Extrude / Revolve / Sweep / Loft` 等特征节点的分类执行。
- `core/graph/solidHandlers.ts` 负责基础体节点的分类执行，便于后续继续补导出、分析与体属性节点。
- `core/graph/analysisHandlers.ts` 负责 Dynamo 风格的分析读取节点，比如包围盒、面积、体积与质心。

## 4. 模块职责约束
- `computeGraph.ts` 不写节点细节。
- `nodeExecutor.ts` 不管理图状态。
- `runtimeUtils.ts` 不感知 React。
- `GraphStore.tsx` 不承载几何算法，只协调状态与日志。
- `components/` 不直接处理内核初始化。

## 5. 中文注释约定
1. 只在“边界、意图、约束”处写注释，不解释显而易见的语句。
2. 注释统一使用中文，优先说明“为什么这样拆”。
3. 关键模块文件头应说明职责和后续迁移方向。

## 6. 下一步扩展点
1. 在 `core/kernel/` 下新增 `brepPrimitives.ts`，先迁移基础体节点。
2. 在 `core/graph/` 下引入执行注册表，把 `switch(node.type)` 继续拆成多文件执行器。
3. 在 `store/` 下拆出 `history`、`persistence`、`kernel-state` 子模块，降低单文件复杂度。
4. 在 `components/NodeEditor/` 下进一步拆分工具条、面板头部、上下文菜单。
