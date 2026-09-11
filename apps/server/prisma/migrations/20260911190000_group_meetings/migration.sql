-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "meetingGroupId" TEXT;

-- AlterTable
ALTER TABLE "meeting_requests" ADD COLUMN     "groupId" TEXT;

-- CreateIndex
CREATE INDEX "calendar_events_meetingGroupId_idx" ON "calendar_events"("meetingGroupId");

-- CreateIndex
CREATE INDEX "meeting_requests_groupId_idx" ON "meeting_requests"("groupId");

