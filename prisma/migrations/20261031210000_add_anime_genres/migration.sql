-- Persist AniList genres as a JSON string for local stats/radar chart.
ALTER TABLE "AnimeCache" ADD COLUMN "genres" TEXT;
