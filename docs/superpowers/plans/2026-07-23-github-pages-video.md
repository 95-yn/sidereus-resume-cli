# Sidereus Resume CLI GitHub Pages Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a directly playable, mobile-friendly demo page at `https://95-yn.github.io/sidereus-resume-cli/` without adding video assets to the project’s `main` branch.

**Architecture:** Push the approved design documentation to `main`, then create an orphan `gh-pages` branch from a temporary clone. The Pages branch contains one self-contained HTML page, the verified MP4, a poster image, and `.nojekyll`; GitHub Pages serves the branch root over HTTPS.

**Tech Stack:** Static HTML5, CSS, vanilla JavaScript, native `<video>`, Git, GitHub CLI, GitHub Pages

---

### Task 1: Publish the approved Pages design documentation

**Files:**
- Verify: `docs/superpowers/specs/2026-07-23-github-pages-video-design.md`

- [ ] **Step 1: Verify the source branch is clean and tested**

Run:

```bash
git status --short --branch
npm run check
```

Expected: the worktree is clean; ESLint, TypeScript, all 149 tests, and the build pass.

- [ ] **Step 2: Push the design commit to remote main**

Run:

```bash
git push origin HEAD:main
```

Expected: remote `main` advances to the local HEAD without force-pushing.

### Task 2: Create the isolated GitHub Pages branch

**Files:**
- Create in temporary clone: `.nojekyll`
- Create in temporary clone: `index.html`
- Copy into temporary clone: `poster.png`
- Copy into temporary clone: `sidereus-resume-cli-demo-v1.0.0.mp4`

- [ ] **Step 1: Prepare a clean temporary clone**

Run:

```bash
pages_dir=/tmp/sidereus-resume-cli-pages-20260723
if [ -e "$pages_dir" ]; then
  mv "$pages_dir" "$HOME/.Trash/sidereus-resume-cli-pages-20260723-$(date +%s)"
fi
git clone --no-checkout https://github.com/95-yn/sidereus-resume-cli.git "$pages_dir"
git -C "$pages_dir" switch --orphan gh-pages
```

Expected: the temporary repository is on a new orphan branch named `gh-pages` with an empty worktree.

- [ ] **Step 2: Create the no-Jekyll marker**

Create `/tmp/sidereus-resume-cli-pages-20260723/.nojekyll` as an empty file using `apply_patch`.

- [ ] **Step 3: Create the player page**

Create `/tmp/sidereus-resume-cli-pages-20260723/index.html` using `apply_patch` with this complete content:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Sidereus Resume CLI — DeepSeek 实时演示视频">
  <title>Sidereus Resume CLI · DeepSeek Live Demo</title>
  <style>
    :root {
      color-scheme: dark;
      --ink: #f4f2eb;
      --muted: #9ba4b7;
      --line: rgba(141, 219, 226, .2);
      --accent: #8ddbe2;
      --panel: #111827;
      --void: #080c14;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      background:
        radial-gradient(circle at 82% 0%, rgba(56, 189, 201, .12), transparent 34rem),
        linear-gradient(135deg, #080c14, #0d1320 55%, #080c14);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: .18;
      background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px);
      background-size: 100% 4px;
    }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 64px 0 48px; }
    header { display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: end; margin-bottom: 28px; }
    .eyebrow { color: var(--accent); letter-spacing: .16em; text-transform: uppercase; font-size: 12px; }
    h1 { max-width: 820px; margin: 12px 0 10px; font-size: clamp(36px, 6vw, 76px); line-height: .98; letter-spacing: -.055em; }
    .lede { margin: 0; color: var(--muted); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 17px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .button {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0 16px;
      border: 1px solid var(--line);
      color: var(--ink);
      text-decoration: none;
      background: rgba(17, 24, 39, .74);
      transition: border-color .2s ease, transform .2s ease;
    }
    .button:hover { border-color: var(--accent); transform: translateY(-2px); }
    .button:focus-visible, .chapter:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
    .player-shell { overflow: hidden; border: 1px solid var(--line); background: var(--panel); box-shadow: 0 28px 80px rgba(0,0,0,.38); }
    .window-bar { display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 16px; border-bottom: 1px solid var(--line); }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #f28b82; }
    .dot:nth-child(2) { background: #fdd663; }
    .dot:nth-child(3) { background: #81c995; }
    .window-title { margin-left: 8px; color: var(--muted); font-size: 12px; }
    video { display: block; width: 100%; aspect-ratio: 16 / 9; background: #090d17; }
    .chapters { display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid var(--line); border-top: 0; }
    .chapter {
      min-width: 0;
      padding: 18px;
      color: var(--ink);
      text-align: left;
      border: 0;
      border-right: 1px solid var(--line);
      background: rgba(10, 15, 25, .82);
      cursor: pointer;
    }
    .chapter:last-child { border-right: 0; }
    .chapter:hover { background: rgba(141, 219, 226, .09); }
    .time { display: block; color: var(--accent); margin-bottom: 8px; font-size: 12px; }
    .name { display: block; overflow: hidden; text-overflow: ellipsis; font-weight: 700; }
    footer { display: flex; justify-content: space-between; gap: 24px; margin-top: 24px; color: var(--muted); font-size: 12px; }
    @media (max-width: 820px) {
      main { padding-top: 36px; }
      header { grid-template-columns: 1fr; align-items: start; }
      .chapters { grid-template-columns: 1fr; }
      .chapter { border-right: 0; border-bottom: 1px solid var(--line); }
      .chapter:last-child { border-bottom: 0; }
      footer { flex-direction: column; }
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      .button { transition: none; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <div class="eyebrow">DeepSeek Live Demo · TypeScript CLI</div>
        <h1>Sidereus<br>Resume CLI</h1>
        <p class="lede">PDF 简历解析、结构化提取与 JD 匹配评分。</p>
      </div>
      <nav class="actions" aria-label="项目链接">
        <a class="button" href="https://github.com/95-yn/sidereus-resume-cli">查看源码 ↗</a>
        <a class="button" href="https://github.com/95-yn/sidereus-resume-cli/releases/download/v1.0.0/sidereus-resume-cli-demo-v1.0.0.mp4">下载视频 ↓</a>
      </nav>
    </header>

    <section aria-label="演示视频">
      <div class="player-shell">
        <div class="window-bar" aria-hidden="true">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="window-title">resume-cli — live session</span>
        </div>
        <video id="demo" controls playsinline preload="metadata" poster="poster.png">
          <source src="sidereus-resume-cli-demo-v1.0.0.mp4" type="video/mp4">
          当前浏览器不支持 HTML5 视频，请使用上方下载链接。
        </video>
      </div>

      <div class="chapters" aria-label="视频章节">
        <button class="chapter" type="button" data-time="5"><span class="time">00:05</span><span class="name">安装与运行</span></button>
        <button class="chapter" type="button" data-time="18"><span class="time">00:18</span><span class="name">项目结构</span></button>
        <button class="chapter" type="button" data-time="25"><span class="time">00:25</span><span class="name">parse</span></button>
        <button class="chapter" type="button" data-time="31"><span class="time">00:31</span><span class="name">extract · DeepSeek</span></button>
        <button class="chapter" type="button" data-time="39"><span class="time">00:39</span><span class="name">score · DeepSeek</span></button>
      </div>
    </section>

    <footer>
      <span>54.5 SEC · 1080P · 中文旁白与字幕</span>
      <span>NODE.JS 20+ / TYPESCRIPT / DEEPSEEK</span>
    </footer>
  </main>
  <script>
    const video = document.querySelector('#demo');
    document.querySelectorAll('[data-time]').forEach((chapter) => {
      chapter.addEventListener('click', () => {
        video.currentTime = Number(chapter.dataset.time);
        video.play();
      });
    });
  </script>
</body>
</html>
```

- [ ] **Step 4: Copy the verified media assets**

Run:

```bash
cp ../../demo-output/demo演示视频.mp4 /tmp/sidereus-resume-cli-pages-20260723/sidereus-resume-cli-demo-v1.0.0.mp4
cp ../../demo-output/resume-cli-deepseek-screen-demo-contact-sheet.png /tmp/sidereus-resume-cli-pages-20260723/poster.png
```

Expected: the MP4 is 2,035,358 bytes and the poster is a valid PNG.

### Task 3: Validate and publish the Pages branch

**Files:**
- Verify: `/tmp/sidereus-resume-cli-pages-20260723/index.html`
- Verify: `/tmp/sidereus-resume-cli-pages-20260723/sidereus-resume-cli-demo-v1.0.0.mp4`
- Verify: `/tmp/sidereus-resume-cli-pages-20260723/poster.png`

- [ ] **Step 1: Validate the static assets**

Run:

```bash
pages_dir=/tmp/sidereus-resume-cli-pages-20260723
test "$(stat -f %z "$pages_dir/sidereus-resume-cli-demo-v1.0.0.mp4")" = "2035358"
ffmpeg -hide_banner -loglevel error -i "$pages_dir/sidereus-resume-cli-demo-v1.0.0.mp4" -f null -
rg -n '<video|data-time="5"|data-time="18"|data-time="25"|data-time="31"|data-time="39"' "$pages_dir/index.html"
```

Expected: the video fully decodes and all five chapter controls exist.

- [ ] **Step 2: Scan the Pages payload for the configured API Key**

Run:

```bash
secret_value=$(sed -n 's/^DEEPSEEK_API_KEY=//p' ../../.env | head -n 1)
test -n "$secret_value"
if LC_ALL=C grep -aFRq "$secret_value" /tmp/sidereus-resume-cli-pages-20260723; then exit 1; fi
```

Expected: exit code 0 without printing the secret.

- [ ] **Step 3: Commit the isolated branch**

Run:

```bash
pages_dir=/tmp/sidereus-resume-cli-pages-20260723
git -C "$pages_dir" add .nojekyll index.html poster.png sidereus-resume-cli-demo-v1.0.0.mp4
git -C "$pages_dir" commit -m "docs: publish demo video player"
git -C "$pages_dir" status --short --branch
```

Expected: one root commit and a clean `gh-pages` branch.

- [ ] **Step 4: Push the Pages branch**

Run:

```bash
git -C /tmp/sidereus-resume-cli-pages-20260723 push -u origin gh-pages
```

Expected: a new remote `gh-pages` branch is created without force-pushing.

### Task 4: Enable GitHub Pages and verify direct playback

**Files:**
- Configure external site: `https://95-yn.github.io/sidereus-resume-cli/`

- [ ] **Step 1: Configure the Pages source**

Run:

```bash
gh api --method POST repos/95-yn/sidereus-resume-cli/pages \
  -f build_type=legacy \
  -F 'source[branch]=gh-pages' \
  -F 'source[path]=/'
```

Expected: HTTP 201 with the Pages site configuration. This uses the documented Pages source object with branch `gh-pages` and path `/`.

- [ ] **Step 2: Wait for the Pages build**

Poll:

```bash
gh api repos/95-yn/sidereus-resume-cli/pages/builds/latest --jq '.status'
```

Expected: status changes to `built`. Stop and report if the status becomes `errored`.

- [ ] **Step 3: Verify public HTML and media responses**

Run:

```bash
page_url=https://95-yn.github.io/sidereus-resume-cli/
video_url=https://95-yn.github.io/sidereus-resume-cli/sidereus-resume-cli-demo-v1.0.0.mp4
test "$(curl -L -sS -o /tmp/sidereus-pages-index.html -w '%{http_code}' "$page_url")" = "200"
test "$(curl -L -sS -o /dev/null -w '%{http_code}' "$video_url")" = "200"
curl -L -sSI "$video_url" | rg -i '^content-type: video/mp4'
rg -n 'Sidereus Resume CLI|安装与运行|项目结构|extract · DeepSeek|score · DeepSeek' /tmp/sidereus-pages-index.html
```

Expected: both URLs return HTTP 200, the MP4 content type is `video/mp4`, and the live HTML contains the required content.

- [ ] **Step 4: Inspect the rendered player**

Open `https://95-yn.github.io/sidereus-resume-cli/` in a browser, verify the video element and five chapter controls are visible, and activate one chapter to confirm seeking works.

- [ ] **Step 5: Verify branch isolation**

Run:

```bash
main_paths=$(gh api 'repos/95-yn/sidereus-resume-cli/git/trees/main?recursive=1' --jq '.tree[].path')
pages_paths=$(gh api 'repos/95-yn/sidereus-resume-cli/git/trees/gh-pages?recursive=1' --jq '.tree[].path')
if printf '%s\n' "$main_paths" | rg '\.mp4$|^poster\.png$'; then exit 1; fi
printf '%s\n' "$pages_paths" | rg -x '\.nojekyll|index\.html|poster\.png|sidereus-resume-cli-demo-v1\.0\.0\.mp4'
```

Expected: `main` contains no Pages media; `gh-pages` contains exactly the four expected files.

- [ ] **Step 6: Clean up temporary files**

Run:

```bash
mv /tmp/sidereus-resume-cli-pages-20260723 "$HOME/.Trash/sidereus-resume-cli-pages-$(date +%s)"
mv /tmp/sidereus-pages-index.html "$HOME/.Trash/sidereus-pages-index-$(date +%s).html"
```

Expected: local temporary publishing files move to Trash; the public Pages site remains available.
