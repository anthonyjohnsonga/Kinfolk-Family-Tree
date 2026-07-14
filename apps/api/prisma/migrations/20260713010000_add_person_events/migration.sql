ALTER TABLE "Person" ADD COLUMN "birthPlace" TEXT;
ALTER TABLE "Person" ADD COLUMN "deathPlace" TEXT;

CREATE TABLE "LifeEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "personId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "place" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LifeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LifeEvent_personId_idx" ON "LifeEvent"("personId");
CREATE INDEX "LifeEvent_date_idx" ON "LifeEvent"("date");

ALTER TABLE "LifeEvent" ADD CONSTRAINT "LifeEvent_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
