"use client";

import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { AnimeCard, AnimeCardSkeleton } from "@/components/AnimeCard";
import {
  RefreshIcon,
  SearchIcon,
  Spinner,
  XIcon,
} from "@/components/icons";
import {
  getErrorMessage,
  requestJson,
} from "@/lib/client-api";
import { getAnimeTitle } from "@/lib/format";
import {
  FORMAT_TABS,
  type FormatTab,
} from "@/lib/formats";
import {
  GENRE_OPTIONS,
  type GenreValue,
} from "@/lib/genres";
import type { AnimeItem, AnimeListResponse } from "@/lib/types";

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

type RequestStatus = "loading" | "ready" | "error";
type ToastMessage = {
  kind: "success" | "info" | "error";
  text: string;
};

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function withWatchedValue(
  current: Set<number>,
  animeId: number,
  watched: boolean,
): Set<number> {
  const next = new Set(current);
  if (watched) next.add(animeId);
  else next.delete(animeId);
  return next;
}

function mergeUniqueById(
  current: AnimeItem[],
  incoming: AnimeItem[],
): AnimeItem[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}

async function fetchAnimeList(
  query: string,
  page: number,
  format: FormatTab,
  genre: GenreValue | "",
  signal: AbortSignal,
): Promise<AnimeListResponse> {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  if (format !== "ALL") params.set("format", format);
  if (genre) params.set("genre", genre);

  return requestJson<AnimeListResponse>(`/api/anime?${params.toString()}`, {
    signal,
  });
}

export function HomeBrowser() {
  const [input, setInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<FormatTab>("ALL");
  const [genreFilter, setGenreFilter] = useState<GenreValue | "">("");
  const [reloadToken, setReloadToken] = useState(0);

  const [items, setItems] = useState<AnimeItem[]>([]);
  const [watchedIds, setWatchedIds] = useState<Set<number>>(() => new Set());
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());
  const [status, setStatus] = useState<RequestStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const requestSequence = useRef(0);
  const loadMoreController = useRef<AbortController | null>(null);
  const pendingIdsRef = useRef<Set<number>>(new Set());

  // 500ms 防抖。
  useEffect(() => {
    const nextQuery = input.trim();
    if (nextQuery === debouncedQuery) return;

    const timer = window.setTimeout(() => {
      setDebouncedQuery(nextQuery);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [input, debouncedQuery]);

  // 搜索词、类型或题材变化时重新加载第 1 页。
  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    loadMoreController.current?.abort();
    loadMoreController.current = null;

    setStatus("loading");
    setError(null);
    setWarning(null);
    setItems([]);
    setWatchedIds(new Set());
    setPendingIds(new Set());
    pendingIdsRef.current = new Set();
    setPage(1);
    setHasNextPage(false);
    setIsLoadingMore(false);
    setLoadMoreError(null);

    void (async () => {
      try {
        const data = await fetchAnimeList(
          debouncedQuery,
          1,
          formatFilter,
          genreFilter,
          controller.signal,
        );

        if (
          controller.signal.aborted ||
          sequence !== requestSequence.current
        ) {
          return;
        }

        setItems(data.items);
        setWatchedIds(new Set(data.watchedIds));
        setPage(data.page);
        setHasNextPage(data.hasNextPage);
        setWarning(data.warning ?? null);
        setStatus("ready");
      } catch (caught) {
        if (
          isAbortError(caught) ||
          controller.signal.aborted ||
          sequence !== requestSequence.current
        ) {
          return;
        }

        setError(
          getErrorMessage(caught, "暂时无法加载动画，请稍后重试。"),
        );
        setStatus("error");
      }
    })();

    return () => controller.abort();
  }, [debouncedQuery, formatFilter, genreFilter, reloadToken]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 3_500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => loadMoreController.current?.abort();
  }, []);

  function runSearch(rawValue: string, force = false) {
    const nextQuery = rawValue.trim();
    setInput(nextQuery);

    if (nextQuery === debouncedQuery) {
      if (force) setReloadToken((value) => value + 1);
      return;
    }

    setDebouncedQuery(nextQuery);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(input, true);
  }

  function clearSearch() {
    setInput("");
    setDebouncedQuery("");
  }

  function resetFilters() {
    setInput("");
    setDebouncedQuery("");
    setFormatFilter("ALL");
    setGenreFilter("");

    if (
      debouncedQuery === "" &&
      formatFilter === "ALL" &&
      genreFilter === ""
    ) {
      setReloadToken((value) => value + 1);
    }
  }

  async function handleToggleWatch(anime: AnimeItem) {
    if (pendingIdsRef.current.has(anime.id)) return;

    const wasWatched = watchedIds.has(anime.id);
    const nextWatched = !wasWatched;
    const title = getAnimeTitle(anime);

    pendingIdsRef.current.add(anime.id);
    setPendingIds((current) => new Set(current).add(anime.id));
    setWatchedIds((current) =>
      withWatchedValue(current, anime.id, nextWatched),
    );

    try {
      const result = await requestJson<{ watched: boolean }>("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId: anime.id }),
      });

      setWatchedIds((current) =>
        withWatchedValue(current, anime.id, result.watched),
      );
      setToast({
        kind: result.watched ? "success" : "info",
        text: result.watched
          ? `已追《${title}》`
          : `已取消《${title}》`,
      });
    } catch (caught) {
      setWatchedIds((current) =>
        withWatchedValue(current, anime.id, wasWatched),
      );
      setToast({
        kind: "error",
        text: getErrorMessage(caught, "更新追番状态失败，请稍后重试。"),
      });
    } finally {
      pendingIdsRef.current.delete(anime.id);
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(anime.id);
        return next;
      });
    }
  }

  async function handleLoadMore() {
    if (!hasNextPage || isLoadingMore || status !== "ready") return;

    loadMoreController.current?.abort();
    const controller = new AbortController();
    loadMoreController.current = controller;

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const data = await fetchAnimeList(
        debouncedQuery,
        page + 1,
        formatFilter,
        genreFilter,
        controller.signal,
      );

      if (controller.signal.aborted) return;

      setItems((current) => mergeUniqueById(current, data.items));
      setWatchedIds((current) => {
        const next = new Set(current);
        for (const animeId of data.watchedIds) next.add(animeId);
        return next;
      });
      setPage(data.page);
      setHasNextPage(data.hasNextPage);
      if (data.warning) setWarning(data.warning);
    } catch (caught) {
      if (isAbortError(caught) || controller.signal.aborted) return;
      setLoadMoreError(
        getErrorMessage(caught, "加载更多失败，请稍后重试。"),
      );
    } finally {
      if (loadMoreController.current === controller) {
        loadMoreController.current = null;
        setIsLoadingMore(false);
      }
    }
  }

  const hasActiveFilter =
    debouncedQuery.length > 0 ||
    formatFilter !== "ALL" ||
    genreFilter !== "";

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
        <h1 className="sr-only">BanLog 动画库</h1>

        <form
          onSubmit={handleSubmit}
          role="search"
          className="flex items-center gap-2"
        >
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400" />
            <label htmlFor="anime-search" className="sr-only">
              搜索动画
            </label>
            <input
              id="anime-search"
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="搜索动画 / 日文原名 / 罗马音"
              maxLength={100}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-10 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/5"
            />
            {input ? (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="清空搜索"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            className="h-11 shrink-0 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-700 sm:px-5"
          >
            搜索
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="按作品类型筛选"
          >
            {FORMAT_TABS.map((tab) => {
              const active = formatFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFormatFilter(tab.value)}
                  aria-pressed={active}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-900"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <label htmlFor="genre-filter" className="sr-only">
            按题材筛选
          </label>
          <select
            id="genre-filter"
            value={genreFilter}
            onChange={(event) =>
              setGenreFilter(event.target.value as GenreValue | "")
            }
            className="h-[30px] cursor-pointer rounded-full border border-neutral-200 bg-white px-3 text-xs text-neutral-500 outline-none transition-colors hover:border-neutral-300 hover:text-neutral-900 focus:border-neutral-400 sm:ml-auto"
          >
            <option value="">全部题材</option>
            {GENRE_OPTIONS.map((genre) => (
              <option key={genre.value} value={genre.value}>
                {genre.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-7 sm:px-6 lg:px-8">
        <p className="sr-only" aria-live="polite">
          {status === "loading"
            ? "正在加载动画"
            : status === "error"
              ? "动画加载失败"
              : `已显示 ${items.length} 部动画`}
        </p>

        {warning ? (
          <p
            role="status"
            className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"
          >
            {warning}
          </p>
        ) : null}

        {status === "loading" ? (
          <div
            aria-busy="true"
            aria-label="正在加载动画"
            className="flex flex-col"
          >
            {SKELETON_KEYS.map((key) => (
              <AnimeCardSkeleton key={key} />
            ))}
          </div>
        ) : status === "error" ? (
          <div
            role="alert"
            className="flex flex-col items-center rounded-xl border border-neutral-200 bg-white px-5 py-16 text-center"
          >
            <p className="text-sm font-medium text-neutral-900">
              加载失败
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
        ) : items.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm font-medium text-neutral-900">
              没有找到相关动画
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              换个关键词、作品类型或题材试试。
            </p>
            {hasActiveFilter ? (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:text-neutral-900"
              >
                清除筛选
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex flex-col">
              {items.map((anime, index) => (
                <AnimeCard
                  key={anime.id}
                  anime={anime}
                  watched={watchedIds.has(anime.id)}
                  pending={pendingIds.has(anime.id)}
                  eager={index < 3}
                  onToggle={handleToggleWatch}
                />
              ))}
            </div>

            <div className="mt-12 flex flex-col items-center gap-3">
              {loadMoreError ? (
                <p
                  role="alert"
                  className="text-center text-xs text-red-600"
                >
                  {loadMoreError}
                </p>
              ) : null}

              {hasNextPage ? (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-2 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-wait disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <Spinner className="h-3.5 w-3.5" />
                      加载中
                    </>
                  ) : (
                    "加载更多"
                  )}
                </button>
              ) : (
                <p className="text-[11px] text-neutral-300">END</p>
              )}
            </div>
          </>
        )}
      </section>

      {toast ? (
        <div
          role={toast.kind === "error" ? "alert" : "status"}
          className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              toast.kind === "error" ? "bg-red-400" : "bg-emerald-400"
            }`}
          />
          <p className="flex-1 leading-5">{toast.text}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="关闭提示"
            className="rounded-full p-1 text-white/50 transition-colors hover:text-white"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </>
  );
}
