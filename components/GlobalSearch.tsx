"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SearchIcon } from "@/components/icons";
import { BANLOG_SEARCH_EVENT } from "@/lib/search";

export function GlobalSearch({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [value, setValue] = useState("");

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      setValue((params.get("q") ?? "").slice(0, 100));
    };

    const handleSearch = (event: Event) => {
      const detail = (
        event as CustomEvent<{ query?: string }>
      ).detail;
      setValue(
        typeof detail?.query === "string"
          ? detail.query.slice(0, 100)
          : "",
      );
    };

    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener(BANLOG_SEARCH_EVENT, handleSearch);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(BANLOG_SEARCH_EVENT, handleSearch);
    };
  }, [pathname]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim().slice(0, 100);

    if (pathname === "/") {
      const params = new URLSearchParams(window.location.search);
      if (query) params.set("q", query);
      else params.delete("q");

      window.history.replaceState(
        window.history.state,
        "",
        `/?${params.toString()}`,
      );
      window.dispatchEvent(
        new CustomEvent(BANLOG_SEARCH_EVENT, {
          detail: { query },
        }),
      );
      return;
    }

    router.push(query ? `/?q=${encodeURIComponent(query)}` : "/");
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={`flex items-center gap-2 ${className}`}
    >
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          aria-label="搜索动画"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="搜索动画 / 日文原名 / 罗马音"
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-[13px] text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/5"
        />
      </div>
      <button
        type="submit"
        aria-label="提交搜索"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white transition-colors hover:bg-neutral-700"
      >
        <SearchIcon className="h-4 w-4" />
      </button>
    </form>
  );
}
