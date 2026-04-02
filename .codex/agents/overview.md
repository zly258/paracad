# 代理协作概览

本项目建议至少维持三类代理并行协作：
1. **内核与节点代理**：负责将 computeGraph 抽象为 threeKernel，扩展节点库，编写 threeBridge、nodes/index.ts。
2. **UI 与体验代理**：负责 NodeComponent 统一主题、Viewer3D 工具栏优化、滚动/响应布局、多语言文案与动画。
3. **文档与协作代理**：负责 docs/ 目录、技能说明、提交规范，协调 .codex/skills 与 README 中的元信息。

## 协作流程
- 进入任务前先设置 当前任务 字段（type/目标/依赖），并记录在 docs/plan.md 的 backlog。
- 每个代理在完成任务后，在 .codex/skills/paracad-coordination 中撰写一次总结，注明验证命令与输出路径。
- 所有提交必须符合 docs/git-commit.md 中的格式，在 PR 描述中列出计划文档编号与对应技能（skill）。

## 交付物
- **节点代理**：节点清单、threeBridge、geometryEngine 模块；输出文档可放在 docs/architecture.md 的 节点引擎部分。
- **UI 代理**：样式变量、3D toolbar、互动动画、文本翻译；请同步更新 README 的协作与流程部分说明。
- **文档代理**：README、docs/plan.md、docs/git-commit.md、.codex/skills 与 .codex/agents；需保持中文并说明跨代理依赖。

## 额外约定
- 所有代理在开始新分支或大规模改动前先在 README 的下一步建议中添加计划链路，并同步给其他代理。
- 当代理之间存在依赖（如 UI 需要节点更新），在 .codex/agents/overview.md 加一段依赖链并附上预计完成时间。

