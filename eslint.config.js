import { configs, defineConfig } from '@ecs-pcl/eslint';

export default defineConfig({
  ignores: ['apps', 'packages', '**/dist/**'],
  extends: [...configs.base],
});
