"use client";

import { useEffect, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { getGenreLabel } from "@/lib/genres";
import type { GenreStat } from "@/lib/types";

export function GenreRadar({
  distribution,
}: {
  distribution: GenreStat[];
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const top = distribution[0];
  const chartData = distribution.map((item) => ({
    subject: getGenreLabel(item.genre),
    value: item.percentage,
    count: item.count,
  }));

  return (
    <section className="mt-10 border-t border-neutral-200 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-900">
          我的追番雷达图
        </h2>
        <span className="text-[11px] text-neutral-400">
          按已追作品题材统计
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl bg-neutral-950 px-4 py-5 text-white sm:px-6">
        {top ? (
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="h-[260px] min-w-0 flex-1">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={chartData}
                    outerRadius="72%"
                    margin={{ top: 12, right: 24, bottom: 12, left: 24 }}
                  >
                    <PolarGrid stroke="#3f3f46" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "#d4d4d8", fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name="题材占比"
                      dataKey="value"
                      stroke="#22d3ee"
                      fill="#22d3ee"
                      fillOpacity={0.22}
                      strokeWidth={2}
                      dot={{
                        r: 2.5,
                        fill: "#22d3ee",
                        stroke: "#0a0a0a",
                        strokeWidth: 1,
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full animate-pulse rounded-lg bg-neutral-900" />
              )}
            </div>

            <div className="shrink-0 md:w-52">
              <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">
                Taste Profile
              </p>
              <p className="mt-3 text-sm text-neutral-300">
                你最偏爱的题材是：
              </p>
              <p className="mt-1 text-xl font-semibold text-cyan-400">
                【{getGenreLabel(top.genre)}】
              </p>
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                出现在你追过的 {top.count} 部作品中，占全部已追作品的{" "}
                {top.percentage}%。
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
            <p className="text-sm text-neutral-300">
              还没有足够的题材数据
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              追几部动画后，这里会生成你的题材画像。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
