import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="text-[11px] font-medium tracking-wide text-neutral-400">
        404
      </p>
      <h1 className="mt-3 text-sm font-medium text-neutral-900">
        这一页不存在
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        返回动画库继续浏览吧。
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-700"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        返回首页
      </Link>
    </div>
  );
}
