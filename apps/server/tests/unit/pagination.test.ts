import { describe, expect, it } from 'vitest';
import { paginate, toSkipTake } from '../../src/utils/pagination.js';

describe('pagination', () => {
  it('converts a page and limit into skip/take', () => {
    expect(toSkipTake({ page: 1, limit: 25 })).toEqual({ skip: 0, take: 25 });
    expect(toSkipTake({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 });
  });

  it('reports the right flags on the first page', () => {
    const result = paginate([1, 2, 3, 4], 9, { page: 1, limit: 4 });

    expect(result.pagination).toEqual({
      page: 1,
      limit: 4,
      total: 9,
      totalPages: 3,
      hasNext: true,
      hasPrevious: false,
    });
  });

  it('reports the right flags on the last page', () => {
    const result = paginate([9], 9, { page: 3, limit: 4 });

    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrevious).toBe(true);
  });

  it('reports one page when there is nothing, not zero', () => {
    // totalPages of 0 breaks "page 1 of 0" in every UI that renders it.
    expect(paginate([], 0, { page: 1, limit: 25 }).pagination.totalPages).toBe(1);
  });
});
