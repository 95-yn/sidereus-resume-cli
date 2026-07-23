# Sidereus Resume CLI GitHub Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brand the completed CLI as Sidereus Resume CLI and publish the verified source repository to the public GitHub repository `95-yn/sidereus-resume-cli` with `main` as its default branch.

**Architecture:** The existing `codex/cli-ux` worktree is the single publication source. Only project-facing documentation changes locally; the implementation, package name, and `resume-cli` executable remain unchanged. Publication uses GitHub CLI for repository creation and standard Git for a non-force push from the verified local HEAD to remote `main`.

**Tech Stack:** Git, GitHub CLI, Node.js 20+, npm, TypeScript, Vitest, ESLint, tsup

---

### Task 1: Apply the approved project name to public documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README title**

Change the first line from:

```markdown
# Resume CLI
```

to:

```markdown
# Sidereus Resume CLI
```

- [ ] **Step 2: Replace the placeholder GitHub installation example**

Replace the generic owner/repository instructions and command with:

```markdown
也可以直接从 GitHub 安装：

```bash
npm install -g github:95-yn/sidereus-resume-cli
resume-cli --help
```
```

- [ ] **Step 3: Check the documentation diff**

Run:

```bash
git diff --check
git diff -- README.md
```

Expected: no whitespace errors; only the approved title and GitHub installation text change.

- [ ] **Step 4: Commit the branding update**

Run:

```bash
git add README.md
git commit -m "docs: brand project as Sidereus Resume CLI"
```

Expected: one new commit containing only `README.md`.

### Task 2: Verify the final implementation and publication source

**Files:**
- Verify: `package.json`
- Verify: `src/**`
- Verify: `tests/**`
- Verify: `.gitignore`

- [ ] **Step 1: Run the complete project check**

Run:

```bash
npm run check
```

Expected: ESLint exits successfully, TypeScript reports no errors, all 149 tests pass, and tsup builds `dist/cli.js`.

- [ ] **Step 2: Confirm branch ancestry and clean state**

Run:

```bash
git status --short --branch
git merge-base --is-ancestor master HEAD
git log -1 --oneline
```

Expected: branch is `codex/cli-ux`, the working tree is clean, and the command exits successfully.

- [ ] **Step 3: Review the exact tracked publication set**

Run:

```bash
git ls-files | sort
```

Expected: source, tests, examples, scripts, README, LICENSE, package metadata, and project documentation are present; generated artifacts are absent.

### Task 3: Prove secrets and local artifacts are excluded

**Files:**
- Verify: `.gitignore`
- Verify: all tracked Git objects

- [ ] **Step 1: Check forbidden tracked paths**

Run:

```bash
if git ls-files | rg '(^|/)\.env$|^demo-output/|(^|/)node_modules/|(^|/)dist/|(^|/)coverage/|examples/resume\.pdf$'; then
  exit 1
fi
```

Expected: no output and exit code 0.

- [ ] **Step 2: Compare the configured DeepSeek key against tracked files and history**

Run from the implementation worktree:

```bash
secret_value=$(sed -n 's/^DEEPSEEK_API_KEY=//p' ../../.env | head -n 1)
test -n "$secret_value"
if git grep -aFq "$secret_value"; then exit 1; fi
if git log -p --all | LC_ALL=C grep -aFq "$secret_value"; then exit 1; fi
```

Expected: all commands exit successfully and the secret value is never printed.

- [ ] **Step 3: Confirm environment and generated files remain ignored**

Run:

```bash
git check-ignore -v ../../.env examples/resume.pdf dist/cli.js
```

Expected: each path is associated with an ignore rule; no secret content is displayed.

### Task 4: Create and publish the GitHub repository

**Files:**
- External create: `https://github.com/95-yn/sidereus-resume-cli`
- Modify shared Git configuration: add remote `origin`

- [ ] **Step 1: Reconfirm authentication and repository availability**

Run:

```bash
gh auth status
if gh repo view 95-yn/sidereus-resume-cli >/dev/null 2>&1; then exit 1; fi
```

Expected: GitHub account `95-yn` is authenticated and the repository does not already exist.

- [ ] **Step 2: Create the empty public repository**

Run:

```bash
gh repo create 95-yn/sidereus-resume-cli \
  --public \
  --description "AI-powered TypeScript CLI for PDF resume parsing and JD matching"
```

Expected: GitHub returns `https://github.com/95-yn/sidereus-resume-cli`.

- [ ] **Step 3: Add the HTTPS remote without embedded credentials**

Run:

```bash
git remote add origin https://github.com/95-yn/sidereus-resume-cli.git
git remote -v
```

Expected: fetch and push URLs use plain HTTPS and contain no token.

- [ ] **Step 4: Push the verified local HEAD to remote main**

Run:

```bash
git push -u origin HEAD:main
```

Expected: a new remote branch `main` is created without force-pushing.

- [ ] **Step 5: Set the GitHub default branch**

Run:

```bash
gh repo edit 95-yn/sidereus-resume-cli --default-branch main
```

Expected: command exits successfully.

### Task 5: Verify the public remote and hand off the link

**Files:**
- Verify external repository: `https://github.com/95-yn/sidereus-resume-cli`

- [ ] **Step 1: Compare local and remote commit IDs**

Run:

```bash
local_head=$(git rev-parse HEAD)
remote_head=$(git ls-remote origin refs/heads/main | awk '{print $1}')
test "$local_head" = "$remote_head"
```

Expected: exit code 0.

- [ ] **Step 2: Verify repository visibility and default branch**

Run:

```bash
gh repo view 95-yn/sidereus-resume-cli \
  --json nameWithOwner,visibility,defaultBranchRef,url
```

Expected: `visibility` is `PUBLIC`, `defaultBranchRef.name` is `main`, and the URL matches the approved repository.

- [ ] **Step 3: Verify required remote files**

Run:

```bash
for path in README.md LICENSE package.json src/cli.ts tests/cli.test.ts; do
  gh api "repos/95-yn/sidereus-resume-cli/contents/$path?ref=main" --silent
done
```

Expected: all requests exit successfully.

- [ ] **Step 4: Run the final local verification gate**

Run:

```bash
git status --short --branch
npm run check
```

Expected: the working tree is clean and the complete project check passes again.

- [ ] **Step 5: Report the public repository URL**

Return:

```text
https://github.com/95-yn/sidereus-resume-cli
```

Also report the pushed commit ID, default branch, visibility, and the successful test count.
