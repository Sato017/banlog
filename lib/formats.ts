/** 前端展示的筛选项；“全部”不会向 AniList 传 format。 */
export const FORMAT_TABS = [
  { value: "ALL", label: "全部" },
  { value: "TV", label: "TV" },
  { value: "MOVIE", label: "剧场版" },
  { value: "OVA", label: "OVA" },
  { value: "ONA", label: "ONA" },
] as const;

export type FormatTab = (typeof FORMAT_TABS)[number]["value"];

/** AniList MediaFormat 中本项目 API 接受的值。 */
export const SUPPORTED_FORMATS = [
  "TV",
  "TV_SHORT",
  "MOVIE",
  "SPECIAL",
  "OVA",
  "ONA",
  "MUSIC",
] as const;

export type AnimeFormat = (typeof SUPPORTED_FORMATS)[number];

export function isSupportedFormat(value: string): value is AnimeFormat {
  return (SUPPORTED_FORMATS as readonly string[]).includes(value);
}
