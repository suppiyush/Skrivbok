-- Pinning is removed from notes.
--
-- It was not only a form field: every sort order put pinned notes first, so
-- taking the control away without taking the column would have left any
-- already-pinned note stuck at the top with no way to release it.

-- AlterTable
ALTER TABLE "notes" DROP COLUMN "pinned";

