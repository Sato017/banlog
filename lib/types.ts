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
  /** 本次请求实际使用的题材筛选；全部时为 null。 */
  genre: string | null;
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

export interface StatsResponse {
  totalWatched: number;
  byFormat: Record<string, number>;
  recent: RecentWatch[];
}

export interface ApiErrorBody {
  error: string;
  code?: string;
}
