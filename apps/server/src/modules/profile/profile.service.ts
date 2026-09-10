/**
 * The user's profile.
 *
 * One per user, created on the first save. Deliberately small — it holds who
 * someone is and how to reach them. The long-form academic record it used to
 * carry existed only to feed the generated CV, and went with it.
 */
import type { Prisma, Profile } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { ForbiddenError, NotFoundError } from '../../utils/errors.js';
import type { UpsertProfileInput } from './profile.schema.js';

export async function get(userId: string): Promise<Profile | null> {
  return prisma.profile.findUnique({ where: { userId } });
}

/**
 * Write only the keys the client sent.
 *
 * The profile screen submits one section at a time, so a full-object write
 * would blank every field the current section does not contain.
 */
export async function upsert(userId: string, input: UpsertProfileInput): Promise<Profile> {
  const data = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Prisma.ProfileUpdateInput;

  return prisma.profile.upsert({
    where: { userId },
    create: { userId, ...(data as Prisma.ProfileCreateWithoutUserInput) },
    update: data,
  });
}

export async function remove(userId: string): Promise<void> {
  const result = await prisma.profile.deleteMany({ where: { userId } });
  if (result.count === 0) throw new NotFoundError('Profile');
}

// ── Avatar ────────────────────────────────────────────────────────────────────

/**
 * Record the avatar after the client has uploaded it to the storage provider.
 *
 * The image never passes through this server: the client uploads it directly
 * with a short-lived signature, and only the resulting URL is stored. That
 * keeps a 3MB image out of the request body and off the API process entirely.
 */
export async function setAvatar(userId: string, url: string): Promise<Profile> {
  return prisma.profile.upsert({
    where: { userId },
    create: { userId, avatarUrl: url },
    update: { avatarUrl: url },
  });
}

export async function clearAvatar(userId: string): Promise<Profile> {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new NotFoundError('Profile');
  return prisma.profile.update({ where: { userId }, data: { avatarUrl: null } });
}

export async function assertProfileExists(userId: string): Promise<void> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw new ForbiddenError('Create your profile before doing that');
}
