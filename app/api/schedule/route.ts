import { NextResponse } from "next/server";

import { AniListRequestError } from "@/lib/anilist";
import { fetchWeeklySchedule } from "@/lib/schedule";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type {
  ApiErrorBody,
  WeeklyScheduleResponse,
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
  extraHeaders?: HeadersInit,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error, code },
    {
      status,
      headers: {
        ...NO_STORE_HEADERS,
        ...(extraHeaders ?? {}),
      },
    },
  );
}

export async function GET(): Promise<
  NextResponse<WeeklyScheduleResponse | ApiErrorBody>
> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError(401, "请先登录。", "UNAUTHORIZED");
    }

    const schedule = await fetchWeeklySchedule();
    return NextResponse.json(schedule, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    if (error instanceof AniListRequestError) {
      if (error.code === "TIMEOUT") {
        return jsonError(
          504,
          "BanLog 连接放送数据源较慢，请稍后重试",
          "ANILIST_SCHEDULE_TIMEOUT",
        );
      }
      if (error.code === "RATE_LIMIT") {
        return jsonError(
          429,
          "AniList 放送表请求太频繁，请稍候再试。",
          "ANILIST_SCHEDULE_RATE_LIMIT",
          { "Retry-After": "3" },
        );
      }
      if (error.code === "INVALID_RESPONSE") {
        return jsonError(
          502,
          "AniList 放送表返回了无法识别的数据。",
          "ANILIST_SCHEDULE_INVALID_RESPONSE",
        );
      }
      return jsonError(
        503,
        "暂时无法连接 AniList 放送表，请稍后重试。",
        "ANILIST_SCHEDULE_UNAVAILABLE",
      );
    }

    console.error("[api/schedule] Unexpected error:", error);
    return jsonError(
      500,
      "服务器暂时开小差，请稍后重试。",
      "INTERNAL_ERROR",
    );
  }
}
