import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the build works from any static path (GitHub Pages project site).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2020', sourcemap: false },
  test: { include: ['src/tests/**/*.test.ts'], environment: 'node' },
});
