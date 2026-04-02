---
name: paracad-coordination
description: 本技能协调 ParaCad 的内核、节点、界面与文档任务，适用于 multi-agent 并行改造的场景。
---

# ParaCad 协作技能

## 触发条件
1. 需要抽象或重构 computeGraph 内核、接入 Three.js.js、封装 Three.jsBridge、调整节点注册方式。
2. 需要扩展节点库、整理 UI 体验、更新 3D 视口和本地日志反馈。
3. 需要同步文档、计划或 Git 流程，使多 agent 可以并行工作而不冲突。

## 执行指引
- 首先阅读 README、docs/architecture.md、docs/plan.md，明确当前阶段和任务状态。
- 用本技能记录当前关注点：任务类型、目标、输入文件、预期输出、验证命令（如 npm run dev 或 npm run build）。
- 所有任务描述中保留中文关键字，可附加 #doc、#skill 或 #ui 标签，便于后续搜索与聚合。

## 输出要求
1. 提交说明里包含目标、当前进度、下一步以及验证方式。
2. 完成后更新 .codex/agents/overview.md，说明 agent 角色责任、依赖资源与文档链路。
3. PR 描述须引用 docs/git-commit.md，正文列出 docs/plan.md 中的任务编号与 skill 模板。

## 多 agent 协作
- 先查看 .codex/agents/overview.md 推荐分工，确定自己负责的领域（节点、内核、UI、文档等）。
- 若需新资源（node 模板、文档、截图），在技能说明中写明准备方式和路径。
- 在恢复其他 agent 的任务前，不要覆盖 skills 或 docs 目录的内容，除非确认所有人同意。

