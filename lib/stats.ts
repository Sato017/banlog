import { USER_ID, WATCHED_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type { RecentWatch, StatsResponse } from "@/lib/types";

export const RECENT_WATCH_LIMIT = 6;

/**
 * 统计与个人页共用同一数据服务。
 * totalWatched 直接来自 WatchRecord 表的 COUNT。
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
            seasonYear: true,
          },
        },
      },
    }),
  ]);

  const byFormat: Record<string, number> = {};
  for (const record of records) {
    const format = record.anime.format?.trim() || "UNKNOWN";
    byFormat[format] = (byFormat[format] ?? 0) + 1;
  }

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

  return { totalWatched, byFormat, recent };
}
