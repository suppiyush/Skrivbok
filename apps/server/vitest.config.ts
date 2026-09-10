import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node, not jsdom — this is a server.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration tests share one database, so they must not run concurrently
    // against each other. Unit tests are pure and unaffected.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/db/seed.ts', 'src/jobs/worker.ts', 'src/server.ts', 'src/types/**'],
    },
  },
});
