-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TEAM';
ALTER TYPE "NotificationType" ADD VALUE 'PROJECT_MEETING';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'REPORT';
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN';

-- AlterEnum
ALTER TYPE "ReminderItemType" ADD VALUE 'SUBSCRIPTION';

-- DropIndex
DROP INDEX "idx_deadlines_remind_at";

-- AlterTable
ALTER TABLE "deadlines" DROP COLUMN "remindAt";

-- CreateTable
CREATE TABLE "worker_status" (
    "key" TEXT NOT NULL,
    "lastTickAt" TIMESTAMP(3) NOT NULL,
    "lastResult" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_status_pkey" PRIMARY KEY ("key")
);

