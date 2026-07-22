# CLI 环境配置加载设计规格

## 目标

让源码运行、构建后的 `dist/cli.js` 和通过 `npm link` 安装的 `resume-cli` 都能方便地加载 API 配置，同时保持环境变量覆盖规则明确且不泄露密钥。

## 使用方式

默认自动读取当前工作目录的 `.env`：

```bash
resume-cli extract ./resume.pdf
```

允许显式指定配置文件：

```bash
resume-cli --env-file /absolute/path/to/resume.env extract ./resume.pdf
```

`--env-file` 是根命令全局选项，推荐放在子命令之前。其路径基于调用 CLI 时的当前工作目录解析，而不是基于可执行文件或安装目录解析。

## 加载与优先级

1. 如果提供 `--env-file <path>`，必须读取指定文件；文件不存在、不是普通文件或无法解析时返回退出码 2。
2. 如果没有 `--env-file`，尝试读取当前工作目录的 `.env`；不存在时静默继续。
3. shell 或父进程中已存在的变量优先，配置文件不得覆盖。
4. 一个进程只加载一个配置文件；显式文件不会与默认 `.env` 合并。
5. 配置加载在任何 AI 提供商解析、API Key 检查或网络客户端创建之前完成。

使用 `dotenv` 的 `config({ path, override: false })` 实现，避免依赖 Node 20 小版本才提供的内置 API。`tsup` 将其随 CLI 正常打包，构建产物仍只需要现有生产依赖安装。

## CLI 行为

- `--help` 和 `--version` 不需要 `.env`，也不因默认 `.env` 缺失而失败。
- `--mock` 不需要 API Key，但若显式提供了错误的 `--env-file`，仍报告配置路径错误，因为用户明确要求读取该文件。
- `parse` 不需要 API Key，同样遵守显式配置文件错误规则。
- 默认 `.env` 不存在时，非 mock AI 命令继续走现有的提供商 Key 缺失提示。

## 模块边界

- `src/services/env.ts`：解析路径、检查显式/默认文件、调用 dotenv、把解析或文件错误映射为 `AppError`。
- `src/program.ts`：注册 `--env-file`，在命令 action 执行前加载配置。
- `src/cli.ts`：保持仅负责调用 `runCli` 和设置退出码。

为了让已经构造的默认 AI 依赖读取加载后的变量，AI 服务继续在调用时读取 `process.env`，不在模块导入时缓存 Key 或提供商。

## 安全

- 错误和日志只显示配置文件路径及错误类型，不输出文件内容或变量值。
- `.env` 继续由 `.gitignore` 排除。
- 配置文件不支持远程 URL、命令替换或脚本执行；只使用 dotenv 的键值解析。
- 显式环境变量不被配置文件覆盖，方便 CI、容器和密钥管理系统控制最终值。

## 测试

- 默认 `.env` 存在时加载 DeepSeek 配置。
- 默认 `.env` 不存在时不报错。
- 显式 `--env-file` 可以加载任意文件名。
- 显式文件不存在、是目录或解析失败时返回用户错误。
- shell 变量优先于文件值。
- CLI 在加载后再调用命令依赖。
- 构建后的 CLI 使用临时工作目录 `.env` 成功进入 DeepSeek 请求路径；用注入客户端/缺失 Key 信号验证，不发送真实网络请求。
- 所有现有 mock、DeepSeek、OpenAI 与 CLI 测试保持通过。

## 文档

README 增加默认 `.env`、`--env-file`、全局 CLI 和 Docker `--env-file` 示例，并删除“CLI 不会自动读取 `.env`”的旧说明。
