import type { Metadata } from "next";

import { ProfileDashboard } from "@/components/ProfileDashboard";

export const metadata: Metadata = {
  title: { absolute: "个人主页 · BanLog" },
  description: "查看 BanLog 的追番统计和最近标记记录。",
};

export default function ProfilePage() {
  return <ProfileDashboard />;
}
