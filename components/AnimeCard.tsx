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
    <article className="flex h-full min-w-0 flex-col gap-2.5 sm:h-auto sm:flex-row sm:gap-5 sm:border-b sm:border-neutral-200 sm:py-5 sm:first:pt-0 sm:last:border-b-0">
      <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-lg bg-neutral-100 sm:w-[128px] md:w-[144px]">
        <CoverImage src={anime.coverUrl} title={title} eager={eager} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 flex-col items-start gap-0.5 overflow-hidden sm:flex-row sm:items-baseline sm:gap-2">
          <h3
            className="line-clamp-2 min-w-0 text-[14px] font-medium leading-5 text-neutral-900 sm:line-clamp-none sm:truncate sm:text-base sm:leading-6"
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
              className="line-clamp-1 min-w-0 text-[11px] text-neutral-400 sm:truncate sm:text-xs"
              lang="ja"
              title={originalTitle ?? undefined}
            >
              {originalTitle}
            </p>
          ) : null}
        </div>

        <p
          className={`mt-1.5 line-clamp-3 text-[12px] leading-5 sm:mt-2 sm:min-h-[3.9rem] sm:text-[13px] sm:leading-[1.55] ${
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

        <div className="mt-auto flex items-center justify-between gap-2 pt-2 sm:pt-3">
          <p className="min-w-0 truncate text-[10px] text-neutral-400 sm:text-[11px]">
            {meta}
          </p>

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
    <div className="flex h-full min-w-0 flex-col gap-2.5 sm:h-auto sm:flex-row sm:gap-5 sm:border-b sm:border-neutral-200 sm:py-5 sm:first:pt-0 sm:last:border-b-0">
      <div className="skeleton aspect-[3/4] w-full shrink-0 rounded-lg sm:w-[128px] md:w-[144px]" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="skeleton h-4 w-11/12 rounded sm:h-5 sm:w-2/3" />
        <div className="mt-2 skeleton h-3 w-1/2 rounded sm:mt-3 sm:h-4" />
        <div className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">
          <div className="skeleton h-2.5 w-full rounded sm:h-3" />
          <div className="skeleton h-2.5 w-11/12 rounded sm:h-3" />
          <div className="skeleton h-2.5 w-3/4 rounded sm:h-3" />
        </div>
        <div className="mt-auto flex items-center justify-between pt-2 sm:pt-3">
          <div className="skeleton h-2.5 w-16 rounded sm:h-3 sm:w-20" />
          <div className="skeleton h-7 w-7 rounded-full sm:h-8 sm:w-8" />
        </div>
      </div>
    </div>
  );
}
