import type { SupabaseClient } from "@supabase/supabase-js";

import { WATCHED_STATUS } from "@/lib/constants";
import type { AnimeItem } from "@/lib/types";

interface AnimeCacheRow {
  id: number;
  title_native: string | null;
  title_romaji: string | null;
  title_chinese: string | null;
  description: string | null;
  synopsis_chinese: string | null;
  cover_url: string | null;
  format: string | null;
  genres: string[];
  episodes: number | null;
  season_year: number | null;
  updated_at: string;
}

function toCacheRow(item: AnimeItem): AnimeCacheRow {
  return {
    id: item.id,
    title_native: item.titleNative?.trim() || null,
    title_romaji: item.titleRomaji?.trim() || null,
    title_chinese: item.titleChinese?.trim() || null,
    description: item.description?.trim() || null,
    synopsis_chinese: item.synopsisChinese?.trim() || null,
    cover_url: item.coverUrl,
    format: item.format,
    genres: item.genres,
    episodes: item.episodes,
    season_year: item.seasonYear,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Upsert the shared AniList cache with the service-role client.
 * anime_cache is intentionally read-only for authenticated browser clients.
 */
export async function upsertAnimeCache(
  admin: SupabaseClient,
  items: AnimeItem[],
): Promise<void> {
  if (items.length === 0) return;

  const { error } = await admin
    .from("anime_cache")
    .upsert(items.map(toCacheRow), { onConflict: "id" });

  if (error) {
    throw new Error(`写入 anime_cache 失败：${error.message}`);
  }
}

/** Query which media ids this user has already watched. RLS enforces ownership. */
export async function findWatchedIds(
  supabase: SupabaseClient,
  animeIds: number[],
  userId: string,
): Promise<number[]> {
  if (animeIds.length === 0) return [];

  const { data, error } = await supabase
    .from("watch_records")
    .select("anime_id")
    .eq("user_id", userId)
    .eq("status", WATCHED_STATUS)
    .in("anime_id", animeIds)
    .returns<Array<{ anime_id: number }>>();

  if (error) {
    throw new Error(`读取追番记录失败：${error.message}`);
  }

  return (data ?? []).map((row) => row.anime_id);
}
