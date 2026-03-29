# ParaCad — 以节点驱动的 Web 参数化建模平台

ParaCad 是一套运行于浏览器的节点式参数化建模平台，面向需要在 Web 端快速迭代几何构型的团队。项目以 Three.js 与 React 构建，为文本逻辑、图形关系、3D 可视化提供统一链路。

## 项目概述
1. **内核定位**：当前已接入 `OCCT.js` 作为内核初始化入口，并采用 `OCCT.js + Three.js` 的混合架构；布尔与可视化求解先由 Three 路径稳定承载，为后续更深层的 BRep 能力迁移预留接口。
2. **界面体验**：节点画布、侧边库、3D 视口、日志面板共享统一皮肤，所有交互与文案均以中文为主，并保留英文切换。
3. **核心工作流**：参数 → 图元 → 特征 → 变换 → 结果，可保存为自定义“组合节点”，并通过 3D 视口实时预览。

## 核心能力
- **自定义参数**：支持数值、向量、布尔、颜色、表达式等参数类型，自动记录历史并可撤销/重做。
- **丰富节点**：2D 轮廓、3D 实体、特征操作、布尔/阵列、几何变换、表达式与自定义集合。
- **自动计算管线**：GraphStore 统一管理节点、连接、全局参数，computeGraph 负责迭代求解并将 Three.js 实例注入视图。
- **可定制化**：可保存自定义组合（Custom Node），可在 docs/plan.md 中找到未来节点评估与开发计划。

## 技术与架构
详细模块结构与数据流请阅读 `docs/architecture.md`。该文档说明了状态管理、节点引擎、节点注册方式、视图渲染链路，以及未来 OCCT.js 迁移点。

## 快速启动
1. 切换到项目目录并安装依赖：`npm install`
2. 启动开发服务器：`npm run dev`
3. 浏览器访问 `http://localhost:5173`
4. 若需构建生产包：`npm run build`
5. 若需预览构建：`npm run preview`
6. node_modules 依赖项包括 `three`, `@react-three/fiber`, `three-bvh-csg`, `dagre` 等；请优先采用 Node 18+ 环境。

## 协作与流程
1. **文档基础**：架构、计划、Git 提交规范均在 `docs/` 目录下，协助多阶段开发回顾。
2. **技能与多 agent 协作**：
   - `.codex/skills/paracad-coordination`：描述本项目的协作规则、常见任务模板（如“扩展节点”、“接入 OCCT.js”、“前端提效”）。
   - `.codex/agents/overview.md`：记录当前多 agent 分工建议、互相调用的技能名称以及输出约定。
3. **Git 提交规范**：所有协作人员应遵守 `docs/git-commit.md` 里约定的标题、类型与描述要求，便于 multi-agent 自动生成规范化变更。

## 目录结构概览
```
paracad/
├── components/         # 节点编辑、视口等可视化模块
├── store/              # GraphStore 负责节点状态与历史
├── utils/              # 几何引擎与布局算法
├── docs/               # 架构、计划、Git 规范
├── .codex/skills/       # 项目协作技能（Skill）
├── .codex/agents/       # 多 agent 协作说明与角色
├── App.tsx             # 应用入口
└── index.tsx           # React 渲染入口
```

## 下一步建议
1. 阅读 `docs/architecture.md` 了解当前引擎拓扑与扩展点；
2. 根据 `docs/plan.md` 选定短期任务（如节点扩展、OCCT.js 适配、界面优化）并在 `Saved Custom Node` 中记录；
3. 所有 PR 需参考 `docs/git-commit.md` 书写标准化提交，再由 `.codex/skills/paracad-coordination` 提供 review 模板。


