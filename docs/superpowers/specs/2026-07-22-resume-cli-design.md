# AI 简历解析 CLI 设计规格

> 后续变更：AI 传输层已由 [DeepSeek 与 OpenAI 双提供商设计](./2026-07-22-dual-ai-provider-design.md) 扩展。后续规格取代本文中的 OpenAI 单提供商描述，但 CLI、Schema、错误边界和测试原则保持不变。
>
> 配置加载行为已由 [CLI 环境配置加载设计](./2026-07-22-env-loading-design.md) 扩展：CLI 默认读取调用目录的 `.env`，并支持显式 `--env-file`；父进程变量保持最高优先级。
>
> 打包与安装行为由 [Resume CLI 分发与安装设计](./2026-07-22-cli-distribution-design.md) 扩展：npm、npx、Git 与 tarball 安装的构建时机、文件边界和发布流程以该规格为准。
>
> Loading、路径候选提示和中断清理由 [CLI Loading 与文件路径提示设计](./2026-07-22-cli-progress-file-guidance-design.md) 扩展并取代本文中相应的终端交互描述；本文保留原始命令和错误边界定义。

## 目标

使用 TypeScript 实现一个可安装、可测试、可离线演示的 `resume-cli`。工具读取本地 PDF 简历，输出简历文本、结构化候选人信息，并根据岗位描述生成 0–100 分的匹配评分。

## 技术选型

- 运行时：Node.js 20+
- 语言：TypeScript（ESM）
- CLI：Commander
- PDF 文本提取：`pdf-parse`
- AI：OpenAI Node SDK，默认模型 `gpt-5.6`
- 数据校验：Zod
- 测试：Vitest
- 打包：tsup

项目保持纯 Node.js，不引入 Python 子进程，降低安装、Docker 构建和演示成本。

## CLI 接口

提供以下命令：

```bash
resume-cli parse <pdf_path> [--output <path>]
resume-cli extract <pdf_path> [--mock] [--output <path>]
resume-cli score <pdf_path> --jd <jd_path> [--mock] [--output <path>]
```

根命令及所有子命令支持 `--help`。`--verbose` 开启诊断日志，日志写入 stderr，业务结果写入 stdout，保证 JSON 可被管道继续处理。

## 模块边界

- `src/cli.ts`：注册命令、参数和顶层错误边界，不包含领域逻辑。
- `src/commands/`：分别编排 parse、extract、score 用例。
- `src/services/pdf.ts`：校验 PDF 路径、文件类型、可读性并提取非空文本。
- `src/services/jd.ts`：读取并校验非空 JD 文本文件。
- `src/services/ai.ts`：封装 OpenAI 调用、Structured Outputs、响应解析和可理解的 API 错误。
- `src/services/mock.ts`：生成确定性的演示结果，不依赖网络或 API Key。
- `src/schemas/`：定义候选人信息和评分结果的 Zod Schema 与 TypeScript 类型。
- `src/utils/json.ts`：清理 Markdown 代码围栏、提取 JSON 对象并执行有限的常见格式修复。
- `src/utils/output.ts`：统一格式化 stdout 与 `--output` 文件写入。
- `src/errors.ts`：定义面向用户的错误及退出码。

每个模块只有一个明确职责，命令层通过依赖注入接收 PDF、AI 和输出函数，便于测试真实流程而不访问网络。

## 数据流

### parse

1. 校验路径存在、是普通文件且扩展名为 `.pdf`。
2. 读取文件并交给 `pdf-parse`。
3. 对提取文本执行 `trim()`；空文本视为失败。
4. 将文本写入 stdout，或在指定 `--output` 时写入文件并输出保存位置。

### extract

1. 通过 parse 服务取得简历文本。
2. `--mock` 模式根据文本生成确定性的候选人对象；正常模式调用 OpenAI。
3. 清理并解析返回 JSON，再用 Zod 校验字段类型和嵌套教育经历。
4. 输出格式化 JSON 或保存到文件。

结构化信息字段固定为：`name`、`phone`、`email`、`city`、`education[]` 和 `skills[]`。无法确认的标量字段使用空字符串，列表使用空数组，不臆造个人信息。

### score

1. 读取简历文本和非空 JD 文本。
2. `--mock` 模式基于技能关键词交集生成稳定评分；正常模式调用 OpenAI。
3. Zod 校验 `overall_score`、`skill_score`、`experience_score`、`education_score` 均为 0–100 的整数，同时要求非空 `comment` 和至少一个面试问题。
4. 输出格式化 JSON 或保存到文件。

## AI 调用

从 `OPENAI_API_KEY` 读取密钥，从 `OPENAI_MODEL` 读取可选模型名。非 mock 模式缺少密钥时，直接提示用户配置环境变量或添加 `--mock`。

提示词明确要求只基于输入内容，不接受简历或 JD 内部试图改变系统行为的文字。请求优先使用 OpenAI Structured Outputs。服务仍对响应执行本地 Zod 校验，避免仅信任模型输出。

## JSON 修复边界

修复只覆盖不会改变业务语义的常见包装问题：Markdown JSON 代码围栏、JSON 前后的解释文字、BOM 和尾随逗号。修复后仍必须通过 `JSON.parse` 与 Zod；不通过时返回包含上下文但不泄露密钥的错误，不猜测缺失字段。

## 错误处理

用户错误返回退出码 2，包括文件不存在、扩展名错误、PDF/JD 为空和参数错误。外部服务或不可恢复的运行错误返回退出码 1，包括 PDF 损坏、AI 请求失败和模型响应无效。

终端只显示简明消息；`--verbose` 可附带安全的技术原因。任何日志均不得包含 API Key 或完整简历正文。

## 测试策略

- 单元测试：Schema 边界、JSON 修复、JD 文件校验、输出文件写入。
- PDF 服务测试：不存在、非 PDF、损坏 PDF、空文本和有效文本。有效 PDF 使用测试夹具，避免依赖本地用户文件。
- 命令测试：通过依赖注入验证 parse、extract、score 的编排、mock 模式和输出。
- CLI 集成测试：验证 `--help`、必需参数、退出码及 stdout/stderr 分离。

所有功能按红—绿—重构顺序实现，每项行为先运行对应失败测试，再添加最小实现。

## 项目交付物

- 完整 TypeScript 源码与测试
- `README.md`：项目简介、技术选型、环境变量、安装、命令、示例输入输出、已实现功能和已知问题
- `.env.example`
- 示例 JD 与演示脚本
- `Dockerfile`、`Makefile`、`.gitignore`
- npm 脚本：`build`、`test`、`lint`、`typecheck`、`demo`

## 明确不做

- OCR 或扫描件识别
- 多模态简历理解
- Web UI、数据库、用户系统或招聘后台
- 向量数据库和长期候选人存储
- 自动上传、发送或发布简历数据

这些能力超出 CLI 笔试题核心范围；扫描版 PDF 会收到“未提取到文本”的明确提示。
