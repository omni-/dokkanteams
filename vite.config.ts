import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// Served from the root of builder.dokkandle.net, so the default base of '/' is right.
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
