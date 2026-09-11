-- CreateTable
CREATE TABLE "project_meetings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "heldAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_meeting_attendees" (
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "project_meeting_attendees_pkey" PRIMARY KEY ("meetingId","memberId")
);

-- CreateIndex
CREATE INDEX "project_meetings_projectId_heldAt_idx" ON "project_meetings"("projectId", "heldAt");

-- CreateIndex
CREATE INDEX "project_meeting_attendees_memberId_idx" ON "project_meeting_attendees"("memberId");

-- AddForeignKey
ALTER TABLE "project_meetings" ADD CONSTRAINT "project_meetings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_meeting_attendees" ADD CONSTRAINT "project_meeting_attendees_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "project_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_meeting_attendees" ADD CONSTRAINT "project_meeting_attendees_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "project_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

