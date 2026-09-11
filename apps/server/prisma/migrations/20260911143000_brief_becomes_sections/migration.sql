-- The 25-field creative brief becomes a document of user-written sections.
--
-- The dropped columns held fixed headings decided in advance (objectives,
-- timeline, audience, sign-off). Nothing in this project used them: the
-- backend was wired but no screen ever read or wrote one, so the only rows
-- carrying values came from the demo seed.

-- AlterTable
ALTER TABLE "project_briefs" DROP COLUMN "approvalDate",
DROP COLUMN "approvalSignature",
DROP COLUMN "callToAction",
DROP COLUMN "clientComments",
DROP COLUMN "clientName",
DROP COLUMN "colleagueAddress1",
DROP COLUMN "colleagueAddress2",
DROP COLUMN "colleagueAddress3",
DROP COLUMN "colleagueEmail",
DROP COLUMN "colleagueName",
DROP COLUMN "colleaguePhone",
DROP COLUMN "competition",
DROP COLUMN "graphics",
DROP COLUMN "multimedia",
DROP COLUMN "notes",
DROP COLUMN "objectives",
DROP COLUMN "otherInfo",
DROP COLUMN "photography",
DROP COLUMN "primaryAudience",
DROP COLUMN "projectTitle",
DROP COLUMN "secondaryAudience",
DROP COLUMN "timeline",
DROP COLUMN "yourAddress1",
DROP COLUMN "yourAddress2",
DROP COLUMN "yourAddress3",
DROP COLUMN "yourEmail",
DROP COLUMN "yourName",
DROP COLUMN "yourPhone";

-- CreateTable
CREATE TABLE "brief_sections" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brief_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brief_sections_briefId_position_idx" ON "brief_sections"("briefId", "position");

-- AddForeignKey
ALTER TABLE "brief_sections" ADD CONSTRAINT "brief_sections_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "project_briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

