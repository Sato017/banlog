import { CheckIcon, PlusIcon, Spinner } from "@/components/icons";
import { CoverImage } from "@/components/CoverImage";
import {
  formatMediaMeta,
  getAnimeOriginalTitle,
  getAnimeTitle,
} from "@/lib/format";
import type { AnimeItem } from "@/lib/types";

export function AnimeCard({
  anime,
  watched,
  pending,
  eager,
  onToggle,
}: {
  anime: AnimeItem;
  watched: boolean;
  pending: boolean;
  eager?: boolean;
  onToggle: (anime: AnimeItem) => void;
}) {
  const title = getAnimeTitle(anime);
  const originalTitle = getAnimeOriginalTitle(anime);
  const showOriginalTitle =
    Boolean(originalTitle) && originalTitle !== title;
  const synopsis =
    anime.synopsisChinese?.trim() ||
    anime.description?.trim() ||
    "暂无简介";
  const meta = formatMediaMeta(
    anime.format,
    anime.seasonYear,
    anime.episodes,
  );

  return (
    <article className="flex gap-4 border-b border-neutral-200 py-5 first:pt-0 last:border-b-0 sm:gap-5">
      <div className="relative aspect-[3/4] w-[104px] shrink-0 overflow-hidden rounded-lg bg-neutral-100 sm:w-[128px] md:w-[144px]">
        <CoverImage src={anime.coverUrl} title={title} eager={eager} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-baseline gap-2 overflow-hidden">
          <h3
            className="min-w-0 truncate text-[15px] font-medium leading-6 text-neutral-900 sm:text-base"
            title={
              anime.titleNative && anime.titleChinese
                ? `${anime.titleChinese} / ${anime.titleNative}`
                : title
            }
          >
            {title}
          </h3>
          {showOriginalTitle ? (
            <p
              className="min-w-0 truncate text-xs text-neutral-400"
              lang="ja"
              title={originalTitle ?? undefined}
            >
              {originalTitle}
            </p>
          ) : null}
        </div>

        <p
          className={`mt-2 line-clamp-3 min-h-[3.9rem] text-[13px] leading-[1.55] ${
            anime.description || anime.synopsisChinese
              ? "text-neutral-600"
              : "text-neutral-400"
          }`}
          lang={anime.synopsisChinese ? "zh-CN" : "en"}
          title={
            anime.synopsisChinese?.trim() ||
            anime.description?.trim() ||
            "暂无简介"
          }
        >
          {synopsis}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <p className="truncate text-[11px] text-neutral-400">{meta}</p>

          <button
            type="button"
            onClick={() => onToggle(anime)}
            disabled={pending}
            aria-pressed={watched}
            aria-label={
              pending
                ? `正在更新《${title}》的追番状态`
                : watched
                  ? `取消追《${title}》`
                  : `标记《${title}》为已追`
            }
            title={watched ? "已追，点击取消" : "标记已追"}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-wait disabled:opacity-50 ${
              watched
                ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700"
                : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-900 hover:text-neutral-900"
            }`}
          >
            {pending ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : watched ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <PlusIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export function AnimeCardSkeleton() {
  return (
    <div className="flex gap-4 border-b border-neutral-200 py-5 first:pt-0 last:border-b-0 sm:gap-5">
      <div className="skeleton aspect-[3/4] w-[104px] shrink-0 rounded-lg sm:w-[128px] md:w-[144px]" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="skeleton h-5 w-2/3 rounded" />
        <div className="mt-3 skeleton h-4 w-1/2 rounded" />
        <div className="mt-3 space-y-2">
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-11/12 rounded" />
          <div className="skeleton h-3 w-3/4 rounded" />
        </div>
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}
