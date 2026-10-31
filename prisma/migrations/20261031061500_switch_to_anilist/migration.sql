-- 从 Jikan/MAL 数据源切换到 AniList。
-- MAL 的 id 与 AniList 的 media id 属于不同命名空间，无法直接映射。
-- 旧 AnimeCache 中的 ID 已失去意义，因此清空旧追番记录并重建缓存表。
-- WatchRecord 的列结构与约束保持不变，之后用 AniList ID 关联。
DELETE FROM "WatchRecord";

DROP TABLE "WatchRecord";
DROP TABLE "AnimeCache";

-- CreateTable
CREATE TABLE "AnimeCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titleNative" TEXT,
    "titleRomaji" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "format" TEXT,
    "episodes" INTEGER,
    "seasonYear" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WatchRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL DEFAULT 'local',
    "animeId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'watched',
    "watchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchRecord_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "AnimeCache" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WatchRecord_userId_status_watchedAt_idx" ON "WatchRecord"("userId", "status", "watchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WatchRecord_userId_animeId_key" ON "WatchRecord"("userId", "animeId");
