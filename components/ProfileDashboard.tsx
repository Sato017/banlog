"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CoverImage } from "@/components/CoverImage";
import { GenreRadar } from "@/components/GenreRadar";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  RefreshIcon,
  Spinner,
} from "@/components/icons";
import {
  getErrorMessage,
  requestJson,
} from "@/lib/client-api";
import {
  formatCount,
  formatMediaFormat,
  formatMediaMeta,
  formatWatchedAt,
  getAnimeTitle,
} from "@/lib/format";
import type { StatsResponse } from "@/lib/types";

type LoadStatus = "loading" | "ready" | "error";

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function formatJoinedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="正在加载追番统计">
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="skeleton h-[118px] rounded-xl" />
        <div className="skeleton h-[118px] rounded-xl" />
      </div>
      <div className="mt-10 border-t border-neutral-200 pt-6">
        <div className="skeleton h-5 w-24 rounded" />
        <div className="mt-4 flex gap-2">
          <div className="skeleton h-8 w-20 rounded-full" />
          <div className="skeleton h-8 w-24 rounded-full" />
          <div className="skeleton h-8 w-16 rounded-full" />
        </div>
      </div>
      <div className="mt-10 space-y-1 border-t border-neutral-200 pt-6">
        <div className="skeleton mb-4 h-5 w-24 rounded" />
        {[0, 1, 2].map((key) => (
          <div key={key} className="flex items-center gap-3 py-3">
            <div className="skeleton h-16 w-12 rounded-md" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-3 w-1/3 rounded" />
            </div>
          </div>
        ))}
      </div>
      <p className="sr-only">正在加载追番统计，请稍候。</p>
    </div>
  );
}

export function ProfileDashboard({
  email,
  createdAt,
}: {
  email: string;
  createdAt: string;
}) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setStatus("loading");
    setError(null);

    void (async () => {
      try {
        const data = await requestJson<StatsResponse>("/api/stats", {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        setStats(data);
        setStatus("ready");
      } catch (caught) {
        if (isAbortError(caught) || controller.signal.aborted) return;
        setError(
          getErrorMessage(caught, "读取追番统计失败，请稍后重试。"),
        );
        setStatus("error");
      }
    })();

    return () => controller.abort();
  }, [reloadToken]);

  const formatEntries = stats
    ? Object.entries(stats.byFormat).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          动画库
        </Link>
        <button
          type="button"
          onClick={() => setReloadToken((value) => value + 1)}
          disabled={status === "loading"}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-wait disabled:opacity-50"
        >
          {status === "loading" ? (
            <Spinner className="h-3 w-3" />
          ) : (
            <RefreshIcon className="h-3.5 w-3.5" />
          )}
          刷新
        </button>
      </div>

      <header className="mt-10 border-b border-neutral-200 pb-7">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
          My BanLog
        </p>
        <h1 className="mt-3 break-all text-2xl font-semibold tracking-[-0.03em] text-neutral-900 sm:text-3xl">
          {email}
        </h1>
        <p className="mt-2 text-xs text-neutral-400">
          加入于 {formatJoinedAt(createdAt)}
        </p>
      </header>

      {status === "loading" ? (
        <ProfileSkeleton />
      ) : status === "error" || !stats ? (
        <div
          role="alert"
          className="mt-10 rounded-xl border border-neutral-200 bg-white px-5 py-10 text-center"
        >
          <h2 className="text-sm font-medium text-neutral-900">
            暂时无法读取追番统计
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500">{error}</p>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-700"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      ) : (
        <>
          <section
            className="mt-6 grid grid-cols-2 gap-3"
            aria-label="追番数据概览"
          >
            <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
              <p className="text-[11px] text-neutral-400">总追番数</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-neutral-900 sm:text-4xl">
                {formatCount(stats.totalWatched)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-400">部动画</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
              <p className="text-[11px] text-neutral-400">总集数</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-neutral-900 sm:text-4xl">
                {formatCount(stats.totalEpisodes)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-400">集</p>
            </div>
          </section>

          <section className="mt-10 border-t border-neutral-200 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-900">
                类型分布
              </h2>
              <span className="text-[11px] text-neutral-400">
                共 {formatCount(stats.totalWatched)} 部
              </span>
            </div>

            {formatEntries.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {formatEntries.map(([format, count]) => (
                  <span
                    key={format}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600"
                  >
                    {formatMediaFormat(format)}
                    <span className="ml-1.5 font-medium text-neutral-900">
                      {count}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-neutral-400">
                还没有类型数据。
              </p>
            )}
          </section>

          <GenreRadar distribution={stats.genreDistribution} />

          <section className="mt-10 border-t border-neutral-200 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-900">
                最近动态
              </h2>
              <span className="text-[11px] text-neutral-400">
                最近 {stats.recent.length} 条
              </span>
            </div>

            {stats.recent.length > 0 ? (
              <ul className="mt-2 divide-y divide-neutral-100">
                {stats.recent.map((item) => {
                  const title = getAnimeTitle(item);
                  const meta = formatMediaMeta(
                    item.format,
                    item.seasonYear,
                  );

                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 py-3"
                    >
                      <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                        <CoverImage
                          src={item.coverUrl}
                          title={title}
                          className="h-full w-full"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className="line-clamp-1 text-sm font-medium text-neutral-900"
                          title={
                            item.titleNative && item.titleRomaji
                              ? `${item.titleNative} / ${item.titleRomaji}`
                              : title
                          }
                          lang={item.titleNative ? "ja" : undefined}
                        >
                          {title}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-neutral-400">
                          {meta ? <span>{meta}</span> : null}
                          {meta ? (
                            <span className="h-0.5 w-0.5 rounded-full bg-neutral-300" />
                          ) : null}
                          <time dateTime={item.watchedAt}>
                            {formatWatchedAt(item.watchedAt)}
                          </time>
                        </p>
                      </div>

                      <CheckIcon className="hidden h-4 w-4 shrink-0 text-neutral-300 sm:block" />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-neutral-900">
                  还没有追番记录
                </p>
                <p className="mt-2 text-sm text-neutral-500">
                  去动画库挑一部喜欢的吧。
                </p>
                <Link
                  href="/"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-700"
                >
                  去发现动画
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </section>

          <div className="mt-10 border-t border-neutral-200 pt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 transition-colors hover:text-neutral-900"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              返回动画库
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
