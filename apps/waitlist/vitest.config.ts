import { defineConfig } from 'vitest/config'

// Each test file boots an in-process PGlite (WASM Postgres), which takes a few seconds.
export default defineConfig({
  // tsconfig keeps jsx: preserve for Next; tests need it compiled.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    hookTimeout: 60_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
})
