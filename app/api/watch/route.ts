import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { USER_ID, WATCHED_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isMissingRecordError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<WatchToggleResponse | ApiErrorBody>> {
  let body: unknown;

  try {
    body = (await request.json()) as unknown;
  } catch {
    return jsonError(400, "请求体必须是 JSON，例如 { \"animeId\": 1 }。", "INVALID_JSON");
  }

  if (!body || typeof body !== "object" || !("animeId" in body)) {
    return jsonError(
      400,
      "缺少 animeId，请求体应为 { \"animeId\": number }。",
      "MISSING_ANIME_ID",
    );
  }

  const animeId = (body as { animeId?: unknown }).animeId;
  if (
    typeof animeId !== "number" ||
    !Number.isSafeInteger(animeId) ||
    animeId <= 0
  ) {
    return jsonError(
      400,
      "animeId 必须是正整数。",
      "INVALID_ANIME_ID",
    );
  }

  try {
    // 只接受已缓存到数据库的动画，防止写入孤立记录。
    const anime = await prisma.animeCache.findUnique({
      where: { id: animeId },
      select: { id: true },
    });

    if (!anime) {
      return jsonError(
        404,
        "这部动画尚未进入本地缓存，请先刷新列表后重试。",
        "ANIME_NOT_CACHED",
      );
    }

    const existing = await prisma.watchRecord.findUnique({
      where: {
        userId_animeId: {
          userId: USER_ID,
          animeId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      try {
        await prisma.watchRecord.delete({ where: { id: existing.id } });
      } catch (error) {
        // 同一部动画同时被两个请求取消时，最终状态仍是“未追”。
        if (!isMissingRecordError(error)) throw error;
      }

      return NextResponse.json(
        { watched: false },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    try {
      await prisma.watchRecord.create({
        data: {
          userId: USER_ID,
          animeId,
          status: WATCHED_STATUS,
        },
      });
    } catch (error) {
      // 并发重复创建由 @@unique([userId, animeId]) 兜底；
      // 唯一键冲突说明记录已存在，最终状态仍是“已追”。
      if (!isUniqueConstraintError(error)) throw error;
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
