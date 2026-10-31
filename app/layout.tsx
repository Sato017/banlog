import type { Metadata, Viewport } from "next";

import { SiteHeader } from "@/components/SiteHeader";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BanLog · 动画追番记录",
    template: "%s · BanLog",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["BanLog", "动画", "追番", "AniList", "Anime"],
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fafafa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col bg-[#fafafa] font-sans text-neutral-900 antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-neutral-200">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-[11px] text-neutral-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>BanLog · 单用户动画追番记录</p>
            <p>
              动画资料来自{" "}
              <a
                href="https://anilist.co/"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-neutral-700"
              >
                AniList
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
