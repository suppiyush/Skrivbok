/**
 * HTML escaping and error shapes.
 *
 * Small, boring functions whose failure modes are all security incidents.
 *
 * There is no password-hashing suite here any more: Google is the only sign-in
 * method, so the application stores no credential of its own.
 */
import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../src/utils/html.js';
import {
  AppError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  isAppError,
} from '../../src/utils/errors.js';

describe('escapeHtml', () => {
  it('neutralises a script tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('neutralises an attribute break-out', () => {
    expect(escapeHtml('" onerror="alert(1)')).toBe('&quot; onerror=&quot;alert(1)');
  });

  it('escapes the ampersand first, avoiding double-escaping', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('handles null and undefined as empty strings', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeHtml('Ada Lovelace, PhD')).toBe('Ada Lovelace, PhD');
  });
});

describe('AppError', () => {
  it('carries a status and a stable machine-readable code', () => {
    const error = new NotFoundError('Project');

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.message).toBe('Project not found');
    expect(error.isOperational).toBe(true);
  });

  it('marks unexpected failures as non-operational', () => {
    const error = new AppError(500, ErrorCode.INTERNAL_ERROR, 'boom', { isOperational: false });
    expect(error.isOperational).toBe(false);
  });

  it('allows a specific code to be supplied', () => {
    const error = new ForbiddenError('Nope', ErrorCode.FREE_LIMIT_REACHED);
    expect(error.code).toBe(ErrorCode.FREE_LIMIT_REACHED);
  });

  it('is detected by isAppError, and a plain Error is not', () => {
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new Error('plain'))).toBe(false);
    expect(isAppError('a string')).toBe(false);
  });
});
