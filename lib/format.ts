import type { AnimeItem } from "@/lib/types";

const FORMAT_LABELS: Readonly<Record<string, string>> = {
  TV: "TV",
  TV_SHORT: "TV 短篇",
  MOVIE: "剧场版",
  SPECIAL: "特别篇",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "音乐",
  UNKNOWN: "其他",
};

type TitleFields = Pick<
  AnimeItem,
  "titleChinese" | "titleNative" | "titleRomaji"
>;

/** 主标题优先中文译名，其次日文原名，最后罗马音。 */
export function getAnimeTitle(item: TitleFields): string {
  return (
    item.titleChinese?.trim() ||
    item.titleNative?.trim() ||
    item.titleRomaji?.trim() ||
    "未命名动画"
  );
}

/** 卡片副标题使用日文原名；没有中文主标题时返回 null，避免重复。 */
export function getAnimeOriginalTitle(
  item: TitleFields,
): string | null {
  if (!item.titleChinese?.trim()) return null;
  return item.titleNative?.trim() || null;
}

export function formatMediaFormat(format: string | null | undefined): string {
  if (!format) return "其他";
  return FORMAT_LABELS[format] ?? format;
}

export function formatMediaMeta(
  format: string | null | undefined,
  seasonYear: number | null | undefined,
  episodes?: number | null,
): string {
  const parts: string[] = [];

  if (format) parts.push(formatMediaFormat(format));
  if (seasonYear && seasonYear > 0) parts.push(String(seasonYear));

  // 剧场版通常显示 1 集，信息价值不大，直接省略。
  if (format !== "MOVIE" && episodes && episodes > 0) {
    parts.push(`${episodes} 集`);
  }

  return parts.join(" · ");
}

export function formatWatchedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "时间未知";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}
