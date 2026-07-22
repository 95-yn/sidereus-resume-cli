# Resume CLI Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make npm, npx, Git, and tarball installs expose a working `resume-cli` command without manual builds.

**Architecture:** Keep npm's existing `bin` shim contract and add lifecycle scripts that build Git installs and gate packed artifacts. Verify metadata in Vitest, then install a real tarball into an isolated temporary npm prefix and execute its generated command.

**Tech Stack:** npm lifecycle scripts, TypeScript/Vitest, tsup, POSIX shell verification

---

### Task 1: Package distribution contract

**Files:**
- Create: `tests/package.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write failing package metadata tests**

Read `package.json` and assert:

```ts
expect(pkg.name).toBe('sidereus-resume-cli');
expect(pkg.bin).toEqual({ 'resume-cli': 'dist/cli.js' });
expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'README.md', 'LICENSE']));
expect(pkg.license).toBe('MIT');
expect(pkg.publishConfig).toEqual({ access: 'public' });
expect(pkg.scripts.prepare).toBe('npm run build');
expect(pkg.scripts.prepack).toBe('npm run check');
```

Also assert there is no `postinstall` script and keywords include `resume`, `cli`, `deepseek`, and `openai`.

- [ ] **Step 2: Run RED**

Run `npm test -- tests/package.test.ts`; expect missing metadata/lifecycle assertions to fail.

- [ ] **Step 3: Implement package metadata and lifecycle scripts**

Add `license`, `keywords`, `publishConfig`, `prepare`, and `prepack`. Preserve the package name, version, bin, files whitelist, engine, and existing scripts. Do not add fake repository URLs.

- [ ] **Step 4: Refresh lockfile and run GREEN**

Run `npm install --package-lock-only`, the package test, typecheck, and full tests, then commit.

### Task 2: Packed artifact verification

**Files:**
- No repository files required unless verification finds a packaging defect

- [ ] **Step 1: Run dry-run pack inspection**

Run `npm pack --dry-run --json`. Verify the returned file list contains only `LICENSE`, `README.md`, `dist/cli.js`, `dist/cli.js.map`, and `package.json`, and that no `.env`, source, tests, docs, or examples appear.

- [ ] **Step 2: Check executable build output**

Run `npm run build`, verify `dist/cli.js` begins with `#!/usr/bin/env node`, and run `node dist/cli.js --version`.

- [ ] **Step 3: Build a real tarball**

Run `npm pack --json`, capture the generated tarball filename, and retain it only for the temporary install test. The prepack hook must run the full quality gate successfully.

- [ ] **Step 4: Install into an isolated prefix**

Create a temporary directory with `mktemp -d`, run `npm install -g --prefix <temp> ./<tarball>`, then execute `<temp>/bin/resume-cli --version` and `--help`. Verify version `1.0.0` and a zero exit code.

- [ ] **Step 5: Remove the generated tarball**

Delete only the exact tarball created in Step 3, verify `git status --short` contains no artifact, and leave the user's global npm installation untouched.

### Task 3: Distribution documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-22-resume-cli-design.md`

- [ ] **Step 1: Add user installation methods**

Document `npm install -g sidereus-resume-cli`, `npx sidereus-resume-cli`, tarball install, and Git repository install. Explain that Git installs use `prepare`, while published/tarball installs include `dist`.

- [ ] **Step 2: Add maintainer release procedure**

Document `npm login`, `npm whoami`, semantic version update, `npm pack --dry-run`, local tarball smoke test, and the deliberately manual `npm publish --access public`. State that repository metadata should be added once a real remote exists.

- [ ] **Step 3: Link the distribution design**

Add a supersession note in the original design that packaging and install behavior is governed by the distribution specification.

- [ ] **Step 4: Validate docs and commit**

Run placeholder scan and `git diff --check`, then commit documentation.

### Task 4: Complete verification

**Files:**
- No new production files expected

- [ ] **Step 1: Run the full quality gate**

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm pack --dry-run`, `npm audit --omit=dev`, and `git diff --check`.

- [ ] **Step 2: Review requirements**

Confirm npm global install, npx bin discovery, Git prepare build, tarball contents, no consumer postinstall, no sensitive files, docs, and no actual publish action.

- [ ] **Step 3: Commit any final verified adjustment**

Stage only intended files and hand off for branch integration.
