import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The website's `@/` imports, for its pure helpers under apps/web/test.
    alias: { '@': fileURLToPath(new URL('./apps/web', import.meta.url)) },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'scripts/**/*.test.ts', 'apps/web/test/**/*.test.ts'],
  },
});
