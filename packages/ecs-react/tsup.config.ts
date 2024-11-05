import type { Options } from 'tsup';

import { defineConfig } from 'tsup';

export default defineConfig((options: Options) => ({
  entry: ['./src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  ...options,
}));
