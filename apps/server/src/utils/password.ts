/**
 * Password hashing.
 *
 * bcrypt at cost 12. The legacy server used the library's default (10); 12 is
 * the current sensible floor and costs a few tens of milliseconds per login.
 */
import bcrypt from 'bcryptjs';

const COST = 12;

/**
 * A pre-computed hash of a value nobody can supply, used to burn the same CPU
 * time as a real comparison when the account does not exist. Without this, an
 * attacker can tell registered emails from unregistered ones purely by how fast
 * the login endpoint answers.
 */
const DUMMY_HASH = bcrypt.hashSync('::no-such-account::', COST);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Spend the same time as a genuine verification, then fail. Call this on the
 * "user not found" and "OAuth-only account" branches of login so every failed
 * attempt takes the same wall-clock time.
 */
export async function fakeVerify(): Promise<false> {
  await bcrypt.compare('::no-such-account::', DUMMY_HASH);
  return false;
}
