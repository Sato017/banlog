import type { Metadata } from "next";

import { HomeBrowser } from "@/components/HomeBrowser";

export const metadata: Metadata = {
  title: { absolute: "BanLog" },
  description:
    "搜索日本动画，按剧情、年份和热度筛选，在卡片上标记已追。",
};

export default function HomePage() {
  return <HomeBrowser />;
}
