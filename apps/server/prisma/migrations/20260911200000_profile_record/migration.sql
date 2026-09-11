-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "alternateEmail" TEXT,
ADD COLUMN     "awards" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "courses" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "degrees" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "grants" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "officeAddress" TEXT,
ADD COLUMN     "outreach" TEXT,
ADD COLUMN     "positions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "professionalActivities" TEXT,
ADD COLUMN     "skills" TEXT;

