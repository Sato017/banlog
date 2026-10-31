"use client";

import { RefreshIcon } from "@/components/icons";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-medium text-neutral-900">页面出错了</p>
      <p className="mt-2 text-sm leading-6 text-neutral-500">
        {error.message || "发生未知错误，请刷新后重试。"}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-700"
      >
        <RefreshIcon className="h-3.5 w-3.5" />
        重新加载
      </button>
    </div>
  );
}
