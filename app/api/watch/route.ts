import { NextRequest, NextResponse } from "next/server";

import { WATCHED_STATUS } from "@/lib/constants";
import {
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import type {
  ApiErrorBody,
  WatchToggleResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function jsonError(
  status: number,
  error: string,
  code: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error, code },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<WatchToggleResponse | ApiErrorBody>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError(401, "请先登录。", "UNAUTHORIZED");
  }

  let body: unknown;

  try {
    body = (await request.json()) as unknown;
  } catch {
    return jsonError(
      400,
      '请求体必须是 JSON，例如 { "animeId": 1 }。',
      "INVALID_JSON",
    );
  }

  if (!body || typeof body !== "object" || !("animeId" in body)) {
    return jsonError(
      400,
      '缺少 animeId，请求体应为 { "animeId": number }。',
      "MISSING_ANIME_ID",
    );
  }

  const animeId = (body as { animeId?: unknown }).animeId;
  if (
    typeof animeId !== "number" ||
    !Number.isSafeInteger(animeId) ||
    animeId <= 0
  ) {
    return jsonError(400, "animeId 必须是正整数。", "INVALID_ANIME_ID");
  }

  try {
    // anime_cache is shared and readable by authenticated users. Requiring the
    // row to exist prevents orphaned watch records.
    const { data: anime, error: cacheError } = await supabase
      .from("anime_cache")
      .select("id")
      .eq("id", animeId)
      .maybeSingle();

    if (cacheError) throw new Error(cacheError.message);

    if (!anime) {
      return jsonError(
        404,
        "这部动画尚未进入云端缓存，请先刷新列表后重试。",
        "ANIME_NOT_CACHED",
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("watch_records")
      .select("id")
      .eq("user_id", user.id)
      .eq("anime_id", animeId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { error: deleteError } = await supabase
        .from("watch_records")
        .delete()
        .eq("id", existing.id)
        .eq("user_id", user.id);

      if (deleteError) throw new Error(deleteError.message);

      return NextResponse.json(
        { watched: false },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    const { error: insertError } = await supabase
      .from("watch_records")
      .insert({
        user_id: user.id,
        anime_id: animeId,
        status: WATCHED_STATUS,
      });

    // A concurrent insert hits the unique(user_id, anime_id) constraint.
    // The final state is still "watched", so treat it as success.
    if (insertError && insertError.code !== "23505") {
      throw new Error(insertError.message);
    }

    return NextResponse.json(
      { watched: true },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[api/watch] Unexpected error:", error);
    return jsonError(
      500,
      "更新追番状态失败，请稍后重试。",
      "INTERNAL_ERROR",
    );
  }
}
