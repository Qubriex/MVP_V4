import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',          // PGlite (WASM) per test file
    env: {
      NODE_ENV: 'test',
      DB_PATH: ':memory:',  // each test file gets its own in-memory database
      JWT_SECRET: 'test-secret-not-for-production',
      AI_ADAPTER: 'mock',
      LOG_LEVEL: 'silent',
      SECURE_CONFIG_DIR: './tests/no-secure-config',
      DEV_KEY_DIR: './data/test-keys'
    },
    testTimeout: 20000
  }
});
