-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "isResumePublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resumeSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "profiles_resumeSlug_key" ON "profiles"("resumeSlug");

