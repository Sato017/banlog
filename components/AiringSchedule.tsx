"use client";

import { useEffect, useState } from "react";

import { CoverImage } from "@/components/CoverImage";
import { RefreshIcon, Spinner } from "@/components/icons";
import {
  getErrorMessage,
  requestJson,
} from "@/lib/client-api";
import {
  formatMediaFormat,
  getAnimeTitle,
} from "@/lib/format";
import type {
  AiringScheduleItem,
  WeeklyScheduleResponse,
} from "@/lib/types";

const DAY_LABELS = [
  "周一",
  "周二",
  "周三",
  "周四",
  "周五",
  "周六",
  "周日",
] as const;

type LoadStatus = "loading" | "ready" | "error";

interface DayGroup {
  label: string;
  date: Date;
  items: AiringScheduleItem[];
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function weekDayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function buildWeekGroups(
  items: AiringScheduleItem[],
  weekStart: string,
): DayGroup[] {
  const monday = new Date(weekStart);
  monday.setHours(0, 0, 0, 0);

  const groups: DayGroup[] = DAY_LABELS.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { label, date, items: [] };
  });

  for (const item of items) {
    const date = new Date(item.airingAt * 1000);
    const index = weekDayIndex(date);
    groups[index]?.items.push(item);
  }

  return groups;
}

function formatDayDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatWeekRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  endDate.setDate(endDate.getDate() - 1);

  const formatter = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  });

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function formatAiringTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp * 1000));
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function ScheduleSkeleton() {
  return (
    <div aria-busy="true" aria-label="正在加载每日放送">
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="border-t border-neutral-200 py-5 first:border-t-0"
        >
          <div className="flex items-center gap-3">
            <div className="skeleton h-4 w-10 rounded" />
            <div className="skeleton h-3 w-12 rounded" />
          </div>
          <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {[0, 1].map((itemKey) => (
              <div key={itemKey} className="flex items-center gap-3">
                <div className="skeleton h-[72px] w-[54px] shrink-0 rounded-md" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="sr-only">正在加载本周放送表，请稍候。</p>
    </div>
  );
}

export function AiringSchedule() {
  const [data, setData] = useState<WeeklyScheduleResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setStatus("loading");
    setError(null);

    void (async () => {
      try {
        const result = await requestJson<WeeklyScheduleResponse>(
          "/api/schedule",
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;

        setData(result);
        setStatus("ready");
      } catch (caught) {
        if (isAbortError(caught) || controller.signal.aborted) return;
        setError(
          getErrorMessage(caught, "读取放送表失败，请稍后重试。"),
        );
        setStatus("error");
      }
    })();

    return () => controller.abort();
  }, [reloadToken]);

  const days = data ? buildWeekGroups(data.items, data.weekStart) : [];
  const totalItems = data?.items.length ?? 0;
  const localTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-neutral-900">
            每日放送
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            {data
              ? `${formatWeekRange(data.weekStart, data.weekEnd)} · 本周共 ${totalItems} 部更新`
              : "本周动画更新时间表"}
          </p>
        </div>
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

      <p className="mt-2 text-[11px] text-neutral-300">
        时间为本地时区（{localTimeZone}）。
      </p>

      <div className="mt-6 border-t border-neutral-200">
        {status === "loading" ? (
          <ScheduleSkeleton />
        ) : status === "error" || !data ? (
          <div
            role="alert"
            className="my-12 flex flex-col items-center px-4 text-center"
          >
            <p className="text-sm font-medium text-neutral-900">
              暂时无法读取放送表
            </p>
            <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
              {error}
            </p>
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
          <div>
            {days.map((day, dayIndex) => (
              <section
                key={day.label}
                className="border-b border-neutral-200 py-5 last:border-b-0"
              >
                <div className="flex items-baseline gap-3">
                  <h2
                    className={`text-sm font-medium ${
                      isToday(day.date)
                        ? "text-[#00a1d6]"
                        : "text-neutral-900"
                    }`}
                  >
                    {day.label}
                  </h2>
                  <span className="text-[11px] text-neutral-400">
                    {formatDayDate(day.date)}
                  </span>
                  <span className="text-[10px] text-neutral-300">
                    {day.items.length > 0
                      ? `${day.items.length} 部`
                      : "暂无更新"}
                  </span>
                </div>

                {day.items.length > 0 ? (
                  <div className="mt-3 grid gap-x-8 sm:grid-cols-2">
                    {day.items.map((item) => {
                      const title = getAnimeTitle(item);
                      const native = item.titleNative?.trim() || null;
                      const showNative =
                        Boolean(native) && native !== title;

                      return (
                        <article
                          key={item.id}
                          className="flex items-center gap-3 py-1.5"
                        >
                          <div className="h-[72px] w-[54px] shrink-0 overflow-hidden rounded-md bg-neutral-100">
                            <CoverImage
                              src={item.coverUrl}
                              title={title}
                              className="h-full w-full"
                              eager={dayIndex === 0}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-baseline gap-2">
                              <p
                                className="truncate text-sm font-medium text-neutral-900"
                                title={title}
                              >
                                {title}
                              </p>
                              {showNative ? (
                                <p
                                  className="truncate text-[10px] text-neutral-400"
                                  lang="ja"
                                  title={native ?? undefined}
                                >
                                  {native}
                                </p>
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-[11px] text-neutral-400">
                              {item.episode
                                ? `第 ${item.episode} 集`
                                : "集数未知"}
                              {" · "}
                              {formatMediaFormat(item.format)}
                            </p>
                          </div>
                          <time
                            dateTime={new Date(
                              item.airingAt * 1000,
                            ).toISOString()}
                            className="shrink-0 text-xs tabular-nums text-neutral-500"
                          >
                            {formatAiringTime(item.airingAt)}
                          </time>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
