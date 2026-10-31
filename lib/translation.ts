import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnimeItem } from "@/lib/types";

const DEFAULT_TRANSLATE_ENDPOINT =
  "https://translate.googleapis.com/translate_a/single";
const REQUEST_TIMEOUT_MS = 2_500;
const CONCURRENCY = 6;
const BATCH_BUDGET_MS = 5_000;
const FAILURE_TTL_MS = 10 * 60 * 1000;
const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

interface TranslationState {
  successful: Map<string, string>;
  failedAt: Map<string, number>;
  inFlight: Map<string, Promise<string | null>>;
}

const globalForTranslation = globalThis as unknown as {
  __banLogTranslationState?: TranslationState;
};

const state: TranslationState =
  globalForTranslation.__banLogTranslationState ?? {
    successful: new Map(),
    failedAt: new Map(),
    inFlight: new Map(),
  };

globalForTranslation.__banLogTranslationState = state;

function translateEndpoint(): string {
  return (
    process.env.TRANSLATE_API_URL?.trim() || DEFAULT_TRANSLATE_ENDPOINT
  );
}

function markFailure(text: string): void {
  state.failedAt.set(text, Date.now());
  if (state.failedAt.size > 500) {
    const oldest = state.failedAt.keys().next().value;
    if (typeof oldest === "string") state.failedAt.delete(oldest);
  }
}

function recentlyFailed(text: string): boolean {
  const failedAt = state.failedAt.get(text);
  if (!failedAt) return false;
  if (Date.now() - failedAt < FAILURE_TTL_MS) return true;
  state.failedAt.delete(text);
  return false;
}

async function requestTranslation(text: string): Promise<string | null> {
  const url = new URL(translateEndpoint());
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", "zh-CN");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 BanLog/3.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) return null;

    const translated = payload[0]
      .map((segment) =>
        Array.isArray(segment) && typeof segment[0] === "string"
          ? segment[0]
          : "",
      )
      .join("")
      .trim();

    if (!translated || !CJK_RE.test(translated)) return null;
    return translated.slice(0, 800);
  } catch {
    return null;
  }
}

/**
 * 翻译单条英文简介。失败/超时一律返回 null，由前端回退英文。
 * 10 分钟内的失败会做负缓存，避免 Google 不可达时每页重复等待。
 */
export async function translateToChinese(
  text: string,
): Promise<string | null> {
  const normalized = text.trim();
  if (!normalized) return null;

  const cached = state.successful.get(normalized);
  if (cached) return cached;
  if (recentlyFailed(normalized)) return null;

  const inFlight = state.inFlight.get(normalized);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const translated = await requestTranslation(normalized);
    if (translated) {
      state.successful.set(normalized, translated);
      if (state.successful.size > 1_000) {
        const oldest = state.successful.keys().next().value;
        if (typeof oldest === "string") state.successful.delete(oldest);
      }
    } else {
      markFailure(normalized);
    }
    return translated;
  })();

  state.inFlight.set(normalized, promise);
  try {
    return await promise;
  } finally {
    if (state.inFlight.get(normalized) === promise) {
      state.inFlight.delete(normalized);
    }
  }
}

async function translateMany(
  texts: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(texts.map((text) => text.trim()).filter(Boolean))];
  const results = new Map<string, string>();
  const startedAt = Date.now();

  for (let offset = 0; offset < unique.length; offset += CONCURRENCY) {
    if (Date.now() - startedAt >= BATCH_BUDGET_MS) break;

    const chunk = unique.slice(offset, offset + CONCURRENCY);
    const translated = await Promise.all(
      chunk.map(async (text) => ({
        text,
        value: await translateToChinese(text),
      })),
    );

    for (const entry of translated) {
      if (entry.value) results.set(entry.text, entry.value);
    }
  }

  return results;
}

/**
 * 把 AniList 英文简介补成中文简介。
 *
 * 1. 先读 Supabase anime_cache.synopsis_chinese，已翻译过的直接复用；
 * 2. 只翻译缺中文的条目，并限制并发/总耗时；
 * 3. 翻译失败保持 null，前端展示英文 description；
 * 4. 调用方随后 upsert，将成功结果写入 Supabase。
 */
export async function attachChineseSynopses(
  items: AnimeItem[],
  supabase: SupabaseClient,
): Promise<AnimeItem[]> {
  if (items.length === 0) return items;

  const ids = items.map((item) => item.id);
  let cached = new Map<number, string>();

  try {
    const { data, error } = await supabase
      .from("anime_cache")
      .select("id, synopsis_chinese")
      .in("id", ids)
      .not("synopsis_chinese", "is", null)
      .returns<
        Array<{ id: number; synopsis_chinese: string | null }>
      >();

    if (error) throw new Error(error.message);

    cached = new Map(
      (data ?? [])
        .filter(
          (row): row is { id: number; synopsis_chinese: string } =>
            typeof row.synopsis_chinese === "string" &&
            row.synopsis_chinese.trim().length > 0,
        )
        .map((row) => [row.id, row.synopsis_chinese]),
    );
  } catch (error) {
    console.warn(
      "[translation] failed to read Supabase synopsis cache:",
      error instanceof Error ? error.message : String(error),
    );
  }

  const pending = items.filter(
    (item) =>
      !cached.has(item.id) &&
      !item.synopsisChinese &&
      Boolean(item.description?.trim()),
  );

  const translatedByText = await translateMany(
    pending.map((item) => item.description?.trim() ?? ""),
  );

  return items.map((item) => {
    const fromDb = cached.get(item.id) ?? null;
    const fromMemory = item.description
      ? translatedByText.get(item.description.trim()) ?? null
      : null;

    return {
      ...item,
      synopsisChinese: fromDb ?? item.synopsisChinese ?? fromMemory,
    };
  });
}
