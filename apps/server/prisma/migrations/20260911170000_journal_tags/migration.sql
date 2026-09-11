-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "journal_entries_tags_idx" ON "journal_entries" USING GIN ("tags");

