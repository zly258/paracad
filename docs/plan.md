# 开发计划与任务清单

## 总目标
1. 将建模执行从原型式 Three 逻辑演进为可维护的 `OCCT.js + Three.js` 混合架构。
2. 持续扩展节点能力、统一界面和中文化规范。
3. 建立可并行推进的模块边界、文档和多 agent 协作机制。

## 阶段路线图

### 阶段 A：结构治理与边界清理
验收标准：`core/kernel`、`core/graph`、`core/nodes` 三层职责清晰，`npm run build` 通过。
- 拆分图调度器与节点执行器。
- 收敛 OCCT 导入边界，只允许核心建模入口动态导入 wasm。
- 为关键模块补中文注释与 barrel 导出。
- 清理兼容层，保留最少量旧路径转发。

### 阶段 B：OCCT 基础体迁移
验收标准：至少 3 个基础体由 OCCT 生成拓扑，再转换为可视结果。
- 迁移 `Box`、`Cylinder`、`Cone`。
- 设计 BRep 到渲染网格的转换桥。
- 为节点结果追加“执行来源”与“内核明细”信息。
- 补充失败回退与日志策略。

### 阶段 C：布尔与特征迁移
验收标准：布尔、倒角等关键节点能在 OCCT 路径下工作并保留回退机制。
- 布尔运算：`Union / Subtract / Intersect`。
- 草图到特征主链：闭合轮廓、`Extrude`、`Revolve`。
- 特征：`Fillet / Chamfer / Shell / Draft`。
- 建立参数合法性检查与错误分级。
- 增加对大模型的性能监测字段。

### 阶段 D：编辑器模块化
验收标准：NodeEditor 和 GraphStore 文件长度下降，职责更聚焦。
- 拆分 `NodeCanvas` 工具条、菜单、拖拽逻辑。
- 拆分 `GraphStore` 的历史、导入导出、内核状态、日志管理。
- 统一组件 props 类型与目录导出。
- 增加更多中文注释和边界说明。

### 阶段 E：工程化与交付
验收标准：具备可持续协作的工程规范和基础测试。
- 增加构建检查、类型检查、后续测试计划。
- 增加提交模板、版本记录策略。
- 增加导出能力规划：STEP / IGES / STL。
- 将计划同步到 `.codex/skills` 与 `.codex/agents`。

## 节点扩展 Backlog
1. 曲线节点：Bezier、样条、偏移曲线、投影曲线。
2. 草图节点：工作平面、草图容器、约束占位。
3. 分析节点：体积、面积、包围盒、质心。
4. 变换节点：非均匀缩放、基于坐标系变换。
5. 输出节点：网格导出、BRep 导出、结果快照。

## 风险清单
1. `OCCT.js` wasm 体积较大，需要继续做懒加载和 chunk 控制。
2. 浏览器预览与 BRep 精确结果之间可能出现几何差异。
3. `GraphStore.tsx` 仍然偏大，后续拆分时要避免破坏交互稳定性。
4. `OCCT.js` 的 JS 导出名带重载后缀，新增路径虽然都做了回退保护，但仍需浏览器端继续核验。

## 近期连续实施项
1. 继续把 `Sweep / Loft / Fillet` 接到真实 OCCT BRep 路径。
2. 为 `Ellipse / Arc / Line` 补齐可复用的 OCCT 草图轮廓载体。
3. 完成 `core/graph` 的进一步注册表化，降低 `nodeExecutor.ts` 复杂度。
4. 拆分 `GraphStore` 的内核状态与历史模块。
5. 继续补中文注释、浏览器端核验与更细的开发说明。

## 当前进度快照
1. 基础体：`Box / Sphere / Cylinder / Cone / Truncated Cone / Torus` 已可优先走 OCCT。
2. 变换：`Translation / Rotation / Scale / Mirror` 已支持 BRep 级变换。
3. 布尔：当输入保留 `occtShape` 时，`Boolean` 会优先走真实 OCCT 布尔。
4. 草图与特征：`Star / Rectangle / Circle / Polygon / Ellipse` 已能挂载 OCCT 轮廓，`Extrude / Revolve` 已优先尝试真实 OCCT。
5. 开放路径：`Line / Arc` 已能挂载 OCCT 路径载体，供后续扫掠类节点复用。
6. 曲面主链：`Sweep / Loft` 已增加 OCCT 优先路径，并保留 Three 回退。
