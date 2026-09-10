/**
 * Password hashing, HTML escaping and error shapes.
 *
 * Small, boring functions whose failure modes are all security incidents.
 */
import { describe, expect, it } from 'vitest';
import { fakeVerify, hashPassword, verifyPassword } from '../../src/utils/password.js';
import { escapeHtml } from '../../src/utils/html.js';
import {
  AppError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  isAppError,
} from '../../src/utils/errors.js';

describe('password hashing', () => {
  it('produces a bcrypt hash, never the plaintext', async () => {
    const hash = await hashPassword('correct-horse-battery');

    expect(hash).not.toContain('correct-horse-battery');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('uses cost 12', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash.split('$')[2]).toBe('12');
  });

  it('salts, so the same password hashes differently each time', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);
    expect(a).not.toBe(b);
  });

  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct-horse-battery');

    await expect(verifyPassword('correct-horse-battery', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('fakeVerify always fails, and takes real work to do it', async () => {
    const started = Date.now();
    await expect(fakeVerify()).resolves.toBe(false);

    // The point of fakeVerify is to burn comparable CPU time so a nonexistent
    // account cannot be identified by how quickly login fails.
    expect(Date.now() - started).toBeGreaterThan(20);
  });
});

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
