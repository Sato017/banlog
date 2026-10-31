import { NextResponse } from "next/server";

import { getWatchStats } from "@/lib/stats";
import type { ApiErrorBody, StatsResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export async function GET(): Promise<
  NextResponse<StatsResponse | ApiErrorBody>
> {
  try {
    const stats = await getWatchStats();
    return NextResponse.json(stats, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("[api/stats] Unexpected error:", error);
    return NextResponse.json(
      { error: "读取追番统计失败，请稍后重试。", code: "INTERNAL_ERROR" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
