import {configs, defineConfig} from '@ecs-pcl/eslint';

export default defineConfig(
  ...configs.base,
  ...configs.react,
  ...configs.storybook,
);
