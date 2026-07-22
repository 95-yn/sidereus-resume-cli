# CLI Progress and File Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TTY-safe `ora` progress feedback and actionable nearby-file suggestions without contaminating stdout or changing existing exit codes.

**Architecture:** Wrap `ora` behind a small progress interface injected into command options, and keep it disabled outside an interactive terminal. Attach structured file context to `AppError`, discover candidates with a bounded filesystem scanner, and render all guidance once at the CLI boundary.

**Tech Stack:** TypeScript ESM, Commander, ora 9.4.1, Node.js filesystem APIs, Vitest, tsup

---

## File structure

- Create `src/utils/progress.ts`: progress contract, TTY policy, silent implementation, and `ora` adapter.
- Create `src/utils/file-suggestions.ts`: bounded scanning, type filtering, similarity ranking, and display paths.
- Create `src/utils/error-output.ts`: structured rendering and shell-safe retry commands.
- Create three matching unit-test files under `tests/`.
- Modify `src/errors.ts` and the PDF, JD, and env services to expose file guidance facts.
- Modify command types, three commands, and `src/program.ts` to integrate progress and centralized rendering.
- Modify README, package tests, and the original design cross-reference.

### Task 1: Progress abstraction and ora adapter

**Files:**
- Create: `src/utils/progress.ts`
- Create: `tests/progress.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write the failing progress tests**

Create `tests/progress.test.ts`. Mock the default `ora` export with `vi.hoisted`, returning an object with `isSpinning`, `text`, `start`, `stop`, and `succeed`. Assert this policy matrix:

```ts
expect(shouldShowProgress({ stdoutIsTTY: true, stderrIsTTY: true })).toBe(true);
expect(shouldShowProgress({ stdoutIsTTY: false, stderrIsTTY: true })).toBe(false);
expect(shouldShowProgress({ stdoutIsTTY: true, stderrIsTTY: false })).toBe(false);
expect(shouldShowProgress({ stdoutIsTTY: true, stderrIsTTY: true, ci: true })).toBe(false);
expect(shouldShowProgress({ stdoutIsTTY: true, stderrIsTTY: true, disabled: true })).toBe(false);
```

Create an enabled progress instance and assert:

```ts
progress.start('正在解析 PDF…');
spinner.isSpinning = true;
progress.update('正在提取结构化信息…');
progress.stop();
progress.succeed('完成');
expect(ora).toHaveBeenCalledWith(expect.objectContaining({
  isEnabled: true,
  discardStdin: false,
}));
expect(spinner.start).toHaveBeenCalledWith('正在解析 PDF…');
expect(spinner.text).toBe('正在提取结构化信息…');
expect(spinner.stop).toHaveBeenCalled();
expect(spinner.succeed).toHaveBeenCalledWith('完成');
```

Also call every `silentProgress` method and assert none throws.

- [ ] **Step 2: Run RED**

Run `npm test -- tests/progress.test.ts`.

Expected: FAIL because `src/utils/progress.ts` does not exist.

- [ ] **Step 3: Install ora and implement the adapter**

Run `npm install ora@9.4.1`. Then create `src/utils/progress.ts`:

```ts
import ora from 'ora';

export interface Progress {
  start(text: string): void;
  update(text: string): void;
  stop(): void;
  succeed(text: string): void;
}

export interface ProgressPolicy {
  stdoutIsTTY: boolean;
  stderrIsTTY: boolean;
  ci?: boolean;
  disabled?: boolean;
}

export function shouldShowProgress(policy: ProgressPolicy): boolean {
  return Boolean(policy.stdoutIsTTY && policy.stderrIsTTY && !policy.ci && !policy.disabled);
}

export const silentProgress: Progress = {
  start: () => undefined,
  update: () => undefined,
  stop: () => undefined,
  succeed: () => undefined,
};

export function createProgress(options: {
  enabled: boolean;
  stream?: NodeJS.WriteStream;
}): Progress {
  const spinner = ora({
    isEnabled: options.enabled,
    discardStdin: false,
    ...(options.stream ? { stream: options.stream } : {}),
  });
  return {
    start: (text) => { spinner.start(text); },
    update: (text) => {
      if (spinner.isSpinning) spinner.text = text;
      else spinner.start(text);
    },
    stop: () => { spinner.stop(); },
    succeed: (text) => { spinner.succeed(text); },
  };
}
```

- [ ] **Step 4: Run GREEN and commit**

Run `npm test -- tests/progress.test.ts && npm run typecheck && npm test`.

Commit:

```bash
git add package.json package-lock.json src/utils/progress.ts tests/progress.test.ts
git commit -m "feat: add TTY-aware progress adapter"
```

### Task 2: Bounded nearby-file discovery

**Files:**
- Create: `src/utils/file-suggestions.ts`
- Create: `tests/file-suggestions.test.ts`

- [ ] **Step 1: Write failing discovery tests**

Create temporary trees with `mkdtemp`, `mkdir`, and `writeFile`. Import `suggestFiles` and cover these exact cases:

```ts
expect(await suggestFiles('resum.pdf', 'pdf', { cwd })).toEqual([
  './resume.pdf',
  './简历/张三-cv.pdf',
  './portfolio.pdf',
]);
expect(await suggestFiles('job.txt', 'jd', { cwd })).toEqual(
  expect.arrayContaining(['./backend-jd.md', './backend.txt']),
);
expect(await suggestFiles('.env.local', 'env', { cwd })).toEqual([
  './.env',
  './.env.deepseek',
]);
expect(await suggestFiles('候选人', 'pdf', { cwd })).toEqual([
  './候选人/李四 简历.pdf',
]);
```

Add fixtures proving `node_modules/resume.pdf` and a file three levels below the root are excluded, the result is capped at three, a missing parent falls back to `cwd`, and `maxEntries` stops traversal.

- [ ] **Step 2: Run RED**

Run `npm test -- tests/file-suggestions.test.ts`.

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the bounded scanner**

Create this public contract in `src/utils/file-suggestions.ts`:

```ts
export type FileSuggestionKind = 'pdf' | 'jd' | 'env';

export interface SuggestFilesOptions {
  cwd?: string;
  maxDepth?: number;
  maxEntries?: number;
  limit?: number;
}

export async function suggestFiles(
  inputPath: string,
  kind: FileSuggestionKind,
  options: SuggestFilesOptions = {},
): Promise<string[]>;
```

Implement it with `readdir(..., { withFileTypes: true })`, `stat`, and `node:path`. Use `maxDepth = 2`, `maxEntries = 500`, and `limit = 3`. Resolve against `cwd`; scan the input itself when it is a directory, otherwise its existing parent, otherwise `cwd`. Sort directory entries before traversal and count every inspected entry.

Use these filters and exclusions:

```ts
const excludedDirectories = new Set([
  '.git', 'node_modules', 'dist', 'coverage', '.next', 'build',
]);
const accepts = {
  pdf: (name: string) => /\.pdf$/i.test(name),
  jd: (name: string) => /\.(txt|md|markdown)$/i.test(name),
  env: (name: string) => /^\.env(?:\..+)?$/i.test(name),
};
```

Skip other dotfiles and all hidden directories. Catch directory permission/race failures without replacing the primary CLI error. Rank with a private dynamic-programming Levenshtein function over lowercased basenames, then path depth, then `localeCompare`. Format paths inside `cwd` as POSIX-style `./relative/path`; retain absolute paths outside it.

- [ ] **Step 4: Run GREEN and commit**

Run `npm test -- tests/file-suggestions.test.ts && npm run typecheck && npm test`.

Commit:

```bash
git add src/utils/file-suggestions.ts tests/file-suggestions.test.ts
git commit -m "feat: suggest nearby input files"
```

### Task 3: Structured file guidance and centralized rendering

**Files:**
- Modify: `src/errors.ts`
- Modify: `tests/errors.test.ts`
- Create: `src/utils/error-output.ts`
- Create: `tests/error-output.test.ts`

- [ ] **Step 1: Write failing error tests**

Extend `tests/errors.test.ts`:

```ts
const error = new AppError('PDF 文件不存在：cv.pdf', {
  code: 'PDF_NOT_FOUND',
  exitCode: 2,
  fileGuidance: { kind: 'pdf', inputPath: 'cv.pdf' },
});
expect(error.fileGuidance).toEqual({ kind: 'pdf', inputPath: 'cv.pdf' });
```

Create `tests/error-output.test.ts` with an injected `suggestFiles` mock. Assert the rendered output contains the primary error, numbered candidates, current directory, and:

```text
重试：resume-cli extract './简历/张三 cv.pdf'
```

For no candidates, assert it contains `请检查相对路径，或改用绝对路径` and no `重试：`. For an ordinary AI error, assert the complete result is only `错误：API 请求失败`. Make the suggestion mock reject and assert the primary error and current directory still render.

- [ ] **Step 2: Run RED**

Run `npm test -- tests/errors.test.ts tests/error-output.test.ts`.

- [ ] **Step 3: Extend AppError**

In `src/errors.ts`, add:

```ts
export interface FileGuidance {
  kind: FileSuggestionKind;
  inputPath: string;
}

export interface AppErrorOptions {
  code: string;
  exitCode?: 1 | 2;
  cause?: unknown;
  fileGuidance?: FileGuidance;
}
```

Add `readonly fileGuidance?: FileGuidance` to `AppError` and assign it only when present:

```ts
if (options.fileGuidance) this.fileGuidance = options.fileGuidance;
```

- [ ] **Step 4: Implement the renderer**

Create `src/utils/error-output.ts` with this contract:

```ts
export interface ErrorOutputOptions {
  cwd: string;
  args: string[];
  suggestFiles?: typeof defaultSuggestFiles;
}

export async function renderAppError(
  error: AppError,
  options: ErrorOutputOptions,
): Promise<string>;
```

Start with `错误：${error.message}`. Return immediately when `fileGuidance` is absent. Otherwise call the injected/default scanner in `try/catch`, append at most three numbered candidates, always append `当前目录`, and append either a retry or the absolute-path hint. Generate retry arguments by replacing only tokens equal to the original `inputPath`.

Use this shell quoting helper so Chinese, spaces, apostrophes, `$`, and backticks cannot execute:

```ts
function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
```

- [ ] **Step 5: Run GREEN and commit**

Run `npm test -- tests/errors.test.ts tests/error-output.test.ts && npm run typecheck && npm test`.

Commit:

```bash
git add src/errors.ts src/utils/error-output.ts tests/errors.test.ts tests/error-output.test.ts
git commit -m "feat: render actionable file errors"
```

### Task 4: Attach guidance to PDF, JD, and explicit env paths

**Files:**
- Modify: `src/services/pdf.ts`
- Modify: `src/services/jd.ts`
- Modify: `src/services/env.ts`
- Modify: `tests/pdf.test.ts`
- Modify: `tests/jd.test.ts`
- Modify: `tests/env.test.ts`

- [ ] **Step 1: Write failing service assertions**

Capture the existing missing-file and directory errors and assert these values, using each test's actual input variable:

```ts
{ code: 'PDF_NOT_FOUND', fileGuidance: { kind: 'pdf', inputPath } }
{ code: 'PDF_NOT_FILE', fileGuidance: { kind: 'pdf', inputPath } }
{ code: 'JD_NOT_FOUND', fileGuidance: { kind: 'jd', inputPath } }
{ code: 'JD_NOT_FILE', fileGuidance: { kind: 'jd', inputPath } }
{ code: 'ENV_FILE_NOT_FOUND', fileGuidance: { kind: 'env', inputPath: 'missing.env' } }
{ code: 'ENV_FILE_NOT_FILE', fileGuidance: { kind: 'env', inputPath: 'config.env' } }
```

Keep the existing assertion that an absent implicit `.env` succeeds silently.

- [ ] **Step 2: Run RED**

Run `npm test -- tests/pdf.test.ts tests/jd.test.ts tests/env.test.ts`.

- [ ] **Step 3: Add facts without changing service messages**

Add `fileGuidance: { kind: 'pdf', inputPath }` to missing and not-file PDF errors, and the corresponding JD value to missing and not-file JD errors. For env errors, attach guidance only when `options.envFile` was explicit:

```ts
...(explicit
  ? { fileGuidance: { kind: 'env' as const, inputPath: options.envFile! } }
  : {}),
```

Do not attach suggestions to invalid PDF content, empty PDF/JD, PDF parsing failures, or dotenv parsing failures.

- [ ] **Step 4: Run GREEN and commit**

Run `npm test -- tests/pdf.test.ts tests/jd.test.ts tests/env.test.ts && npm run typecheck && npm test`.

Commit:

```bash
git add src/services/pdf.ts src/services/jd.ts src/services/env.ts tests/pdf.test.ts tests/jd.test.ts tests/env.test.ts
git commit -m "feat: add guidance context to file errors"
```

### Task 5: Integrate command stages and CLI runtime policy

**Files:**
- Modify: `src/types.ts`
- Modify: `src/commands/parse.ts`
- Modify: `src/commands/extract.ts`
- Modify: `src/commands/score.ts`
- Modify: `src/program.ts`
- Modify: `tests/commands.test.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Write failing command-stage tests**

Create a fake with `start`, `update`, `stop`, and `succeed` spies. Assert:

- parse starts `正在读取并解析 PDF…`;
- extract starts `正在解析 PDF…` then updates to `正在提取结构化信息…`;
- score starts `正在读取简历与 JD…` then updates to `正在分析匹配度…`;
- all successful commands stop before `writeResult` and succeed with `完成` after it;
- rejected input reads, AI calls, or output writes stop and never succeed.

- [ ] **Step 2: Write failing CLI tests**

Extend the dependency fixture with `renderAppError`. Extend IO with TTY flags and a `progressFactory`. Assert an interactive command calls the factory with `true`, a piped stdout calls it with `false`, and this command calls it with `false`:

```ts
await runCli(['--no-progress', 'parse', 'resume.pdf'], deps, ttyIo);
```

Make `renderAppError` resolve to `错误：友好提示` and assert the CLI writes that exact string. Preserve the existing clean-JSON assertion.

- [ ] **Step 3: Run RED**

Run `npm test -- tests/commands.test.ts tests/cli.test.ts`.

- [ ] **Step 4: Inject progress into commands**

In `src/types.ts` add `progress?: Progress` to `CommonCommandOptions`. Each command uses `options.progress ?? silentProgress` and follows:

```ts
progress.start('阶段文字');
try {
  const result = await operation();
  progress.update('第二阶段文字'); // extract and score only
  const finalResult = await remainingOperation(result);
  progress.stop();
  await dependencies.writeResult(finalResult, outputOptions);
  progress.succeed('完成');
} catch (error) {
  progress.stop();
  throw error;
}
```

Keep PDF/JD reads parallel, schemas, mock selection, and stdout/output-file behavior unchanged. Do not call `succeed` in `finally`.

- [ ] **Step 5: Integrate the root option and renderer**

In `src/program.ts`:

- add required `renderAppError` to `ProgramDependencies` and defaults;
- add optional `stdoutIsTTY`, `stderrIsTTY`, and `progressFactory` to `ProgramIo`;
- populate the default IO from `process.stdout.isTTY`, `process.stderr.isTTY`, and `createProgress({ enabled, stream: process.stderr })`;
- register `.option('--no-progress', '关闭动态进度提示')`;
- create one progress per action using `shouldShowProgress` with both TTY facts, `Boolean(process.env.CI)`, and `program.opts().progress === false`;
- fall back to `silentProgress` when tests do not inject a factory;
- pass the progress into command options;
- replace direct error formatting with:

```ts
io.stderr(await dependencies.renderAppError(appError, {
  cwd: process.cwd(),
  args,
}));
```

Keep verbose code output after the rendered message and preserve Commander help/version handling.

- [ ] **Step 6: Run GREEN and commit**

Run `npm test -- tests/commands.test.ts tests/cli.test.ts && npm run typecheck && npm test`.

Commit:

```bash
git add src/types.ts src/commands src/program.ts tests/commands.test.ts tests/cli.test.ts
git commit -m "feat: add command progress and friendly errors"
```

### Task 6: Documentation and distribution verification

**Files:**
- Modify: `README.md`
- Modify: `tests/package.test.ts`
- Modify: `docs/superpowers/specs/2026-07-22-resume-cli-design.md`

- [ ] **Step 1: Extend the package contract**

Add to `tests/package.test.ts`:

```ts
expect(pkg.dependencies.ora).toBe('^9.4.1');
expect(pkg.scripts.postinstall).toBeUndefined();
```

Run `npm test -- tests/package.test.ts`; expect PASS because Task 1 installed ora without adding a consumer hook.

- [ ] **Step 2: Document the new UX**

Update README with the command phase texts, stderr-only behavior, automatic CI/non-TTY disablement, `resume-cli --no-progress extract ./resume.pdf`, a missing-file example, the two-level/three-result scan limit, exclusions, and the guarantee that candidates are listed but never opened automatically. Link the approved UX design from the original design specification.

- [ ] **Step 3: Run the complete quality gate**

Run:

```bash
! rg -n "WIP|XXX|待补充" README.md docs/superpowers/specs/2026-07-22-cli-progress-file-guidance-design.md
git diff --check
npm run lint
npm run typecheck
npm test
npm run build
npm pack --dry-run --json
npm audit --omit=dev
```

Expected: no placeholders or whitespace errors, all tests pass, production audit reports zero vulnerabilities, and the tarball contains only `LICENSE`, `README.md`, `dist/cli.js`, `dist/cli.js.map`, and `package.json`.

- [ ] **Step 4: Verify an isolated real installation**

Run `npm pack --json`, install `sidereus-resume-cli-1.0.0.tgz` under the exact unused prefix `/tmp/resume-cli-ux-install`, and execute:

```bash
/tmp/resume-cli-ux-install/bin/resume-cli --version
/tmp/resume-cli-ux-install/bin/resume-cli --help
/tmp/resume-cli-ux-install/bin/resume-cli parse missing.pdf
```

Expected: version `1.0.0`; help contains `--no-progress`; the missing PDF exits `2` and displays current-directory guidance. Move the exact tarball and isolated prefix to the user's Trash after verification. Do not touch the user's global npm installation and do not publish.

- [ ] **Step 5: Commit and final review**

```bash
git add README.md tests/package.test.ts docs/superpowers/specs/2026-07-22-resume-cli-design.md
git commit -m "docs: explain CLI progress and file guidance"
```

Run `git status --short`, `git log --oneline master..HEAD`, and a fresh `npm test`. Confirm the worktree is clean and neither `.env` nor a tarball is tracked.
