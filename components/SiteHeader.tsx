"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { GlobalSearch } from "@/components/GlobalSearch";
import { BookmarkIcon, CalendarIcon } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase";

function navClass(active: boolean): string {
  return `inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors sm:px-3 ${
    active
      ? "border-neutral-900 bg-neutral-900 text-white"
      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
  }`;
}

export function SiteHeader({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      router.replace("/login");
      router.refresh();
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : "退出失败，请重试。",
      );
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center gap-3">
          <Link
            href="/"
            className="rounded-sm text-[21px] font-semibold tracking-[-0.04em] text-neutral-900"
            aria-label="BanLog 首页"
          >
            BanLog<span className="text-red-500">.</span>
          </Link>

          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            <GlobalSearch className="w-full max-w-md" />
          </div>

          <nav
            aria-label="主导航"
            className="ml-auto flex items-center gap-1 sm:gap-2"
          >
            <Link
              href="/schedule"
              aria-current={pathname === "/schedule" ? "page" : undefined}
              aria-label="每日放送"
              className={navClass(pathname === "/schedule")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span className="hidden min-[480px]:inline">每日放送</span>
            </Link>
            <Link
              href="/profile"
              prefetch={false}
              aria-current={pathname === "/profile" ? "page" : undefined}
              aria-label="个人主页"
              className={navClass(pathname === "/profile")}
            >
              <BookmarkIcon className="h-3.5 w-3.5" />
              <span className="hidden min-[480px]:inline">个人主页</span>
            </Link>

            {userEmail ? (
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex h-8 items-center rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-wait disabled:opacity-50"
              >
                {signingOut ? "退出中" : "退出"}
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-8 items-center rounded-full bg-neutral-900 px-3 text-xs font-medium text-white transition-colors hover:bg-neutral-700"
              >
                登录
              </Link>
            )}
          </nav>
        </div>

        <div className="pb-3 md:hidden">
          <GlobalSearch />
        </div>

        {signOutError ? (
          <p role="alert" className="pb-2 text-right text-[11px] text-red-600">
            {signOutError}
          </p>
        ) : null}
      </div>
    </header>
  );
}
