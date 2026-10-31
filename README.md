# BanLog

**中文优先、云端同步的日本动画追番 Web 应用。**

BanLog 使用 AniList 获取动画资料，使用本地中文映射显示译名，通过 Supabase Auth 登录，并把追番记录和中文简介缓存保存在 Postgres。手机和电脑浏览器都可以直接使用。

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 功能

- **邮箱账号**：Supabase Auth 注册、登录、退出；未登录访问首页自动跳转 `/login`。
- **云端追番**：标记/取消已追直接写入当前用户的 `watch_records`，RLS 隔离数据。
- **三行平铺筛选**：按剧情、年份、排序；PC 三行展示，手机横向滑动。
- **响应式列表**：电脑为左图右文横向列表，手机为双列纵向卡片。
- **每日放送**：按周一至周日分组展示本周更新时间。
- **追番雷达图**：Recharts 展示最偏爱的 6 个题材。
- **个人主页**：邮箱、注册时间、总追番数、总集数、题材分布和最近 10 条动态。
- **中文体验**：中文标题映射和中文简介缓存，翻译失败自动回退英文。

底部“下载桌面版”入口目前展示“即将推出”。当前产品形态为纯 Web 应用。

## 技术栈

Next.js 15 App Router · React 19 · TypeScript · Tailwind CSS · Supabase Auth · Supabase Postgres · Recharts · AniList GraphQL · Vercel

## 本地启动

要求 Node.js 20+ 和一个 Supabase 项目。

1. 在 Supabase SQL Editor 执行 [`supabase/schema.sql`](supabase/schema.sql)。
2. 复制环境变量并填入项目密钥：

```bash
cp .env.example .env.local
```

3. 安装并启动：

```bash
npm install
npm run dev
```

打开 <http://localhost:3000>，注册账号后即可使用。

完整的 Supabase Auth 回调配置、GitHub 推送和 Vercel 自动部署步骤见 **[DEPLOY.md](DEPLOY.md)**。

## 数据与安全

- `anime_cache` 是所有登录用户共享的 AniList 元数据缓存，只允许登录用户读取；写入仅由服务端使用 `service_role` 完成。
- `watch_records` 开启 RLS，用户只能查询、创建、修改、删除自己的记录。
- `SUPABASE_SERVICE_ROLE_KEY` 只放在服务端/Vercel 环境变量，绝不能加 `NEXT_PUBLIC_` 前缀。
- AniList 列表请求保留 5 分钟内存缓存，Supabase 中文简介缓存长期复用。
- 中文标题来自本地 [soruly/anilist-chinese](https://github.com/soruly/anilist-chinese) 映射。

## License

本项目以 [MIT License](LICENSE) 发布。中文标题数据遵循其 MIT License，声明见 [`data/anilist-chinese-NOTICE.txt`](data/anilist-chinese-NOTICE.txt)。
