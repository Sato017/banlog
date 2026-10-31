"use client";

import { useEffect, useState } from "react";

import { XIcon } from "@/components/icons";

export function SiteFooter() {
  const [downloadOpen, setDownloadOpen] = useState(false);

  useEffect(() => {
    if (!downloadOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDownloadOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [downloadOpen]);

  return (
    <>
      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-[11px] text-neutral-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>BanLog · 你的云端动画追番记录</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => setDownloadOpen(true)}
              className="transition-colors hover:text-neutral-700"
            >
              下载桌面版
            </button>
            <a
              href="https://anilist.co/"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-neutral-700"
            >
              数据来自 AniList
            </a>
            <a
              href="https://github.com/Sato017/banlog"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-neutral-700"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>

      {downloadOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={() => setDownloadOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="download-title"
            className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                  BanLog Desktop
                </p>
                <h2
                  id="download-title"
                  className="mt-2 text-lg font-semibold tracking-[-0.02em] text-neutral-900"
                >
                  桌面版即将推出
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDownloadOpen(false)}
                aria-label="关闭"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-neutral-500">
              BanLog 现在是一款响应式 Web 应用，手机和电脑打开浏览器即可使用。
              桌面客户端正在重新设计中，敬请期待。
            </p>
            <button
              type="button"
              onClick={() => setDownloadOpen(false)}
              className="mt-6 w-full rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
            >
              知道了
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
