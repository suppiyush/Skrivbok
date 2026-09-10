/**
 * Test bootstrap. Runs before every test file.
 *
 * Its whole job is to make sure the suite cannot touch the development
 * database. `resetDatabase()` truncates every table, so pointing at the wrong
 * database would destroy real work.
 *
 * The root `.env` is loaded *here*, before `env.ts` gets a chance to, so the
 * connection strings can be rewritten to `skrivbok_test` first. `env.ts` calls
 * `dotenv.config()` too, but dotenv never overwrites a variable that is already
 * set, so these values win.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const envPath = resolve(repoRoot, '.env');

if (existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'fatal';

// Mail and billing stay unconfigured: nothing is sent, and billing exercises
// its disabled path, which is worth covering anyway.
process.env['SMTP_HOST'] = '';
process.env['RAZORPAY_KEY_ID'] = '';
process.env['RAZORPAY_KEY_SECRET'] = '';

const TEST_DATABASE =
  process.env['TEST_DATABASE_URL'] ??
  (process.env['DATABASE_URL'] ?? '').replace(/\/skrivbok(\?|$)/, '/skrivbok_test$1');

if (!TEST_DATABASE.includes('skrivbok_test')) {
  throw new Error(
    'Refusing to run tests: the database URL does not point at skrivbok_test. ' +
      'Set TEST_DATABASE_URL, or make sure DATABASE_URL ends with /skrivbok.',
  );
}

process.env['DATABASE_URL'] = TEST_DATABASE;
process.env['DIRECT_URL'] = TEST_DATABASE;
