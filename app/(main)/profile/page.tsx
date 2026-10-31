import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileDashboard } from "@/components/ProfileDashboard";
import { getCurrentUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "个人主页 · BanLog" },
  description: "查看你的追番统计、题材偏好和最近标记记录。",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <ProfileDashboard
      email={user.email ?? "未绑定邮箱"}
      createdAt={user.created_at}
    />
  );
}
