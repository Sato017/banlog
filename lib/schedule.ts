import {
  AniListRequestError,
} from "@/lib/anilist";
import { getChineseTitle } from "@/lib/chinese-titles";
import type {
  AiringScheduleItem,
  WeeklyScheduleResponse,
} from "@/lib/types";

const DEFAULT_ANILIST_ENDPOINT = "https://graphql.anilist.co";
const ENDPOINT =
  process.env.ANILIST_API_URL?.trim() || DEFAULT_ANILIST_ENDPOINT;
const CACHE_TTL_MS = 10 * 60 * 1000;
const PAGE_SIZE = 50;
const MAX_PAGES = 6;
const REQUEST_TIMEOUT_MS = 12_000;
const PAGE_GAP_MS = 250;

const SCHEDULE_QUERY = `
query WeeklySchedule($start: Int, $end: Int, $page: Int) {
  Page(page: $page, perPage: ${PAGE_SIZE}) {
    pageInfo {
      currentPage
      hasNextPage
    }
    airingSchedules(
      airingAt_greater: $start
      airingAt_lesser: $end
      sort: TIME
    ) {
      id
      airingAt
      episode
      media {
        id
        type
        isAdult
        title {
          native
          romaji
        }
        coverImage {
          extraLarge
          large
        }
        format
      }
    }
  }
}
`;

interface AniListScheduleMedia {
  id?: number | null;
  type?: string | null;
  isAdult?: boolean | null;
  title?: {
    native?: string | null;
    romaji?: string | null;
  } | null;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
  } | null;
  format?: string | null;
}

interface AniListSchedule {
  id?: number | null;
  airingAt?: number | null;
  episode?: number | null;
  media?: AniListScheduleMedia | null;
}

interface AniListSchedulePage {
  data?: {
    Page?: {
      pageInfo?: {
        hasNextPage?: boolean | null;
      } | null;
      airingSchedules?: AniListSchedule[] | null;
    } | null;
  } | null;
  errors?: Array<{ message?: string; status?: number }>;
}

interface ScheduleCacheEntry {
  expiresAt: number;
  value: WeeklyScheduleResponse;
}

interface ScheduleState {
  cache: ScheduleCacheEntry | null;
  inFlight: Promise<WeeklyScheduleResponse> | null;
}

const globalForSchedule = globalThis as unknown as {
  __banLogScheduleState?: ScheduleState;
};

const state: ScheduleState =
  globalForSchedule.__banLogScheduleState ?? {
    cache: null,
    inFlight: null,
  };

globalForSchedule.__banLogScheduleState = state;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
    ? value
    : null;
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

/**
 * 以服务器本地时区计算本周一 00:00 到下周一 00:00。
 * 展示时前端使用浏览器的本地时区格式化和分组。
 */
export function getCurrentWeekRange(now = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { start, end };
}

function normalizeSchedule(
  schedule: AniListSchedule,
): AiringScheduleItem | null {
  const id = positiveInteger(schedule.id);
  const media = schedule.media;
  const mediaId = positiveInteger(media?.id);
  const airingAt = positiveInteger(schedule.airingAt);

  if (
    !id ||
    !mediaId ||
    !airingAt ||
    media?.type !== "ANIME" ||
    media?.isAdult === true
  ) {
    return null;
  }

  return {
    id,
    mediaId,
    titleNative: normalizeString(media.title?.native),
    titleRomaji: normalizeString(media.title?.romaji),
    titleChinese: getChineseTitle(mediaId),
    coverUrl:
      normalizeString(media.coverImage?.extraLarge) ??
      normalizeString(media.coverImage?.large),
    format: normalizeString(media.format),
    episode: positiveInteger(schedule.episode),
    airingAt,
  };
}

async function fetchSchedulePage(
  startSec: number,
  endSec: number,
  page: number,
): Promise<AniListSchedulePage["data"]> {
  let response: Response;

  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "BanLog/2.2 (weekly schedule)",
      },
      body: JSON.stringify({
        query: SCHEDULE_QUERY,
        variables: { start: startSec, end: endSec, page },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AniListRequestError(
      isTimeoutError(error) ? "AniList 放送表请求超时" : "无法连接 AniList",
      isTimeoutError(error) ? "TIMEOUT" : "UPSTREAM",
    );
  }

  if (response.status === 429) {
    throw new AniListRequestError(
      "AniList 放送表请求频率过高",
      "RATE_LIMIT",
      429,
    );
  }

  if (!response.ok) {
    throw new AniListRequestError(
      `AniList 放送表返回 HTTP ${response.status}`,
      "UPSTREAM",
      response.status,
    );
  }

  const payload = (await response.json()) as AniListSchedulePage;
  if (payload.errors?.length) {
    throw new AniListRequestError(
      payload.errors[0]?.message || "AniList 放送表返回错误",
      "INVALID_RESPONSE",
      payload.errors[0]?.status ?? response.status,
    );
  }

  return payload.data;
}

async function loadWeeklySchedule(): Promise<WeeklyScheduleResponse> {
  const { start, end } = getCurrentWeekRange();
  const startSec = Math.floor(start.getTime() / 1000);
  const endSec = Math.floor(end.getTime() / 1000);
  const byId = new Map<number, AiringScheduleItem>();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (page > 1) await sleep(PAGE_GAP_MS);

    const data = await fetchSchedulePage(startSec, endSec, page);
    const schedules = data?.Page?.airingSchedules ?? [];

    for (const schedule of schedules) {
      const item = normalizeSchedule(schedule);
      if (item) byId.set(item.id, item);
    }

    if (schedules.length === 0 || !data?.Page?.pageInfo?.hasNextPage) {
      break;
    }
  }

  const items = [...byId.values()].sort(
    (a, b) => a.airingAt - b.airingAt,
  );

  return {
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    timeZone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
    items,
    stale: false,
  };
}

/** 10 分钟内存缓存；同一时间只有一个放送表请求。 */
export async function fetchWeeklySchedule(): Promise<WeeklyScheduleResponse> {
  if (state.cache && state.cache.expiresAt > Date.now()) {
    return state.cache.value;
  }
  if (state.inFlight) return state.inFlight;

  const promise = (async () => {
    try {
      const value = await loadWeeklySchedule();
      state.cache = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value,
      };
      return value;
    } finally {
      state.inFlight = null;
    }
  })();

  state.inFlight = promise;
  return promise;
}
