/**
 * 主页“按剧情 / 按年份 / 按排序”的筛选项。
 *
 * AniList 的 GenreCollection 没有“后宫、校园、青春、百合、治愈”等概念，
 * 这些选项使用 AniList 的 tag_in；能在 GenreCollection 中精确对应的选项
 * 使用 genre_in（例如“热血” -> Action，“恋爱” -> Romance）。
 */
export const PLOT_FILTERS = [
  { key: "all", label: "全部", genres: [], tags: [] },
  {
    key: "harem",
    label: "后宫",
    genres: [],
    tags: ["Female Harem", "Male Harem", "Mixed Gender Harem"],
  },
  { key: "school", label: "校园", genres: [], tags: ["School"] },
  { key: "love", label: "爱情", genres: ["Romance"], tags: [] },
  { key: "romance", label: "恋爱", genres: ["Romance"], tags: [] },
  { key: "hotblooded", label: "热血", genres: ["Action"], tags: [] },
  { key: "battle", label: "战斗", genres: ["Action"], tags: [] },
  { key: "sports", label: "竞技", genres: ["Sports"], tags: [] },
  {
    key: "youth",
    label: "青春",
    genres: [],
    tags: ["Coming of Age"],
  },
  { key: "yuri", label: "百合", genres: [], tags: ["Yuri"] },
  { key: "healing", label: "治愈", genres: [], tags: ["Iyashikei"] },
  { key: "comedy", label: "喜剧", genres: ["Comedy"], tags: [] },
  { key: "action", label: "动作", genres: ["Action"], tags: [] },
  { key: "scifi", label: "科幻", genres: ["Sci-Fi"], tags: [] },
  { key: "fantasy", label: "奇幻", genres: ["Fantasy"], tags: [] },
  { key: "adventure", label: "冒险", genres: ["Adventure"], tags: [] },
  { key: "funny", label: "搞笑", genres: ["Comedy"], tags: [] },
  { key: "mystery", label: "悬疑", genres: ["Mystery"], tags: [] },
] as const;

export type PlotKey = (typeof PLOT_FILTERS)[number]["key"];
export type PlotFilter = (typeof PLOT_FILTERS)[number];

export const DEFAULT_PLOT: PlotKey = "all";

export function isPlotKey(value: string): value is PlotKey {
  return PLOT_FILTERS.some((item) => item.key === value);
}

export function getPlotFilter(key: PlotKey): PlotFilter {
  return PLOT_FILTERS.find((item) => item.key === key) ?? PLOT_FILTERS[0];
}

export const YEAR_OPTIONS = [
  "all",
  ...Array.from({ length: 15 }, (_, index) => String(2026 - index)),
] as const;

const YEAR_OPTION_SET = new Set<string>(YEAR_OPTIONS);

export function isYearFilter(value: string): boolean {
  return YEAR_OPTION_SET.has(value);
}

export const SORT_OPTIONS = [
  {
    key: "time",
    label: "时间",
    value: "START_DATE_DESC",
  },
  {
    key: "popularity",
    label: "人气",
    value: "POPULARITY_DESC",
  },
  {
    key: "score",
    label: "评分",
    value: "SCORE_DESC",
  },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["key"];
export type AniListSort = (typeof SORT_OPTIONS)[number]["value"];

export const DEFAULT_SORT: SortKey = "popularity";

export function isSortKey(value: string): value is SortKey {
  return SORT_OPTIONS.some((item) => item.key === value);
}

export function getSortOption(key: SortKey): (typeof SORT_OPTIONS)[number] {
  return SORT_OPTIONS.find((item) => item.key === key) ?? SORT_OPTIONS[1];
}
