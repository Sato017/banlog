# BanLog 部署指南

本文从零开始配置 Supabase、GitHub 和 Vercel，并完成自动部署。

> 技术说明：`@supabase/auth-helpers-nextjs` 已被 Supabase 官方废弃，且不适合 Next.js 15 的异步 Cookie API。本项目使用其官方继任者 `@supabase/ssr`，登录、Session 刷新和 middleware 路由保护的行为一致。

## 1. 创建 Supabase 项目

1. 打开 <https://supabase.com/dashboard>，新建项目。
2. 等待数据库初始化完成。
3. 记录 **Project URL**、**anon public key** 和 **service_role key**：
   - Project Settings → API
   - `service_role` 是服务器密钥，不要发给浏览器，不要提交到 Git。

## 2. 初始化数据库和 RLS

进入 Supabase Dashboard → SQL Editor → New query，粘贴并执行：

- [`supabase/schema.sql`](supabase/schema.sql)

脚本会创建：

- `public.anime_cache`：AniList 动画、中文标题、中文简介、题材等共享缓存。
- `public.watch_records`：每个用户的追番记录。
- `anime_cache` 的只读 RLS：登录用户可读，浏览器端没有写权限；服务端通过 `service_role` 写入。
- `watch_records` 的四条 RLS 策略：只能读取/新增/修改/删除 `auth.uid() = user_id` 的行。
- 必要索引和 `updated_at` 触发器。

可以在 Table Editor 里确认两张表的 **RLS enabled** 状态。

## 3. 配置 Supabase Auth

进入 Authentication → Providers：

- 启用 **Email**。
- 开发期间可以关闭 **Confirm email**，注册后立即登录。
- 正式上线建议开启邮箱确认。

进入 Authentication → URL Configuration：

- **Site URL**：
  - 本地：`http://localhost:3000`
  - 线上：`https://你的域名`
- **Redirect URLs** 至少添加：

```text
http://localhost:3000/auth/callback
https://你的域名/auth/callback
```

如果使用 Vercel Preview 域名，可额外添加：

```text
https://*-你的团队.vercel.app/auth/callback
```

应用注册时的 `emailRedirectTo` 会指向 `/auth/callback`；邮箱确认完成后，callback 会交换 Supabase session cookie 并回到首页。

## 4. 配置本地环境变量

```bash
cp .env.example .env.local
```

填写：

```env
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
```

可选：

```env
# ANILIST_API_URL="https://graphql.anilist.co"
# TRANSLATE_API_URL="https://translate.googleapis.com/translate_a/single"
```

启动：

```bash
npm install
npm run dev
```

打开 <http://localhost:3000>，验证：

1. 未登录访问 `/` 会跳转 `/login`。
2. 注册、邮箱确认、登录。
3. 在首页标记一部动画。
4. `/profile` 能看到总追番数、总集数和最近动态。

> `SUPABASE_SERVICE_ROLE_KEY` 只能在服务端读取，不能写成 `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`。

## 5. 推送到 GitHub

先检查敏感文件没有被跟踪：

```bash
git status
```

`.env`、`.env.local`、`.next` 和 `node_modules` 已在 `.gitignore` 中。

首次创建仓库：

```bash
git init
git add .
git commit -m "feat: rebuild BanLog as a responsive Supabase web app"
git branch -M main
git remote add origin https://github.com/你的用户名/banlog.git
git push -u origin main
```

已有仓库：

```bash
git add .
git commit -m "feat: rebuild BanLog as a responsive Supabase web app"
git pull --rebase origin main
git push origin main
```

如果 `git pull --rebase` 出现冲突，解决冲突后继续；不要使用 `git push --force` 覆盖远端历史。

## 6. 绑定 Vercel 自动部署

1. 登录 <https://vercel.com>，选择 **Add New → Project**。
2. 连接 GitHub，选择 `banlog` 仓库。
3. Framework Preset 选择 **Next.js**。
4. Root Directory 保持仓库根目录。
5. Build Command 保持 `npm run build`，Install Command 保持 `npm install`。
6. 在 **Environment Variables** 添加：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

建议同时勾选 Production、Preview 和 Development。`SUPABASE_SERVICE_ROLE_KEY` 只填在 Vercel 服务端环境变量中。

7. 点击 **Deploy**。
8. 拿到 Vercel 域名后，回到 Supabase → Authentication → URL Configuration：
   - Site URL 改为 `https://你的项目.vercel.app`
   - Redirect URLs 添加 `https://你的项目.vercel.app/auth/callback`
9. 在 Vercel 重新部署一次，让最新的 Auth URL 配置生效。
10. 之后每次 push 到 `main`，Vercel 都会自动构建和发布；Pull Request 会生成 Preview 部署。

> 修改 Vercel 环境变量后必须重新部署，旧部署不会自动读取新值。

## 7. 上线验收清单

- [ ] 未登录访问 `/` 自动跳转 `/login`
- [ ] 邮箱注册和确认邮件能完成
- [ ] 登录后能看到首页和每日放送
- [ ] 标记动画后刷新仍保持已追
- [ ] `/profile` 显示邮箱、注册时间、总追番数、总集数、雷达图和最近 10 条
- [ ] 退出后回到 `/login`
- [ ] 用账号 B 登录看不到账号 A 的追番记录
- [ ] `anime_cache` 在浏览器端不可写
- [ ] `.env.local` 和 service_role key 没有进入 Git

## 8. 常见问题

**登录后仍跳回 `/login`**

- 检查 Supabase Site URL 和 Redirect URLs。
- 检查浏览器是否阻止第三方 Cookie。
- 确认 middleware 能读取 `NEXT_PUBLIC_SUPABASE_*` 环境变量。
- 确认 Vercel 环境变量设置后重新部署。

**注册成功但没收到邮件**

- 检查 Supabase Authentication → Email 配置和垃圾邮件箱。
- 正式项目建议配置自定义 SMTP。
- 开发期间可以在 Supabase 中临时关闭 Confirm email。

**能登录但首页报错**

- 确认已执行 `supabase/schema.sql`。
- 确认 Vercel 配置了 `SUPABASE_SERVICE_ROLE_KEY`。
- 查看 Vercel Functions 日志中的 Supabase 错误。

**RLS 相关错误**

- 确认两张表都开启了 RLS。
- 不要用 service_role 冒充用户查询；用户数据应使用带用户 Cookie 的 Supabase 客户端。
- 检查 `watch_records.user_id` 是否等于当前 `auth.uid()`。

## 9. 安全建议

- 永远不要把 `SUPABASE_SERVICE_ROLE_KEY` 暴露给客户端或提交到 Git。
- 不要关闭 `watch_records` 的 RLS。
- 定期轮换 service_role key。
- 生产环境开启邮箱确认。
- 绑定自定义域名后同步更新 Supabase 的 Site URL 和 Redirect URLs。
