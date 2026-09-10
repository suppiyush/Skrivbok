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
  .extend({ archived: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listProjectsSchema = paginationSchema.extend({
  /** `owned` and `shared` split the list into "mine" and "invited to". */
  scope: z.enum(['all', 'owned', 'shared']).default('all'),
  archived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
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

const text = z.string().max(10_000).nullish();
const short = z.string().trim().max(300).nullish();

/**
 * The 25-field creative brief, carried over from the legacy `projects` table
 * where these were columns on the project itself. Every field is optional: the
 * brief is filled in gradually.
 */
export const upsertBriefSchema = z
  .object({
    projectTitle: short,
    notes: text,

    colleagueName: short,
    colleaguePhone: short,
    colleagueEmail: short,
    colleagueAddress1: short,
    colleagueAddress2: short,
    colleagueAddress3: short,

    yourName: short,
    yourPhone: short,
    yourEmail: short,
    yourAddress1: short,
    yourAddress2: short,
    yourAddress3: short,

    objectives: text,
    timeline: text,
    primaryAudience: text,
    secondaryAudience: text,
    callToAction: text,
    competition: text,
    graphics: text,
    photography: text,
    multimedia: text,
    otherInfo: text,

    clientName: short,
    clientComments: text,
    approvalDate: z.coerce.date().nullish(),
    approvalSignature: short,
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to save',
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type UpsertBriefInput = z.infer<typeof upsertBriefSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
