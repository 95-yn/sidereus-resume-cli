# CLI Environment Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically load `.env` from the caller's working directory and support an explicit global `--env-file` option in the built CLI.

**Architecture:** A focused environment service resolves and validates the selected file, then uses dotenv without overriding parent-process variables. Commander registers a global option and loads configuration in a pre-action hook so provider selection happens afterward. Help/version stay side-effect free.

**Tech Stack:** TypeScript, Commander, dotenv, Vitest, tsup

---

### Task 1: Environment loading service

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/services/env.ts`
- Create: `tests/env.test.ts`

- [ ] **Step 1: Install dotenv as a runtime dependency**

Run `npm install dotenv`, retain the resolved semver range and lockfile, and verify it supports `config({ path, override: false })`.

- [ ] **Step 2: Write failing service tests**

Use temporary directories and an injected environment object. Test default `.env`, missing default file, explicit arbitrary filename, missing explicit file, explicit directory, malformed dotenv result, and parent environment precedence. Tests must never use real keys.

- [ ] **Step 3: Run RED**

Run `npm test -- tests/env.test.ts`; expect missing `src/services/env.ts`.

- [ ] **Step 4: Implement `loadEnvironment(options)`**

Accept `{ cwd, env, envFile, parseFile? }`. Resolve `envFile ?? '.env'` from `cwd`; default missing files return without change, while explicit invalid paths throw exit-code-2 `AppError` codes `ENV_FILE_NOT_FOUND`, `ENV_FILE_NOT_FILE`, or `ENV_FILE_INVALID`. Call dotenv with `processEnv: env`, `override: false`, and never include variable values in error messages.

- [ ] **Step 5: Run GREEN and commit**

Run environment tests and typecheck, then commit the service and dependency changes.

### Task 2: Commander integration

**Files:**
- Modify: `src/program.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Add failing CLI tests**

Inject `loadEnvironment` through `ProgramDependencies`. Verify `--env-file config/resume.env` is passed before the extract dependency runs, default loading receives no explicit path, help/version do not load, and a typed loading error maps to exit code 2.

- [ ] **Step 2: Run RED**

Run `npm test -- tests/cli.test.ts`; expect missing dependency/option behavior.

- [ ] **Step 3: Register and load configuration**

Add root option `--env-file <path>`. Add a `preAction` hook that reads root options and calls the injected loader once with `process.cwd()` and `process.env`. Keep the existing output/error boundary and ensure subcommands receive the environment after loading.

- [ ] **Step 4: Run GREEN and commit**

Run CLI tests, full tests, typecheck, and build, then commit.

### Task 3: Documentation and built CLI validation

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-22-resume-cli-design.md`

- [ ] **Step 1: Update README configuration instructions**

Document automatic current-directory `.env`, explicit `--env-file`, shell precedence, global `npm link` use, Docker `--env-file`, and mock behavior. Remove the prior statement that the CLI never loads `.env`.

- [ ] **Step 2: Add a supersession note to the original design**

Link the environment-loading specification and state that it supersedes the original no-auto-load behavior.

- [ ] **Step 3: Validate the built executable**

Build the CLI, run it from a temporary directory containing a fake DeepSeek `.env`, and confirm the error changes from `MISSING_API_KEY` to a provider request error without printing the fake key. Repeat with `--env-file` and a non-default filename. No successful network call is required.

- [ ] **Step 4: Run full quality gate**

Run `npm run demo`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm pack --dry-run`, `npm audit --omit=dev`, and `git diff --check`.

- [ ] **Step 5: Commit documentation and verified adjustments**

Stage only intended files, commit, and hand off for branch integration.
