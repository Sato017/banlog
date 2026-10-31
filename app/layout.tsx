import type { Metadata, Viewport } from "next";

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
        {children}
      </body>
    </html>
  );
}
