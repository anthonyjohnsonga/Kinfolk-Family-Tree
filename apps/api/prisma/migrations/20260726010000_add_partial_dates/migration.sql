-- Partial-date support: keep the resolved DateTime for sorting and add a
-- companion token column holding the date as entered (year, year-month, or
-- full day, with an optional ~/</> qualifier). Existing dates backfill as
-- exact full-day tokens so display is unchanged for prior data.
ALTER TABLE "Person" ADD COLUMN "birthDateToken" TEXT;
ALTER TABLE "Person" ADD COLUMN "deathDateToken" TEXT;
UPDATE "Person" SET "birthDateToken" = to_char("birthDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD') WHERE "birthDate" IS NOT NULL;
UPDATE "Person" SET "deathDateToken" = to_char("deathDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD') WHERE "deathDate" IS NOT NULL;

ALTER TABLE "Partnership" ADD COLUMN "marriageDateToken" TEXT;
ALTER TABLE "Partnership" ADD COLUMN "divorceDateToken" TEXT;
UPDATE "Partnership" SET "marriageDateToken" = to_char("marriageDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD') WHERE "marriageDate" IS NOT NULL;
UPDATE "Partnership" SET "divorceDateToken" = to_char("divorceDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD') WHERE "divorceDate" IS NOT NULL;

ALTER TABLE "LifeEvent" ADD COLUMN "dateToken" TEXT;
UPDATE "LifeEvent" SET "dateToken" = to_char("date" AT TIME ZONE 'UTC', 'YYYY-MM-DD') WHERE "date" IS NOT NULL;
