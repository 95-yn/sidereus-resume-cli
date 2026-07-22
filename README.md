# Resume CLI

一个使用 TypeScript 编写的 AI 简历解析命令行工具。它可以读取本地 PDF 简历、提取结构化候选人信息，并根据岗位描述（JD）生成匹配评分与面试问题。

项目提供确定性的 `--mock` 模式，不配置 API Key 也能完整演示。非 mock 模式默认使用 DeepSeek，也可以通过环境变量切换到 OpenAI；两个提供商的结果都会在本地使用 Zod 校验。

## 技术选型

- Node.js 20+、TypeScript、ESM
- Commander：CLI 参数与帮助信息
- pdf-parse：PDF 文本提取
- OpenAI Node SDK：调用 DeepSeek 的兼容接口和 OpenAI 原生接口
- Zod：运行时数据校验
- Vitest：单元与 CLI 集成测试
- tsup：生成可执行的 ESM 包

## 项目结构

```text
src/
  commands/     # parse、extract、score 用例编排
  schemas/      # 候选人和评分结果的数据契约
  services/     # PDF、JD、DeepSeek、OpenAI 与 mock 适配器
  utils/        # 输出、日志和 JSON 修复
  cli.ts        # 可执行入口
  program.ts    # Commander 程序与退出码处理
tests/          # 单元测试和 CLI 集成测试
examples/       # 示例 JD；演示脚本会在此生成 PDF
scripts/        # 创建演示 PDF
```

## 安装

要求 Node.js 20 或更高版本。

```bash
npm ci
npm run build
npm link
resume-cli --help
```

也可以不执行 `npm link`，直接运行：

```bash
node dist/cli.js --help
```

## 环境变量

CLI 默认自动读取**当前工作目录**的 `.env`。先从示例创建本地配置：

```bash
cp .env.example .env
```

编辑 `.env`；默认提供商是 DeepSeek：

```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-v4-flash
```

然后直接运行：

```bash
resume-cli extract ./resume.pdf
```

构建后或全局安装的 CLI 可以显式指定任意配置文件。全局选项建议放在子命令之前：

```bash
resume-cli --env-file "$HOME/.config/resume-cli.env" extract ./resume.pdf
node dist/cli.js --env-file ./config/resume.env score ./resume.pdf --jd ./examples/jd.txt
```

切换到 OpenAI 时，在配置文件中设置：

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.6
```

shell、CI 或容器已经设置的变量优先，不会被配置文件覆盖。默认 `.env` 不存在时会继续运行；显式 `--env-file` 不存在或不可读时会给出明确错误。`--mock` 不需要 API Key，`--help` 和 `--version` 也不会加载配置文件。

DeepSeek 默认使用 `deepseek-v4-flash` 和官方固定地址 `https://api.deepseek.com`，通过 Chat Completions JSON Output 返回数据；OpenAI 使用 Responses API Structured Outputs，默认模型为 `gpt-5.6`。工具不会在提供商失败时自动切换到另一个 API，避免意外计费或改变简历数据流向。

## CLI 命令

### 1. 解析 PDF 文本

```bash
resume-cli parse ./resume.pdf
resume-cli parse ./resume.pdf --output ./result/resume.txt
```

### 2. 提取结构化信息

```bash
resume-cli extract ./resume.pdf
resume-cli extract ./resume.pdf --mock
resume-cli extract ./resume.pdf --mock --output ./result/candidate.json
```

输出示例：

```json
{
  "name": "Ada Lovelace",
  "phone": "+86 138-0013-8000",
  "email": "ada@example.com",
  "city": "",
  "education": [],
  "skills": ["TypeScript", "Node.js", "React"]
}
```

### 3. JD 匹配评分

```bash
resume-cli score ./resume.pdf --jd ./examples/jd.txt
resume-cli score ./resume.pdf --jd ./examples/jd.txt --mock
resume-cli score ./resume.pdf --jd ./examples/jd.txt --mock --output ./result/score.json
```

输出示例：

```json
{
  "overall_score": 82,
  "skill_score": 88,
  "experience_score": 80,
  "education_score": 75,
  "comment": "候选人的主要全栈技能与岗位要求较匹配。",
  "interview_questions": [
    "请介绍一个你主导过的全栈项目。",
    "你如何测试依赖大模型 API 的功能？"
  ]
}
```

所有命令支持 `--help`。根命令的 `--verbose` 选项输出安全的诊断信息，例如：

```bash
resume-cli --verbose extract ./resume.pdf --mock
```

诊断日志和保存提示写入 stderr，文本或 JSON 结果写入 stdout，便于管道调用。

## 离线演示

一条命令会生成示例 PDF，并依次执行三个核心流程：

```bash
npm run demo
```

也可以逐步演示：

```bash
npm run build
npm run demo:pdf
node dist/cli.js parse examples/resume.pdf
node dist/cli.js extract examples/resume.pdf --mock
node dist/cli.js score examples/resume.pdf --jd examples/jd.txt --mock
```

## 测试与质量检查

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run check
```

测试覆盖文件异常、PDF 签名与空文本、Schema 边界、AI 错误映射、mock 稳定性、输出文件以及 CLI 参数和退出码。

## Docker

```bash
docker build -t resume-cli .
docker run --rm resume-cli --help
docker run --rm -v "$PWD:/data:ro" resume-cli parse /data/resume.pdf
docker run --rm --env-file .env -v "$PWD:/data:ro" resume-cli score /data/resume.pdf --jd /data/examples/jd.txt
docker run --rm -v "$PWD:/data:ro" resume-cli --env-file /data/resume.env extract /data/resume.pdf
```

也可以使用 `make install`、`make check`、`make build` 和 `make demo`。

## 已实现功能

- 三个必需命令：`parse`、`extract`、`score`
- PDF、JD 和 AI 调用的分层错误提示与稳定退出码
- DeepSeek JSON Output、有限 JSON 修复与本地 Zod 校验
- OpenAI Responses Structured Outputs 与本地 Zod 二次校验
- `AI_PROVIDER` 双提供商选择，默认 DeepSeek、无自动回退
- 自动读取当前目录 `.env`，并支持全局 `--env-file <path>`
- `--mock` 离线演示模式
- `--output` 保存文本或 JSON
- Markdown 围栏、外围文字、BOM 和尾随逗号的有限 JSON 修复工具
- `--verbose` 安全日志
- Dockerfile、Makefile、自动化测试与演示 PDF 生成器

## 安全与隐私

- 简历和 JD 只在本地读取；非 mock 命令会把文本发送给 `AI_PROVIDER` 当前选择的 DeepSeek 或 OpenAI API。
- 日志不会输出 API Key 或完整简历正文。
- 系统提示将简历和 JD 视为不可信数据，忽略其中试图改变分析规则的指令。
- 不要将真实 API Key、真实简历或输出结果提交到公开仓库。

## 已知问题与未完成内容

- 只支持含文本层的 PDF；扫描件或图片 PDF 需要先执行 OCR。
- mock 模式是关键词规则演示，不代表真实招聘结论。
- 不支持 DOCX、图片简历、多语言 OCR、Web UI、数据库或候选人长期存储。
- 非 mock 结果会受到所选提供商的模型权限、额度、网络与输入质量影响。

## 退出码

- `0`：成功或显示帮助/版本
- `2`：用户输入错误，例如文件不存在、格式错误、空内容或缺少参数/API Key
- `1`：PDF 解析、AI 请求或其他运行错误
