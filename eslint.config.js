import {configs, defineConfig} from '@sadim/eslint';

export default defineConfig({
  ignores: ['apps', 'packages', '**/dist/**'],
  extends: [...configs.base],
});
