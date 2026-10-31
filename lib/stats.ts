import type { SupabaseClient } from "@supabase/supabase-js";

import { WATCHED_STATUS } from "@/lib/constants";
import type {
  GenreStat,
  RecentWatch,
  StatsResponse,
} from "@/lib/types";

export const RECENT_WATCH_LIMIT = 10;

interface WatchRecordRow {
  id: number;
  anime_id: number;
  watched_at: string;
  anime_cache: {
    title_native: string | null;
    title_romaji: string | null;
    title_chinese: string | null;
    cover_url: string | null;
    format: string | null;
    genres: string[] | null;
    episodes: number | null;
    season_year: number | null;
  };
}

/**
 * The watch_records query is protected by RLS. anime_cache is joined for
 * display and for computing episode/genre statistics.
 */
export async function getWatchStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<StatsResponse> {
  const { data, error } = await supabase
    .from("watch_records")
    .select(
      `
        id,
        anime_id,
        watched_at,
        anime_cache!inner (
          title_native,
          title_romaji,
          title_chinese,
          cover_url,
          format,
          genres,
          episodes,
          season_year
        )
      `,
    )
    .eq("user_id", userId)
    .eq("status", WATCHED_STATUS)
    .order("watched_at", { ascending: false })
    .order("id", { ascending: false })
    .returns<WatchRecordRow[]>();

  if (error) {
    throw new Error(`读取追番统计失败：${error.message}`);
  }

  const records = data ?? [];
  const byFormat: Record<string, number> = {};
  const genreCounts = new Map<string, number>();
  let totalEpisodes = 0;

  for (const record of records) {
    const anime = record.anime_cache;
    const format = anime.format?.trim() || "UNKNOWN";
    byFormat[format] = (byFormat[format] ?? 0) + 1;
    totalEpisodes += anime.episodes ?? 0;

    for (const genre of new Set(anime.genres ?? [])) {
      if (!genre.trim()) continue;
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }

  const totalWatched = records.length;

  const genreDistribution: GenreStat[] = [...genreCounts.entries()]
    .map(([genre, count]) => ({
      genre,
      count,
      percentage:
        totalWatched > 0
          ? Math.round((count / totalWatched) * 100)
          : 0,
    }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre))
    .slice(0, 6);

  const recent: RecentWatch[] = records
    .slice(0, RECENT_WATCH_LIMIT)
    .map((record) => ({
      id: record.id,
      animeId: record.anime_id,
      titleNative: record.anime_cache.title_native,
      titleRomaji: record.anime_cache.title_romaji,
      titleChinese: record.anime_cache.title_chinese,
      coverUrl: record.anime_cache.cover_url,
      format: record.anime_cache.format,
      seasonYear: record.anime_cache.season_year,
      watchedAt: record.watched_at,
    }));

  return {
    totalWatched,
    totalEpisodes,
    byFormat,
    genreDistribution,
    recent,
  };
}
