import type { Metadata } from "next";

import { AiringSchedule } from "@/components/AiringSchedule";

export const metadata: Metadata = {
  title: { absolute: "每日放送 · BanLog" },
  description: "查看本周日本动画的每日更新时间表。",
};

export default function SchedulePage() {
  return <AiringSchedule />;
}
