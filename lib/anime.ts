import { USER_ID, WATCHED_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import type { AnimeItem } from "@/lib/types";

/**
 * 将当前页 AniList 动画写入 AnimeCache。
 * 列表接口已经返回展示所需字段，不逐部请求详情。
 */
export async function upsertAnimeCache(items: AnimeItem[]): Promise<void> {
  if (items.length === 0) return;

  await prisma.$transaction(
    items.map((item) => {
      const titleChinese = item.titleChinese?.trim() || null;
      const synopsisChinese = item.synopsisChinese?.trim() || null;
      const genres = item.genres.length > 0 ? JSON.stringify(item.genres) : null;

      return prisma.animeCache.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          titleNative: item.titleNative,
          titleRomaji: item.titleRomaji,
          titleChinese,
          description: item.description,
          synopsisChinese,
          coverUrl: item.coverUrl,
          format: item.format,
          genres,
          episodes: item.episodes,
          seasonYear: item.seasonYear,
        },
        update: {
          titleNative: item.titleNative,
          titleRomaji: item.titleRomaji,
          description: item.description,
          coverUrl: item.coverUrl,
          format: item.format,
          episodes: item.episodes,
          seasonYear: item.seasonYear,
          // 映射或翻译暂时不可用时，不要用 null 覆盖已经缓存的中文。
          ...(titleChinese ? { titleChinese } : {}),
          ...(synopsisChinese ? { synopsisChinese } : {}),
          ...(genres ? { genres } : {}),
        },
      });
    }),
  );
}

/** 查询当前页中已被 local 用户追过的 AniList media id。 */
export async function findWatchedIds(
  animeIds: number[],
  userId: string = USER_ID,
): Promise<number[]> {
  if (animeIds.length === 0) return [];

  const rows = await prisma.watchRecord.findMany({
    where: {
      userId,
      animeId: { in: animeIds },
      status: WATCHED_STATUS,
    },
    select: { animeId: true },
  });

  return rows.map((row) => row.animeId);
}
