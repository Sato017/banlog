import fs from "node:fs";
import path from "node:path";

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

interface ChineseTitleMapState {
  map: Map<string, string> | null;
  sourcePath: string | null;
  loaded: boolean;
}

interface RawTitleEntry {
  id?: unknown;
  title?: unknown;
  synonyms?: unknown;
}

const globalForChineseTitles = globalThis as unknown as {
  __banLogChineseTitleState?: ChineseTitleMapState;
};

const state: ChineseTitleMapState =
  globalForChineseTitles.__banLogChineseTitleState ?? {
    map: null,
    sourcePath: null,
    loaded: false,
  };

globalForChineseTitles.__banLogChineseTitleState = state;

function pickChineseTitle(entry: RawTitleEntry): string | null {
  const candidates: string[] = [];

  if (typeof entry.title === "string") candidates.push(entry.title);
  if (Array.isArray(entry.synonyms)) {
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
 * 支持：
 * - 下载脚本规范化后的 { "16498": "進擊的巨人" }
 * - 原始 anilist-chinese.json：[{ id, title, synonyms }]
 * - { titles: { ... } } 包装
 */
function parseTitleMap(
  payload: unknown,
  target: Map<string, string>,
): void {
  if (!payload || typeof payload !== "object") return;

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (!item || typeof item !== "object") continue;
      const entry = item as RawTitleEntry;
      const id = Number(entry.id);
      if (!Number.isInteger(id) || id <= 0) continue;
      const title = pickChineseTitle(entry);
      if (title) target.set(String(id), title);
    }
    return;
  }

  const object = payload as Record<string, unknown>;
  const source =
    object.titles && typeof object.titles === "object"
      ? (object.titles as Record<string, unknown>)
      : object;

  for (const [key, value] of Object.entries(source)) {
    const id = Number(key);
    if (!Number.isInteger(id) || id <= 0) continue;

    if (typeof value === "string" && value.trim()) {
      target.set(String(id), value.trim());
    } else if (value && typeof value === "object") {
      const title = pickChineseTitle(value as RawTitleEntry);
      if (title) target.set(String(id), title);
    }
  }
}

function candidatePaths(): string[] {
  const candidates: string[] = [];
  const override = process.env.BANLOG_CHINESE_MAP_PATH?.trim();
  if (override) candidates.push(override);

  const cwd = process.cwd();
  const nodeDir = path.dirname(process.execPath);

  candidates.push(
    path.join(cwd, "data", "anilist-chinese.json"),
    path.join(cwd, "server", "data", "anilist-chinese.json"),
    path.join(cwd, "..", "data", "anilist-chinese.json"),
    path.join(cwd, "..", "server", "data", "anilist-chinese.json"),
    path.join(nodeDir, "..", "data", "anilist-chinese.json"),
  );

  return [...new Set(candidates.map((value) => path.resolve(value)))];
}

/**
 * 每个 Node 进程只读取一次本地映射；不会在每次列表请求时重复解析大 JSON。
 */
export function getChineseTitleMap(): Map<string, string> {
  if (state.loaded) return state.map ?? new Map();

  state.loaded = true;
  const map = new Map<string, string>();

  for (const filePath of candidatePaths()) {
    if (!fs.existsSync(filePath)) continue;

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      parseTitleMap(JSON.parse(raw), map);
      state.map = map;
      state.sourcePath = filePath;
      console.info(
        `[chinese] loaded ${map.size} title mappings from ${filePath}`,
      );
      return map;
    } catch (error) {
      console.warn(
        `[chinese] failed to read ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  state.map = map;
  console.warn(
    "[chinese] local title map not found; falling back to native/romaji titles",
  );
  return map;
}

export function getChineseTitle(animeId: number): string | null {
  return getChineseTitleMap().get(String(animeId)) ?? null;
}
