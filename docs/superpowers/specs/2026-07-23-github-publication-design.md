# Sidereus Resume CLI GitHub 发布设计

## 目标

将完成的 TypeScript CLI 项目发布为公开 GitHub 仓库，项目名称为 **Sidereus Resume CLI**，远程仓库地址为 `95-yn/sidereus-resume-cli`。

## 命名

- 展示名称：Sidereus Resume CLI
- GitHub 仓库名：`sidereus-resume-cli`
- npm 包名：`sidereus-resume-cli`（保持现状）
- 可执行命令：`resume-cli`（保持现状）

名称与现有 `package.json`、README 和 npm 安装方式一致，不进行无必要的代码重命名。

## 发布内容

以 `codex/cli-ux` 作为最终实现来源。该分支包含：

- PDF 文本解析命令 `parse`
- DeepSeek/OpenAI 结构化提取命令 `extract`
- JD 匹配评分命令 `score`
- `.env` 与 `--env-file` 配置支持
- npm 全局安装与 `resume-cli` 可执行入口
- 终端加载状态、友好文件提示和安全错误输出
- 测试、示例、README、LICENSE 与发布文档

远程默认分支使用 `main`。本地开发分支和 worktree 不作为额外远程分支发布。

## 安全边界

发布前必须确认：

- `.env` 和 API Key 未被 Git 跟踪，也未出现在提交历史中
- `node_modules`、`dist`、覆盖率、日志和临时 PDF 不进入仓库
- `demo-output` 中的视频、旁白和录制缓存不进入仓库
- Git 跟踪文件与提交历史通过敏感信息模式扫描
- GitHub 远程地址不包含凭据

## 发布流程

1. 在最终实现 worktree 中运行完整质量检查。
2. 检查分支关系、工作区状态和待发布文件列表。
3. 扫描 Git 跟踪文件及历史，确认没有 API Key 或环境文件。
4. 创建公开仓库 `95-yn/sidereus-resume-cli`，不自动生成 README、LICENSE 或 `.gitignore`，避免与本地内容冲突。
5. 将最终实现提交推送为远程 `main` 并设置默认分支。
6. 读取远程仓库元数据和文件列表，验证可见性、默认分支和 HEAD。

## 验收标准

- `npm run check` 退出码为 0
- Git 工作区在推送前保持干净
- 远程仓库为 public，默认分支为 `main`
- 远程 `main` 与本地最终实现提交一致
- README、源码、测试、LICENSE 与 `package.json` 在远程可读取
- `.env`、API Key、视频、`node_modules` 和 `dist` 不存在于远程仓库
