import type { Metadata } from "next";

import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: { absolute: "登录 · BanLog" },
  description: "登录 BanLog，同步你的追番记录。",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa]">
      <header className="px-5 py-5 sm:px-8">
        <span className="text-[21px] font-semibold tracking-[-0.04em] text-neutral-900">
          BanLog<span className="text-red-500">.</span>
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16 pt-4">
        <LoginForm />
      </main>

      <footer className="px-5 pb-6 text-center text-[11px] text-neutral-400">
        数据来自 AniList · 你的记录只属于你
      </footer>
    </div>
  );
}
