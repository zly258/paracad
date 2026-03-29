# Git 提交规范（中文）

## 标题格式
使用 `type(scope): 描述` 模式，`scope` 可选但建议填写模块名，`描述` 使用中文。
示例：`feat(core): 接入 occt 内核适配层`

## type 取值
- `feat`：新增节点、工具、界面模块
- `fix`：修复计算错误、3D 展示故障、连接逻辑问题
- `docs`：更新 README、`docs/`、`.codex/`、翻译文件
- `chore`：依赖升级、配置整理、脚本维护
- `style`：UI 微调、文案、非功能性样式调整
- `refactor`：重构 `geometryEngine`、`GraphStore`、`Viewer3D` 等模块
- `test`：补充测试、验证脚本、检查项
- `build`：构建流程、CI、打包优化

## 描述要求
1. 使用中文，必要时保留通用英文缩写。
2. 如果变更跨多个模块，建议使用 `模块-子模块` 形式的 `scope`，例如 `feat(node-curve)`。
3. 提交正文建议包含三段：
   - 为什么：当前问题或改造背景。
   - 怎么做：核心修改点，涉及的文件和模块。
   - 如何验证：本地执行过的命令，例如 `npm run build`。
4. 如果涉及 OCCT.js 迁移或核心建模逻辑，请在正文首行加入 `OCCT` 关键字，方便检索。

## 推荐示例
- `feat(core): 接入 occt.js wasm 加载适配`
- `feat(node): 补齐 revolve sweep loft 阵列节点`
- `refactor(graph): 拆分计算引擎到 core 目录`
- `docs(collab): 补充 skills 与多 agent 协作文档`

## 协作要求
1. 所有 PR 描述都应引用 `docs/git-commit.md`。
2. 如果改动影响多 agent 协作流程，请在正文增加“协作提示”段落，并说明关联的 `.codex/skills/paracad-coordination` 任务。
3. 如果改动对应 `docs/plan.md` 中的阶段任务，请在正文标注对应目标或条目。
