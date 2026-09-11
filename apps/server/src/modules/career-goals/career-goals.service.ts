/**
 * Career goals: business rules.
 *
 * Single-owner, so the ownership contract is the same as `ideas.service.ts`.
 * What is different is that progress is *derived*, and every change to it is
 * recorded.
 *
 * The legacy table stored a `progress` integer alongside `current_stage` and
 * `total_stages`, and nothing kept the three in agreement — a goal could read
 * "80%" while sitting on stage 2 of 5. Here `progressPercent` is computed on
 * read and never stored, so it cannot disagree with anything.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { Pagination } from '../../middleware/validate.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { paginate, toSkipTake, type Paginated } from '../../utils/pagination.js';
import { assertWithinLimit } from '../billing/limits.service.js';
import type {
  CreateCareerGoalInput,
  CreateHistoryInput,
  ListCareerGoalsQuery,
  UpdateCareerGoalInput,
  UpdateHistoryInput,
} from './career-goals.schema.js';

type GoalRow = Prisma.CareerGoalGetPayload<Record<string, never>>;

export interface CareerGoal extends GoalRow {
  /** Derived on read from `currentStage / totalStages`. Never stored. */
  progressPercent: number;
  isAchieved: boolean;
}

function decorate(goal: GoalRow): CareerGoal {
  return {
    ...goal,
    progressPercent: Math.round((goal.currentStage / goal.totalStages) * 100),
    isAchieved: goal.achievedAt !== null,
  };
}

const ORDER_BY: Record<ListCareerGoalsQuery['sort'], Prisma.CareerGoalOrderByWithRelationInput[]> =
  {
    newest: [{ createdAt: 'desc' }],
    oldest: [{ createdAt: 'asc' }],
    // Ordering by currentStage is the closest the database can get to ordering
    // by percentage; goals with different stage counts are then broken by date.
    progress: [{ currentStage: 'desc' }, { createdAt: 'desc' }],
    target: [{ targetAt: { sort: 'asc', nulls: 'last' } }],
    title: [{ title: 'asc' }],
  };

function buildWhere(userId: string, query: ListCareerGoalsQuery): Prisma.CareerGoalWhereInput {
  return {
    userId,
    ...(query.goalType ? { goalType: query.goalType } : {}),
    ...(query.status === 'achieved' ? { achievedAt: { not: null } } : {}),
    ...(query.status === 'active' ? { achievedAt: null } : {}),
    ...(query.status === 'not_started' ? { achievedAt: null, currentStage: 0 } : {}),
    ...(query.status === 'in_progress' ? { achievedAt: null, currentStage: { gt: 0 } } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
            { stageDescription: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

export async function list(
  userId: string,
  query: ListCareerGoalsQuery,
): Promise<Paginated<CareerGoal>> {
  const where = buildWhere(userId, query);
  const pagination: Pagination = { page: query.page, limit: query.limit };

  const [rows, total] = await prisma.$transaction([
    prisma.careerGoal.findMany({ where, orderBy: ORDER_BY[query.sort], ...toSkipTake(pagination) }),
    prisma.careerGoal.count({ where }),
  ]);

  return paginate(rows.map(decorate), total, pagination);
}

export async function getById(userId: string, id: string): Promise<CareerGoal> {
  const goal = await prisma.careerGoal.findFirst({ where: { id, userId } });
  if (!goal) throw new NotFoundError('Career goal');
  return decorate(goal);
}

export async function create(userId: string, input: CreateCareerGoalInput): Promise<CareerGoal> {
  await assertWithinLimit(userId, 'careerGoals');

  const goal = await prisma.careerGoal.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      goalType: input.goalType,
      totalStages: input.totalStages,
      currentStage: input.currentStage,
      stageDescription: input.stageDescription ?? null,
      startAt: input.startAt ?? null,
      targetAt: input.targetAt ?? null,
      achievedAt: input.currentStage >= input.totalStages ? new Date() : null,
      // A goal created part-way through gets an opening history entry, so the
      // log is never missing the state it started from.
      ...(input.currentStage > 0
        ? {
            history: {
              create: {
                stage: input.currentStage,
                description: input.stageDescription ?? 'Starting point',
              },
            },
          }
        : {}),
    },
  });

  return decorate(goal);
}

export async function update(
  userId: string,
  id: string,
  input: UpdateCareerGoalInput,
): Promise<CareerGoal> {
  const existing = await getById(userId, id);

  // Shrinking the stage count below the stage already reached would leave the
  // goal at, say, stage 7 of 5. Rejected rather than silently clamped, because
  // clamping would quietly discard recorded progress.
  if (input.totalStages !== undefined && input.totalStages < existing.currentStage) {
    throw new BadRequestError(
      `This goal is already at stage ${existing.currentStage}. Reduce the current stage before lowering the total to ${input.totalStages}.`,
    );
  }

  const data: Prisma.CareerGoalUpdateManyMutationInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description ?? null } : {}),
    ...(input.goalType !== undefined ? { goalType: input.goalType } : {}),
    ...(input.totalStages !== undefined ? { totalStages: input.totalStages } : {}),
    ...(input.stageDescription !== undefined
      ? { stageDescription: input.stageDescription ?? null }
      : {}),
    ...(input.startAt !== undefined ? { startAt: input.startAt ?? null } : {}),
    ...(input.targetAt !== undefined ? { targetAt: input.targetAt ?? null } : {}),
    // Lowering the total onto the current stage completes the goal; raising it
    // reopens one that was complete.
    ...(input.totalStages !== undefined
      ? {
          achievedAt:
            existing.currentStage >= input.totalStages ? (existing.achievedAt ?? new Date()) : null,
        }
      : {}),
  };

  const result = await prisma.careerGoal.updateMany({ where: { id, userId }, data });
  if (result.count === 0) throw new NotFoundError('Career goal');

  return getById(userId, id);
}

export async function remove(userId: string, id: string): Promise<void> {
  // History rows cascade with the goal — enforced by the schema.
  const result = await prisma.careerGoal.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError('Career goal');
}

// ── Stage movement ────────────────────────────────────────────────────────────

/**
 * Move a goal to `stage` and record the move.
 *
 * The stage change and its history entry are written in one transaction: a
 * goal whose stage advanced without a corresponding log entry would make the
 * history unreliable, which is the only reason the table exists.
 */
export async function setStage(
  userId: string,
  id: string,
  stage: number,
  description?: string | null,
): Promise<CareerGoal> {
  const goal = await getById(userId, id);

  if (stage > goal.totalStages) {
    throw new BadRequestError(
      `This goal has ${goal.totalStages} stages, so stage ${stage} does not exist`,
    );
  }

  if (stage === goal.currentStage) {
    throw new BadRequestError(`The goal is already at stage ${stage}`);
  }

  const achieved = stage >= goal.totalStages;

  await prisma.$transaction([
    prisma.careerGoal.update({
      where: { id },
      data: {
        currentStage: stage,
        ...(description !== undefined && description !== null
          ? { stageDescription: description }
          : {}),
        // Moving backwards from a completed goal reopens it.
        achievedAt: achieved ? (goal.achievedAt ?? new Date()) : null,
      },
    }),
    prisma.careerStageHistory.create({
      data: { goalId: id, stage, description: description ?? null },
    }),
  ]);

  return getById(userId, id);
}

/** Convenience wrapper: one stage forward. */
export async function advance(
  userId: string,
  id: string,
  description?: string | null,
): Promise<CareerGoal> {
  const goal = await getById(userId, id);

  if (goal.currentStage >= goal.totalStages) {
    throw new BadRequestError('This goal is already complete');
  }

  return setStage(userId, id, goal.currentStage + 1, description);
}

// ── History ───────────────────────────────────────────────────────────────────

/**
 * Every history call re-checks that the goal belongs to the caller before
 * touching a history row. History rows are addressed by their own id, so
 * without this a user could edit entries on someone else's goal.
 */
async function assertGoalOwned(userId: string, goalId: string): Promise<void> {
  const goal = await prisma.careerGoal.findFirst({
    where: { id: goalId, userId },
    select: { id: true },
  });
  if (!goal) throw new NotFoundError('Career goal');
}

export async function listHistory(userId: string, goalId: string) {
  await assertGoalOwned(userId, goalId);
  return prisma.careerStageHistory.findMany({
    where: { goalId },
    orderBy: [{ recordedAt: 'desc' }, { stage: 'desc' }],
  });
}

export async function addHistory(userId: string, goalId: string, input: CreateHistoryInput) {
  const goal = await getById(userId, goalId);

  if (input.stage > goal.totalStages) {
    throw new BadRequestError(
      `This goal has ${goal.totalStages} stages, so stage ${input.stage} does not exist`,
    );
  }

  return prisma.careerStageHistory.create({
    data: {
      goalId,
      stage: input.stage,
      description: input.description ?? null,
      ...(input.recordedAt ? { recordedAt: input.recordedAt } : {}),
    },
  });
}

export async function updateHistory(
  userId: string,
  goalId: string,
  historyId: string,
  input: UpdateHistoryInput,
) {
  const goal = await getById(userId, goalId);

  if (input.stage !== undefined && input.stage > goal.totalStages) {
    throw new BadRequestError(
      `This goal has ${goal.totalStages} stages, so stage ${input.stage} does not exist`,
    );
  }

  const result = await prisma.careerStageHistory.updateMany({
    where: { id: historyId, goalId },
    data: {
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.recordedAt !== undefined ? { recordedAt: input.recordedAt } : {}),
    },
  });

  if (result.count === 0) throw new NotFoundError('History entry');

  return prisma.careerStageHistory.findUniqueOrThrow({ where: { id: historyId } });
}

export async function removeHistory(
  userId: string,
  goalId: string,
  historyId: string,
): Promise<void> {
  await assertGoalOwned(userId, goalId);

  const result = await prisma.careerStageHistory.deleteMany({ where: { id: historyId, goalId } });
  if (result.count === 0) throw new NotFoundError('History entry');
}

/** Counts for the dashboard tile. */
export async function summary(userId: string): Promise<{
  total: number;
  active: number;
  achieved: number;
  averageProgress: number;
}> {
  const [total, achieved, stageTotals] = await prisma.$transaction([
    prisma.careerGoal.count({ where: { userId } }),
    prisma.careerGoal.count({ where: { userId, achievedAt: { not: null } } }),
    prisma.careerGoal.aggregate({
      where: { userId },
      _sum: { currentStage: true, totalStages: true },
    }),
  ]);

  const done = stageTotals._sum.currentStage ?? 0;
  const planned = stageTotals._sum.totalStages ?? 0;

  return {
    total,
    active: total - achieved,
    achieved,
    averageProgress: planned === 0 ? 0 : Math.round((done / planned) * 100),
  };
}
