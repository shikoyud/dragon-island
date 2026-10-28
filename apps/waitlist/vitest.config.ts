import { defineConfig } from 'vitest/config'

// Each test file boots an in-process PGlite (WASM Postgres), which takes a few seconds.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    hookTimeout: 60_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
})
