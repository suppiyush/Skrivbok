import { z } from 'zod';
import { paginationSchema } from '../../middleware/validate.js';

/** Free text, so users can group goals their own way. */
const goalTypeSchema = z.string().trim().min(1).max(60);

/**
 * A goal is divided into stages. One stage is meaningless (that is a task, not
 * a goal); 50 is a generous ceiling that still keeps the UI usable.
 */
const totalStagesSchema = z.number().int().min(2).max(50);

/** 0 means "not started". The upper bound is checked against `totalStages`. */
const currentStageSchema = z.number().int().min(0).max(50);

const dateSchema = z.coerce.date();

const goalFields = z.object({
  title: z.string().trim().min(1, 'A title is required').max(200),
  description: z.string().max(20_000).nullish(),
  goalType: goalTypeSchema,
  totalStages: totalStagesSchema,
  stageDescription: z.string().max(2_000).nullish(),
  startAt: dateSchema.nullish(),
  targetAt: dateSchema.nullish(),
});

export const createCareerGoalSchema = goalFields
  .extend({
    goalType: goalTypeSchema.default('general'),
    totalStages: totalStagesSchema.default(5),
    /** A goal may be created part-way through, e.g. when migrating notes. */
    currentStage: currentStageSchema.default(0),
  })
  .refine((v) => v.currentStage <= v.totalStages, {
    message: 'The current stage cannot be beyond the total number of stages',
    path: ['currentStage'],
  })
  .refine((v) => !v.startAt || !v.targetAt || v.startAt <= v.targetAt, {
    message: 'The target date cannot be before the start date',
    path: ['targetAt'],
  });

/**
 * Built from a defaults-free base — see the note in `ideas.schema.ts`.
 *
 * `currentStage` is deliberately absent: stage changes go through
 * `POST /:id/advance` or `PUT /:id/stage`, which also write the history entry.
 * Allowing a bare PATCH to move the stage would let progress change without
 * leaving a trace, which is the whole point of the history table.
 */
export const updateCareerGoalSchema = goalFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  })
  .refine((v) => !v.startAt || !v.targetAt || v.startAt <= v.targetAt, {
    message: 'The target date cannot be before the start date',
    path: ['targetAt'],
  });

export const listCareerGoalsSchema = paginationSchema.extend({
  goalType: goalTypeSchema.optional(),
  status: z.enum(['all', 'active', 'achieved']).default('all'),
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'progress', 'target', 'title']).default('newest'),
});

// ── Stage movement ────────────────────────────────────────────────────────────

/** Move to a specific stage, forwards or backwards. */
export const setStageSchema = z.object({
  stage: currentStageSchema,
  /** What was accomplished. Recorded in the history entry. */
  description: z.string().max(2_000).nullish(),
});

/** Move one stage forward. */
export const advanceSchema = z.object({
  description: z.string().max(2_000).nullish(),
});

// ── History ───────────────────────────────────────────────────────────────────

export const createHistorySchema = z.object({
  stage: currentStageSchema,
  description: z.string().max(2_000).nullish(),
  /** Backdating is allowed, for recording progress after the fact. */
  recordedAt: dateSchema.optional(),
});

export const updateHistorySchema = z
  .object({
    stage: currentStageSchema.optional(),
    description: z.string().max(2_000).nullish(),
    recordedAt: dateSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

export const historyParamSchema = z.object({
  id: z.string().min(20).max(40),
  historyId: z.string().min(20).max(40),
});

export type CreateCareerGoalInput = z.infer<typeof createCareerGoalSchema>;
export type UpdateCareerGoalInput = z.infer<typeof updateCareerGoalSchema>;
export type ListCareerGoalsQuery = z.infer<typeof listCareerGoalsSchema>;
export type SetStageInput = z.infer<typeof setStageSchema>;
export type AdvanceInput = z.infer<typeof advanceSchema>;
export type CreateHistoryInput = z.infer<typeof createHistorySchema>;
export type UpdateHistoryInput = z.infer<typeof updateHistorySchema>;
