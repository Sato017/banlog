# 本地中文标题数据

`anilist-chinese.json` 是以 AniList ID 为 key 的中文标题映射，由
[`scripts/sync-anilist-chinese.mjs`](../scripts/sync-anilist-chinese.mjs) 从
[soruly/anilist-chinese](https://github.com/soruly/anilist-chinese) 下载并规范化。

- `anilist-chinese.json`：`{ "<AniList ID>": "中文标题" }`
- `anilist-chinese.meta.json`：来源、同步时间、条目数
- `anilist-chinese-NOTICE.txt`：源数据 MIT License 声明

刷新：

```bash
npm run sync:chinese
```

项目会在 `postinstall`、`predev` 和 `prebuild` 自动检查：文件缺失或超过 24 小时才重新下载。下载失败时保留已有文件，页面回退到 AniList 原生/罗马音标题。
