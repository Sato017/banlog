# BanLog

**中文优先、本地优先的日本动画追番记录。**

BanLog 使用 AniList 获取动画资料，以本地中文映射显示译名，并将中文简介缓存到 SQLite。无需登录，没有云同步，提供网页版和 Windows 便携版。

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Windows](https://img.shields.io/badge/Windows-WebView2-0078D4?logo=windows&logoColor=white)](https://learn.microsoft.com/microsoft-edge/webview2/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Windows 用户**：[下载 BanLog 2.2.0](https://github.com/Sato017/banlog/releases/latest)，解压后双击 `BanLog.exe`。

![BanLog 首页：中文标题、三行筛选和中文简介](screenshots/banlog-home.png)

## 功能

- **三行平铺筛选**：按剧情、年份、排序，选中项高亮，筛选状态同步到 URL。
- **每日放送**：按周一至周日分组展示本周动画更新时间，自动转换本地时区。
- **追番雷达图**：统计已追作品的题材分布，展示最偏爱的 6 个题材及比例。
- **中文体验**：中文主标题 + 日文原名副标题，中文简介自动缓存。
- **追番记录**：卡片标记已追，个人主页查看数量和类型分布。
- **本地优先**：单用户 SQLite，无需账号，不依赖云服务。

## 预览

| 每日放送 | 追番雷达图 |
| --- | --- |
| ![每日放送](screenshots/banlog-schedule.png) | ![追番雷达图](screenshots/banlog-radar.png) |

## Windows 版

从 [Releases](https://github.com/Sato017/banlog/releases/latest) 下载 `BanLog-2.2.0-win64.zip`，解压到可写目录并运行 `BanLog.exe`。

数据默认保存在程序旁的 `BanLogData/`。系统需要 WebView2 Runtime，Windows 11 通常已自带。更多说明见 [desktop/README.txt](desktop/README.txt)。

## 从源码运行

要求 Node.js 20+。

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

打开 <http://127.0.0.1:3000>。

构建 Windows 桌面版：

```bash
npm run desktop:build
```

## 技术栈

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Prisma 6 · SQLite · Recharts · AniList GraphQL · WinForms + WebView2

## 数据说明

- 动画资料与封面来自 AniList。
- 中文标题来自本地 [soruly/anilist-chinese](https://github.com/soruly/anilist-chinese) 映射。
- 追番记录与中文简介缓存保存在本地 SQLite。
- 中文简介翻译失败时自动展示英文简介，不影响使用。

## License

本项目以 [MIT License](LICENSE) 发布。

中文标题数据遵循其 MIT License，声明见 [`data/anilist-chinese-NOTICE.txt`](data/anilist-chinese-NOTICE.txt)。WebView2 许可见 [`launcher/vendor/webview2/LICENSE.txt`](launcher/vendor/webview2/LICENSE.txt)。
