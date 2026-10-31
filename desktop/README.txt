BanLog · Windows 桌面版
=======================

启动
----
解压后双击 BanLog.exe。

启动器会在一个原生桌面窗口中启动应用：
1. 在后台启动随包附带的 Node.js 本地服务；
2. 使用系统 WebView2 内嵌浏览器加载 BanLog 动画库；
3. 关闭应用窗口时，本地服务会随应用退出。

不需要单独打开浏览器，也不需要安装 Node.js。
runtime\node.exe 已包含在发布目录中。

整个文件夹必须保持完整：BanLog.exe、seed.db、data\、runtime\、server\
以及 WebView2 的 DLL 都不能单独移动或删除。程序可以放在任意有写权限的目录，
不需要安装到系统目录。

数据位置
--------
程序会自动选择第一个可写的数据目录，优先顺序：

1. 程序目录\BanLogData\                     ← 推荐、便携模式默认位置
2. %LOCALAPPDATA%\BanLog\
3. %APPDATA%\BanLog\
4. %TEMP%\BanLog\                           （仅前三个都不可写时的回退）

实际位置会写进该目录下的 logs\launcher.log 第一行。
目录结构：

  BanLogData\
    data\banlog.db           SQLite 数据库
    logs\launcher.log        启动器日志
    logs\server.log          Next.js/Prisma 服务日志
    webview2-data\           WebView2 用户数据

首次启动会从发布包里的 seed.db 复制一份空数据库。
升级程序不会覆盖已有的 banlog.db；更新前建议备份整个数据目录。

如果所有候选目录都被拒绝写入，启动器会显示一个列出尝试路径的错误框。
此时请把发布包解压到可写目录（例如桌面或用户目录），并在 Windows 资源
管理器中直接双击 exe；不要直接在 ZIP 压缩包预览器中运行。

运行要求
--------
- Windows 10/11 x64
- Microsoft Edge WebView2 Runtime（Windows 11 已内置）
- 能访问 AniList 官方 GraphQL API 的网络
- 中文简介翻译需要访问 Google Translate；无法访问时自动回退英文简介

如果系统缺少 WebView2 Runtime，可从微软官网下载安装：
https://developer.microsoft.com/microsoft-edge/webview2/

数据源
------
动画资料来自 AniList：
https://graphql.anilist.co

中文标题来自随包附带的本地映射：
data\anilist-chinese.json
（soruly/anilist-chinese，MIT License）

中文简介通过翻译接口按需生成并缓存到 SQLite 的
AnimeCache.synopsisChinese 字段。翻译超时或失败时，
页面会直接展示英文简介，不会报错。

如果 AniList 请求超时或限流，页面会给出友好提示，
不会导致应用崩溃。

安全说明
--------
本地 Node 服务只监听 127.0.0.1 的随机空闲端口，不对局域网开放。
没有登录与云同步，动画缓存和追番记录只写进本机 SQLite 文件。

本程序未做代码签名，Windows SmartScreen 可能提示“未知发布者”；
这是本地构建程序的正常现象，选择“仍要运行”即可。
