# Resume CLI 分发与安装设计规格

## 目标

让其他用户通过 npm Registry、Git 仓库地址或本地 `.tgz` 安装后，直接获得 `resume-cli` 命令，不需要手动进入源码目录构建或执行 `npm link`。

## 安装体验

公开 npm 包：

```bash
npm install -g sidereus-resume-cli
resume-cli --help
```

无需全局安装：

```bash
npx sidereus-resume-cli --help
```

本地安装包：

```bash
npm install -g ./sidereus-resume-cli-1.0.0.tgz
```

Git 仓库安装：

```bash
npm install -g github:<owner>/<repository>
```

npm 不允许包自身把普通本地依赖安装强制升级为全局安装；用户仍需使用 `-g`，或改用 `npx`。

## 包名与命令

- npm 包名保持 `sidereus-resume-cli`。
- 可执行命令保持 `resume-cli`。
- `package.json.bin` 继续指向 `dist/cli.js`。
- 发布前验证构建产物首行是 Node shebang，文件可被 npm 建立的 shim 执行。

当前 npm Registry 未发现同名公开包，但最终发布仍以 npm 在发布时的权限与占用检查为准。

## npm 生命周期

- `build`：只生成 `dist/cli.js` 与 source map。
- `prepare`：执行 `npm run build`，支持从 Git 仓库安装时自动构建。
- `prepack`：执行完整 `npm run check`，确保 `npm pack` 与 `npm publish` 前通过 lint、类型、测试和构建。
- 不使用 `postinstall`，避免普通消费者安装时执行不必要脚本。

`prepare` 会在开发者执行 `npm install` 时运行一次构建，但不会运行测试；完整测试只在打包或发布前运行。

## 发布内容

通过现有 `files` 白名单仅发布：

- `dist/cli.js`
- `dist/cli.js.map`
- `README.md`
- `LICENSE`
- npm 自动包含的 `package.json`

不发布源码、测试、设计文档、`.env`、`.env.example`、示例简历、Git 数据或本地日志。

补充以下元数据：

- `license: MIT`
- `keywords`
- `repository`、`bugs`、`homepage`：只有在获得真实 Git 远程地址后才写入，不能伪造占位 URL。
- `publishConfig.access: public`

若当前仓库没有远程地址，先完成不依赖 URL 的发布配置，并在 README 标记发布前应填写仓库元数据。

## 发布验证

自动化测试覆盖：

- `package.json` 的包名、bin、files、license 与 lifecycle 脚本。
- `npm pack --dry-run --json` 的文件白名单。
- 实际 `npm pack` 生成临时 tarball，在临时 npm prefix 下执行 `npm install -g <tarball>`。
- 从临时 prefix 调用生成的 `resume-cli --version` 和 `resume-cli --help`。
- 构建产物不包含 API Key 或 `.env` 内容。

验证过程不发布到 npm，不修改用户全局 npm prefix，也不需要 npm 登录。

## README

新增“给使用者”“给维护者”两部分：

- npm 全局安装、npx、`.tgz` 与 Git 安装。
- 发布前登录、身份检查、版本升级、`npm pack --dry-run`、实际发布命令。
- 明确 `npm publish` 是外部不可逆操作，必须由仓库维护者确认后手动执行。

## 不自动执行的操作

- 不执行 `npm login`。
- 不修改 npm 账号、组织或 2FA。
- 不执行 `npm publish`。
- 不创建 GitHub 仓库、远程或 release。
- 不自动提升版本号。

这些操作需要维护者的账户、版本和公开发布决策，超出本地可逆配置范围。
