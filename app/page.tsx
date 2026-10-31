import type { Metadata } from "next";

import { HomeBrowser } from "@/components/HomeBrowser";

export const metadata: Metadata = {
  title: { absolute: "BanLog" },
  description: "搜索日本动画，按作品类型筛选，直接在卡片上标记已追。",
};

export default function HomePage() {
  return <HomeBrowser />;
}
