import { NextResponse } from "next/server";

import { getWatchStats } from "@/lib/stats";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ApiErrorBody, StatsResponse } from "@/lib/types";

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

export async function GET(): Promise<
  NextResponse<StatsResponse | ApiErrorBody>
> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError(401, "请先登录。", "UNAUTHORIZED");
    }

    const stats = await getWatchStats(supabase, user.id);
    return NextResponse.json(stats, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("[api/stats] Unexpected error:", error);
    return jsonError(
      500,
      "读取追番统计失败，请稍后重试。",
      "INTERNAL_ERROR",
    );
  }
}
