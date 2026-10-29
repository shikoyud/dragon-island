import { defineConfig } from 'vitest/config'

// Each test file boots an in-process PGlite (WASM Postgres), which takes a few seconds. With
// TEST_DATABASE_URL all files share one real database (each wipes it), so files must run serially.
export default defineConfig({
  test: {
    hookTimeout: 60_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
})
