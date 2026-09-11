import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';
import { emailSchema } from '../auth/auth.schema.js';

/** OWNER is never assignable — it follows project creation and transfer only. */
export const assignableRoleSchema = z.enum(['EDITOR', 'VIEWER']);
export const projectRoleSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER']);

const projectFields = z.object({
  name: z.string().trim().min(1, 'A project name is required').max(200),
  description: z.string().max(20_000).nullish(),
  progress: z.number().int().min(0).max(100),
});

export const createProjectSchema = projectFields.extend({
  progress: z.number().int().min(0).max(100).default(0),
  /** Optional invites sent as part of creation. */
  members: z
    .array(
      z.object({
        email: emailSchema,
        name: z.string().trim().max(120).nullish(),
        role: assignableRoleSchema.default('VIEWER'),
      }),
    )
    .max(50)
    .default([]),
});

/** Built from a defaults-free base — see the note in `ideas.schema.ts`. */
export const updateProjectSchema = projectFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listProjectsSchema = paginationSchema.extend({
  /** `owned` and `shared` split the list into "mine" and "invited to". */
  scope: z.enum(['all', 'owned', 'shared']).default('all'),
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['recent', 'name', 'progress', 'newest']).default('recent'),
});

// ── Members ───────────────────────────────────────────────────────────────────

export const addMemberSchema = z.object({
  email: emailSchema,
  name: z.string().trim().max(120).nullish(),
  role: assignableRoleSchema.default('VIEWER'),
});

export const updateMemberSchema = z.object({ role: assignableRoleSchema });

export const memberParamSchema = z.object({
  id: z.string().min(20).max(40),
  memberId: z.string().min(20).max(40),
});

/** Handing the project to another member. Owner-only, and irreversible for them. */
export const transferOwnershipSchema = z.object({ memberId: z.string().min(20).max(40) });

// ── Brief ─────────────────────────────────────────────────────────────────────

/**
 * The brief is saved whole, not field by field.
 *
 * Sections can be added, removed and reordered in one editing pass, and a
 * patch-shaped API would have to describe all three as separate operations
 * against ids the client has only just invented. Sending the finished document
 * makes the array's order the document's order, and makes a save idempotent.
 *
 * An empty `sections` array is valid: it means the author deleted everything,
 * which is a state they are allowed to be in.
 */
export const upsertBriefSchema = z.object({
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(1, 'A section needs a heading').max(200),
        body: z.string().max(50_000).default(''),
      }),
    )
    .max(100, 'A brief cannot have more than 100 sections'),
});

// ── Meetings ──────────────────────────────────────────────────────────────────

const memberIdSchema = z.string().min(20).max(40);

/**
 * A meeting is one instant, a title, who was there, and what was said.
 *
 * Attendees are member ids, not emails or user ids: the membership row is the
 * one thing every person on a project has, signed up or not. Whether each id
 * actually belongs to this project is the service's check, since it needs the
 * project to know.
 */
const meetingFields = z.object({
  title: z.string().trim().min(1, 'A meeting needs a title').max(200),
  heldAt: z.coerce.date(),
  location: z.string().trim().max(200).nullish(),
  notes: z.string().max(50_000).nullish(),
  attendeeIds: z.array(memberIdSchema).max(100),
});

export const createMeetingSchema = meetingFields.extend({
  attendeeIds: z.array(memberIdSchema).max(100).default([]),
});

/** Built from the defaults-free base — see the note in `ideas.schema.ts`. */
export const updateMeetingSchema = meetingFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

export const meetingParamSchema = z.object({
  id: z.string().min(20).max(40),
  meetingId: z.string().min(20).max(40),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type UpsertBriefInput = z.infer<typeof upsertBriefSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
