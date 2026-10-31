import { NextRequest, NextResponse } from "next/server";

import { findWatchedIds, upsertAnimeCache } from "@/lib/anime";
import {
  AniListRequestError,
  fetchAniListPage,
} from "@/lib/anilist";
import {
  isSupportedFormat,
  type AnimeFormat,
} from "@/lib/formats";
import {
  isSupportedGenre,
  type GenreValue,
} from "@/lib/genres";
import {
  isPlotKey,
  isSortKey,
  isYearFilter,
  DEFAULT_SORT,
  type PlotKey,
  type SortKey,
} from "@/lib/filters";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase-server";
import { attachChineseSynopses } from "@/lib/translation";
import type { AnimeListResponse, ApiErrorBody } from "@/lib/types";

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

function mapAniListError(
  error: AniListRequestError,
): NextResponse<ApiErrorBody> {
  if (error.code === "TIMEOUT") {
    return jsonError(
      504,
      "BanLog 连接数据源较慢，请稍后重试",
      "ANILIST_TIMEOUT",
    );
  }

  if (error.code === "RATE_LIMIT") {
    return jsonError(
      429,
      "AniList 请求太频繁了，请稍候几秒再试。",
      "ANILIST_RATE_LIMIT",
      { "Retry-After": "3" },
    );
  }

  if (error.code === "INVALID_RESPONSE") {
    return jsonError(
      502,
      "AniList 返回的数据格式异常，请稍后重试。",
      "ANILIST_INVALID_RESPONSE",
    );
  }

  return jsonError(
    503,
    "BanLog 暂时无法连接 AniList，请稍后重试。",
    "ANILIST_UNAVAILABLE",
  );
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<AnimeListResponse | ApiErrorBody>> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError(401, "请先登录。", "UNAUTHORIZED");
  }

  const { searchParams } = new URL(request.url);
  const rawPage = searchParams.get("page") ?? "1";
  const rawQuery = searchParams.get("q") ?? "";
  const rawFormat = (searchParams.get("format") ?? "").trim().toUpperCase();
  const rawGenre = (searchParams.get("genre") ?? "").trim();
  const rawPlot = (searchParams.get("plot") ?? "all").trim();
  const rawYear = (searchParams.get("year") ?? "all").trim();
  const rawSort = (searchParams.get("sort") ?? DEFAULT_SORT).trim();

  const page = Number(rawPage);
  if (
    !/^\d+$/.test(rawPage) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1000
  ) {
    return jsonError(
      400,
      "page 必须是 1 到 1000 之间的整数。",
      "INVALID_PAGE",
    );
  }

  const query = rawQuery.trim().slice(0, 100);
  let format: AnimeFormat | null = null;
  let genre: GenreValue | null = null;
  let plot: PlotKey = "all";
  let year: number | null = null;
  let sort: SortKey = DEFAULT_SORT;

  if (rawFormat && rawFormat !== "ALL") {
    if (!isSupportedFormat(rawFormat)) {
      return jsonError(
        400,
        "format 参数不受支持，可用值为 TV、MOVIE、OVA、ONA 等 AniList 格式。",
        "INVALID_FORMAT",
      );
    }
    format = rawFormat;
  }

  if (rawGenre) {
    if (!isSupportedGenre(rawGenre)) {
      return jsonError(
        400,
        "genre 参数不受支持，请使用 Action、Romance 等 AniList 题材名。",
        "INVALID_GENRE",
      );
    }
    genre = rawGenre;
  }

  if (!isPlotKey(rawPlot)) {
    return jsonError(400, "plot 参数不受支持。", "INVALID_PLOT");
  }
  plot = rawPlot;

  if (rawYear !== "all") {
    if (!isYearFilter(rawYear)) {
      return jsonError(400, "year 参数无效。", "INVALID_YEAR");
    }
    const parsedYear = Number(rawYear);
    if (parsedYear < 1900 || parsedYear > 2100) {
      return jsonError(400, "year 参数超出范围。", "INVALID_YEAR");
    }
    year = parsedYear;
  }

  if (!isSortKey(rawSort)) {
    return jsonError(400, "sort 参数不受支持。", "INVALID_SORT");
  }
  sort = rawSort;

  try {
    const pageData = await fetchAniListPage({
      query,
      page,
      format,
      genre,
      plot,
      year,
      sort,
    });
    const items = await attachChineseSynopses(pageData.items, supabase);

    // List responses populate the shared cache. The service-role client is
    // required because anime_cache is read-only for authenticated users.
    const admin = createSupabaseAdminClient();
    await upsertAnimeCache(admin, items);
    const watchedIds = await findWatchedIds(
      supabase,
      items.map((item) => item.id),
      user.id,
    );

    const response: AnimeListResponse = {
      items,
      watchedIds,
      page: pageData.page,
      hasNextPage: pageData.hasNextPage,
      totalPages: pageData.totalPages,
      totalItems: pageData.totalItems,
      query,
      format: pageData.format,
      genre: pageData.genre,
      plot: pageData.plot,
      year: pageData.year,
      sort: pageData.sort,
      stale: pageData.stale,
      ...(pageData.stale
        ? {
            warning:
              "AniList 暂时不可用，当前展示的是最近一次成功获取的缓存数据。",
          }
        : {}),
    };

    return NextResponse.json(response, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    if (error instanceof AniListRequestError) {
      console.warn(
        "[api/anime] AniList error:",
        error.code,
        error.message,
      );
      return mapAniListError(error);
    }

    console.error("[api/anime] Unexpected error:", error);
    return jsonError(
      500,
      "服务器暂时开小差，请稍后重试。",
      "INTERNAL_ERROR",
    );
  }
}
