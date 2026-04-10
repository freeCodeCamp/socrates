import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    exclude: ['dist/**', 'node_modules/**'],
    setupFiles: ['src/__tests__/setup.ts'],
  },
});
