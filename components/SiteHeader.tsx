"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BookmarkIcon } from "@/components/icons";

export function SiteHeader() {
  const pathname = usePathname();
  const isProfile = pathname === "/profile";

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="rounded-sm text-[21px] font-semibold tracking-[-0.04em] text-neutral-900"
          aria-label="BanLog 首页"
        >
          BanLog<span className="text-red-500">.</span>
        </Link>

        <nav aria-label="主导航">
          <Link
            href="/profile"
            prefetch={false}
            aria-current={isProfile ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              isProfile
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
            }`}
          >
            <BookmarkIcon className="h-3.5 w-3.5" />
            个人主页
          </Link>
        </nav>
      </div>
    </header>
  );
}
