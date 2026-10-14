import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5199, strictPort: true },
  build: { chunkSizeWarningLimit: 2000 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
