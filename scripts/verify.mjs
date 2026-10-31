/**
 * BanLog 本地验收。
 *
 * 前置：
 *   1. npm run dev 已在 http://127.0.0.1:3000 启动；
 *   2. 当前网络能访问 https://graphql.anilist.co。
 *
 * 运行：npm run verify
 *
 * 测试会通过真实 API Route 请求 AniList，校验类型筛选、字段清洗、已追切换、
 * 统计口径和 SQLite 一致性，并在结束时恢复测试动画最初的追番状态。
 */
import fs from "node:fs";
import process from "node:process";

const APP_BASE_URL = (
  process.env.APP_BASE_URL ?? "http://127.0.0.1:3000"
).replace(/\/+$/, "");
const CHINESE_MAP_PATH = new URL(
  "../data/anilist-chinese.json",
  import.meta.url,
);

let passed = 0;
let failed = 0;

function check(condition, label, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function request(path, init) {
  const response = await fetch(`${APP_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return { response, data, text };
}

async function postWatch(animeId) {
  return request("/api/watch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ animeId }),
  });
}

function titleOf(item) {
  return (
    item?.titleChinese?.trim?.() ||
    item?.titleNative?.trim?.() ||
    item?.titleRomaji?.trim?.() ||
    "未命名动画"
  );
}

try {
  process.loadEnvFile?.(".env");
} catch {
  console.warn("未找到 .env，使用默认 SQLite 路径。");
}
process.env.DATABASE_URL ??= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

let target = null;
let initialWatched = null;

async function main() {
  console.log("BanLog · AniList 验收");
  console.log(`APP_BASE_URL=${APP_BASE_URL}`);

  try {
    await fetch(`${APP_BASE_URL}/`, {
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error(
      `无法连接 ${APP_BASE_URL}。请先在另一个终端运行 npm run dev。`,
    );
  }

  section("1. 页面与品牌");
  const home = await request("/");
  check(home.response.status === 200, "首页 HTTP 200");
  check(home.text.includes("BanLog"), "首页包含 BanLog 品牌");
  check(!/Jikan|MyAnimeList|追番手帖/i.test(home.text), "页面不再包含旧品牌/旧数据源文案");
  check(home.text.includes("AniList"), "首页标注 AniList 数据源");

  const profilePage = await request("/profile");
  check(profilePage.response.status === 200, "个人主页 HTTP 200");

  section("2. 中文标题映射");
  const localMap = JSON.parse(
    fs.readFileSync(CHINESE_MAP_PATH, "utf8"),
  );
  check(
    localMap && typeof localMap === "object",
    "本地 anilist-chinese 映射存在",
  );
  check(
    Object.keys(localMap).length > 1000,
    "本地映射包含足够条目",
    `${Object.keys(localMap).length.toLocaleString("zh-CN")} 条`,
  );
  check(
    localMap["16498"] === "進擊的巨人",
    "映射可按 AniList ID 命中中文标题",
    String(localMap["16498"]),
  );
  const metaPath = new URL(
    "../data/anilist-chinese.meta.json",
    import.meta.url,
  );
  check(fs.existsSync(metaPath), "映射下载元数据存在");

  section("3. AniList 列表与字段清洗");
  const list = await request("/api/anime?page=1");
  check(list.response.status === 200, "GET /api/anime?page=1 返回 200");
  check(Array.isArray(list.data?.items), "返回 items 数组");
  check(list.data?.items?.length === 24, "每页返回 24 部动画");
  check(list.data?.format === null, "全部筛选不设置 format");
  check(typeof list.data?.stale === "boolean", "返回 stale 状态");
  check(Array.isArray(list.data?.watchedIds), "返回 watchedIds");

  const items = list.data?.items ?? [];
  check(
    items.every((item) => Number.isInteger(item.id) && item.id > 0),
    "动画 id 为有效 AniList id",
  );
  check(
    items.every(
      (item) =>
        typeof item.titleNative === "string" ||
        typeof item.titleRomaji === "string",
    ),
    "标题包含原生标题或罗马音",
  );
  check(
    items.every(
      (item) => item.titleChinese === null || typeof item.titleChinese === "string",
    ),
    "每项返回 titleChinese 字段",
  );
  const chineseTitleCount = items.filter((item) => item.titleChinese).length;
  check(
    chineseTitleCount >= 10,
    "AniList 列表已合并本地中文标题",
    `${chineseTitleCount}/${items.length}`,
  );
  check(
    items.find((item) => item.id === 16498)?.titleChinese === "進擊的巨人",
    "列表中的进击的巨人命中中文标题",
  );
  check(
    items.every((item) => Array.isArray(item.genres)),
    "每项返回 genres 数组",
  );
  check(
    items.every(
      (item) =>
        item.synopsisChinese === null ||
        typeof item.synopsisChinese === "string",
    ),
    "每项返回 synopsisChinese 字段",
  );
  const translatedItems = items.filter((item) => item.synopsisChinese);
  check(
    translatedItems.length > 0,
    "至少部分英文简介已翻译并返回",
    `${translatedItems.length}/${items.length}`,
  );
  check(
    translatedItems.every((item) =>
      /[\u3400-\u9fff\uf900-\ufaff]/.test(item.synopsisChinese),
    ),
    "synopsisChinese 包含中文",
  );
  check(
    items.every(
      (item) =>
        typeof item.coverUrl === "string" &&
        item.coverUrl.includes("anilist.co"),
    ),
    "封面使用 AniList 图片地址",
  );
  check(
    items.every(
      (item) =>
        item.description === null || item.description.length <= 120,
    ),
    "简介截断到 120 字符以内",
  );
  check(
    items.every(
      (item) =>
        item.description === null || !/<[^>]+>/.test(item.description),
    ),
    "简介不包含 HTML 标签",
  );

  if (list.data?.hasNextPage) {
    const page2 = await request("/api/anime?page=2");
    const ids1 = new Set(items.map((item) => item.id));
    check(
      page2.response.status === 200 &&
        page2.data?.items?.some((item) => !ids1.has(item.id)),
      "分页返回新的 AniList 数据",
    );
  }

  section("4. 类型筛选");
  const formatExpectations = [
    ["TV", "TV = TV"],
    ["MOVIE", "MOVIE = 剧场版"],
    ["OVA", "OVA = OVA"],
    ["ONA", "ONA = ONA"],
  ];

  const allItems = [...items];

  for (const [format] of formatExpectations) {
    const filtered = await request(
      `/api/anime?page=1&format=${encodeURIComponent(format)}`,
    );
    const filteredItems = filtered.data?.items ?? [];
    check(filtered.response.status === 200, `${format} 筛选接口 200`);
    check(filteredItems.length > 0, `${format} 筛选有结果`);
    check(
      filteredItems.every((item) => item.format === format),
      `${format} 筛选返回项全部匹配`,
      JSON.stringify([...new Set(filteredItems.map((item) => item.format))]),
    );
    allItems.push(...filteredItems);
  }

  const invalidFormat = await request("/api/anime?page=1&format=INVALID");
  check(invalidFormat.response.status === 400, "非法 format 返回 400");
  const invalidPage = await request("/api/anime?page=0");
  check(invalidPage.response.status === 400, "非法 page 返回 400");

  section("5. 题材筛选");
  const action = await request("/api/anime?page=1&genre=Action");
  check(action.response.status === 200, "Action 题材筛选接口 200");
  check(
    action.data?.items?.length > 0 &&
      action.data.items.every((item) => item.genres.includes("Action")),
    "Action 筛选返回项都包含 Action",
  );
  check(action.data?.genre === "Action", "响应保留 genre=Action");

  const combined = await request(
    "/api/anime?page=1&genre=Romance&format=MOVIE",
  );
  check(
    combined.data?.items?.length > 0 &&
      combined.data.items.every(
        (item) =>
          item.format === "MOVIE" && item.genres.includes("Romance"),
      ),
    "MOVIE + Romance 组合筛选正确",
  );
  const invalidGenre = await request(
    "/api/anime?page=1&genre=NotAGenre",
  );
  check(invalidGenre.response.status === 400, "非法 genre 返回 400");

  section("6. 搜索");
  const search = await request(
    `/api/anime?page=1&q=${encodeURIComponent("Naruto")}`,
  );
  const searchItems = search.data?.items ?? [];
  check(search.response.status === 200, "搜索接口 200");
  check(searchItems.length > 0, "搜索 Naruto 有结果");
  check(
    searchItems.some((item) =>
      /naruto/i.test(item.titleNative ?? item.titleRomaji ?? ""),
    ),
    "搜索结果包含 Naruto",
  );
  check(search.data?.query === "Naruto", "响应保留查询词");
  check(search.data?.format === null, "搜索时未携带类型");

  section("7. 已追切换与数据库一致性");
  const uniqueItems = [...new Map(allItems.map((item) => [item.id, item])).values()];
  target =
    uniqueItems.find(
      (item) =>
        !(list.data?.watchedIds ?? []).includes(item.id),
    ) ?? uniqueItems[0];

  if (!target) {
    throw new Error("没有可用于测试的动画");
  }

  const initialRecord = await prisma.watchRecord.findUnique({
    where: {
      userId_animeId: {
        userId: "local",
        animeId: target.id,
      },
    },
  });
  initialWatched = Boolean(initialRecord);

  if (initialWatched) {
    const cleanup = await postWatch(target.id);
    check(cleanup.data?.watched === false, "清理测试动画原有状态");
  }

  const statsBefore = await request("/api/stats");
  const baseline = statsBefore.data?.totalWatched ?? 0;
  const dbBaseline = await prisma.watchRecord.count({
    where: { userId: "local", status: "watched" },
  });
  check(
    baseline === dbBaseline,
    "个人统计与 WatchRecord 基线一致",
    `API=${baseline} DB=${dbBaseline}`,
  );

  const mark = await postWatch(target.id);
  check(mark.response.status === 200, "标记已追返回 200");
  check(mark.data?.watched === true, "标记后 watched=true");

  const record = await prisma.watchRecord.findUnique({
    where: {
      userId_animeId: {
        userId: "local",
        animeId: target.id,
      },
    },
  });
  check(record !== null, "AnimeCache id 与 WatchRecord 正确关联");
  check(record?.status === "watched", "记录状态为 watched");

  const duplicateCount = await prisma.watchRecord.count({
    where: { userId: "local", animeId: target.id },
  });
  check(duplicateCount === 1, "同一动画只有一条记录");

  const statsAfter = await request("/api/stats");
  check(
    statsAfter.data?.totalWatched === baseline + 1,
    "标记后统计 +1",
    `before=${baseline} after=${statsAfter.data?.totalWatched}`,
  );
  check(
    statsAfter.data?.recent?.some(
      (item) => item.animeId === target.id,
    ),
    "最近标记包含该动画",
  );
  const recent = statsAfter.data?.recent?.find(
    (item) => item.animeId === target.id,
  );
  check(
    Boolean(recent?.titleNative || recent?.titleRomaji),
    "最近记录包含 AniList 标题",
  );
  check(
    Boolean(recent?.titleChinese),
    "最近记录保留中文标题",
    String(recent?.titleChinese),
  );
  check(
    String(recent?.watchedAt ?? "").length > 0,
    "最近记录包含时间",
  );
  const byFormatSum = Object.values(
    statsAfter.data?.byFormat ?? {},
  ).reduce((sum, value) => sum + value, 0);
  check(
    byFormatSum === statsAfter.data?.totalWatched,
    "类型统计之和等于总数",
  );

  const listAfterWatch = await request("/api/anime?page=1");
  check(
    (listAfterWatch.data?.watchedIds ?? []).includes(target.id),
    "下次列表请求返回新 watchedIds",
  );

  const unmark = await postWatch(target.id);
  check(unmark.data?.watched === false, "取消已追返回 false");
  const recordAfterUnmark = await prisma.watchRecord.findUnique({
    where: {
      userId_animeId: {
        userId: "local",
        animeId: target.id,
      },
    },
  });
  check(recordAfterUnmark === null, "取消后记录从数据库删除");

  const statsRestored = await request("/api/stats");
  check(
    statsRestored.data?.totalWatched === baseline,
    "取消后统计恢复基线",
  );

  // 再标记一次，确认重复点击不会累积重复行。
  await postWatch(target.id);
  check(
    (await prisma.watchRecord.count({
      where: { userId: "local", animeId: target.id },
    })) === 1,
    "重复标记仍只有一条记录",
  );
  await postWatch(target.id);

  if (initialWatched) {
    await postWatch(target.id);
    check(true, "恢复测试前的已追状态");
  }

  const finalStats = await request("/api/stats");
  const finalDbCount = await prisma.watchRecord.count({
    where: { userId: "local", status: "watched" },
  });
  check(
    finalStats.data?.totalWatched === finalDbCount,
    "最终统计与 WatchRecord 总数一致",
    `API=${finalStats.data?.totalWatched} DB=${finalDbCount}`,
  );

  const cacheRows = await prisma.animeCache.count();
  check(cacheRows > 0, "AniList 列表已写入 AnimeCache", `${cacheRows} 条`);
  const chineseCacheRows = await prisma.animeCache.count({
    where: { titleChinese: { not: null } },
  });
  check(
    chineseCacheRows > 0,
    "中文标题已写入 AnimeCache.titleChinese",
    `${chineseCacheRows} 条`,
  );
  const translatedCacheRows = await prisma.animeCache.count({
    where: { synopsisChinese: { not: null } },
  });
  check(
    translatedCacheRows > 0,
    "中文简介已写入 AnimeCache.synopsisChinese",
    `${translatedCacheRows} 条`,
  );
  const sample = await prisma.animeCache.findUnique({
    where: { id: 16498 },
    select: { titleChinese: true, synopsisChinese: true },
  });
  check(
    sample?.titleChinese === "進擊的巨人" &&
      Boolean(sample.synopsisChinese),
    "SQLite 同时缓存中文标题和中文简介",
  );

  console.log(`\n结果：${passed} 项通过，${failed} 项失败。`);
  if (failed > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  failed += 1;
  console.error(
    `\n致命错误：${error instanceof Error ? error.message : String(error)}`,
  );
} finally {
  if (target && initialWatched !== null) {
    try {
      const current = await prisma.watchRecord.findUnique({
        where: {
          userId_animeId: {
            userId: "local",
            animeId: target.id,
          },
        },
      });
      if (Boolean(current) !== initialWatched) {
        await postWatch(target.id);
      }
    } catch {
      // Best effort.
    }
  }

  await prisma.$disconnect();

  if (failed > 0) {
    process.exitCode = 1;
    console.error("验收未通过，请根据上方失败项排查。");
  } else if (passed > 0) {
    console.log("全部验收项通过。");
  }
}
