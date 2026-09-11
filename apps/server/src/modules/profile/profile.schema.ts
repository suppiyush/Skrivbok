import { z } from 'zod';
import { emailSchema } from '../auth/auth.schema.js';

/**
 * The profile: who someone is, how to reach them, and their academic record.
 *
 * The record is what the résumé is printed from, so the form collects it in
 * full — degrees, positions, teaching, grants, awards — and it is saved as
 * one document with one PUT. The repeating sections are arrays of small
 * objects with a fixed shape; each is bounded so a profile stays a page,
 * not a database.
 */

/** Optional free text where an empty string means "cleared", not "unset". */
const text = (max: number) => z.string().trim().max(max).nullish();

/** A link the profile shows publicly. Bounded, and http(s) only. */
const link = z
  .url({ protocol: /^https?$/ })
  .max(2048)
  .nullish();

/** A year, as a short string — "2019", or "Present" on an open-ended entry. */
const year = z.string().trim().max(12).nullish();

const LIST_MAX = 30;

const degreeSchema = z.object({
  degree: z.string().trim().min(1, 'The degree is needed').max(120),
  field: text(160),
  institution: text(160),
  startYear: year,
  endYear: year,
});

const positionSchema = z.object({
  title: z.string().trim().min(1, 'The position is needed').max(160),
  organisation: text(160),
  startYear: year,
  endYear: year,
  description: text(1_000),
});

const courseSchema = z.object({
  title: z.string().trim().min(1, 'The course is needed').max(160),
  code: text(40),
  level: text(60),
  institution: text(160),
  years: text(40),
});

const grantSchema = z.object({
  title: z.string().trim().min(1, 'The grant is needed').max(200),
  funder: text(160),
  amount: text(60),
  year,
  role: text(80),
});

const awardSchema = z.object({
  title: z.string().trim().min(1, 'The award is needed').max(200),
  issuer: text(160),
  year,
});

export const upsertProfileSchema = z
  .object({
    // 1. Basic information
    fullName: text(120),
    designation: text(120),
    department: text(160),
    institution: text(160),
    officialEmail: emailSchema.nullish(),
    alternateEmail: emailSchema.nullish(),
    phone: text(40),
    website: link,
    officeAddress: text(500),

    // 2–3. Background and employment
    degrees: z.array(degreeSchema).max(LIST_MAX).optional(),
    positions: z.array(positionSchema).max(LIST_MAX).optional(),

    // 4–5. Research and publications
    researchKeywords: text(300),
    researchDescription: text(2_000),
    scholarLink: link,

    // 6–11. Teaching, funding, activities, awards, skills, service
    courses: z.array(courseSchema).max(LIST_MAX).optional(),
    grants: z.array(grantSchema).max(LIST_MAX).optional(),
    professionalActivities: text(5_000),
    awards: z.array(awardSchema).max(LIST_MAX).optional(),
    skills: text(1_000),
    outreach: text(5_000),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to save',
  });

/**
 * The avatar URL is set by the upload flow, not typed by hand, so it is
 * validated separately and never accepted through the general profile save.
 * Letting a client PUT an arbitrary `avatarUrl` would make the profile a place
 * to host links to anything.
 */
export const setAvatarSchema = z.object({
  /** Returned by the storage provider after a successful upload. */
  url: z.url({ protocol: /^https$/ }).max(2048),
});

export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;
export type SetAvatarInput = z.infer<typeof setAvatarSchema>;
export type Degree = z.infer<typeof degreeSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Course = z.infer<typeof courseSchema>;
export type Grant = z.infer<typeof grantSchema>;
export type Award = z.infer<typeof awardSchema>;
