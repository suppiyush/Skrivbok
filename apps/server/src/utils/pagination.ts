/**
 * Uniform list responses.
 *
 * Every list endpoint returns the same envelope, so the frontend can write one
 * pagination component instead of one per screen. The legacy API returned bare
 * arrays with no total, which made paging impossible without fetching
 * everything.
 */
import type { Pagination } from '../middleware/validate.js';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: PageMeta;
}

/** Convert `{ page, limit }` into Prisma's `skip` / `take`. */
export function toSkipTake(pagination: Pagination): { skip: number; take: number } {
  return {
    skip: (pagination.page - 1) * pagination.limit,
    take: pagination.limit,
  };
}

export function paginate<T>(data: T[], total: number, pagination: Pagination): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(total / pagination.limit));
  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrevious: pagination.page > 1,
    },
  };
}
