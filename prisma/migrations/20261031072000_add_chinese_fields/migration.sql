-- Local Chinese metadata cache.
-- titleChinese comes from the locally synced soruly/anilist-chinese map.
-- synopsisChinese is filled on demand by the translation cache.
ALTER TABLE "AnimeCache" ADD COLUMN "titleChinese" TEXT;
ALTER TABLE "AnimeCache" ADD COLUMN "synopsisChinese" TEXT;
