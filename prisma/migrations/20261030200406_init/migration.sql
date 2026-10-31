-- CreateTable
CREATE TABLE "AnimeCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "titleJapanese" TEXT,
    "coverUrl" TEXT,
    "synopsis" TEXT,
    "type" TEXT,
    "episodes" INTEGER,
    "year" INTEGER,
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
