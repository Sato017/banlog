import { PAGE_SIZE } from "@/lib/constants";
import { getChineseTitle } from "@/lib/chinese-titles";
import {
  getPlotFilter,
  getSortOption,
  type PlotKey,
  type SortKey,
} from "@/lib/filters";
import type { AnimeFormat } from "@/lib/formats";
import type { AnimeItem } from "@/lib/types";

const DEFAULT_ANILIST_ENDPOINT = "https://graphql.anilist.co";
const FRESH_CACHE_TTL_MS = 10 * 60 * 1000;
const STALE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 2;
// 串行请求，避免用户快速切换筛选时同时打满 AniList。
const MIN_REQUEST_GAP_MS = 350;

export type AniListErrorCode =
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "UPSTREAM"
  | "INVALID_RESPONSE";

export class AniListRequestError extends Error {
  readonly code: AniListErrorCode;
  readonly upstreamStatus: number | null;

  constructor(
    message: string,
    code: AniListErrorCode,
    upstreamStatus: number | null = null,
  ) {
    super(message);
    this.name = "AniListRequestError";
    this.code = code;
    this.upstreamStatus = upstreamStatus;
  }
}

interface AniListTitle {
  native?: string | null;
  romaji?: string | null;
}

interface AniListCoverImage {
  extraLarge?: string | null;
  large?: string | null;
}

interface AniListMedia {
  id?: number | null;
  title?: AniListTitle | null;
  description?: string | null;
  coverImage?: AniListCoverImage | null;
  format?: string | null;
  episodes?: number | null;
  seasonYear?: number | null;
  genres?: string[] | null;
}

interface AniListPageInfo {
  total?: number | null;
  currentPage?: number | null;
  lastPage?: number | null;
  hasNextPage?: boolean | null;
}

interface AniListPage {
  pageInfo?: AniListPageInfo | null;
  media?: AniListMedia[] | null;
}

interface AniListGraphQlResponse {
  data?: {
    Page?: AniListPage | null;
  } | null;
  errors?: Array<{
    message?: string;
    status?: number;
  }>;
}

export interface AniListPageResult {
  items: AnimeItem[];
  page: number;
  hasNextPage: boolean;
  totalPages: number;
  totalItems: number;
  format: AnimeFormat | null;
  genre: string | null;
  plot: PlotKey;
  year: number | null;
  sort: SortKey;
  stale: boolean;
}

export interface FetchAnimePageInput {
  query: string;
  page: number;
  format: AnimeFormat | null;
  plot: PlotKey;
  year: number | null;
  sort: SortKey;
  /** 保留旧接口的 genre 参数，首页新筛选不使用。 */
  genre?: string | null;
}

interface CacheEntry {
  expiresAt: number;
  savedAt: number;
  value: AniListPageResult;
}

interface AniListRuntimeState {
  freshCache: Map<string, CacheEntry>;
  staleCache: Map<string, CacheEntry>;
  inFlight: Map<string, Promise<AniListPageResult>>;
  queue: Promise<void>;
  lastRequestStart: number;
}

const globalForAniList = globalThis as unknown as {
  __banLogAniListState?: AniListRuntimeState;
};

const state: AniListRuntimeState =
  globalForAniList.__banLogAniListState ?? {
    freshCache: new Map(),
    staleCache: new Map(),
    inFlight: new Map(),
    queue: Promise.resolve(),
    lastRequestStart: 0,
  };

globalForAniList.__banLogAniListState = state;

export const ANILIST_QUERY = `
query AnimePage(
  $page: Int!
  $perPage: Int!
  $search: String
  $format: MediaFormat
  $genre: String
  $genres: [String]
  $tags: [String]
  $seasonYear: Int
  $sort: [MediaSort]
) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
    }
    media(
      type: ANIME
      search: $search
      format: $format
      genre: $genre
      genre_in: $genres
      tag_in: $tags
      seasonYear: $seasonYear
      sort: $sort
    ) {
      id
      title {
        native
        romaji
      }
      description
      coverImage {
        extraLarge
        large
      }
      format
      episodes
      seasonYear
      genres
    }
  }
}
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

/**
 * AniList 的 description 会混合 <br>、<i> 等标签与 HTML 实体。
 * 这里先统一去标签、解码常见实体、折叠空白，再按需求截取前 120 字符。
 */
export function cleanDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;
  return cleaned.slice(0, 120);
}

function normalizeMedia(raw: AniListMedia): AnimeItem | null {
  const id = toPositiveInteger(raw.id);
  if (!id) return null;

  const titleNative = normalizeString(raw.title?.native);
  const titleRomaji = normalizeString(raw.title?.romaji);
  const coverUrl =
    normalizeString(raw.coverImage?.extraLarge) ??
    normalizeString(raw.coverImage?.large);

  return {
    id,
    titleNative,
    titleRomaji,
    titleChinese: getChineseTitle(id),
    description: cleanDescription(raw.description),
    synopsisChinese: null,
    coverUrl,
    format: normalizeString(raw.format),
    episodes: toPositiveInteger(raw.episodes),
    seasonYear: toPositiveInteger(raw.seasonYear),
    genres: Array.isArray(raw.genres)
      ? raw.genres
          .filter(
            (genre): genre is string =>
              typeof genre === "string" && genre.trim().length > 0,
          )
          .map((genre) => genre.trim())
      : [],
  };
}

function setBoundedCache(
  cache: Map<string, CacheEntry>,
  key: string,
  entry: CacheEntry,
): void {
  cache.set(key, entry);
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey === "string") cache.delete(oldestKey);
  }
}

function endpoint(): string {
  const configured = process.env.ANILIST_API_URL?.trim();
  return configured || DEFAULT_ANILIST_ENDPOINT;
}

/**
 * 串行化出站请求并保证最小间隔。
 */
function enqueueRequest<T>(task: () => Promise<T>): Promise<T> {
  const run = state.queue.then(async () => {
    const waitMs = Math.max(
      0,
      MIN_REQUEST_GAP_MS - (Date.now() - state.lastRequestStart),
    );
    if (waitMs > 0) await sleep(waitMs);
    state.lastRequestStart = Date.now();
    return task();
  });

  state.queue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

async function fetchOnce(
  input: FetchAnimePageInput,
): Promise<Response> {
  const plot = getPlotFilter(input.plot);
  const variables: Record<string, string | number | string[]> = {
    page: input.page,
    perPage: PAGE_SIZE,
    sort: [getSortOption(input.sort).value],
  };

  if (input.query) variables.search = input.query;
  if (input.format) variables.format = input.format;
  if (input.genre) variables.genre = input.genre;
  if (plot.genres.length > 0) variables.genres = [...plot.genres];
  if (plot.tags.length > 0) variables.tags = [...plot.tags];
  if (input.year) variables.seasonYear = input.year;

  return enqueueRequest(() =>
    fetch(endpoint(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "BanLog/2.2 (local anime watch log)",
      },
      body: JSON.stringify({ query: ANILIST_QUERY, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
  );
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

async function requestAniListPage(
  input: FetchAnimePageInput,
): Promise<AniListPageResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await fetchOnce(input);
    } catch (error) {
      const timedOut = isTimeoutError(error);
      if (attempt < MAX_ATTEMPTS && !timedOut) {
        await sleep(500);
        continue;
      }

      throw new AniListRequestError(
        timedOut ? "AniList 请求超时" : "无法连接 AniList",
        timedOut ? "TIMEOUT" : "UPSTREAM",
      );
    }

    if (response.status === 429) {
      if (attempt < MAX_ATTEMPTS) {
        const retryAfter = response.headers.get("retry-after");
        const seconds = retryAfter ? Number(retryAfter) : NaN;
        await sleep(Number.isFinite(seconds) ? seconds * 1000 : 1500);
        continue;
      }
      throw new AniListRequestError(
        "AniList 请求频率过高",
        "RATE_LIMIT",
        429,
      );
    }

    if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
      await sleep(600);
      continue;
    }

    if (!response.ok) {
      throw new AniListRequestError(
        `AniList 返回 HTTP ${response.status}`,
        "UPSTREAM",
        response.status,
      );
    }

    let payload: AniListGraphQlResponse;
    try {
      payload = (await response.json()) as AniListGraphQlResponse;
    } catch {
      throw new AniListRequestError(
        "AniList 返回了非 JSON 内容",
        "INVALID_RESPONSE",
        response.status,
      );
    }

    if (payload.errors && payload.errors.length > 0) {
      const first = payload.errors[0];
      throw new AniListRequestError(
        first?.message || "AniList GraphQL 返回错误",
        "INVALID_RESPONSE",
        first?.status ?? response.status,
      );
    }

    const pageData = payload.data?.Page;
    if (!pageData || !Array.isArray(pageData.media)) {
      throw new AniListRequestError(
        "AniList 返回的数据结构不正确",
        "INVALID_RESPONSE",
        response.status,
      );
    }

    const items = pageData.media
      .map(normalizeMedia)
      .filter((item): item is AnimeItem => item !== null);

    const pageInfo = pageData.pageInfo;
    const currentPage = toPositiveInteger(pageInfo?.currentPage) ?? input.page;
    const lastPage = toPositiveInteger(pageInfo?.lastPage) ?? currentPage;
    const total = toPositiveInteger(pageInfo?.total) ?? items.length;
    const hasNextPage =
      typeof pageInfo?.hasNextPage === "boolean"
        ? pageInfo.hasNextPage
        : false;

    return {
      items,
      page: currentPage,
      hasNextPage,
      totalPages: lastPage,
      totalItems: total,
      format: input.format,
      genre: input.genre ?? null,
      plot: input.plot,
      year: input.year,
      sort: input.sort,
      stale: false,
    };
  }

  throw new AniListRequestError("AniList 请求失败", "UPSTREAM");
}

/**
 * 10 分钟内存缓存 + 同 key in-flight 合并 + 24 小时 stale 降级。
 */
export async function fetchAniListPage(
  input: FetchAnimePageInput,
): Promise<AniListPageResult> {
  const normalizedQuery = input.query.trim();
  const pageInput: FetchAnimePageInput = {
    ...input,
    query: normalizedQuery,
  };
  const cacheKey = [
    input.page,
    input.format ?? "ALL",
    input.genre ?? "ALL",
    input.plot,
    input.year ?? "ALL",
    input.sort,
    normalizedQuery.toLocaleLowerCase(),
  ].join("|");
  const now = Date.now();

  const fresh = state.freshCache.get(cacheKey);
  if (fresh && fresh.expiresAt > now) {
    return { ...fresh.value, stale: false };
  }

  const inFlight = state.inFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<AniListPageResult> => {
    try {
      const result = await requestAniListPage(pageInput);
      const savedAt = Date.now();
      const entry: CacheEntry = {
        expiresAt: savedAt + FRESH_CACHE_TTL_MS,
        savedAt,
        value: result,
      };
      setBoundedCache(state.freshCache, cacheKey, entry);
      setBoundedCache(state.staleCache, cacheKey, entry);
      return result;
    } catch (error) {
      const stale = state.staleCache.get(cacheKey);
      if (
        stale &&
        Date.now() - stale.savedAt <= STALE_CACHE_TTL_MS &&
        error instanceof AniListRequestError
      ) {
        return { ...stale.value, stale: true };
      }
      throw error;
    }
  })();

  state.inFlight.set(cacheKey, promise);

  try {
    return await promise;
  } finally {
    if (state.inFlight.get(cacheKey) === promise) {
      state.inFlight.delete(cacheKey);
    }
  }
}
