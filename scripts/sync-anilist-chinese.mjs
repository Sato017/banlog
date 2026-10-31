/**
 * 下载并规范化 soruly/anilist-chinese 的中文标题映射。
 *
 * 输出：
 *   data/anilist-chinese.json         { "<AniList ID>": "中文标题" }
 *   data/anilist-chinese.meta.json    来源、更新时间、条目数
 *
 * 只在文件缺失或超过 24 小时时访问网络；--force 可强制刷新。
 * 网络不可用时保留已有文件，并以 0 退出，让 BanLog 继续使用本地映射
 * 或回退到 AniList 原标题。
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const OUTPUT_PATH = path.join(DATA_DIR, "anilist-chinese.json");
const META_PATH = path.join(DATA_DIR, "anilist-chinese.meta.json");
const NOTICE_PATH = path.join(DATA_DIR, "anilist-chinese-NOTICE.txt");
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;
const FORCE = process.argv.includes("--force");

const RAW_URL =
  "https://raw.githubusercontent.com/soruly/anilist-chinese/master/anilist-chinese.json";
const GITHUB_API_URL =
  "https://api.github.com/repos/soruly/anilist-chinese/contents/anilist-chinese.json";
const MIRROR_URL = `https://ghproxy.net/${RAW_URL}`;

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

const NOTICE = `AniList Chinese title mapping
================================

Source: soruly/anilist-chinese
https://github.com/soruly/anilist-chinese

The mapping data is distributed under the MIT License.
Copyright (c) 2018 soruly

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

function log(message) {
  console.log(`[chinese] ${message}`);
}

async function readExistingMap() {
  try {
    const raw = await fsp.readFile(OUTPUT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isFresh(existing) {
  if (!existing) return false;
  try {
    return Date.now() - fs.statSync(OUTPUT_PATH).mtimeMs < MAX_AGE_MS;
  } catch {
    return false;
  }
}

function chooseChineseTitle(entry) {
  const candidates = [];
  if (typeof entry?.title === "string") candidates.push(entry.title);
  if (Array.isArray(entry?.synonyms)) {
    for (const synonym of entry.synonyms) {
      if (typeof synonym === "string") candidates.push(synonym);
    }
  }

  return (
    candidates
      .map((value) => value.trim())
      .find((value) => value.length > 0 && CJK_RE.test(value)) ?? null
  );
}

/**
 * 兼容三种输入：
 * 1. 官方 anilist-chinese.json：数组 { id, title, synonyms }
 * 2. 已经规范化过的对象映射 { "1": "星际牛仔" }
 * 3. GitHub Contents API 包装 { content: "base64..." }
 */
function normalizePayload(payload) {
  if (typeof payload === "string") {
    payload = JSON.parse(payload);
  }

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    if (typeof payload.content === "string" && payload.encoding === "base64") {
      return normalizePayload(
        Buffer.from(payload.content, "base64").toString("utf8"),
      );
    }

    if (payload.titles && typeof payload.titles === "object") {
      payload = payload.titles;
    }
  }

  if (Array.isArray(payload)) {
    const map = {};
    for (const entry of payload) {
      const id = Number(entry?.id);
      if (!Number.isInteger(id) || id <= 0) continue;
      const title = chooseChineseTitle(entry);
      if (title) map[String(id)] = title;
    }
    return { map, sourceEntryCount: payload.length };
  }

  if (payload && typeof payload === "object") {
    const map = {};
    for (const [key, value] of Object.entries(payload)) {
      const id = Number(key);
      if (!Number.isInteger(id) || id <= 0) continue;
      if (typeof value === "string" && value.trim()) {
        map[String(id)] = value.trim();
      } else if (value && typeof value === "object") {
        const title = chooseChineseTitle(value);
        if (title) map[String(id)] = title;
      }
    }
    return { map, sourceEntryCount: Object.keys(payload).length };
  }

  throw new Error("映射文件不是可识别的 JSON 对象或数组");
}

async function fetchSource(source, custom) {
  const headers = {
    Accept: "application/json",
    "User-Agent": "BanLog/2.1 (local anime catalog)",
  };

  const response = await fetch(source.url, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (custom) {
    return normalizePayload(payload);
  }
  return normalizePayload(payload);
}

function sources() {
  const custom = process.env.ANILIST_CHINESE_URL?.trim();
  if (custom) {
    return [{ url: custom, label: "ANILIST_CHINESE_URL" }];
  }

  return [
    { url: RAW_URL, label: "GitHub raw" },
    { url: GITHUB_API_URL, label: "GitHub API" },
    { url: MIRROR_URL, label: "GitHub mirror" },
  ];
}

async function main() {
  const existing = await readExistingMap();
  if (!FORCE && isFresh(existing)) {
    log(
      `local map is fresh (${Object.keys(existing).length} titles), skip download`,
    );
    return;
  }

  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(NOTICE_PATH, NOTICE, "utf8");

  let lastError = null;

  for (const source of sources()) {
    try {
      log(`downloading from ${source.label}...`);
      const { map, sourceEntryCount } = await fetchSource(
        source,
        Boolean(process.env.ANILIST_CHINESE_URL?.trim()),
      );
      const count = Object.keys(map).length;

      if (count < 100) {
        throw new Error(`映射条目过少：${count}`);
      }

      const tempPath = `${OUTPUT_PATH}.tmp`;
      await fsp.writeFile(tempPath, `${JSON.stringify(map)}\n`, "utf8");
      await fsp.rename(tempPath, OUTPUT_PATH);

      const meta = {
        source: source.url,
        sourceEntryCount,
        mappedTitleCount: count,
        fetchedAt: new Date().toISOString(),
        license: "MIT (soruly/anilist-chinese)",
      };
      await fsp.writeFile(
        META_PATH,
        `${JSON.stringify(meta, null, 2)}\n`,
        "utf8",
      );

      log(`saved ${count} Chinese titles to ${OUTPUT_PATH}`);
      return;
    } catch (error) {
      lastError = error;
      log(
        `${source.label} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (existing) {
    log(
      `download failed; keeping existing local map (${Object.keys(existing).length} titles)`,
    );
    return;
  }

  log(
    `WARN: no Chinese title map available (${
      lastError instanceof Error ? lastError.message : String(lastError)
    })`,
  );
  log("BanLog will fall back to AniList native/romaji titles.");
}

await main();
