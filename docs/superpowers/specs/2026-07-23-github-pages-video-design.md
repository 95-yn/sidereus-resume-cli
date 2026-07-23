# Sidereus Resume CLI GitHub Pages 视频页设计

## 目标

为演示视频提供可在浏览器中直接观看的公开地址：

`https://95-yn.github.io/sidereus-resume-cli/`

页面用于面试作业交付，访问者无需登录、下载文件或安装播放器。

## 发布架构

使用独立的孤立分支 `gh-pages` 承载静态页面，与项目源码所在的 `main` 分支隔离。页面分支只包含：

- `index.html`：完整播放页及内联样式
- `sidereus-resume-cli-demo-v1.0.0.mp4`：54.5 秒演示视频
- `poster.png`：视频封面与加载占位图
- `.nojekyll`：禁止不必要的 Jekyll 处理

GitHub Pages 的发布来源配置为 `gh-pages` 分支根目录。Release `v1.0.0` 继续保留，作为视频下载和版本归档入口。

## 页面内容

页面采用深色终端编辑风格，与 CLI 录屏视觉一致。首屏直接展示：

- 项目名 Sidereus Resume CLI
- “DeepSeek Live Demo” 标识
- 原生 HTML5 视频播放器，启用 `controls`、`playsinline` 和 `preload="metadata"`
- “查看源码”和“下载视频”两个清晰入口

播放器下方列出五个必需章节及时间点：

- 00:05 安装与运行
- 00:18 项目结构
- 00:25 `parse`
- 00:31 `extract`（真实 DeepSeek）
- 00:39 `score`（真实 DeepSeek）

页面底部说明视频时长、分辨率、技术栈及 API Key 未出现在视频中。

## 交互与可访问性

- 视频不自动播放，避免突然发声
- 使用浏览器原生播放、音量、全屏和画中画能力
- 点击章节时间点会跳转到对应时间并开始播放
- 布局适配手机、平板与桌面浏览器
- 文本、焦点状态和控件满足清晰可读要求
- 尊重 `prefers-reduced-motion`，不依赖动画传达信息

## 安全与隐私

- 不包含 API Key、`.env`、源码构建产物或本地路径
- 不使用分析统计、Cookie、第三方 JavaScript 或外部字体
- 所有页面资源由同一个 GitHub Pages 域名提供
- 视频使用已经通过密钥扫描的最终文件

## 发布与验证

1. 在临时目录克隆公开仓库并创建孤立 `gh-pages` 分支。
2. 写入页面、封面、视频和 `.nojekyll`，提交并推送分支。
3. 通过 GitHub API 将 Pages 来源设置为 `gh-pages` 根目录。
4. 等待 Pages 构建完成。
5. 验证页面返回 HTTP 200、MP4 返回 `video/mp4`，并检查播放器画面。
6. 确认 `main` 分支仍不包含视频文件，Pages 分支不包含 API Key。

## 验收标准

- 页面公开地址可直接打开
- 视频可在页面内播放、拖动进度、全屏
- 五项必需演示内容在页面中明确列出
- 页面在移动端不会横向溢出
- `gh-pages` 与 `main` 分支内容隔离
- 页面与视频公开请求均返回 HTTP 200
