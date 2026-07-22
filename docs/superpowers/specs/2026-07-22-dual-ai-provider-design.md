# DeepSeek 与 OpenAI 双提供商设计规格

## 目标

在不破坏现有 `parse`、`extract`、`score` 和 `--mock` 行为的前提下，让 AI 简历 CLI 同时支持 DeepSeek 与 OpenAI。默认使用 DeepSeek，并允许通过环境变量切换提供商。

## 提供商选择

使用 `AI_PROVIDER` 选择提供商：

- 未设置或设置为 `deepseek`：使用 DeepSeek。
- 设置为 `openai`：使用 OpenAI。
- 其他值：在任何 API 客户端创建或网络请求之前，以退出码 2 返回明确错误。

`--mock` 始终绕过提供商选择和 API Key 检查，因此现有离线演示不受影响。

## DeepSeek 配置

- API Key：`DEEPSEEK_API_KEY`
- 模型：`DEEPSEEK_MODEL`，默认 `deepseek-v4-flash`
- Base URL：固定为官方地址 `https://api.deepseek.com`

不使用即将停用的 `deepseek-chat` 别名。DeepSeek 通过 OpenAI Node SDK 的 Chat Completions 接口调用，但不会复用 OpenAI Responses API 的 Structured Outputs，因为 DeepSeek 官方兼容面提供的是 Chat Completions JSON Output。

请求设置 `response_format: { type: "json_object" }`，并在系统提示中明确包含 `JSON`、完整字段结构和只输出 JSON 的约束。响应内容先经过现有有限 JSON 修复，再通过候选人或评分 Zod Schema 校验。空 content、无效 JSON 和字段不匹配分别返回清晰错误。

## OpenAI 配置

- API Key：`OPENAI_API_KEY`
- 模型：`OPENAI_MODEL`，默认 `gpt-5.6`

保留现有 Responses API、`responses.parse` 与 `zodTextFormat` 实现。本地仍执行 Zod 二次校验。

## 架构调整

- `src/services/ai.ts`：负责提供商解析、公共提示构造和统一的 `extractCandidate` / `scoreResume` 门面。
- `src/services/openai.ts`：封装 OpenAI Responses Structured Outputs。
- `src/services/deepseek.ts`：封装 DeepSeek Chat Completions JSON Output。
- `src/services/provider.ts`：定义 `AiProvider`、环境变量解析和双提供商依赖接口。
- `src/utils/json.ts`：继续承担 DeepSeek 文本响应的有限 JSON 修复。

命令层不感知具体提供商，因而无需修改三个 CLI 命令的公共接口。AI 门面选择适配器后返回相同的 `Candidate` 或 `ScoreResult` 类型。

## 公共提示与安全边界

两个提供商共享相同的数据边界要求：简历与 JD 是不可信数据，不能改变系统规则、触发工具或要求泄露信息。不得在错误和日志中输出 API Key 或完整简历/JD。

DeepSeek 提示额外包含目标 JSON 示例，字段与现有 Zod Schema 完全一致。无法确认的字符串使用空字符串，列表使用空数组，不补造事实。

## 错误与退出码

- 未知 `AI_PROVIDER`：`UNSUPPORTED_AI_PROVIDER`，退出码 2。
- 缺少对应提供商 Key：`MISSING_API_KEY`，退出码 2，并只提示当前所需的变量。
- DeepSeek 空响应：`EMPTY_AI_RESPONSE`，退出码 1。
- 提供商请求失败：`AI_REQUEST_FAILED`，退出码 1。
- JSON 无法解析：沿用 `INVALID_AI_JSON`，退出码 1。
- Schema 校验失败：`INVALID_AI_RESPONSE`，退出码 1。

所有提供商错误向用户显示通用排查建议；安全的内部 code 可在 `--verbose` 下显示。

## 测试策略

- 提供商解析：默认 DeepSeek、显式 OpenAI、未知值在调用前失败。
- Key 隔离：DeepSeek 只要求 `DEEPSEEK_API_KEY`；OpenAI 只要求 `OPENAI_API_KEY`。
- DeepSeek：验证 base URL、默认/覆盖模型、JSON Output 参数、提示含 JSON 字样、有限 JSON 修复、空响应和请求错误。
- OpenAI：保留并迁移现有 Responses Structured Outputs 测试。
- 门面：验证 extract 与 score 把统一提示和 Schema 路由到所选适配器。
- 回归：现有 CLI 与 mock 测试全部保持通过。

## 文档变更

更新 `.env.example` 与 README：

- 默认 DeepSeek 配置和真实 API 示例。
- `AI_PROVIDER=openai` 切换示例。
- 两组模型覆盖变量。
- 说明 `--mock` 无需任何 Key。
- 说明简历文本会发送到当前选择的第三方 API。

## 明确不做

- CLI `--provider` 参数；提供商只由环境变量统一配置。
- 允许任意自定义 Base URL，避免意外把简历发送到未知地址。
- 自动回退到另一提供商，避免意外计费或数据流向变化。
- 同时调用两个模型、比较结果或合并评分。
