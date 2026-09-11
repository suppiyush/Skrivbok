/**
 * Bring the test database up to date with the migrations.
 *
 * A file rather than a one-liner in `package.json`. The inline version this
 * replaced read:
 *
 *     .replace(//skrivbok(?|$)/, '/skrivbok_test$1')
 *
 * where the intended `/\/skrivbok(\?|$)/` had lost its backslashes, so `//`
 * opened a line comment and took the rest of the statement with it. The script
 * had never run. Quoting a regex through npm, cmd and `node -e` is three
 * escaping layers deep; none of them apply here.
 *
 * The target is resolved exactly as `tests/setup.ts` resolves it, honouring
 * `TEST_DATABASE_URL` first. If the two disagreed, this would migrate one
 * database while the suite read another, and the failures would look like
 * application bugs rather than a missing migration.
 */
import { execFileSync } from 'node:child_process';

const target =
  process.env.TEST_DATABASE_URL ??
  (process.env.DATABASE_URL ?? '').replace(/\/skrivbok(\?|$)/, '/skrivbok_test$1');

// The guard is the point of the script. `migrate deploy` against the
// development database would apply migrations to real work.
if (!target.includes('skrivbok_test')) {
  console.error(
    'Refusing to migrate: the database URL does not point at skrivbok_test.\n' +
      'Set TEST_DATABASE_URL, or make sure DATABASE_URL ends with /skrivbok.',
  );
  process.exit(1);
}

console.log(`Migrating the test database (${target.replace(/:[^:@/]*@/, ':***@')})`);

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: target, DIRECT_URL: target },
});
