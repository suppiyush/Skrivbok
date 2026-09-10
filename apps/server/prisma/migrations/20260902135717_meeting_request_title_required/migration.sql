/*
  Warnings:

  - Made the column `title` on table `meeting_requests` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "meeting_requests" ALTER COLUMN "title" SET NOT NULL;
