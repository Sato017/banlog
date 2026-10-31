import { USER_ID, WATCHED_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type {
  GenreStat,
  RecentWatch,
  StatsResponse,
} from "@/lib/types";

export const RECENT_WATCH_LIMIT = 6;

function parseGenres(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (genre): genre is string =>
            typeof genre === "string" && genre.trim().length > 0,
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * 统计与个人页共用同一数据服务。
 * totalWatched 来自 WatchRecord；题材分布来自 AnimeCache.genres。
 */
export async function getWatchStats(
  userId: string = USER_ID,
): Promise<StatsResponse> {
  const [totalWatched, records] = await prisma.$transaction([
    prisma.watchRecord.count({
      where: { userId, status: WATCHED_STATUS },
    }),
    prisma.watchRecord.findMany({
      where: { userId, status: WATCHED_STATUS },
      orderBy: [{ watchedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        animeId: true,
        watchedAt: true,
        anime: {
          select: {
            titleNative: true,
            titleRomaji: true,
            titleChinese: true,
            coverUrl: true,
            format: true,
            genres: true,
            seasonYear: true,
          },
        },
      },
    }),
  ]);

  const byFormat: Record<string, number> = {};
  const genreCounts = new Map<string, number>();

  for (const record of records) {
    const format = record.anime.format?.trim() || "UNKNOWN";
    byFormat[format] = (byFormat[format] ?? 0) + 1;

    for (const genre of new Set(parseGenres(record.anime.genres))) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }

  const genreDistribution: GenreStat[] = [...genreCounts.entries()]
    .map(([genre, count]) => ({
      genre,
      count,
      percentage:
        totalWatched > 0 ? Math.round((count / totalWatched) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre))
    .slice(0, 6);

  const recent: RecentWatch[] = records
    .slice(0, RECENT_WATCH_LIMIT)
    .map((record) => ({
      id: record.id,
      animeId: record.animeId,
      titleNative: record.anime.titleNative,
      titleRomaji: record.anime.titleRomaji,
      titleChinese: record.anime.titleChinese,
      coverUrl: record.anime.coverUrl,
      format: record.anime.format,
      seasonYear: record.anime.seasonYear,
      watchedAt: record.watchedAt.toISOString(),
    }));

  return { totalWatched, byFormat, genreDistribution, recent };
}
