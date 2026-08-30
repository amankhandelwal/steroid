import { defineConfig } from 'vitest/config';

/**
 * Test-only config, kept separate from `vite.config.ts` so the extension build
 * stays free of test concerns. Tests live outside `src/` so `tsc --noEmit`
 * (which only includes `src`) is unaffected by test-runner globals.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true
  }
});
