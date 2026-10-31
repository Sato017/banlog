import type { PlotKey, SortKey } from "@/lib/filters";

/** 列表 API 返回的单部动画，字段与 AnimeCache 对应。 */
export interface AnimeItem {
  id: number;
  titleNative: string | null;
  titleRomaji: string | null;
  titleChinese: string | null;
  description: string | null;
  synopsisChinese: string | null;
  coverUrl: string | null;
  format: string | null;
  episodes: number | null;
  seasonYear: number | null;
  genres: string[];
}

export interface AnimeListResponse {
  items: AnimeItem[];
  /** 当前页中已经追过的动画 id；跨页时由前端合并。 */
  watchedIds: number[];
  page: number;
  hasNextPage: boolean;
  totalPages: number;
  totalItems: number;
  /** 用户输入的搜索词。 */
  query: string;
  /** 本次请求实际使用的类型筛选；全部时为 null。 */
  format: string | null;
  /** 兼容旧接口的题材筛选；新首页使用 plot。 */
  genre: string | null;
  plot: PlotKey;
  year: number | null;
  sort: SortKey;
  /** AniList 失败但存在本地旧缓存时为 true。 */
  stale: boolean;
  warning?: string;
}

export interface WatchToggleResponse {
  watched: boolean;
}

export interface RecentWatch {
  id: number;
  animeId: number;
  titleNative: string | null;
  titleRomaji: string | null;
  titleChinese: string | null;
  coverUrl: string | null;
  format: string | null;
  seasonYear: number | null;
  watchedAt: string;
}

export interface GenreStat {
  genre: string;
  count: number;
  percentage: number;
}

export interface StatsResponse {
  totalWatched: number;
  byFormat: Record<string, number>;
  /** 出现频率最高的前 6 个 AniList 题材。 */
  genreDistribution: GenreStat[];
  recent: RecentWatch[];
}

export interface AiringScheduleItem {
  id: number;
  mediaId: number;
  titleNative: string | null;
  titleRomaji: string | null;
  titleChinese: string | null;
  coverUrl: string | null;
  format: string | null;
  episode: number | null;
  airingAt: number;
}

export interface WeeklyScheduleResponse {
  weekStart: string;
  weekEnd: string;
  timeZone: string;
  items: AiringScheduleItem[];
  stale: boolean;
  warning?: string;
}

export interface ApiErrorBody {
  error: string;
  code?: string;
}
